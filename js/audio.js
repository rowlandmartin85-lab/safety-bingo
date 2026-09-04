"use strict";

console.log("SAFETY BINGO AUDIO ENGINE LOADED");

class AudioEngine {
constructor() {
this.voiceEnabled = true;

    /*
     * DISPLAY MUTE STATE
     *
     * This is controlled by the host through
     * the Socket.IO server.
     */
    this.muted = false;

    this.locked = false;
    this.voicesLoaded = false;
    this.selectedVoice = null;

    this.sounds = {
        intro: null,
        whoosh: null,
        ding: null,
        end: null,
        bingo: null
    };

    this.lastSpeech = "";

    this.loadVoices();
}

/* =====================================================
   VOICE LOADING
   ===================================================== */

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

    for (const name of preferred) {
        const match = voices.find(voice =>
            voice.name.includes(name)
        );

        if (match) {
            return match;
        }
    }

    return (
        voices.find(v => v.lang === "en-US") ||
        voices.find(v => v.lang.startsWith("en"))
    );
}

/* =====================================================
   MUTE CONTROL
   ===================================================== */

setMuted(muted) {
    this.muted = muted === true;

    console.log(
        "========== AUDIO ENGINE MUTE ==========",
        this.muted ? "MUTED" : "UNMUTED"
    );

    /*
     * IMPORTANT:
     *
     * Cancel any speech already playing when
     * mute is activated.
     */
    if (this.muted) {
        this.stop();
    }
}

isMuted() {
    return this.muted === true;
}

/* =====================================================
   SPEECH
   ===================================================== */

speak(text, options = {}) {
    /*
     * MUTE CHECK #1
     *
     * Do this before creating or scheduling
     * any speech.
     */
    if (this.muted) {
        console.log(
            "AUDIO MUTED — SPEECH BLOCKED:",
            text
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

    if (this.locked && !options.force) {
        return;
    }

    this.locked = true;

    window.speechSynthesis.cancel();

    const cleanText = text.replace(/\s+/g, " ");

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

    speech.onend = () => {
        this.locked = false;
    };

    speech.onerror = () => {
        this.locked = false;
    };

    /*
     * Give the browser a short delay, but check
     * mute AGAIN immediately before playback.
     *
     * This prevents speech from slipping through
     * if the host presses mute during the delay.
     */
    setTimeout(() => {
        if (this.muted) {
            console.log(
                "AUDIO MUTED — DELAYED SPEECH CANCELLED"
            );

            this.locked = false;
            return;
        }

        if (!("speechSynthesis" in window)) {
            this.locked = false;
            return;
        }

        window.speechSynthesis.speak(speech);
    }, 150);
}

/* =====================================================
   AUDIO COMMANDS
   ===================================================== */

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

/* =====================================================
   SOUND EFFECT SUPPORT
   ===================================================== */

play(soundName) {
    /*
     * Keep compatibility with display.js.
     *
     * If actual sound files are added later,
     * they can be played from this method.
     *
     * For now, mute prevents any sound playback.
     */
    if (this.muted) {
        console.log(
            "AUDIO MUTED — SOUND BLOCKED:",
            soundName
        );

        return;
    }

    const sound = this.sounds[soundName];

    if (!sound) {
        return;
    }

    try {
        sound.currentTime = 0;
        sound.play().catch(error => {
            console.warn(
                "AUDIO PLAYBACK FAILED:",
                error
            );
        });
    } catch (error) {
        console.warn(
            "AUDIO PLAY ERROR:",
            error
        );
    }
}

/* =====================================================
   STOP
   ===================================================== */

stop() {
    if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
    }

    this.locked = false;
}

/* =====================================================
   BROWSER AUDIO UNLOCK
   ===================================================== */

unlock() {
    /*
     * NEVER attempt to unlock/start speech while
     * the display is muted.
     */
    if (this.muted) {
        console.log(
            "AUDIO UNLOCK SKIPPED — DISPLAY MUTED"
        );

        return;
    }

    if ("speechSynthesis" in window) {
        const silent =
            new SpeechSynthesisUtterance("");

        silent.volume = 0;

        window.speechSynthesis.speak(silent);
    }

    console.log("AUDIO UNLOCKED");
}

}

/* =========================================================
GLOBAL AUDIO ENGINE
========================================================= */

window.audioEngine = new AudioEngine();

/*

Browser audio unlock.
Only runs once after the first user interaction.
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
