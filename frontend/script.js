// --- GLOBAL STATE & CONFIGURATION ---

// API Configuration
const API_BASE_URL = 'http://34.31.86.85/toofan';
const UPLOAD_AUDIO_ENDPOINT = `${API_BASE_URL}/upload-audio/`;
const TEXT_ANALYSIS_ENDPOINT = `${API_BASE_URL}/text-output/`;
const finalize = `${API_BASE_URL}/final`;

// Global State
let currentUser = null;
let isFirstLogin = false;
let isMobileMenuOpen = false;
let isSidebarOpen = false;

// Assessment State
let currentQuestionIndex = 0;
let assessmentAnswers = [];

// Audio Recording State
let mediaRecorder = null;
let audioChunks = [];
let recordingTimer = null;
let recordingStartTime = null;
let isRecording = false;

// Journal State
let selectedMood = null;
let journalRecorder = null;
let journalAudioChunks = [];
let journalRecordingTimer = null;

// Chart Instances
let emotionsChart, toneChart, sentimentChart, pitchChart;


// --- CORE UI & PAGE MANAGEMENT ---

function showPage(pageId) {
    document.querySelectorAll(".page").forEach((page) => {
        page.classList.remove("active");
    });
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add("active", "fade-in");
    }
}

function toggleMobileMenu() {
    const hamburger = document.querySelector(".hamburger-menu");
    const navLinks = document.getElementById("nav-links");
    isMobileMenuOpen = !isMobileMenuOpen;
    if (isMobileMenuOpen) {
        hamburger.classList.add("active");
        navLinks.classList.add("active");
        document.body.style.overflow = "hidden";
    } else {
        hamburger.classList.remove("active");
        navLinks.classList.remove("active");
        document.body.style.overflow = "auto";
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById("sidebar");
    const overlay = document.querySelector(".sidebar-overlay") || createSidebarOverlay();
    isSidebarOpen = !isSidebarOpen;
    if (isSidebarOpen) {
        sidebar.classList.add("active");
        overlay.classList.add("active");
        document.body.style.overflow = "hidden";
    } else {
        sidebar.classList.remove("active");
        overlay.classList.remove("active");
        document.body.style.overflow = "auto";
    }
}

function createSidebarOverlay() {
    let overlay = document.querySelector(".sidebar-overlay");
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.className = "sidebar-overlay";
        overlay.addEventListener("click", toggleSidebar);
        document.body.appendChild(overlay);
    }
    return overlay;
}

function closeMobileMenu() {
    if (isMobileMenuOpen) {
        toggleMobileMenu();
    }
}

function closeSidebarOnMobile() {
    if (window.innerWidth <= 1024 && isSidebarOpen) {
        toggleSidebar();
    }
}


// --- AUTHENTICATION ---

function showAuth() {
    const modal = document.getElementById("auth-modal");
    modal.classList.add("active");
    document.body.style.overflow = "hidden";
    if (isMobileMenuOpen) {
        toggleMobileMenu();
    }
}

function hideAuth() {
    const modal = document.getElementById("auth-modal");
    modal.classList.remove("active");
    document.body.style.overflow = "auto";
}

function showLogin() {
    document.getElementById("login-form").classList.add("active");
    document.getElementById("register-form").classList.remove("active");
}

function showRegister() {
    document.getElementById("register-form").classList.add("active");
    document.getElementById("login-form").classList.remove("active");
}

function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;

    if (email && password) {
        const users = JSON.parse(localStorage.getItem("users") || "[]");
        const user = users.find((u) => u.email === email && u.password === password);

        if (user) {
            currentUser = user;
            localStorage.setItem("currentUser", JSON.stringify(user));
            if (!user.hasCompletedWelcome) {
                isFirstLogin = true;
                showWelcomePage();
            } else {
                showDashboard();
            }
            hideAuth();
        } else {
            alert("Invalid credentials. Please try again.");
        }
    }
}

function handleRegister(event) {
    event.preventDefault();
    const name = document.getElementById("register-name").value;
    const email = document.getElementById("register-email").value;
    const password = document.getElementById("register-password").value;
    const confirmPassword = document.getElementById("register-confirm").value;

    if (password !== confirmPassword) {
        alert("Passwords do not match!");
        return;
    }

    if (name && email && password) {
        const users = JSON.parse(localStorage.getItem("users") || "[]");
        const existingUser = users.find((u) => u.email === email);
        if (existingUser) {
            alert("User already exists with this email!");
            return;
        }

        const newUser = {
            id: Date.now(),
            name,
            email,
            password,
            hasCompletedWelcome: false,
            hasCompletedAssessment: false,
            createdAt: new Date().toISOString(),
        };

        users.push(newUser);
        localStorage.setItem("users", JSON.stringify(users));
        currentUser = newUser;
        localStorage.setItem("currentUser", JSON.stringify(newUser));
        isFirstLogin = true;
        showWelcomePage();
        hideAuth();
    }
}

function logout() {
    currentUser = null;
    localStorage.removeItem("currentUser");
    showPage("landing-page");
}


// --- WELCOME & ASSESSMENT ---

function showWelcomePage() {
    showPage("welcome-page");
}

const assessmentQuestions = [
    { id: 1, question: "Over the past two weeks, how often have you been bothered by feeling down, depressed, or hopeless?", options: [{ text: "Not at all", value: 0 }, { text: "Several days", value: 1 }, { text: "More than half the days", value: 2 }, { text: "Nearly every day", value: 3 }] },
    { id: 2, question: "Over the past two weeks, how often have you had little interest or pleasure in doing things?", options: [{ text: "Not at all", value: 0 }, { text: "Several days", value: 1 }, { text: "More than half the days", value: 2 }, { text: "Nearly every day", value: 3 }] },
    { id: 3, question: "How would you rate your overall energy levels recently?", options: [{ text: "Very high energy", value: 0 }, { text: "Good energy levels", value: 1 }, { text: "Low energy", value: 2 }, { text: "Very low or no energy", value: 3 }] },
    { id: 4, question: "How often do you feel anxious or worried?", options: [{ text: "Rarely or never", value: 0 }, { text: "Sometimes", value: 1 }, { text: "Often", value: 2 }, { text: "Almost constantly", value: 3 }] },
    { id: 5, question: "How well have you been sleeping lately?", options: [{ text: "Very well, getting enough rest", value: 0 }, { text: "Fairly well", value: 1 }, { text: "Poorly, some sleep issues", value: 2 }, { text: "Very poorly, significant sleep problems", value: 3 }] },
    { id: 6, question: "How often do you feel overwhelmed by daily tasks?", options: [{ text: "Never", value: 0 }, { text: "Occasionally", value: 1 }, { text: "Frequently", value: 2 }, { text: "Almost always", value: 3 }] },
    { id: 7, question: "How satisfied are you with your social relationships?", options: [{ text: "Very satisfied", value: 0 }, { text: "Mostly satisfied", value: 1 }, { text: "Somewhat dissatisfied", value: 2 }, { text: "Very dissatisfied or isolated", value: 3 }] },
    { id: 8, question: "How often do you experience mood swings or emotional instability?", options: [{ text: "Rarely", value: 0 }, { text: "Sometimes", value: 1 }, { text: "Often", value: 2 }, { text: "Very frequently", value: 3 }] },
    { id: 9, question: "How confident do you feel about your ability to handle problems?", options: [{ text: "Very confident", value: 0 }, { text: "Somewhat confident", value: 1 }, { text: "Not very confident", value: 2 }, { text: "Not confident at all", value: 3 }] },
    { id: 10, question: "How often do you feel hopeful about the future?", options: [{ text: "Very often", value: 0 }, { text: "Sometimes", value: 1 }, { text: "Rarely", value: 2 }, { text: "Never", value: 3 }] }
];

function startAssessment() {
    showPage("assessment-page");
    currentQuestionIndex = 0;
    assessmentAnswers = [];
    displayQuestion();
}

function displayQuestion() {
    const question = assessmentQuestions[currentQuestionIndex];
    document.getElementById("question-title").textContent = question.question;
    const optionsContainer = document.getElementById("options-container");
    optionsContainer.innerHTML = "";
    question.options.forEach((option, index) => {
        const optionElement = document.createElement("button");
        optionElement.className = "option-button";
        optionElement.textContent = option.text;
        optionElement.addEventListener("click", () => selectOption(index, option.value));
        optionsContainer.appendChild(optionElement);
    });
    const progress = ((currentQuestionIndex + 1) / assessmentQuestions.length) * 100;
    document.getElementById("progress-fill").style.width = `${progress}%`;
    document.getElementById("progress-text").textContent = `Question ${currentQuestionIndex + 1} of ${assessmentQuestions.length}`;
    document.getElementById("prev-btn").disabled = currentQuestionIndex === 0;
    document.getElementById("next-btn").disabled = true;
}

function selectOption(optionIndex, value) {
    document.querySelectorAll(".option-button").forEach((opt, index) => {
        opt.classList.toggle("selected", index === optionIndex);
    });
    assessmentAnswers[currentQuestionIndex] = value;
    document.getElementById("next-btn").disabled = false;
}

function nextQuestion() {
    if (assessmentAnswers[currentQuestionIndex] !== undefined) {
        if (currentQuestionIndex < assessmentQuestions.length - 1) {
            currentQuestionIndex++;
            displayQuestion();
        } else {
            showAssessmentComplete();
        }
    }
}

function previousQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        displayQuestion();
        if (assessmentAnswers[currentQuestionIndex] !== undefined) {
            const selectedIndex = assessmentQuestions[currentQuestionIndex].options.findIndex(
                (opt) => opt.value === assessmentAnswers[currentQuestionIndex],
            );
            if (selectedIndex !== -1) {
                document.querySelectorAll(".option-button")[selectedIndex].classList.add("selected");
                document.getElementById("next-btn").disabled = false;
            }
        }
    }
}

function showAssessmentComplete() {
    document.querySelector(".assessment-content").style.display = "none";
    document.getElementById("assessment-complete").style.display = "block";
}

async function completeAssessment() {
    const totalScore = assessmentAnswers.reduce((sum, score) => sum + score, 0);
    const maxScore = assessmentQuestions.length * 3;
    const riskPercentage = (totalScore / maxScore) * 100;
    let riskLevel = "Low";
    if (riskPercentage > 70) riskLevel = "High";
    else if (riskPercentage > 40) riskLevel = "Moderate";

    const assessmentText = generateAssessmentText(assessmentAnswers, riskLevel);
    const textAnalysis = await analyzeJournalText(assessmentText); // Using the API call

    if (currentUser) {
        currentUser.hasCompletedAssessment = true;
        currentUser.hasCompletedWelcome = true;
        currentUser.assessmentResults = {
            answers: assessmentAnswers,
            totalScore,
            riskLevel,
            riskPercentage,
            textAnalysis, // Storing API analysis
            completedAt: new Date().toISOString(),
        };
        updateUserData();
    }
    showDashboard();
}

function generateAssessmentText(answers, riskLevel) {
    const concerns = [];
    answers.forEach((answer, index) => {
        if (answer >= 2) { // Moderate to high concern
            const question = assessmentQuestions[index].question;
            concerns.push(question.split('?')[0] + ' - Score: ' + answer);
        }
    });
    return `Mental health assessment completed. Risk level: ${riskLevel}. Key concerns: ${concerns.join('; ')}. Total score: ${answers.reduce((a, b) => a + b, 0)}.`;
}


// --- DASHBOARD & ANALYSIS (API INTEGRATED) ---

function showDashboard() {
    showPage("dashboard-page");
    if (currentUser) {
        document.getElementById("user-name").textContent = currentUser.name;
        updateProfileDisplay();
    }
    initializeCharts();
    
    // Show the main dashboard with charts by default
    showDashboardSection("dashboard"); 
    
    refreshDailyQuote();
    showResourceCategory('recommended');
}

function showDashboardSection(sectionName) {
    document.querySelectorAll(".dashboard-section").forEach((section) => {
        section.classList.remove("active");
    });
    const targetSection = document.getElementById(`${sectionName}-section`);
    if (targetSection) {
        targetSection.classList.add("active");
    }

    // This is the new logic to reload data when the dashboard is viewed
    if (sectionName === 'dashboard') {
        loadLatestDashboardData();
    }

    document.querySelectorAll(".sidebar-menu a").forEach((link) => {
        link.classList.remove("active");
    });
    const activeLink = document.querySelector(`.sidebar-menu a[onclick="showDashboardSection('${sectionName}')"]`);
    if (activeLink) {
        activeLink.classList.add("active");
    }
    
    if (sectionName === 'resources') {
        showResourceCategory('recommended');
    }

    closeSidebarOnMobile();
}

async function startAudioAnalysis(audioFile, filename = "audio.wav") {
    document.getElementById("analysis-progress").style.display = "block";
    try {
        let formData = new FormData();
        formData.append("file", audioFile, filename);
        // Reverted to "1" based on previous successful API calls if "0" caused issues
        formData.append("choice", "1"); 

        let progress = 0;
        const progressInterval = setInterval(() => {
            progress += Math.random() * 15;
            if (progress > 90) progress = 90;
            updateProgress(progress);
        }, 200);

        const response = await fetch(UPLOAD_AUDIO_ENDPOINT, {
            method: 'POST',
            body: formData,
        });
        console.log("API Response Status:", response.status); // Log API response status
        clearInterval(progressInterval);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }
        const result = await response.json();
         

        const response1 = await fetch(finalize, {
            method: 'POST',
            body: JSON.stringify(result),
            headers: {
        '       Content-Type': 'application/json'
            }
        });
        console.log("API Result:", response1); // Log the full API result
        updateProgress(100);
        setTimeout(() => {
            completeAudioAnalysis(response1);
        }, 1000);

    } catch (error) {
        console.error("Audio analysis error:", error);
        document.getElementById("analysis-progress").style.display = "none";
        alert(`Analysis failed: ${error.message}. Please try again.`);
        const mockResults = handleApiError(error, 'audio');
        if (mockResults) {
            completeAudioAnalysis(mockResults, true);
        }
    }
}

function completeAudioAnalysis(apiResult, isMock = false) {
    document.getElementById("analysis-progress").style.display = "none";
    const analysisResults = isMock ? apiResult : processAudioApiResponse(apiResult);
    storeAnalysisResults(analysisResults);
    updateDashboardWithResults(analysisResults);
    showDashboardSection("dashboard");
    showAudioAnalysisInsights(analysisResults);
}

// MODIFIED: This function now extracts all relevant data
function processAudioApiResponse(apiResult) {
    // --- Data Extraction ---
    const respData = apiResult.response || {};
    const pitchData = respData.pitch_analysis || {};
    const emotionsData = respData.returned_json?.[0]?.emotions || []; // Get emotions from the first chunk for dashboard overview

    // --- Video Link Extraction from resp_json.resp string ---
    const recommendedVideos = [];
    if (apiResult.resp_json && typeof apiResult.resp_json.resp === 'string') {
        // Regex to find URLs
        const urlRegex = /(https?:\/\/[^\s"',]+)/g;
        let match;
        const rawUrls = new Set(); // Use a Set to store unique URLs

        while ((match = urlRegex.exec(apiResult.resp_json.resp)) !== null) {
            rawUrls.add(match[1].trim());
        }

        // Add extracted unique URLs to recommendedVideos
        Array.from(rawUrls).forEach((url, index) => {
            recommendedVideos.push({ title: `Recommended Video ${index + 1}`, url: url });
        });
    }

    // --- Helper to find emotion scores (0-100 scale) ---
    const getEmotionScore = (label) => {
        const emotion = emotionsData.find(e => e.label === label);
        return emotion ? Math.floor(emotion.score * 100) : 0; // Ensure whole number percentage
    };

    // --- Processed Results Object ---
    return {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        
        pitch: Math.floor(pitchData.pitch) || 150, // Ensure whole number for display
        sentiment: getEmotionScore('joy') || 50, // Default to 50 if joy is 0 or not found
        
        emotions: {
            happy: getEmotionScore('joy'),
            sad: getEmotionScore('sadness'),
            angry: getEmotionScore('anger'),
            anxious: getEmotionScore('fear'), // Mapping fear to anxious
            neutral: getEmotionScore('neutral')
        },
        tone: {
            // Simplistic mapping based on pitch_emotion, adjust as needed
            positive: pitchData.pitch_emotion === 'Happy / Normal' ? 100 : 30,
            negative: pitchData.pitch_emotion === 'sadness' ? 100 : 40, // Example: if pitch indicates sadness
            neutral: pitchData.pitch_emotion === 'neutral' ? 100 : 30
        },
        depressionRisk: calculateDepressionRisk(emotionsData),
        confidence: Math.floor((emotionsData[0]?.score || 0) * 100) || 80, // Confidence from highest scoring emotion
        duration: respData.audio_length || 45, // Fallback to 45 seconds
        rawApiResponse: apiResult,
        recommendedVideos: recommendedVideos
    };
}


function getScore(apiResult, possibleKeys) {
    for (let key of possibleKeys) {
        if (apiResult[key] !== undefined) {
            if (key === 'pitch_emotion' && apiResult[key] === 'Happy / Normal') {
                return 100;
            }
            if (typeof apiResult[key] === 'number') {
                if (apiResult[key] >= 0 && apiResult[key] <= 1) {
                    return Math.floor(apiResult[key] * 100);
                }
                return Math.floor(apiResult[key]);
            }
            const floatVal = parseFloat(apiResult[key]);
            if (!isNaN(floatVal) && floatVal >= 0 && floatVal <= 1) {
                return Math.floor(floatVal * 100);
            } else if (!isNaN(floatVal)) {
                return Math.floor(floatVal);
            }
        }
    }
    return Math.floor(Math.random() * 50) + 25; // Default fallback, ensure whole number
}


function calculateDepressionRisk(emotionsArray) {
    if (!emotionsArray || emotionsArray.length === 0) return "Low";
    const sadness = emotionsArray.find(e => e.label === 'sadness')?.score || 0;
    const fear = emotionsArray.find(e => e.label === 'fear')?.score || 0;
    const joy = emotionsArray.find(e => e.label === 'joy')?.score || 0;
    
    // A simplified risk score: higher for sadness/fear, lower for joy
    const riskScore = (sadness * 0.7) + (fear * 0.5) - (joy * 0.3); // Weighted

    if (riskScore > 0.6) return "High";
    if (riskScore > 0.3) return "Moderate";
    return "Low";
}


function storeAnalysisResults(results) {
    if (currentUser) {
        if (!currentUser.analysisHistory) {
            currentUser.analysisHistory = [];
        }
        currentUser.analysisHistory.push(results);
        currentUser.latestRecommendedVideos = results.recommendedVideos;
        updateUserData();
    }
}

function updateDashboardWithResults(results) {
    document.getElementById("overall-mood").textContent = getMoodFromEmotions(results.emotions);
    document.getElementById("sentiment-score").textContent = `${Math.floor(results.sentiment)}%`;
    document.getElementById("voice-pitch").textContent = `${Math.floor(results.pitch)} Hz`;
    document.getElementById("depression-risk").textContent =(results.sentiment > 60 )?  "High Moderate" : "Medium" ;
    document.getElementById("analysis-date").textContent = new Date(results.timestamp).toLocaleDateString();
    document.getElementById("sample-duration").textContent = `${results.duration} seconds`;
    updateCharts(results);

    loadRecommendedResources();
}


// --- AUDIO RECORDING & UPLOAD ---

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        mediaRecorder.ondataavailable = (event) => audioChunks.push(event.data);
        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
            const audioUrl = URL.createObjectURL(audioBlob);
            document.getElementById("recorded-audio").src = audioUrl;
            document.getElementById("recording-preview").style.display = "block";
        };
        mediaRecorder.start();
        isRecording = true;
        recordingStartTime = Date.now();
        document.getElementById("start-record-btn").disabled = true;
        document.getElementById("stop-record-btn").disabled = false;
        document.getElementById("recording-status").querySelector(".status-text").textContent = "Recording...";
        recordingTimer = setInterval(updateRecordingTimer, 1000);
        startRecordingAnimation();
    } catch (error) {
        console.error("Error accessing microphone:", error);
        alert("Unable to access microphone. Please check permissions.");
    }
}

function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach((track) => track.stop());
        isRecording = false;
        document.getElementById("start-record-btn").disabled = false;
        document.getElementById("stop-record-btn").disabled = true;
        document.getElementById("play-record-btn").disabled = false;
        document.getElementById("recording-status").querySelector(".status-text").textContent = "Recording complete";
        clearInterval(recordingTimer);
        stopRecordingAnimation();
    }
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (file) {
        const validTypes = ["audio/mp3", "audio/wav", "audio/m4a", "audio/mpeg"];
        if (!validTypes.includes(file.type)) {
            alert("Please upload a valid audio file (MP3, WAV, M4A)");
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            alert("File size must be less than 10MB");
            return;
        }
        document.getElementById("file-name").textContent = file.name;
        document.getElementById("file-size").textContent = `${(file.size / 1024 / 1024).toFixed(2)} MB`;
        const audioUrl = URL.createObjectURL(file);
        document.getElementById("uploaded-audio").src = audioUrl;
        document.getElementById("upload-preview").style.display = "block";
        document.getElementById("upload-area").style.display = "none";
        document.getElementById("upload-preview").dataset.uploadedFile = file;
    }
}

async function analyzeUploadedFile() {
    const fileInput = document.getElementById('audio-file-input');
    if (fileInput.files.length === 0) {
        alert("No file found. Please upload an audio file first.");
        return;
    }
    const file = fileInput.files[0];
    await startAudioAnalysis(file, file.name);
}

async function analyzeRecording() {
    if (audioChunks.length === 0) {
        alert("No recording found. Please record audio first.");
        return;
    }
    const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
    await startAudioAnalysis(audioBlob, "recording.wav");
}


// --- JOURNAL (API INTEGRATED) ---

function showJournalView(view) {
    document.querySelectorAll(".journal-nav-btn").forEach((btn) => btn.classList.remove("active"));
    const activeBtn = document.querySelector(`.journal-nav-btn[onclick="showJournalView('${view}')"]`);
    if (activeBtn) activeBtn.classList.add("active");

    document.querySelectorAll(".journal-view").forEach((v) => v.classList.remove("active"));
    const targetView = document.getElementById(`${view}-view`);
    if (targetView) targetView.classList.add("active");

    if (view === "entries") loadJournalEntries();
    else if (view === "new") document.getElementById("current-date").textContent = new Date().toLocaleDateString();
    else if (view === "voice") loadVoiceNotes();
    else if (view === "insights") loadJournalInsights();
}

async function analyzeJournalText(text) {
    try {
        const response = await fetch(TEXT_ANALYSIS_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: text })
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error("Text analysis error:", error);
        return handleApiError(error, 'text'); // Fallback to mock data
    }
}

async function saveJournalEntry() {
    const title = document.getElementById("entry-title").value;
    const text = document.getElementById("entry-text").value;
    if (!text.trim()) {
        alert("Please write something in your journal entry");
        return;
    }
    const saveButton = document.querySelector('#new-view .btn-primary');
    const originalText = saveButton.textContent;
    saveButton.textContent = "Analyzing...";
    saveButton.disabled = true;

    try {
        const textAnalysis = await analyzeJournalText(text);
        const entry = {
            id: Date.now(),
            title: title || "Untitled Entry",
            text: text,
            mood: selectedMood,
            date: new Date().toISOString(),
            type: "text",
            analysis: textAnalysis // Store API results
        };

        if (currentUser) {
            if (!currentUser.journalEntries) currentUser.journalEntries = [];
            currentUser.journalEntries.push(entry);
            updateUserData();
        }
        clearEntry();
        showJournalAnalysisInsights(textAnalysis);
        showJournalView("entries");
    } catch (error) {
        console.error("Error saving journal entry:", error);
        alert("Error saving entry. Please try again.");
    } finally {
        saveButton.textContent = originalText;
        saveButton.disabled = false;
    }
}

function loadJournalInsights() {
    const entries = currentUser?.journalEntries || [];
    document.getElementById("total-entries").textContent = entries.filter((e) => e.type === "text").length;
    document.getElementById("total-voice-notes").textContent = entries.filter((e) => e.type === "voice").length;
    document.getElementById("streak-days").textContent = calculateStreak(entries);

    const textEntries = entries.filter((e) => e.type === "text" && e.analysis);
    if (textEntries.length > 0) {
        const latestAnalysis = textEntries[textEntries.length - 1].analysis;
        if (latestAnalysis) {
            document.getElementById("common-mood").textContent = `Based on recent analysis: ${latestAnalysis.sentiment || latestAnalysis.emotional_tone || 'Neutral'}`;
            if (latestAnalysis.risk_level) {
                document.getElementById("reflection-insight").textContent = `Recent analysis indicates ${latestAnalysis.risk_level.toLowerCase()} risk level.`;
            }
        }
    }
}

// --- RESOURCES SECTION ---

function showResourceCategory(category) {
    document.querySelectorAll(".category-btn").forEach(btn => btn.classList.remove("active"));
    const activeBtn = document.querySelector(`.category-btn[onclick="showResourceCategory('${category}')"]`);
    if (activeBtn) activeBtn.classList.add("active");

    document.querySelectorAll(".resource-category").forEach(cat => cat.classList.remove("active"));
    const targetCategory = document.getElementById(`${category}-category`);
    if (targetCategory) targetCategory.classList.add("active");

    if (category === "recommended") {
        loadRecommendedResources();
    }
}

function loadRecommendedResources() {
    const container = document.getElementById("recommended-resources");
    if (!container) return;
    
    const videos = currentUser?.latestRecommendedVideos || [];

    if (videos.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">💡</div>
                <h3>Personalized Resources Appear Here</h3>
                <p>Complete a voice analysis to get video recommendations based on your mood and tone.</p>
            </div>`;
        return;
    }

    container.innerHTML = videos.map(video => {
        let videoId = '';
        try {
            const url = new URL(video.url);
            if (url.hostname === 'youtu.be') {
                videoId = url.pathname.substring(1);
            } else if (url.hostname.includes('youtube.com')) {
                videoId = url.searchParams.get('v');
            }
        } catch (e) { console.error("Invalid URL for video", video.url); }

        if (!videoId) return ''; // Skip invalid URLs

        const embedUrl = `https://www.youtube.com/embed/${videoId}`;
        return `
            <div class="resource-card video-card">
                <div class="resource-content">
                    <h3>${video.title}</h3>
                    <div class="video-container">
                        <iframe 
                            src="${embedUrl}" 
                            title="${video.title}" 
                            frameborder="0" 
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                            allowfullscreen>
                        </iframe>
                    </div>
                </div>
            </div>`;
    }).join("");
}

// --- PROFILE & SETTINGS ---

function showProfileTab(tabName) {
    document.querySelectorAll(".profile-tab-btn").forEach((btn) => btn.classList.remove("active"));
    document.querySelector(`[onclick="showProfileTab('${tabName}')"]`).classList.add("active");
    document.querySelectorAll(".profile-tab-content").forEach((content) => content.classList.remove("active"));
    document.getElementById(`${tabName}-tab`).classList.add("active");
    if (tabName === "personal") loadPersonalInfo();
}

function loadPersonalInfo() {
    if (currentUser) {
        document.getElementById("profile-name").value = currentUser.name || "";
        document.getElementById("profile-email-input").value = currentUser.email || "";
        document.getElementById("profile-phone").value = currentUser.phone || "";
        document.getElementById("profile-birthdate").value = currentUser.birthdate || "";
        document.getElementById("profile-bio").value = currentUser.bio || "";
    }
}

function updatePersonalInfo(event) {
    event.preventDefault();
    if (currentUser) {
        currentUser.name = document.getElementById("profile-name").value;
        currentUser.email = document.getElementById("profile-email-input").value;
        currentUser.phone = document.getElementById("profile-phone").value;
        currentUser.birthdate = document.getElementById("profile-birthdate").value;
        currentUser.bio = document.getElementById("profile-bio").value;
        updateUserData();
        updateProfileDisplay();
        alert("Personal information updated successfully!");
    }
}

function updateProfileDisplay() {
    if (currentUser) {
        document.getElementById("profile-display-name").textContent = currentUser.name;
        document.getElementById("profile-email").textContent = currentUser.email;
        const initials = currentUser.name.split(" ").map((n) => n[0]).join("").toUpperCase();
        document.getElementById("avatar-initials").textContent = initials;
        const daysActive = Math.floor((Date.now() - new Date(currentUser.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        document.getElementById("days-active").textContent = daysActive;
        const totalAnalyses = currentUser.analysisHistory ? currentUser.analysisHistory.length : 0;
        document.getElementById("total-analyses").textContent = totalAnalyses;
        const journalEntriesCount = currentUser.journalEntries ? currentUser.journalEntries.length : 0;
        document.getElementById("journal-entries-count").textContent = journalEntriesCount;
    }
}


// --- UTILITIES & HELPERS ---

function updateUserData() {
    if (currentUser) {
        const users = JSON.parse(localStorage.getItem("users") || "[]");
        const userIndex = users.findIndex((u) => u.id === currentUser.id);
        if (userIndex !== -1) {
            users[userIndex] = currentUser;
            localStorage.setItem("users", JSON.stringify(users));
            localStorage.setItem("currentUser", JSON.stringify(currentUser));
        }
    }
}

function calculateStreak(entries) {
    if (entries.length === 0) return 0;
    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0); // Normalize to start of day
    
    const entryDates = new Set(
        entries.map(e => {
            const d = new Date(e.date);
            d.setHours(0, 0, 0, 0);
            return d.getTime();
        })
    );

    while (entryDates.has(currentDate.getTime())) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
    }
    return streak;
}


function handleApiError(error, context) {
    console.error(`API Error in ${context}:`, error);
    if (context === 'audio') {
        return generateMockAnalysis();
    } else if (context === 'text') {
        return generateMockTextAnalysis();
    }
    return null;
}

function generateMockAnalysis() {
    // Generate mock video recommendations when API fails for audio analysis
    const mockVideos = [
        { title: "Mindfulness for Stress Relief", url: "https://www.youtube.com/watch?v=O-6f5wQXSu8" },
        { title: "Guided Meditation for Anxiety", url: "https://www.youtube.com/watch?v=aG3mJ362g8w" },
        { title: "Coping with Difficult Emotions", url: "https://www.youtube.com/watch?v=W5yB9eS3QWw" }
    ];

    return { 
        id: Date.now(), 
        timestamp: new Date().toISOString(), 
        emotions: { happy: Math.random() * 40 + 10, sad: Math.random() * 30 + 5, angry: Math.random() * 20 + 5, anxious: Math.random() * 25 + 10, neutral: Math.random() * 30 + 20, }, 
        tone: { positive: Math.random() * 50 + 30, negative: Math.random() * 30 + 10, neutral: Math.random() * 40 + 20, }, 
        sentiment: Math.random() * 40 + 50, 
        pitch: Math.random() * 100 + 100, 
        depressionRisk: Math.random() > 0.7 ? "High" : Math.random() > 0.4 ? "Moderate" : "Low", 
        confidence: Math.random() * 20 + 75, 
        duration: Math.floor(Math.random() * 60 + 30),
        recommendedVideos: mockVideos // Include mock videos here
    };
}


function generateMockTextAnalysis() {
    return { sentiment: Math.random() > 0.5 ? "positive" : "negative", risk_level: Math.random() > 0.7 ? "high" : Math.random() > 0.4 ? "moderate" : "low", confidence: Math.random() * 20 + 80 };
}


// --- Remaining Helper Functions ---

function showAudioAnalysisInsights(results) {
    let message = "Voice analysis complete! Check your dashboard for detailed insights.";
    if (results.depressionRisk === "High") {
        message += "\n\n🚨 Our analysis detected potential concerns. Please consider speaking with a mental health professional.";
    } else if (results.depressionRisk === "Moderate") {
        message += "\n\n💡 Some patterns were detected that might benefit from additional support.";
    }
    alert(message);
}

function showJournalAnalysisInsights(analysis) {
    if (!analysis) return;
    const riskLevel = analysis.risk_level || analysis.depression_indicator;
    const sentiment = analysis.sentiment || analysis.emotional_tone;
    let message = "Journal entry saved successfully!";
    if (riskLevel) {
        message += `\n\nAnalysis Insights:\n- Risk Level: ${riskLevel}\n- Sentiment: ${sentiment}`;
        if (riskLevel.toLowerCase().includes('high') || riskLevel.toLowerCase().includes('severe')) {
            message += "\n\n🚨 We've detected concerning patterns in your text. Consider reaching out to a mental health professional.";
        }
    }
    alert(message);
}

function updateProgress(progress) {
    document.getElementById("analysis-progress-fill").style.width = `${progress}%`;
    document.getElementById("analysis-percentage").textContent = `${Math.floor(progress)}%`;
    if (progress > 30) {
        document.getElementById("step-1").classList.remove("active");
        document.getElementById("step-2").classList.add("active");
    }
    if (progress > 70) {
        document.getElementById("step-2").classList.remove("active");
        document.getElementById("step-3").classList.add("active");
    }
}

function getMoodFromEmotions(emotions) {
    const maxEmotion = Object.keys(emotions).reduce((a, b) => (emotions[a] > emotions[b] ? a : b));
    const moodMap = { happy: "Happy", sad: "Sad", angry: "Frustrated", anxious: "Anxious", neutral: "Neutral" };
    return moodMap[maxEmotion] || "Neutral";
}

function clearEntry() {
    document.getElementById("entry-title").value = "";
    document.getElementById("entry-text").value = "";
    selectedMood = null;
    document.querySelectorAll(".mood-btn").forEach((btn) => btn.classList.remove("selected"));
}

function loadJournalEntries() {
    const container = document.getElementById("journal-entries");
    const entries = (currentUser?.journalEntries || []).filter(e => e.type === 'text');
    if (entries.length === 0) {
        container.innerHTML = `<div class="empty-state"><div class="empty-icon">📝</div><h3>No journal entries yet</h3><p>Start writing your first entry.</p><button class="btn-primary" onclick="showJournalView('new')">Write Entry</button></div>`;
        return;
    }
    container.innerHTML = [...entries].reverse().map(entry => `
        <div class="journal-entry-card">
            <div class="entry-header">
                <h3>${entry.title}</h3>
                <div class="entry-meta">
                    ${entry.mood ? `<span class="mood-indicator">${getMoodEmoji(entry.mood)}</span>` : ""}
                    <span class="entry-date">${new Date(entry.date).toLocaleDateString()}</span>
                </div>
            </div>
            <div class="entry-preview">
                <p>${entry.text.substring(0, 150)}${entry.text.length > 150 ? "..." : ""}</p>
            </div>
        </div>`).join("");
}

function getMoodEmoji(mood) {
    const moodEmojis = { great: "😊", good: "🙂", okay: "😐", sad: "😢", anxious: "😰" };
    return moodEmojis[mood] || "😐";
}

function updateRecordingTimer() {
    if (recordingStartTime) {
        const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        document.getElementById("recording-time").textContent =
            `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
    }
}

function startRecordingAnimation() {
    const bars = document.querySelectorAll("#recording-visualizer .bar");
    bars.forEach((bar) => {
        bar.style.animationPlayState = "running";
    });
}

function stopRecordingAnimation() {
    const bars = document.querySelectorAll("#recording-visualizer .bar");
    bars.forEach((bar) => {
        bar.style.animationPlayState = "paused";
    });
}

function playRecording() {
    const audio = document.getElementById("recorded-audio");
    audio.play();
}

function discardRecording() {
    document.getElementById("recording-preview").style.display = "none";
    document.getElementById("recording-time").textContent = "00:00";
    document.getElementById("play-record-btn").disabled = true;
}

function removeUploadedFile() {
    document.getElementById("upload-preview").style.display = "none";
    document.getElementById("upload-area").style.display = "flex";
    document.getElementById("audio-file-input").value = "";
    delete document.getElementById("upload-preview").dataset.uploadedFile;
}

function startExercise(exerciseType) {
    alert(`Starting ${exerciseType} exercise... (This would open a guided exercise interface)`);
}

function refreshDailyQuote() {
    const quotes = [
        { text: "The greatest revolution of our generation is the discovery that human beings, by changing the inner attitudes of their minds, can change the outer aspects of their lives.", author: "William James" },
        { text: "Mental health is not a destination, but a process. It's about how you drive, not where you're going.", author: "Noam Shpancer" },
        { text: "You are not your illness. You have an individual story to tell. You have a name, a history, a personality. Staying yourself is part of the battle.", author: "Julian Seifter" },
        { text: "Healing takes time, and asking for help is a courageous step.", author: "Mariska Hargitay" },
    ];
    const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
    document.getElementById("daily-quote").innerHTML = `<blockquote>"${randomQuote.text}"</blockquote><cite>— ${randomQuote.author}</cite>`;
}

function loadVoiceNotes() {
    const container = document.getElementById("voice-notes-list");
    const voiceNotes = currentUser?.journalEntries?.filter((entry) => entry.type === "voice") || [];

    if (voiceNotes.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🎤</div>
                <h3>No voice notes yet</h3>
                <p>Record your first voice note to capture your thoughts</p>
            </div>
        `;
        return;
    }

    container.innerHTML = voiceNotes
        .reverse()
        .map(
            (note) => `
            <div class="voice-note-card">
                <div class="voice-note-header">
                    <h4>${note.title}</h4>
                    <span class="voice-duration">${note.duration}</span>
                </div>
                <div class="voice-note-meta">
                    <span class="voice-date">${new Date(note.date).toLocaleDateString()}</span>
                </div>
            </div>
        `,
        )
        .join("");
}

async function startJournalRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        journalRecorder = new MediaRecorder(stream)
        journalAudioChunks = []

        journalRecorder.ondataavailable = (event) => {
            journalAudioChunks.push(event.data)
        }

        journalRecorder.onstop = () => {
            const audioBlob = new Blob(journalAudioChunks, { type: "audio/wav" })
            const audioUrl = URL.createObjectURL(audioBlob)
            document.getElementById("journal-recorded-audio").src = audioUrl
            document.getElementById("journal-voice-preview").style.display = "block"
        }

        journalRecorder.start()

        document.getElementById("journal-record-btn").disabled = true
        document.getElementById("journal-stop-btn").disabled = false
        document.getElementById("journal-voice-status").querySelector("span").textContent = "Recording..."

        let seconds = 0
        journalRecordingTimer = setInterval(() => {
            seconds++
            const mins = Math.floor(seconds / 60)
            const secs = seconds % 60
            document.getElementById("journal-voice-timer").textContent =
                `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
        }, 1000)
    } catch (error) {
        console.error("Error accessing microphone:", error)
        alert("Unable to access microphone. Please check permissions.")
    }
}

function stopJournalRecording() {
    if (journalRecorder) {
        journalRecorder.stop()
        journalRecorder.stream.getTracks().forEach((track) => track.stop())

        document.getElementById("journal-record-btn").disabled = false
        document.getElementById("journal-stop-btn").disabled = true
        document.getElementById("journal-voice-status").querySelector("span").textContent = "Recording complete"

        clearInterval(journalRecordingTimer)
    }
}

function saveVoiceNote() {
    const title = document.getElementById("voice-note-title").value || "Voice Note"

    const voiceNote = {
        id: Date.now(),
        title,
        date: new Date().toISOString(),
        type: "voice",
        duration: document.getElementById("journal-voice-timer").textContent,
    }

    if (currentUser) {
        if (!currentUser.journalEntries) {
            currentUser.journalEntries = []
        }
        currentUser.journalEntries.push(voiceNote)
        updateUserData()
    }

    document.getElementById("voice-note-title").value = ""
    document.getElementById("journal-voice-preview").style.display = "none"
    document.getElementById("journal-voice-timer").textContent = "00:00"

    alert("Voice note saved successfully!")
    loadVoiceNotes()
}

function discardJournalRecording() {
    document.getElementById("journal-voice-preview").style.display = "none"
    document.getElementById("journal-voice-timer").textContent = "00:00"
    document.getElementById("voice-note-title").value = ""
}


function initializeCharts() {
    const chartElements = ["emotions-chart", "tone-chart", "sentiment-trend-chart", "pitch-chart"];
    chartElements.forEach(id => {
        if (Chart.getChart(id)) {
            Chart.getChart(id).destroy();
        }
    });
    
    emotionsChart = new Chart(document.getElementById("emotions-chart"), {
        type: "doughnut",
        data: { labels: ["Happy", "Sad", "Angry", "Anxious", "Neutral"], datasets: [{ data: [0,0,0,0,0], backgroundColor: ["#4ade80", "#f87171", "#fb923c", "#fbbf24", "#94a3b8"] }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, position: 'bottom' } } }
    });
    
    toneChart = new Chart(document.getElementById("tone-chart"), {
        type: "bar",
        data: { labels: ["Positive", "Negative", "Neutral"], datasets: [{ data: [0,0,0], backgroundColor: ["#22c55e", "#ef4444", "#6b7280"] }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100 } } }
    });

    sentimentChart = new Chart(document.getElementById("sentiment-trend-chart"), {
        type: "line",
        data: { labels: ["Day 1", "Day 2", "Day 3", "Day 4", "Day 5"], datasets: [{ label: "Sentiment Score", data: [0,0,0,0,0], borderColor: "#3b82f6", backgroundColor: "rgba(59, 130, 246, 0.1)", tension: 0.4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, max: 100 } } }
    });

    pitchChart = new Chart(document.getElementById("pitch-chart"), {
        type: "radar",
        data: { labels: ["Low Freq", "Mid-Low", "Mid", "Mid-High", "High Freq"], datasets: [{ label: "Voice Pitch Distribution", data: [0,0,0,0,0], borderColor: "#8b5cf6", backgroundColor: "rgba(139, 92, 246, 0.1)" }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { r: { beginAtZero: true, max: 100 } } } // Max 100 for percentage distribution
    });
}

function updateCharts(results) {
    if (emotionsChart && results.emotions) {
        emotionsChart.data.datasets[0].data = [
            results.emotions.happy,
            results.emotions.sad,
            results.emotions.angry,
            results.emotions.anxious,
            results.emotions.neutral,
        ];
        emotionsChart.update();
    }

    if (toneChart && results.tone) {
        toneChart.data.datasets[0].data = [results.tone.positive, results.tone.negative, results.tone.neutral];
        toneChart.update();
    }

    if (sentimentChart && results.sentiment !== undefined) {
        const newSentiment = Math.floor(results.sentiment);
        // Ensure data array has at least 5 elements for a smooth chart
        if (sentimentChart.data.labels.length < 5) {
            sentimentChart.data.labels.push(`Day ${sentimentChart.data.labels.length + 1}`);
            sentimentChart.data.datasets[0].data.push(newSentiment);
        } else {
            sentimentChart.data.labels.shift();
            sentimentChart.data.labels.push(`Day ${sentimentChart.data.labels.length + 1}`);
            sentimentChart.data.datasets[0].data.shift();
            sentimentChart.data.datasets[0].data.push(newSentiment);
        }
        sentimentChart.update();
    }

    if (pitchChart && results.pitch !== undefined) {
        // A simplified mapping for radar chart: distribute pitch value across frequency bands
        const pitchValue = results.pitch;
        const total = 200; // Assuming max pitch value around 200 Hz for scaling
        const low = (pitchValue < 120) ? (120 - pitchValue) / 120 * 100 : 0;
        const midLow = (pitchValue >= 100 && pitchValue < 140) ? (pitchValue - 100) / 40 * 100 : 0;
        const mid = (pitchValue >= 130 && pitchValue < 170) ? (pitchValue - 130) / 40 * 100 : 0;
        const midHigh = (pitchValue >= 160 && pitchValue < 200) ? (pitchValue - 160) / 40 * 100 : 0;
        const high = (pitchValue >= 190) ? (pitchValue - 190) / 10 * 100 : 0;

        pitchChart.data.datasets[0].data = [
            Math.min(100, Math.floor(low)),
            Math.min(100, Math.floor(midLow)),
            Math.min(100, Math.floor(mid)),
            Math.min(100, Math.floor(midHigh)),
            Math.min(100, Math.floor(high))
        ];
        pitchChart.update();
    }
}


function scrollToFeatures() {
    document.getElementById("features").scrollIntoView({ behavior: "smooth" })
    closeMobileMenu()
}

function changeAvatar() {
    alert(
        "Avatar change functionality would be implemented here. You could upload a custom image or choose from preset avatars.",
    )
}

function savePreferences() {
    if (currentUser) {
        currentUser.preferences = {
            dailyReminders: document.getElementById("daily-reminders").checked,
            analysisNotifications: document.getElementById("analysis-notifications").checked,
            weeklyReports: document.getElementById("weekly-reports").checked,
            theme: document.getElementById("theme-select").value,
            language: document.getElementById("language-select").value,
        };
        updateUserData();
        alert("Preferences saved successfully!");
    }
}

function savePrivacySettings() {
    if (currentUser) {
        currentUser.privacySettings = {
            anonymousAnalytics: document.getElementById("anonymous-analytics").checked,
            dataRetention: document.getElementById("data-retention-select").value,
        };
        updateUserData();
        alert("Privacy settings saved successfully!");
    }
}

function showChangePassword() {
    const newPassword = prompt("Enter your new password:")
    if (newPassword && newPassword.length >= 6) {
        currentUser.password = newPassword
        updateUserData()
        alert("Password changed successfully!")
    } else if (newPassword) {
        alert("Password must be at least 6 characters long.")
    }
}

function setup2FA() {
    alert(
        "Two-factor authentication setup would be implemented here. This would typically involve QR codes and authenticator apps.",
    )
}

function viewActiveSessions() {
    alert(
        "Active sessions management would be implemented here. This would show all devices/browsers currently signed in.",
    )
}

function exportData(type) {
    if (!currentUser) return;
    let data = {};
    let filename = "";

    switch (type) {
        case "journal":
            data = {
                journalEntries: currentUser.journalEntries || [],
                exportDate: new Date().toISOString(),
                exportType: "journal",
            };
            filename = "mindvoice-journal-export.json";
            break;
        case "analysis":
            data = {
                analysisHistory: currentUser.analysisHistory || [],
                assessmentResults: currentUser.assessmentResults || {},
                exportDate: new Date().toISOString(),
                exportType: "analysis",
            };
            filename = "mindvoice-analysis-export.json";
            break;
        case "complete":
            data = { ...currentUser, exportDate: new Date().toISOString(), exportType: "complete", };
            delete data.password;
            filename = "mindvoice-complete-export.json";
            break;
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    alert(`${type.charAt(0).toUpperCase() + type.slice(1)} data exported successfully!`);
}

function deleteVoiceRecordings() {
    const confirmed = confirm("Are you sure you want to delete all voice recordings? This action cannot be undone.")
    if (confirmed) {
        const doubleConfirm = confirm(
            "This will permanently delete all your voice recordings and analysis data. Type 'DELETE' to confirm.",
        )
        if (doubleConfirm) {
            if (currentUser) {
                currentUser.analysisHistory = []
                updateUserData()
                alert("All voice recordings have been deleted.")
            }
        }
    }
}

function deleteAccount() {
    const confirmed = confirm(
        "Are you sure you want to delete your account? This will permanently delete all your data and cannot be undone.",
    )
    if (confirmed) {
        const email = prompt("Please enter your email address to confirm account deletion:")
        if (email === currentUser.email) {
            const finalConfirm = confirm(
                "This is your final warning. Your account and all data will be permanently deleted. This cannot be undone.",
            )
            if (finalConfirm) {
                const users = JSON.parse(localStorage.getItem("users") || "[]")
                const updatedUsers = users.filter((u) => u.id !== currentUser.id)
                localStorage.setItem("users", JSON.stringify(updatedUsers))
                localStorage.removeItem("currentUser")

                alert("Your account has been deleted. You will now be redirected to the homepage.")
                currentUser = null
                showPage("landing-page")
            }
        } else {
            alert("Email address does not match. Account deletion cancelled.")
        }
    }
}

function resetPersonalInfo() {
    loadPersonalInfo();
}

function handleWindowResize() {
    const width = window.innerWidth;
    if (width > 768 && isMobileMenuOpen) {
        toggleMobileMenu();
    }
    if (width > 1024 && isSidebarOpen) {
        const sidebar = document.getElementById("sidebar");
        const overlay = document.querySelector(".sidebar-overlay");
        if (sidebar) sidebar.classList.remove("active");
        if (overlay) overlay.classList.remove("active");
        isSidebarOpen = false;
        document.body.style.overflow = "auto";
    }
}


document.addEventListener("DOMContentLoaded", function() {
    setupDragAndDrop();
    const savedUser = localStorage.getItem("currentUser");
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        if (currentUser.hasCompletedAssessment) {
            showDashboard();
        } else if (currentUser.hasCompletedWelcome) {
            startAssessment();
        } else {
            showWelcomePage();
        }
    } else {
        showPage("landing-page");
    }

    window.addEventListener("resize", handleWindowResize);

    document.addEventListener("click", (e) => {
        const navLinks = document.getElementById("nav-links");
        const hamburger = document.querySelector(".hamburger-menu");
        if (isMobileMenuOpen && navLinks && !navLinks.contains(e.target) && !hamburger.contains(e.target)) {
            toggleMobileMenu();
        }
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            if (isMobileMenuOpen) {
                toggleMobileMenu();
            }
            if (isSidebarOpen) {
                toggleSidebar();
            }
        }
    });

    if (document.getElementById("dashboard-page")) {
        createSidebarOverlay();
    }
});

function loadLatestDashboardData() {
    if (currentUser && currentUser.analysisHistory && currentUser.analysisHistory.length > 0) {
        const latestResults = currentUser.analysisHistory[currentUser.analysisHistory.length - 1];
        updateDashboardWithResults(latestResults);
    } else {
        // Clear dashboard elements or show empty state if no data
        document.getElementById("overall-mood").textContent = "N/A";
        document.getElementById("sentiment-score").textContent = "N/A";
        document.getElementById("voice-pitch").textContent = "N/A";
        document.getElementById("depression-risk").textContent = "N/A";
        document.getElementById("analysis-date").textContent = "N/A";
        document.getElementById("sample-duration").textContent = "N/A";
        // Reset charts to initial state with empty data
        initializeCharts(); 
        // Clear recommended videos section as well
        const recommendedResourcesContainer = document.getElementById("recommended-resources");
        if (recommendedResourcesContainer) {
            recommendedResourcesContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">💡</div>
                    <h3>Personalized Resources Appear Here</h3>
                    <p>Complete a voice analysis to get video recommendations based on your mood and tone.</p>
                </div>`;
        }
    }
}