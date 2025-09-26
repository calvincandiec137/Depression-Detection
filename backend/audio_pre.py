import librosa
import librosa.display
import noisereduce as nr
import numpy as np
import soundfile as sf
from pydub import AudioSegment
import matplotlib.pyplot as plt
from scipy import signal
import os

class AudioPreprocessor:
    """
    A comprehensive audio preprocessor for depression detection from voice analysis.
    Preserves gaps/silences for sentiment and behavioral analysis.
    """
    
    def __init__(self, target_sr=16000, min_silence_duration=0.5):
        """
        Initialize the preprocessor.
        
        Args:
            target_sr (int): Target sample rate (16000Hz or 22050Hz recommended for speech)
            min_silence_duration (float): Minimum silence duration in seconds to consider as meaningful gap
        """
        self.target_sr = target_sr
        self.min_silence_duration = min_silence_duration
        
    def load_audio(self, file_path):
        """
        Load audio file (MP3 or WAV) and convert to standardized format.
        
        Args:
            file_path (str): Path to audio file
            
        Returns:
            audio (np.array): Audio time series
            sr (int): Sample rate
        """
        try:
            # Check file extension
            file_ext = os.path.splitext(file_path)[1].lower()
            
            if file_ext == '.mp3':
                # For MP3 files, use pydub for better compatibility
                audio = AudioSegment.from_mp3(file_path)
                audio = audio.set_channels(1)  # Convert to mono
                audio = audio.set_frame_rate(self.target_sr)  # Resample
                
                # Export to temporary WAV and load with librosa
                temp_path = "temp_audio.wav"
                audio.export(temp_path, format="wav")
                audio_data, sr = librosa.load(temp_path, sr=self.target_sr)
                os.remove(temp_path)  # Clean up temp file
                
            else:  # WAV and other formats
                audio_data, sr = librosa.load(file_path, sr=self.target_sr, mono=True)
                
            print(f"✅ Loaded audio: {file_path}")
            print(f"   Duration: {len(audio_data)/sr:.2f}s, Sample rate: {sr}Hz")
            return audio_data, sr
            
        except Exception as e:
            print(f"❌ Error loading audio file: {e}")
            return None, None
    
    def remove_background_noise(self, audio, sr, method='nonstationary'):
        """
        Remove background noise from audio while preserving speech gaps.
        
        Args:
            audio (np.array): Input audio signal
            sr (int): Sample rate
            method (str): 'stationary' or 'nonstationary'
            
        Returns:
            cleaned_audio (np.array): Denoised audio with preserved gaps
        """
        try:
            if method == 'stationary':
                # Requires a noise sample (use a segment with only background noise)
                noise_duration = min(int(0.5 * sr), len(audio) // 3)
                noise_sample = audio[:noise_duration]
                cleaned_audio = nr.reduce_noise(y=audio, y_noise=noise_sample, sr=sr)
            else:
                # Non-stationary noise reduction - preserves silence/gap structure
                cleaned_audio = nr.reduce_noise(y=audio, sr=sr, stationary=False)
            
            print(f"✅ Noise reduction applied ({method} method)")
            return cleaned_audio
            
        except Exception as e:
            print(f"❌ Error in noise reduction: {e}")
            return audio
    
    def analyze_silence_patterns(self, audio, sr, top_db=25):
        """
        Analyze silence patterns without removing them.
        Returns timestamps and durations of speech and silence segments.
        
        Args:
            audio (np.array): Input audio signal
            sr (int): Sample rate
            top_db (int): Threshold in dB below reference for silence
            
        Returns:
            segments (list): List of segments with type and timing information
            silence_stats (dict): Statistics about silence patterns
        """
        try:
            # Find non-silent intervals (speech segments)
            non_silent_intervals = librosa.effects.split(
                audio, top_db=top_db, frame_length=1024, hop_length=256
            )
            
            segments = []
            silence_durations = []
            speech_durations = []
            
            # Add initial silence if present
            if non_silent_intervals[0][0] > 0:
                silence_dur = non_silent_intervals[0][0] / sr
                segments.append({'type': 'silence', 'start': 0, 'end': non_silent_intervals[0][0], 
                               'duration': silence_dur})
                silence_durations.append(silence_dur)
            
            # Process each speech segment and following silence
            for i, (start, end) in enumerate(non_silent_intervals):
                # Speech segment
                speech_dur = (end - start) / sr
                segments.append({'type': 'speech', 'start': start, 'end': end, 
                               'duration': speech_dur})
                speech_durations.append(speech_dur)
                
                # Following silence (if any)
                if i < len(non_silent_intervals) - 1:
                    next_start = non_silent_intervals[i+1][0]
                    silence_dur = (next_start - end) / sr
                    segments.append({'type': 'silence', 'start': end, 'end': next_start, 
                                   'duration': silence_dur})
                    silence_durations.append(silence_dur)
            
            # Add final silence if present
            if non_silent_intervals[-1][1] < len(audio):
                silence_dur = (len(audio) - non_silent_intervals[-1][1]) / sr
                segments.append({'type': 'silence', 'start': non_silent_intervals[-1][1], 
                               'end': len(audio), 'duration': silence_dur})
                silence_durations.append(silence_dur)
            
            # Calculate statistics
            silence_stats = {
                'total_silence_time': sum(silence_durations),
                'total_speech_time': sum(speech_durations),
                'average_silence_duration': np.mean(silence_durations) if silence_durations else 0,
                'average_speech_duration': np.mean(speech_durations) if speech_durations else 0,
                'silence_count': len(silence_durations),
                'speech_count': len(speech_durations),
                'speech_to_silence_ratio': sum(speech_durations) / sum(silence_durations) if sum(silence_durations) > 0 else float('inf'),
                'longest_silence': max(silence_durations) if silence_durations else 0,
                'longest_speech': max(speech_durations) if speech_durations else 0
            }
            
            print(f"✅ Silence pattern analysis complete")
            print(f"   Speech segments: {len(speech_durations)}, Silence segments: {len(silence_durations)}")
            print(f"   Total speech: {silence_stats['total_speech_time']:.2f}s, Total silence: {silence_stats['total_silence_time']:.2f}s")
            
            return segments, silence_stats
            
        except Exception as e:
            print(f"❌ Error in silence pattern analysis: {e}")
            return [], {}
    
    def clean_audio_preserving_gaps(self, audio, sr):
        """
        Clean audio while preserving the gap structure for sentiment analysis.
        
        Args:
            audio (np.array): Input audio signal
            sr (int): Sample rate
            
        Returns:
            cleaned_audio (np.array): Cleaned audio with preserved gaps
            segments (list): Segment information
            silence_stats (dict): Silence pattern statistics
        """
        try:
            # First, analyze the silence patterns
            segments, silence_stats = self.analyze_silence_patterns(audio, sr)
            
            # Apply noise reduction to entire audio (preserves gap structure)
            cleaned_audio = self.remove_background_noise(audio, sr)
            
            # Apply bandpass filter to focus on speech frequencies
            filtered_audio = self.apply_bandpass_filter(cleaned_audio, sr)
            
            # Normalize the audio
            normalized_audio = self.normalize_audio(filtered_audio)
            
            print("✅ Audio cleaned while preserving gap structure")
            return normalized_audio, segments, silence_stats
            
        except Exception as e:
            print(f"❌ Error in gap-preserving cleaning: {e}")
            return audio, [], {}
    
    def normalize_audio(self, audio, method='peak'):
        """
        Normalize audio amplitude.
        
        Args:
            audio (np.array): Input audio signal
            method (str): 'peak' (to ±1.0) or 'rms' (root mean square)
            
        Returns:
            normalized_audio (np.array): Normalized audio
        """
        try:
            if method == 'peak':
                # Peak normalization to ±1.0
                max_val = np.max(np.abs(audio))
                if max_val > 0:
                    normalized_audio = audio / max_val
                else:
                    normalized_audio = audio
            else:  # RMS normalization
                rms = np.sqrt(np.mean(audio**2))
                if rms > 0:
                    normalized_audio = audio / rms
                else:
                    normalized_audio = audio
            
            print(f"✅ Audio normalized ({method} method)")
            return normalized_audio
            
        except Exception as e:
            print(f"❌ Error in audio normalization: {e}")
            return audio
    
    def apply_bandpass_filter(self, audio, sr, lowcut=80, highcut=4000):
        """
        Apply bandpass filter to focus on human speech frequencies.
        
        Args:
            audio (np.array): Input audio signal
            sr (int): Sample rate
            lowcut (int): Low cutoff frequency (Hz)
            highcut (int): High cutoff frequency (Hz)
            
        Returns:
            filtered_audio (np.array): Bandpass filtered audio
        """
        try:
            # Design bandpass filter
            nyquist = 0.5 * sr
            low = lowcut / nyquist
            high = highcut / nyquist
            
            # Butterworth filter
            b, a = signal.butter(4, [low, high], btype='band')
            filtered_audio = signal.filtfilt(b, a, audio)
            
            print(f"✅ Bandpass filter applied ({lowcut}-{highcut}Hz)")
            return filtered_audio
            
        except Exception as e:
            print(f"❌ Error in bandpass filtering: {e}")
            return audio
    
    def preprocess_audio(self, file_path, preserve_gaps=True, steps=['load', 'denoise', 'normalize', 'filter']):
        """
        Complete preprocessing pipeline for audio files.
        
        Args:
            file_path (str): Path to audio file
            preserve_gaps (bool): Whether to preserve silence gaps for analysis
            steps (list): List of preprocessing steps to apply
            
        Returns:
            result (dict): Dictionary containing processed audio and metadata
        """
        print(f"🎯 Starting preprocessing pipeline for: {file_path}")
        print(f"📝 Gap preservation: {'ENABLED' if preserve_gaps else 'DISABLED'}")
        print("-" * 50)
        
        result = {
            'original_audio': None,
            'processed_audio': None,
            'sample_rate': self.target_sr,
            'segments': [],
            'silence_stats': {},
            'processing_steps': [],
            'duration_original': 0,
            'duration_processed': 0,
            'preserve_gaps': preserve_gaps
        }
        
        try:
            # Step 1: Load audio
            if 'load' in steps:
                audio, sr = self.load_audio(file_path)
                if audio is None:
                    return None
                result['original_audio'] = audio
                result['duration_original'] = len(audio) / sr
                result['processing_steps'].append('loaded')
            
            # Step 2: Choose processing method based on gap preservation setting
            if preserve_gaps:
                # Preserve gaps for sentiment analysis
                current_audio, segments, silence_stats = self.clean_audio_preserving_gaps(audio, sr)
                result['segments'] = segments
                result['silence_stats'] = silence_stats
                result['processing_steps'].extend(['denoised', 'filtered', 'normalized'])
            else:
                # Original method (remove silence)
                current_audio = audio.copy()
                if 'denoise' in steps:
                    current_audio = self.remove_background_noise(current_audio, sr)
                    result['processing_steps'].append('denoised')
                if 'filter' in steps:
                    current_audio = self.apply_bandpass_filter(current_audio, sr)
                    result['processing_steps'].append('filtered')
                if 'normalize' in steps:
                    current_audio = self.normalize_audio(current_audio)
                    result['processing_steps'].append('normalized')
            
            result['processed_audio'] = current_audio
            result['duration_processed'] = len(current_audio) / sr
            
            print("-" * 50)
            print(f"✅ Preprocessing completed!")
            print(f"📊 Original duration: {result['duration_original']:.2f}s")
            print(f"📊 Processed duration: {result['duration_processed']:.2f}s")
            print(f"🔧 Steps applied: {', '.join(result['processing_steps'])}")
            
            if preserve_gaps:
                print(f"🎯 Gap analysis available: {len(result['segments'])} segments")
                print(f"   Speech-to-Silence ratio: {result['silence_stats'].get('speech_to_silence_ratio', 0):.2f}")
            
            return result
            
        except Exception as e:
            print(f"❌ Error in preprocessing pipeline: {e}")
            return None
    
    def save_processed_audio(self, processed_audio, sr, output_path):
        """
        Save processed audio to file.
        
        Args:
            processed_audio (np.array): Processed audio signal
            sr (int): Sample rate
            output_path (str): Output file path
        """
        try:
            sf.write(output_path, processed_audio, sr)
            print(f"💾 Processed audio saved to: {output_path}")
        except Exception as e:
            print(f"❌ Error saving audio: {e}")
    
    def visualize_audio_with_segments(self, original_audio, processed_audio, segments, sr, title="Audio Analysis"):
        """
        Visualize original vs processed audio with segment annotations.
        
        Args:
            original_audio (np.array): Original audio signal
            processed_audio (np.array): Processed audio signal
            segments (list): Segment information
            sr (int): Sample rate
            title (str): Plot title
        """
        fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(14, 10))
        
        # Plot original audio
        times_orig = np.arange(len(original_audio)) / sr
        ax1.plot(times_orig, original_audio, alpha=0.7, color='blue', label='Original')
        ax1.set_title(f'{title} - Original Audio with Segment Analysis')
        ax1.set_ylabel('Amplitude')
        ax1.grid(True)
        ax1.legend()
        
        # Plot processed audio with segment annotations
        times_proc = np.arange(len(processed_audio)) / sr
        ax2.plot(times_proc, processed_audio, alpha=0.7, color='orange', label='Processed')
        
        # Add segment annotations
        for segment in segments:
            start_time = segment['start'] / sr
            end_time = segment['end'] / sr
            if segment['type'] == 'speech':
                ax2.axvspan(start_time, end_time, alpha=0.3, color='green', label='Speech' if 'Speech' not in ax2.get_legend_handles_labels()[1] else "")
            else:
                ax2.axvspan(start_time, end_time, alpha=0.3, color='red', label='Silence' if 'Silence' not in ax2.get_legend_handles_labels()[1] else "")
        
        ax2.set_title('Processed Audio with Speech/Silence Segments')
        ax2.set_xlabel('Time (s)')
        ax2.set_ylabel('Amplitude')
        ax2.grid(True)
        ax2.legend()
        
        plt.tight_layout()
        plt.show()
    
    def export_silence_analysis(self, silence_stats, output_path="silence_analysis.json"):
        """
        Export silence analysis results to JSON file.
        
        Args:
            silence_stats (dict): Silence pattern statistics
            output_path (str): Output file path
        """
        try:
            import json
            with open(output_path, 'w') as f:
                json.dump(silence_stats, f, indent=2)
            print(f"💾 Silence analysis exported to: {output_path}")
        except Exception as e:
            print(f"❌ Error exporting analysis: {e}")

# Example usage and testing
def main():
    """Example usage of the AudioPreprocessor class."""
    
    # Initialize preprocessor
    preprocessor = AudioPreprocessor(target_sr=16000)
    
    # Example with a test file
    test_files = [
        "whats.wav",  # Your WAV file
        # "sample_audio.mp3",  # Your MP3 file
    ]
    
    for file_path in test_files:
        if os.path.exists(file_path):
            print(f"\n🎯 Processing: {file_path}")
            
            # Apply preprocessing WITH gap preservation
            result = preprocessor.preprocess_audio(
                file_path,
                preserve_gaps=True,  # ← This is the key change!
                steps=['load', 'denoise', 'normalize', 'filter']
            )
            
            if result is not None:
                # Save processed audio
                output_path = f"processed_{os.path.basename(file_path).split('.')[0]}.wav"
                preprocessor.save_processed_audio(
                    result['processed_audio'], 
                    result['sample_rate'], 
                    output_path
                )
                
                # Visualize with segment analysis
                preprocessor.visualize_audio_with_segments(
                    result['original_audio'],
                    result['processed_audio'],
                    result['segments'],
                    result['sample_rate'],
                    title=f"Audio Preprocessing: {file_path}"
                )
                
                # Export silence analysis
                preprocessor.export_silence_analysis(
                    result['silence_stats'],
                    f"silence_analysis_{os.path.basename(file_path).split('.')[0]}.json"
                )
                
                # Print key depression-relevant features
                print("\n🎯 Depression-relevant acoustic features:")
                stats = result['silence_stats']
                print(f"   Average pause duration: {stats.get('average_silence_duration', 0):.2f}s")
                print(f"   Speech-to-Silence ratio: {stats.get('speech_to_silence_ratio', 0):.2f}")
                print(f"   Longest pause: {stats.get('longest_silence', 0):.2f}s")
                print(f"   Number of pauses: {stats.get('silence_count', 0)}")
                
        else:
            print(f"⚠️ File not found: {file_path}")

if __name__ == "__main__":
    main()