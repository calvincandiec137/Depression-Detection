# whatIsAnApple: Voice-based Depression Detection

A multi-modal AI system to detect emotional distress and depression from voice analysis.

## Overview

This project is a full-stack application designed to analyze voice recordings to detect early signs of depression. It works by combining acoustic analysis (how something is said) with linguistic analysis (what is said). The system processes audio to extract features like pitch and silence, and simultaneously transcribes the speech to analyze its sentiment and emotion. All these data points are then fused by an AI orchestrator to generate a comprehensive risk assessment.

## Features

  * **Acoustic Feature Extraction**: Analyzes raw audio for pitch (mean, std, monotony index) and silence patterns (average pause duration, speech-to-silence ratio).
  * **Linguistic Sentiment Analysis**: Uses a custom-trained Bi-Directional LSTM model (`.h5`) to classify transcribed text into categories like Anxiety, Depression, or Normal.
  * **Linguistic Emotion Analysis**: Uses a `transformers` pipeline to detect emotions like joy, sadness, and anger from the text.
  * **Agentic AI Orchestration**: Employs a Gemini LLM to receive all inputs (acoustic, sentiment, emotion) and make a final decision, such as dispatching to a specific agent.
  * **Web Interface**: A vanilla JavaScript frontend for user authentication, audio recording, file upload, and a dashboard with `Chart.js` visualizations.

## Tech Stack

  * **Language(s)**: Python, JavaScript (ES6+), HTML5, CSS3
  * **Frameworks**: (N/A)
  * **Libraries**:
      * **Python**: `tensorflow` (Keras), `transformers`, `librosa`, `noisereduce`, `pydub`, `soundfile`, `pandas`, `scikit-learn`, `google-generative-ai`, `elevenlabs`
      * **JavaScript**: `Chart.js`
  * **Tools**: Jupyter Notebook

## Architecture

A brief outline of the project's structure based on the provided files.

```
/
├── /frontend/
│   ├── index.html        (Main web interface)
│   ├── script.js         (Frontend logic, API calls, Chart.js)
│   └── styles.css        (All styling)
│
├── /backend/
│   ├── audio.py          (Core AudioPreprocessor class)
│   └── pitch.py          (Pitch extraction utilities)
│
├── /model/
│   ├── mental_health_model.h5 (Trained Bi-LSTM sentiment model)
│   ├── emotions.py       (Transformer-based emotion classifier)
│   └── orch.py           (Agentic AI orchestrator with Gemini)
│
└── test.ipynb            (Jupyter Notebook for training the .h5 model)
```

## Installation

### Prerequisites

  * Python 3.10+
  * A local web server (e.g., Python's `http.server` or `Live Server` for VSCode)
  * API keys for Google Gemini and ElevenLabs.

### Clone repo

```bash
git clone https://github.com/your-username/whatIsAnApple.git
cd whatIsAnApple
```

### Install dependencies

Create a virtual environment and install the required Python packages.

```bash
python -m venv venv
source venv/bin/activate  # on Windows: venv\Scripts\activate
pip install tensorflow pandas numpy scikit-learn librosa noisereduce pydub soundfile transformers google-generative-ai elevenlabs
```

### Run setup

Create a `.env` file in the root directory and add your API keys.
**Note:** The `orch.py` script currently has keys hardcoded. You must modify it to load from `os.environ` for security.

## Usage

1.  **Run the Frontend**:
    Serve the `/frontend` directory with a local web server.

    ```bash
    # Example using Python's built-in server from the /frontend directory
    cd frontend
    python -m http.server
    ```

    Open your browser to `http://localhost:8000`.

2.  **Run a Backend Script (Example)**:
    You can test the orchestrator (with mock data) by running it directly.

    ```bash
    python model/orch.py
    ```

## Configuration

Environment variables should be set in a `.env` file.

```env
# API keys for AI models and TTS
ELEVENLABS_API_KEY="your_elevenlabs_key_here"
GEMINI_API_KEY="your_gemini_key_here"
```

## API Endpoints (if applicable)

The frontend is configured to call a backend API hosted at a base URL.

  * `POST /upload-audio/`: Endpoint for submitting the audio file for full analysis.
  * `POST /text-output/`: Endpoint for submitting journal text for analysis.
  * `POST /final`: Final endpoint called by the frontend.

## Roadmap

  * **Integrate Live Models**: Replace the mock functions in `model/orch.py` with actual calls to the `mental_health_model.h5` and `emotions.py` classifiers.
  * **Speech-to-Text**: Implement an STT service (e.g., Google Speech-to-Text, Whisper) to bridge the gap between `audio.py` and the linguistic models.
  * **Refactor Frontend**: Break down the monolithic `frontend/script.js` into modular components.
  * **Secure Keys**: Modify `model/orch.py` to load API keys from environment variables instead of hardcoding them.

## Contributing

Please open an issue to discuss any changes or features you wish to add. Pull requests are welcome but should follow a clear description of the changes made.
