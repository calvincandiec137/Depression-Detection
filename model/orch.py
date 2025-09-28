import random
from elevenlabs import ElevenLabs
import google.generativeai as genai

# --- CONFIG ---
ELEVENLABS_API_KEY = "better_luck_next_time"
GEMINI_API_KEY = "better_luck_next_time"

# Initialize ElevenLabs client
eleven_client = ElevenLabs(api_key=ELEVENLABS_API_KEY)
genai.configure(api_key=GEMINI_API_KEY)

# Gemini LLM wrapper
def gemini_chat(prompt):
    model = genai.GenerativeModel("gemini-2.5-pro")
    response = model.generate_content(prompt)
    return response.text if response else "No response"

# --- Mock Models ---
def mock_transcribe(audio_path):
    return "I feel very sad and anxious today."

def mock_sentiment_model(text):
    labels = ["Normal", "Anxiety", "Depression", "Suicidal"]
    label = random.choice(labels)
    confidence = round(random.uniform(0.5, 0.99), 2)
    return label, confidence

def mock_emotion_model(text):
    emotions = ["Happy", "Sad", "Angry", "Fearful", "Neutral"]
    emotion = random.choice(emotions)
    confidence = round(random.uniform(0.5, 0.99), 2)
    return emotion, confidence

def mock_tone_model(audio_path):
    tones = ["Calm", "Irritated", "Anxious", "Excited", "Neutral"]
    tone = random.choice(tones)
    confidence = round(random.uniform(0.5, 0.99), 2)
    return tone, confidence

# --- Agent Decision ---
def decide_agent(outputs):
    prompt = f"""
The user audio analysis:
Sentiment: {outputs['sentiment'][0]} (Confidence: {outputs['sentiment'][1]})
Emotion: {outputs['emotion'][0]} (Confidence: {outputs['emotion'][1]})
Tone: {outputs['tone'][0]} (Confidence: {outputs['tone'][1]})

Decide which agent should handle the user:
- EmergencyAgent: for suicidal or crisis situations
- TherapistAgent: for therapy, support, or emotional guidance
- ChatAgent: for casual conversation

Respond with the agent name only.
"""
    return gemini_chat(prompt).strip()

# --- Orchestration ---
def process_audio(audio_path):
    text = mock_transcribe(audio_path)
    sentiment = mock_sentiment_model(text)
    emotion = mock_emotion_model(text)
    tone = mock_tone_model(audio_path)

    outputs = {
        "text": text,
        "sentiment": sentiment,
        "emotion": emotion,
        "tone": tone
    }

    agent = decide_agent(outputs)
    return agent, outputs

# --- Text-to-Speech ---
def speak_text(text):
    voices = eleven_client.list_voices()
    voice_id = voices[0].voice_id
    audio = eleven_client.generate(text=text, voice=voice_id)
    eleven_client.play(audio)

# --- CLI ---
if __name__ == "__main__":
    print("Agentic Audio AI Orchestration (Gemini + ElevenLabs)")
    print("Type 'quit' to exit.\n")

    while True:
        audio_path = input("Enter path to audio file: ").strip()
        if audio_path.lower() in ["quit", "exit", "q"]:
            break

        agent, outputs = process_audio(audio_path)

        print("\n--- Analysis ---")
        print(f"Transcribed Text: {outputs['text']}")
        print(f"Sentiment: {outputs['sentiment'][0]} (Confidence: {outputs['sentiment'][1]})")
        print(f"Emotion: {outputs['emotion'][0]} (Confidence: {outputs['emotion'][1]})")
        print(f"Tone: {outputs['tone'][0]} (Confidence: {outputs['tone'][1]})")
        print(f"Recommended Agent: {agent}\n")

        speak_text(f"Recommended agent is {agent}. User text: {outputs['text']}")
