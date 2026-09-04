"use strict";

console.log("SAFETY BINGO AUDIO ENGINE LOADED");

class AudioEngine {
    constructor() {
        this.voiceEnabled = true;
        this.muted = false;
        this.locked = false;
        this.voicesLoaded = false;
        this.selectedVoice = null;
        this.speechQueue = [];
        this.isSpeaking = false;
        this.audioUnlocked = false;

        this.sounds = {
            intro: null,
            whoosh: null,
            ding: null,
            end: null,
            bingo: null
        };

        this.initialize();
    }

    initialize() {
        this.loadVoices();
        this.createAudioKeepAlive();

        // Try to prepare the speech system.
        this.prepareSpeech();

        // First user interaction unlocks browser audio.
        const unlock = () => {
            this.unlock();
            document.removeEventListener("click", unlock);
            document.removeEventListener("touchstart", unlock);
            document.removeEventListener("keydown", unlock);
        };

        document.addEventListener("click", unlock, { passive: true });
        document.addEventListener("touchstart", unlock, { passive: true });
        document.addEventListener("keydown", unlock, { passive: true });
    }

    // ==========================================
    // VOICE LOADING
    // ==========================================

    loadVoices() {
        if (!("speechSynthesis" in window)) {
            console.warn("Speech synthesis unavailable");
            return;
        }

        const load = () => {
            const voices = window.speechSynthesis.getVoices();

            if (!voices.length) {
                console.warn("NO SPEECH VOICES AVAILABLE YET");
                return;
            }

            this.voicesLoaded = true;
            this.selectedVoice = this.findBestVoice(voices);

            console.log(
                "VOICE SELECTED:",
                this.selectedVoice?.name,
                this.selectedVoice?.lang
            );
        };

        load();

        window.speechSynthesis.addEventListener(
            "voiceschanged",
            load
        );
    }

    findBestVoice(voices) {
        const preferred = [
            "Samantha",
            "Ava",
            "Karen",
            "Victoria",
            "Zira",
            "Aria",
            "Jenny",
            "Google US English",
            "Microsoft"
        ];

        for (const name of preferred) {
            const match = voices.find(voice =>
                voice.name.toLowerCase().includes(name.toLowerCase())
            );

            if (match) return match;
        }

        return (
            voices.find(v => v.lang === "en-US") ||
            voices.find(v => v.lang?.startsWith("en")) ||
            voices[0]
        );
    }

    // ==========================================
    // AUDIO KEEP-ALIVE
    // ==========================================

    createAudioKeepAlive() {
        if (document.getElementById("audioKeepAlive")) return;

        const audio = document.createElement("audio");

        audio.id = "audioKeepAlive";
        audio.preload = "auto";
        audio.loop = true;
        audio.muted = true;
        audio.playsInline = true;

        document.body.appendChild(audio);

        this.keepAliveAudio = audio;
    }

    // ==========================================
    // SPEECH PREPARATION
    // ==========================================

    prepareSpeech() {
        if (!("speechSynthesis" in window)) return;

        try {
            window.speechSynthesis.cancel();

            // Force the browser speech engine to initialize.
            const warmup = new SpeechSynthesisUtterance("");

            warmup.volume = 0;
            warmup.rate = 1;
            warmup.pitch = 1;

            if (this.selectedVoice) {
                warmup.voice = this.selectedVoice;
            }

            window.speechSynthesis.speak(warmup);

            console.log("SPEECH ENGINE PREPARED");
        } catch (error) {
            console.warn("SPEECH PREPARE ERROR:", error);
        }
    }

    // ==========================================
    // UNLOCK
    // ==========================================

    unlock() {
        if (this.audioUnlocked) return;

        this.audioUnlocked = true;

        console.log("DISPLAY AUDIO UNLOCKING");

        if ("speechSynthesis" in window) {
            try {
                window.speechSynthesis.resume();
            } catch (error) {
                console.warn("SPEECH RESUME ERROR:", error);
            }
        }

        if (this.keepAliveAudio) {
            this.keepAliveAudio.play().catch(() => {
                // Browser may still require user interaction.
            });
        }

        this.prepareSpeech();

        console.log("DISPLAY AUDIO UNLOCKED");
    }

    // ==========================================
    // MUTE
    // ==========================================

    mute() {
        this.muted = true;

        console.log("DISPLAY AUDIO MUTED");

        if ("speechSynthesis" in window) {
            window.speechSynthesis.cancel();
        }

        this.speechQueue = [];
        this.isSpeaking = false;
        this.locked = false;
    }

    unmute() {
        this.muted = false;

        console.log("DISPLAY AUDIO UNMUTED");

        this.prepareSpeech();
    }

    toggleMute() {
        if (this.muted) {
            this.unmute();
        } else {
            this.mute();
        }

        return this.muted;
    }

    isMuted() {
        return this.muted;
    }

    // ==========================================
    // SPEAK
    // ==========================================

    speak(text, options = {}) {
        if (!text) return;

        if (this.muted) {
            console.log("AUDIO MUTED - SPEECH SUPPRESSED");
            return;
        }

        if (!this.voiceEnabled) return;

        if (!("speechSynthesis" in window)) {
            console.warn("SPEECH SYNTHESIS NOT AVAILABLE");
            return;
        }

        const cleanText = String(text)
            .replace(/\s+/g, " ")
            .trim();

        if (!cleanText) return;

        // Force option allows important messages to interrupt.
        if (options.force === true) {
            window.speechSynthesis.cancel();
            this.speechQueue = [];
            this.isSpeaking = false;
        }

        this.speechQueue.push({
            text: cleanText,
            rate: options.rate ?? 0.78,
            pitch: options.pitch ?? 1,
            volume: options.volume ?? 1
        });

        this.processQueue();
    }

    // ==========================================
    // QUEUE
    // ==========================================

    processQueue() {
        if (this.isSpeaking) return;

        if (!this.speechQueue.length) return;

        if (this.muted) {
            this.speechQueue = [];
            return;
        }

        const item = this.speechQueue.shift();

        this.isSpeaking = true;
        this.locked = true;

        const speech = new SpeechSynthesisUtterance(item.text);

        if (this.selectedVoice) {
            speech.voice = this.selectedVoice;
        }

        speech.rate = item.rate;
        speech.pitch = item.pitch;
        speech.volume = item.volume;

        speech.onstart = () => {
            console.log("SPEECH STARTED:", item.text);
        };

        speech.onend = () => {
            console.log("SPEECH FINISHED");

            this.isSpeaking = false;
            this.locked = false;

            setTimeout(() => {
                this.processQueue();
            }, 50);
        };

        speech.onerror = error => {
            console.warn("SPEECH ERROR:", error);

            this.isSpeaking = false;
            this.locked = false;

            setTimeout(() => {
                this.processQueue();
            }, 50);
        };

        try {
            window.speechSynthesis.speak(speech);
        } catch (error) {
            console.error("SPEECH START ERROR:", error);

            this.isSpeaking = false;
            this.locked = false;
        }
    }

    // ==========================================
    // GAME AUDIO
    // ==========================================

    intro() {
        this.speak(
            "This is Safety Standdown Bingo",
            {
                rate: 0.65,
                pitch: 1,
                volume: 1,
                force: true
            }
        );
    }

    readQuestion(question) {
        if (!question) return;

        console.log("READING QUESTION:", question);

        this.speak(question, {
            rate: 0.78,
            pitch: 1,
            volume: 1,
            force: true
        });
    }

    readAnswer(answer) {
        if (!answer) return;

        this.speak(
            "The answer is... " + answer,
            {
                rate: 0.75,
                pitch: 1,
                volume: 1,
                force: true
            }
        );
    }

    gameStart() {
        this.intro();
    }

    stop() {
        if ("speechSynthesis" in window) {
            window.speechSynthesis.cancel();
        }

        this.speechQueue = [];
        this.isSpeaking = false;
        this.locked = false;
    }
}

window.audioEngine = new AudioEngine();
