"use strict";

console.log("SAFETY BINGO AUDIO ENGINE LOADED");

class AudioEngine {
constructor() {
this.voiceEnabled = true;

    // Added only for host-controlled display mute.
    this.muted = false;

    this.locked = false;
    this.voicesLoaded = false;
    this.selectedVoice = null;

    this.sounds = {
        intro: null,
        whoosh: null,
        ding: null,
        end: null
    };

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
            this.selectedVoice =
                this.findBestVoice(voices);

            console.log(
                "VOICE SELECTED:",
                this.selectedVoice?.name
            );
        }
    };

    load();

    window.speechSynthesis.onvoiceschanged = load;
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
        "Microsoft",
        "Siri"
    ];

    for (let name of preferred) {
        const match = voices.find(
            voice => voice.name.includes(name)
        );

        if (match) {
            return match;
        }
    }

    return (
        voices.find(
            v => v.lang === "en-US"
        ) ||
        voices.find(
            v => v.lang.startsWith("en")
        )
    );
}

/*
 * =====================================================
 * DISPLAY MUTE
 * =====================================================
 */

setMuted(muted) {
    this.muted = muted === true;

    console.log(
        "AUDIO ENGINE:",
        this.muted
            ? "MUTED"
            : "UNMUTED"
    );

    // Immediately stop speech that is already playing.
    if (this.muted) {
        this.stop();
    }
}

isMuted() {
    return this.muted === true;
}

/*
 * =====================================================
 * SPEECH
 * =====================================================
 */

speak(text, options = {}) {

    // Mute must be checked before doing anything else.
    if (this.muted) {
        console.log(
            "AUDIO MUTED — SPEECH SUPPRESSED"
        );

        return;
    }

    if (
        !this.voiceEnabled ||
        !text ||
        !("speechSynthesis" in window)
    ) {
        return;
    }

    if (
        this.locked &&
        !options.force
    ) {
        return;
    }

    this.locked = true;

    window.speechSynthesis.cancel();

    const cleanText =
        text.replace(/\s+/g, " ");

    const speech =
        new SpeechSynthesisUtterance(
            cleanText
        );

    if (this.selectedVoice) {
        speech.voice =
            this.selectedVoice;
    }

    speech.rate =
        options.rate || 0.82;

    speech.pitch =
        options.pitch || 1;

    speech.volume =
        options.volume || 1;

    speech.onend = () => {
        this.locked = false;
    };

    speech.onerror = () => {
        this.locked = false;
    };

    /*
     * Keep the original 150ms delay.
     *
     * Check mute again immediately before
     * actually starting speech.
     */
    setTimeout(() => {

        if (this.muted) {
            this.locked = false;

            console.log(
                "AUDIO MUTED — DELAYED SPEECH SUPPRESSED"
            );

            return;
        }

        window.speechSynthesis.speak(
            speech
        );

    }, 150);
}

intro() {
    this.speak(
        "This... is... Safety Standdown Bingo",
        {
            rate: 0.65,
            pitch: 1,
            volume: 1,
            force: true
        }
    );
}

readQuestion(question) {
    if (!question) {
        return;
    }

    this.speak(
        question,
        {
            rate: 0.78,
            pitch: 1,
            force: true
        }
    );
}

readAnswer(answer) {
    if (!answer) {
        return;
    }

    this.speak(
        "The answer is... " + answer,
        {
            rate: 0.75,
            pitch: 1,
            force: true
        }
    );
}

gameStart() {
    this.intro();
}

stop() {
    if (
        "speechSynthesis" in window
    ) {
        window.speechSynthesis.cancel();
    }

    this.locked = false;
}

unlock() {

    /*
     * Do not attempt audio unlock while muted.
     */
    if (this.muted) {
        console.log(
            "AUDIO UNLOCK SKIPPED — DISPLAY MUTED"
        );

        return;
    }

    if (
        "speechSynthesis" in window
    ) {
        const silent =
            new SpeechSynthesisUtterance("");

        silent.volume = 0;

        window.speechSynthesis.speak(
            silent
        );
    }

    console.log(
        "AUDIO UNLOCKED"
    );
}

}

/*

=========================================================
GLOBAL AUDIO ENGINE
=========================================================
*/
window.audioEngine =
new AudioEngine();

/*

Browser audio unlock.
Keep this exactly as before.
*/
document.addEventListener(
"click",
() => {
if (
window.audioEngine
) {
window.audioEngine.unlock();
}
},
{
once: true
}
);
