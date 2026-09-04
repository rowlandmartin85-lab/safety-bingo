"use strict";

console.log("SAFETY BINGO AUDIO ENGINE LOADED");

class AudioEngine {
    constructor() {
        this.voiceEnabled = true;
        this.locked = false;
        this.voicesLoaded = false;
        this.selectedVoice = null;
        this.sounds = { intro: null, whoosh: null, ding: null, end: null };
        this.lastSpeech = "";
        this.loadVoices();
    }

    loadVoices() {
        if (!("speechSynthesis" in window)) {
            console.warn("Speech synthesis unavailable");
            return;
        }

        const load = () => {
            const voices = window.speechSynthesis.getVoices();
            if (voices.length) {
                this.voicesLoaded = true;
                this.selectedVoice = this.findBestVoice(voices);
                console.log("VOICE SELECTED:", this.selectedVoice?.name);
            }
        };

        load();
        window.speechSynthesis.onvoiceschanged = load;
    }

    findBestVoice(voices) {
        const preferred = ["Samantha", "Ava", "Karen", "Victoria", "Zira", "Aria", "Jenny", "Google US English", "Microsoft", "Siri"];

        for (let name of preferred) {
            const match = voices.find(voice => voice.name.includes(name));
            if (match) return match;
        }

        return voices.find(v => v.lang === "en-US") || voices.find(v => v.lang.startsWith("en"));
    }

    speak(text, options = {}) {
        if (!this.voiceEnabled || !text || !("speechSynthesis" in window)) return;
        if (this.locked && !options.force) return;

        this.locked = true;
        window.speechSynthesis.cancel();

        const cleanText = text.replace(/\s+/g, " ");
        const speech = new SpeechSynthesisUtterance(cleanText);

        if (this.selectedVoice) speech.voice = this.selectedVoice;

        speech.rate = options.rate || 0.82;
        speech.pitch = options.pitch || 1;
        speech.volume = options.volume || 1;

        speech.onend = () => { this.locked = false; };
        speech.onerror = () => { this.locked = false; };

        setTimeout(() => { window.speechSynthesis.speak(speech); }, 150);
    }

    intro() {
        this.speak("This... is... Safety Standdown Bingo", { rate: 0.65, pitch: 1, volume: 1, force: true });
    }

    readQuestion(question) {
        if (!question) return;
        this.speak(question, { rate: 0.78, pitch: 1, force: true });
    }

    readAnswer(answer) {
        if (!answer) return;
        this.speak("The answer is... " + answer, { rate: 0.75, pitch: 1, force: true });
    }

    gameStart() {
        this.intro();
    }

    stop() {
        if ("speechSynthesis" in window) window.speechSynthesis.cancel();
        this.locked = false;
    }

    unlock() {
        if ("speechSynthesis" in window) {
            const silent = new SpeechSynthesisUtterance("");
            silent.volume = 0;
            window.speechSynthesis.speak(silent);
        }
        console.log("AUDIO UNLOCKED");
    }
}

window.audioEngine = new AudioEngine();

document.addEventListener("click", () => {
    if (window.audioEngine) window.audioEngine.unlock();
}, { once: true });
