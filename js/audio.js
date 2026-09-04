"use strict";

console.log("SAFETY BINGO AUDIO ENGINE LOADED");

class AudioEngine {
constructor() {
this.voiceEnabled = true;

    // Host-controlled display mute state.
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
    this.speechTimeout = null;

    this.loadVoices();
}

loadVoices() {
    if (!("speechSynthesis" in window)) {
        console.warn("Speech synthesis unavailable");
        return;
    }

    const load = () => {
        const voices = window.speechSynthesis.getVoices();

        if (!voices.length) {
            return;
        }

        this.voicesLoaded = true;
        this.selectedVoice = this.findBestVoice(voices);

        console.log(
            "VOICE SELECTED:",
            this.selectedVoice?.name
        );
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

    for (const name of preferred) {
        const match = voices.find(
            voice => voice.name.includes(name)
        );

        if (match) {
            return match;
        }
    }

    return (
        voices.find(
            voice => voice.lang === "en-US"
        ) ||
        voices.find(
            voice => voice.lang.startsWith("en")
        )
    );
}

/*
 * =====================================================
 * MUTE CONTROL
 * =====================================================
 */

setMuted(muted) {
    this.muted = muted === true;

    console.log(
        "AUDIO ENGINE:",
        this.muted ? "MUTED" : "UNMUTED"
    );

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
    if (!text) {
        return;
    }

    if (this.muted) {
        console.log(
            "AUDIO MUTED — SPEECH SUPPRESSED"
        );
        return;
    }

    if (!this.voiceEnabled) {
        return;
    }

    if (!("speechSynthesis" in window)) {
        console.warn(
            "Speech synthesis unavailable"
        );
        return;
    }

    if (this.locked && !options.force) {
        return;
    }

    /*
     * Cancel any speech currently playing.
     */
    window.speechSynthesis.cancel();

    /*
     * Cancel any speech that was waiting
     * for the 150ms startup delay.
     */
    if (this.speechTimeout) {
        clearTimeout(this.speechTimeout);
        this.speechTimeout = null;
    }

    this.locked = true;

    const cleanText =
        String(text).replace(/\s+/g, " ").trim();

    if (!cleanText) {
        this.locked = false;
        return;
    }

    const speech =
        new SpeechSynthesisUtterance(cleanText);

    if (this.selectedVoice) {
        speech.voice = this.selectedVoice;
    }

    speech.rate =
        options.rate !== undefined
            ? options.rate
            : 0.82;

    speech.pitch =
        options.pitch !== undefined
            ? options.pitch
            : 1;

    speech.volume =
        options.volume !== undefined
            ? options.volume
            : 1;

    const releaseLock = () => {
        this.locked = false;
        this.speechTimeout = null;
    };

    speech.onend = releaseLock;
    speech.onerror = releaseLock;

    /*
     * Small delay preserves your existing behavior,
     * but mute is checked immediately before playback.
     */
    this.speechTimeout = setTimeout(() => {
        this.speechTimeout = null;

        if (this.muted) {
            this.locked = false;

            console.log(
                "AUDIO MUTED — DELAYED SPEECH SUPPRESSED"
            );

            return;
        }

        try {
            window.speechSynthesis.speak(speech);
        } catch (error) {
            console.error(
                "SPEECH PLAYBACK ERROR:",
                error
            );

            this.locked = false;
        }
    }, 150);
}

/*
 * =====================================================
 * GAME AUDIO
 * =====================================================
 */

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

/*
 * =====================================================
 * STOP
 * =====================================================
 */

stop() {
    if (this.speechTimeout) {
        clearTimeout(this.speechTimeout);
        this.speechTimeout = null;
    }

    if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
    }

    this.locked = false;
}

/*
 * =====================================================
 * BROWSER AUDIO UNLOCK
 * =====================================================
 *
 * IMPORTANT:
 * Do NOT create an empty SpeechSynthesisUtterance here.
 *
 * Some browsers can leave speechSynthesis in a bad
 * state after an empty utterance.
 */

unlock() {
    if (this.muted) {
        console.log(
            "AUDIO UNLOCK SKIPPED — DISPLAY MUTED"
        );

        return;
    }

    console.log("AUDIO UNLOCKED");

    /*
     * Just resume the speech engine if the browser
     * exposes resume(). Do not speak anything.
     */
    if (
        "speechSynthesis" in window &&
        typeof window.speechSynthesis.resume ===
            "function"
    ) {
        try {
            window.speechSynthesis.resume();
        } catch (error) {
            console.warn(
                "Speech synthesis resume failed:",
                error
            );
        }
    }
}

}

/*

=========================================================
GLOBAL AUDIO ENGINE
=========================================================
*/
window.audioEngine = new AudioEngine();

/*

Unlock browser speech handling after the first
user interaction.
This does NOT play an empty utterance.
*/
document.addEventListener(
"click",
() => {
if (window.audioEngine) {
window.audioEngine.unlock();
}
},
{
once: true
}
);
