import warnings
warnings.filterwarnings('ignore')

try:
    from transformers import pipeline
    print("✅ Transformers imported successfully")
except ImportError as e:
    print(f"❌ Failed to import transformers: {e}")
    print("Try: pip install transformers torch")
    exit(1)

def classify_emotion(text):
    """Classify emotions in text using DistilRoBERTa model"""
    try:
        # Initialize the emotion classifier
        classifier = pipeline(
            "text-classification", 
            model="j-hartmann/emotion-english-distilroberta-base", 
            top_k=None,
            device=0 if torch.cuda.is_available() else -1  # Use GPU if available
        )
        
        print(f"📝 Analyzing text: '{text}'")
        emotions = classifier(text)
        
        print("\n🎭 Emotion Analysis Results:")
        print("-" * 30)
        
        # Sort by confidence score (highest first)
        sorted_emotions = sorted(emotions[0], key=lambda x: x['score'], reverse=True)
        
        for emotion in sorted_emotions:
            confidence = emotion['score']
            label = emotion['label']
            
            # Add emoji based on emotion
            emoji_map = {
                'joy': '😊',
                'sadness': '😢', 
                'anger': '😠',
                'fear': '😰',
                'surprise': '😲',
                'disgust': '🤢',
                'neutral': '😐'
            }
            
            emoji = emoji_map.get(label, '❓')
            bar_length = int(confidence * 20)  # Scale for visual bar
            bar = '█' * bar_length + '░' * (20 - bar_length)
            
            print(f"{emoji} {label.capitalize():>8}: {confidence:.4f} |{bar}|")
            
        return sorted_emotions
        
    except Exception as e:
        print(f"❌ Error during emotion classification: {e}")
        return None

def main():
    # Test with your example
    test_texts = [
        "I want to cwetch someone so hard that they never become opposite of happy!",
        "This is the worst day ever.",
        "I'm so excited for the weekend!",
        "I don't really care either way.",
        "The tears of happiness from my eyes were like a river flowing down my cheeks.",
    ]
    
    for text in test_texts:
        print("\n" + "="*50)
        classify_emotion(text)
        print()

if __name__ == "__main__":
    # Check if torch is available (optional but recommended)
    try:
        import torch
        if torch.cuda.is_available():
            print(f"🚀 CUDA available: {torch.cuda.get_device_name(0)}")
        else:
            print("💻 Using CPU for inference")
    except ImportError:
        print("⚠️  PyTorch not found, using CPU")
    
    main()