import random
from google import genai

# --- CONFIG ---
GEMINI_API_KEY = "AIzaSyBHwyVyViAoCUQuRLaYVFMAogc5wyxWVlI"
client = genai.Client(api_key=GEMINI_API_KEY)

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

# --- Decide Agent via Gemini ---
def decide_agent(outputs):
    prompt = f"""
You are a supervisor agent. The user audio was analyzed by 3 models:
Sentiment: {outputs['sentiment'][0]} (Confidence: {outputs['sentiment'][1]})
Emotion: {outputs['emotion'][0]} (Confidence: {outputs['emotion'][1]})
Tone: {outputs['tone'][0]} (Confidence: {outputs['tone'][1]})

Decide which agent should handle the user:
- EmergencyAgent: for suicidal or crisis situations
- TherapistAgent: for therapy, support, or emotional guidance
- ChatAgent: for casual conversation

Respond with the agent name only.
"""
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt
    )
    agent = response.text.strip()
    return agent

# --- Main Orchestration ---
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

# --- Interactive CLI ---
if __name__ == "__main__":
    print("Agentic Audio AI Orchestration (Gemini)")
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