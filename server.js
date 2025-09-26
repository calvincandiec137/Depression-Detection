// server.js - Secure STT Backend for Depression Detection
const express = require('express');
const multer = require('multer');
const FormData = require('form-data');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// ⚠️ IMPORTANT: Replace with your actual ElevenLabs API key
const ELEVENLABS_API_KEY = 'sk_3199c10427d5c8cf1f7a573b8bb0bb8bf606371cc8560755';

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Configure multer for file uploads
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Root route - serve HTML file
app.get('/', (req, res) => {
    const htmlPath = path.join(__dirname, 'public', 'index.html');
    
    // Check if HTML file exists
    if (fs.existsSync(htmlPath)) {
        res.sendFile(htmlPath);
    } else {
        // If HTML file doesn't exist, create a simple one
        res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>STT Server Running</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; background: #f0f0f0; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; }
        .error { color: #e74c3c; background: #fdf2f2; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .success { color: #27ae60; background: #f2fdf2; padding: 15px; border-radius: 5px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎙️ STT Server is Running!</h1>
        <div class="error">
            <strong>HTML File Not Found!</strong><br>
            Please create <code>public/index.html</code> with your front-end code.
        </div>
        <h3>Setup Instructions:</h3>
        <ol>
            <li>Create a <code>public</code> folder in your project directory</li>
            <li>Save your HTML file as <code>public/index.html</code></li>
            <li>Refresh this page</li>
        </ol>
        <h3>Server Status:</h3>
        <div class="success">✅ Server running on port ${PORT}</div>
        <div class="${ELEVENLABS_API_KEY === 'your-elevenlabs-api-key-here' ? 'error' : 'success'}">
            ${ELEVENLABS_API_KEY === 'your-elevenlabs-api-key-here' ? '❌ API Key not configured' : '✅ API Key configured'}
        </div>
    </div>
</body>
</html>
        `);
    }
});

// Main transcription endpoint
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
    console.log('📥 Received transcription request');
    
    try {
        // Validate request
        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: 'No audio file provided'
            });
        }

        if (!ELEVENLABS_API_KEY || ELEVENLABS_API_KEY === 'your-elevenlabs-api-key-here') {
            return res.status(500).json({
                success: false,
                error: 'ElevenLabs API key not configured'
            });
        }

        console.log(`📊 Processing audio file: ${req.file.size} bytes, type: ${req.file.mimetype}`);

        // Prepare form data for ElevenLabs
        const formData = new FormData();
        formData.append('file', req.file.buffer, {
            filename: 'recording.wav',
            contentType: 'audio/wav'
        });
    formData.append('model_id', 'scribe_v1');
        formData.append('language', 'en');

        console.log('🚀 Sending to ElevenLabs STT API...');

        // Call ElevenLabs STT API
        const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
            method: 'POST',
            headers: {
                'xi-api-key': ELEVENLABS_API_KEY,
                ...formData.getHeaders()
            },
            body: formData
        });

        console.log(`📡 ElevenLabs response status: ${response.status}`);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ ElevenLabs API error:', errorText);
            
            return res.status(response.status).json({
                success: false,
                error: `ElevenLabs API error: ${response.status} - ${errorText}`
            });
        }

        const result = await response.json();
        console.log('✅ Transcription successful');

        // Basic depression analysis
        const analysisResult = analyzeForDepression(result.text || '');

        res.json({
            success: true,
            transcript: result.text || 'No speech detected',
            analysis: analysisResult,
            metadata: {
                audioSize: req.file.size,
                processingTime: Date.now()
            }
        });

    } catch (error) {
        console.error('💥 Server error:', error);
        res.status(500).json({
            success: false,
            error: `Server error: ${error.message}`
        });
    }
});

// Depression analysis function
function analyzeForDepression(transcript) {
    if (!transcript || transcript.length === 0) {
        return {
            riskScore: 0,
            indicators: [],
            analysis: 'No text to analyze'
        };
    }

    const depressiveKeywords = [
        'sad', 'depressed', 'hopeless', 'tired', 'exhausted', 'worthless',
        'empty', 'anxious', 'worried', 'lonely', 'isolated', 'helpless',
        'overwhelmed', 'stressed', 'pain', 'hurt', 'suffering', 'difficult'
    ];

    const positiveKeywords = [
        'happy', 'excited', 'motivated', 'energetic', 'confident',
        'hopeful', 'grateful', 'joyful', 'optimistic', 'content',
        'pleased', 'satisfied', 'accomplished', 'successful', 'good'
    ];

    const words = transcript.toLowerCase().split(/\s+/);
    const totalWords = words.length;

    const depressiveMatches = words.filter(word => 
        depressiveKeywords.some(keyword => word.includes(keyword))
    );

    const positiveMatches = words.filter(word => 
        positiveKeywords.some(keyword => word.includes(keyword))
    );

    const depressiveCount = depressiveMatches.length;
    const positiveCount = positiveMatches.length;

    // Calculate risk score (0-1)
    let riskScore = 0;
    if (totalWords > 0) {
        const depressiveRatio = depressiveCount / totalWords;
        const positiveRatio = positiveCount / totalWords;
        riskScore = Math.max(0, Math.min(1, (depressiveRatio * 3) - (positiveRatio * 1.5)));
    }

    // Determine risk level
    let riskLevel = 'Low';
    if (riskScore > 0.7) riskLevel = 'High';
    else if (riskScore > 0.4) riskLevel = 'Moderate';

    const indicators = [];
    if (depressiveCount > 0) {
        indicators.push(`Depressive language detected (${depressiveCount} instances)`);
    }
    if (positiveCount > 0) {
        indicators.push(`Positive language detected (${positiveCount} instances)`);
    }
    if (totalWords < 10) {
        indicators.push('Limited speech sample');
    }

    return {
        riskScore: Math.round(riskScore * 100) / 100,
        riskLevel,
        indicators,
        wordCount: totalWords,
        depressiveWords: depressiveMatches,
        positiveWords: positiveMatches,
        analysis: `Risk Level: ${riskLevel} (Score: ${Math.round(riskScore * 100)}%)`
    };
}

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        apiConfigured: ELEVENLABS_API_KEY !== 'your-elevenlabs-api-key-here'
    });
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('💥 Unhandled error:', error);
    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
});

// Start server
app.listen(PORT, () => {
    console.log('🎙️ Depression Detection STT Server');
    console.log('=====================================');
    console.log(`🌐 Server running on http://localhost:${PORT}`);
    console.log(`🔑 API Key configured: ${ELEVENLABS_API_KEY !== 'your-elevenlabs-api-key-here' ? '✅ Yes' : '❌ No'}`);
    console.log('📁 Place your HTML file in /public/index.html');
    console.log('=====================================');
    
    if (ELEVENLABS_API_KEY === 'your-elevenlabs-api-key-here') {
        console.log('⚠️  WARNING: Please set your ElevenLabs API key in server.js');
    }
});