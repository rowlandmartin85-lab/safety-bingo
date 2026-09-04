"use strict";

console.log("SAFETY BINGO AUDIO ENGINE LOADED");

class AudioEngine {
constructor() {
this.voiceEnabled = true;
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
        console.error(
            "SPEECH SYNTHESIS IS NOT AVAILABLE IN THIS BROWSER"
        );
        return;
    }

    const load = () => {
        const voices =
            window.speechSynthesis.getVoices();

        if (!voices.length) {
            console.log(
                "WAITING FOR SPEECH VOICES..."
            );
            return;
        }

        this.voicesLoaded = true;

        this.selectedVoice =
            this.findBestVoice(voices);

        console.log(
            "VOICE SELECTED:",
            this.selectedVoice
                ? this.selectedVoice.name
                : "DEFAULT"
        );
    };

    load();

    window.speechSynthesis.onvoiceschanged =
        load;
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
        const match =
            voices.find(
                voice =>
                    voice.name
                        .toLowerCase()
                        .includes(
                            name.toLowerCase()
                        )
            );

        if (match) {
            return match;
        }
    }

    return (
        voices.find(
            voice =>
                voice.lang === "en-US"
        ) ||
        voices.find(
            voice =>
                voice.lang.startsWith("en")
        ) ||
        voices[0]
    );
}

/*
 * =====================================================
 * MUTE
 * =====================================================
 */

setMuted(muted) {
    this.muted =
        muted === true;

    console.log(
        "AUDIO ENGINE:",
        this.muted
            ? "MUTED"
            : "UNMUTED"
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
 * SPEAK
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
        console.log(
            "AUDIO DISABLED — SPEECH SUPPRESSED"
        );
        return;
    }

    if (
        !("speechSynthesis" in window)
    ) {
        console.error(
            "SpeechSynthesis API NOT AVAILABLE"
        );
        return;
    }

    const cleanText =
        String(text)
            .replace(/\s+/g, " ")
            .trim();

    if (!cleanText) {
        return;
    }

    console.log(
        "AUDIO SPEAK:",
        cleanText
    );

    /*
     * Stop anything currently speaking.
     */
    window.speechSynthesis.cancel();

    this.locked = true;
    this.lastSpeech = cleanText;

    const speech =
        new SpeechSynthesisUtterance(
            cleanText
        );

    /*
     * Explicitly use English.
     */
    speech.lang = "en-US";

    if (this.selectedVoice) {
        speech.voice =
            this.selectedVoice;
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

    speech.onstart = () => {
        console.log(
            "AUDIO PLAYBACK STARTED"
        );
    };

    speech.onend = () => {
        console.log(
            "AUDIO PLAYBACK FINISHED"
        );

        this.locked = false;
    };

    speech.onerror = event => {
        console.error(
            "AUDIO SPEECH ERROR:",
            event.error
        );

        this.locked = false;
    };

    /*
     * Final mute check immediately before
     * sending the utterance to the browser.
     */
    if (this.muted) {
        this.locked = false;
        return;
    }

    try {
        window.speechSynthesis.speak(
            speech
        );

        /*
         * Some Chromium-based browsers can
         * pause speech synthesis unexpectedly.
         */
        if (
            typeof window.speechSynthesis
                .resume === "function"
        ) {
            window.speechSynthesis.resume();
        }

    } catch (error) {
        console.error(
            "AUDIO PLAYBACK EXCEPTION:",
            error
        );

        this.locked = false;
    }
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

    console.log(
        "READING QUESTION:",
        question
    );

    this.speak(
        question,
        {
            rate: 0.78,
            pitch: 1,
            volume: 1,
            force: true
        }
    );
}

readAnswer(answer) {
    if (!answer) {
        return;
    }

    this.speak(
        "The answer is... " +
            answer,
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

/*
 * =====================================================
 * STOP
 * =====================================================
 */

stop() {
    console.log(
        "AUDIO STOP"
    );

    if (
        "speechSynthesis" in window
    ) {
        window.speechSynthesis.cancel();
    }

    this.locked = false;
}

/*
 * =====================================================
 * BROWSER AUDIO UNLOCK
 * =====================================================
 *
 * Do NOT speak an empty utterance.
 */

unlock() {
    if (this.muted) {
        console.log(
            "AUDIO UNLOCK SKIPPED — MUTED"
        );
        return;
    }

    console.log(
        "AUDIO UNLOCKED"
    );

    if (
        "speechSynthesis" in window &&
        typeof window.speechSynthesis.resume ===
            "function"
    ) {
        try {
            window.speechSynthesis.resume();
        } catch (error) {
            console.warn(
                "AUDIO RESUME ERROR:",
                error
            );
        }
    }
}

}

/*

=========================================================
CREATE GLOBAL AUDIO ENGINE
=========================================================
*/
window.audioEngine =
new AudioEngine();

/*

=========================================================
FIRST USER INTERACTION
=========================================================
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
