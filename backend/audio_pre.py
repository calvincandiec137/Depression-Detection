import os
import torch
import librosa
import soundfile as sf
import pyloudnorm as pyln
from asteroid.models import ConvTasNet

# Load Asteroid pretrained speech separation model
# This one is trained for speech enhancement
model = ConvTasNet.from_pretrained("mpariente/ConvTasNet_Libri2Mix_sepclean")

def load_audio(path, target_sr=16000):
    y, sr = librosa.load(path, sr=target_sr, mono=True)
    return y, sr

def loudness_normalize(y, sr, target_lufs=-23.0):
    meter = pyln.Meter(sr)
    loudness = meter.integrated_loudness(y)
    return pyln.normalize.loudness(y, loudness, target_lufs)

def enhance_audio(input_path, output_path):
    # Load audio
    y, sr = load_audio(input_path, target_sr=16000)

    # Convert to tensor for Asteroid
    wav_tensor = torch.tensor(y).unsqueeze(0)

    # Run speech enhancement
    with torch.no_grad():
        enhanced = model.separate(wav_tensor)[0, 0].cpu().numpy()

    # Loudness normalize
    enhanced_norm = loudness_normalize(enhanced, sr)

    # Save
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    sf.write(output_path, enhanced_norm, sr)
    print(f"Enhanced audio saved at: {output_path}")
    return output_path

if __name__ == "__main__":
    inp = "input.wav"
    out = "enhanced/output.wav"
    enhance_audio(inp, out)
