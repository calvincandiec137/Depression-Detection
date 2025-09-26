import librosa
import numpy as np
from transformers import pipeline

# Load RoBERTa emotion classification model
emotion_pipeline = pipeline("text-classification", model="j-hartmann/emotion-english-distilroberta-base", return_all_scores=True)

def transcribe_audio(audio_path):
    """Transcribe audio to text using Whisper (you can replace with any ASR model)."""
    from transformers import pipeline
    asr = pipeline("automatic-speech-recognition", model="openai/whisper-small")
    result = asr(audio_path)
    return result["text"]

def analyze_pitch(audio_path):
    """Extracts pitch from an audio file and classifies emotion based on pitch."""
    
    # Load audio
    y, sr = librosa.load(audio_path, sr=16000)

    # Extract fundamental frequency (f0) using librosa's Yin algorithm
    f0 = librosa.yin(y, fmin=85, fmax=300)

    # Remove NaN values and take median pitch
    f0 = f0[~np.isnan(f0)]
    median_pitch = np.median(f0) if len(f0) > 0 else 0

    # Classify emotion based on pitch values
    if median_pitch < 140:
        pitch_emotion = "Calm / Sad / Neutral"
    elif 140 <= median_pitch <= 220:
        pitch_emotion = "Happy / Normal"
    else:
        pitch_emotion = "Excited / Angry / Surprised"

    return median_pitch, pitch_emotion

def analyze_combined_emotion(audio_path):
    """Combines pitch and text-based emotion analysis."""
    
    # Step 1: Transcribe Speech to Text
    text = transcribe_audio(audio_path)
    
    # Step 2: Analyze Text Emotion
    text_emotion_scores = emotion_pipeline(text)
    text_emotion = max(text_emotion_scores[0], key=lambda x: x["score"])["label"]
    
    # Step 3: Analyze Pitch Emotion
    pitch, pitch_emotion = analyze_pitch(audio_path)

    # Step 4: Combine Both Emotion Analyses
    final_emotion = f"Text: {text_emotion}, Pitch: {pitch_emotion}"

    return {
        "transcribed_text": text,
        "text_emotion": text_emotion,
        "pitch": pitch,
        "pitch_emotion": pitch_emotion,
        "final_emotion": final_emotion
    }

# Example usage
audio_path = "input.mp3"
result = analyze_combined_emotion(audio_path)
print(f"\nTranscribed Text: {result['transcribed_text']}")
print(f"Text-based Emotion: {result['text_emotion']}")
print(f"Estimated Pitch: {result['pitch']:.2f} Hz")
print(f"Pitch-based Emotion: {result['pitch_emotion']}")
print(f"Final Emotion Analysis: {result['final_emotion']}")