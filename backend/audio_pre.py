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
    Handles both MP3 and WAV files with multiple preprocessing options.
    """
    
    def __init__(self, target_sr=16000, min_silence_duration=0.5):
        """
        Initialize the preprocessor.
        
        Args:
            target_sr (int): Target sample rate (16000Hz or 22050Hz recommended for speech)
            min_silence_duration (float): Minimum silence duration in seconds to split segments
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
        Remove background noise from audio.
        
        Args:
            audio (np.array): Input audio signal
            sr (int): Sample rate
            method (str): 'stationary' or 'nonstationary'
            
        Returns:
            cleaned_audio (np.array): Denoised audio
        """
        try:
            if method == 'stationary':
                # Requires a noise sample (first 0.5 seconds assumed to be noise)
                noise_duration = min(int(0.5 * sr), len(audio) // 3)
                noise_sample = audio[:noise_duration]
                cleaned_audio = nr.reduce_noise(y=audio, y_noise=noise_sample, sr=sr)
            else:
                # Non-stationary noise reduction (no need for noise sample)
                cleaned_audio = nr.reduce_noise(y=audio, sr=sr, stationary=False)
            
            print(f"✅ Noise reduction applied ({method} method)")
            return cleaned_audio
            
        except Exception as e:
            print(f"❌ Error in noise reduction: {e}")
            return audio
    
    def remove_silence(self, audio, sr, top_db=25, min_silence_len=0.3):
        """
        Remove silent portions from audio using Voice Activity Detection.
        
        Args:
            audio (np.array): Input audio signal
            sr (int): Sample rate
            top_db (int): Threshold in dB below reference for silence
            min_silence_len (float): Minimum silence length in seconds
            
        Returns:
            non_silent_audio (np.array): Audio with silence removed
            segments (list): List of non-silent segments [(start, end), ...]
        """
        try:
            # Convert min_silence_len to samples
            min_silence_samples = int(min_silence_len * sr)
            
            # Find non-silent intervals
            non_silent_intervals = librosa.effects.split(
                audio, top_db=top_db, frame_length=1024, hop_length=256
            )
            
            # Filter out very short segments (likely noise)
            valid_intervals = []
            for start, end in non_silent_intervals:
                duration = (end - start) / sr
                if duration >= 0.1:  # Keep segments longer than 0.1 seconds
                    valid_intervals.append((start, end))
            
            if len(valid_intervals) == 0:
                print("⚠️ No non-silent segments found. Returning original audio.")
                return audio, [(0, len(audio))]
            
            # Concatenate non-silent intervals
            non_silent_audio = np.concatenate([audio[start:end] for start, end in valid_intervals])
            
            print(f"✅ Silence removal: {len(non_silent_intervals)} segments found")
            print(f"   Original duration: {len(audio)/sr:.2f}s, After VAD: {len(non_silent_audio)/sr:.2f}s")
            
            return non_silent_audio, valid_intervals
            
        except Exception as e:
            print(f"❌ Error in silence removal: {e}")
            return audio, [(0, len(audio))]
    
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
    
    def preprocess_audio(self, file_path, steps=['load', 'denoise', 'vad', 'normalize', 'filter']):
        """
        Complete preprocessing pipeline for audio files.
        
        Args:
            file_path (str): Path to audio file
            steps (list): List of preprocessing steps to apply
            
        Returns:
            result (dict): Dictionary containing processed audio and metadata
        """
        print(f"🎯 Starting preprocessing pipeline for: {file_path}")
        print("-" * 50)
        
        result = {
            'original_audio': None,
            'processed_audio': None,
            'sample_rate': self.target_sr,
            'segments': [],
            'processing_steps': [],
            'duration_original': 0,
            'duration_processed': 0
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
            
            current_audio = audio.copy()
            
            # Step 2: Denoise
            if 'denoise' in steps:
                current_audio = self.remove_background_noise(current_audio, sr)
                result['processing_steps'].append('denoised')
            
            # Step 3: Voice Activity Detection (remove silence)
            if 'vad' in steps:
                current_audio, segments = self.remove_silence(current_audio, sr)
                result['segments'] = segments
                result['processing_steps'].append('silence_removed')
            
            # Step 4: Normalize
            if 'normalize' in steps:
                current_audio = self.normalize_audio(current_audio)
                result['processing_steps'].append('normalized')
            
            # Step 5: Bandpass filter
            if 'filter' in steps:
                current_audio = self.apply_bandpass_filter(current_audio, sr)
                result['processing_steps'].append('filtered')
            
            result['processed_audio'] = current_audio
            result['duration_processed'] = len(current_audio) / sr
            
            print("-" * 50)
            print(f"✅ Preprocessing completed!")
            print(f"📊 Original duration: {result['duration_original']:.2f}s")
            print(f"📊 Processed duration: {result['duration_processed']:.2f}s")
            print(f"🔧 Steps applied: {', '.join(result['processing_steps'])}")
            
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
    
    def visualize_audio(self, original_audio, processed_audio, sr, title="Audio Comparison"):
        """
        Visualize original vs processed audio.
        
        Args:
            original_audio (np.array): Original audio signal
            processed_audio (np.array): Processed audio signal
            sr (int): Sample rate
            title (str): Plot title
        """
        fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 8))
        
        # Plot original audio
        times_orig = np.arange(len(original_audio)) / sr
        ax1.plot(times_orig, original_audio, alpha=0.7)
        ax1.set_title(f'{title} - Original Audio')
        ax1.set_ylabel('Amplitude')
        ax1.grid(True)
        
        # Plot processed audio
        times_proc = np.arange(len(processed_audio)) / sr
        ax2.plot(times_proc, processed_audio, alpha=0.7, color='orange')
        ax2.set_title('Processed Audio')
        ax2.set_xlabel('Time (s)')
        ax2.set_ylabel('Amplitude')
        ax2.grid(True)
        
        plt.tight_layout()
        plt.show()

# Example usage and testing
def main():
    """Example usage of the AudioPreprocessor class."""
    
    # Initialize preprocessor
    preprocessor = AudioPreprocessor(target_sr=16000)
    
    # Example with a test file (you would replace this with your actual file paths)
    test_files = [
        "whats.wav",  # Replace with your WAV file
        "sample_audio.mp3",  # Replace with your MP3 file
    ]
    
    for file_path in test_files:
        if os.path.exists(file_path):
            print(f"\n🎯 Processing: {file_path}")
            
            # Apply complete preprocessing pipeline
            result = preprocessor.preprocess_audio(
                file_path,
                steps=['load', 'denoise', 'vad', 'normalize', 'filter']
            )
            
            if result is not None:
                # Save processed audio
                output_path = f"processed_{os.path.basename(file_path).split('.')[0]}.wav"
                preprocessor.save_processed_audio(
                    result['processed_audio'], 
                    result['sample_rate'], 
                    output_path
                )
                
                # Visualize results
                preprocessor.visualize_audio(
                    result['original_audio'],
                    result['processed_audio'],
                    result['sample_rate'],
                    title=f"Audio Preprocessing: {file_path}"
                )
        else:
            print(f"⚠️ File not found: {file_path}")
            print("💡 Please update the file paths in the main() function")

if __name__ == "__main__":
    main()