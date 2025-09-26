import json
import warnings
warnings.filterwarnings('ignore')

try:
    from transformers import pipeline
    import torch
    print("✅ Transformers imported successfully")
except ImportError as e:
    print(f"❌ Failed to import transformers: {e}")
    print("Try: pip install transformers torch")
    exit(1)

# Load model once
classifier = pipeline(
    "text-classification",
    model="j-hartmann/emotion-english-distilroberta-base",
    top_k=None,
    device=0 if torch.cuda.is_available() else -1
)

emoji_map = {
    'joy': '😊',
    'sadness': '😢', 
    'anger': '😠',
    'fear': '😰',
    'surprise': '😲',
    'disgust': '🤢',
    'neutral': '😐'
}

def classify_emotion(text):
    """Classify emotions in a given text chunk."""
    emotions = classifier(text)
    # Sort by confidence
    sorted_emotions = sorted(emotions[0], key=lambda x: x['score'], reverse=True)
    return sorted_emotions

def run_on_json(json_path):
    """Run emotion classification on all chunks in the given JSON file."""
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    print(f"\n📄 Processing Transcript ID: {data['transcriptId']}\n")
    results = []

    for chunk in data['chunks']:
        text = chunk['text']
        chunk_id = chunk['id']

        print("="*60)
        print(f"📝 Analyzing Chunk ID: {chunk_id} (timestamp: {chunk['timestamp']})")
        print(f"Text: {text}\n")

        emotions = classify_emotion(text)

        # Print bar-like result
        print("🎭 Emotion Analysis Results:")
        print("-" * 30)
        for emotion in emotions:
            confidence = emotion['score']
            label = emotion['label']
            emoji = emoji_map.get(label, '❓')
            bar_length = int(confidence * 20)
            bar = '█' * bar_length + '░' * (20 - bar_length)
            print(f"{emoji} {label.capitalize():>8}: {confidence:.4f} |{bar}|")

        # Save results
        results.append({
            "chunk_id": chunk_id,
            "text": text,
            "emotions": emotions
        })
        print()

    return results

if __name__ == "__main__":
    json_file_path = "test.json"   # 👈 Use test.json
    final_results = run_on_json(json_file_path)

    # Save results to a new JSON
    with open("emotion_results.json", 'w', encoding='utf-8') as f:
        json.dump(final_results, f, indent=4, ensure_ascii=False)
    print("\n✅ All chunks processed. Results saved to 'emotion_results.json'")
