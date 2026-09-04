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
        end: null,
        bingo: null
    };

    this.lastSpeech = "";

    this.loadVoices();
}

loadVoices() {
    if (!("speechSynthesis" in window)) {
        console.error(
            "AUDIO ENGINE: Speech synthesis is NOT supported by this browser."
        );
        return;
    }

    const load = () => {
        const voices =
            window.speechSynthesis.getVoices();

        if (!voices.length) {
            console.warn(
                "AUDIO ENGINE: No speech voices available yet."
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
                : "browser default"
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
        const match = voices.find(
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
                voice.lang &&
                voice.lang.startsWith("en")
        ) ||
        voices[0]
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
 * SPEECH
 * =====================================================
 */

speak(text, options = {}) {
    if (!text) {
        return;
    }

    if (this.muted) {
        console.log(
            "AUDIO ENGINE: SPEECH BLOCKED — MUTED"
        );
        return;
    }

    if (!this.voiceEnabled) {
        console.log(
            "AUDIO ENGINE: SPEECH BLOCKED — VOICE DISABLED"
        );
        return;
    }

    if (
        !("speechSynthesis" in window)
    ) {
        console.error(
            "AUDIO ENGINE: speechSynthesis unavailable."
        );
        return;
    }

    /*
     * Cancel anything currently speaking.
     * This prevents the previous question from
     * preventing the new question from playing.
     */
    window.speechSynthesis.cancel();

    this.locked = true;

    const cleanText =
        String(text)
            .replace(/\s+/g, " ")
            .trim();

    if (!cleanText) {
        this.locked = false;
        return;
    }

    const speech =
        new SpeechSynthesisUtterance(
            cleanText
        );

    if (this.selectedVoice) {
        speech.voice =
            this.selectedVoice;
    }

    speech.lang =
        this.selectedVoice?.lang ||
        "en-US";

    speech.rate =
        typeof options.rate === "number"
            ? options.rate
            : 0.78;

    speech.pitch =
        typeof options.pitch === "number"
            ? options.pitch
            : 1;

    speech.volume =
        typeof options.volume === "number"
            ? options.volume
            : 1;

    speech.onstart = () => {
        console.log(
            "AUDIO ENGINE: SPEAKING:",
            cleanText
        );
    };

    speech.onend = () => {
        this.locked = false;

        console.log(
            "AUDIO ENGINE: SPEECH COMPLETE"
        );
    };

    speech.onerror = event => {
        this.locked = false;

        console.error(
            "AUDIO ENGINE: SPEECH ERROR:",
            event
        );
    };

    /*
     * IMPORTANT:
     *
     * Do not wait 150ms before calling speak().
     * That delay was allowing browser speech state
     * and mute state to get out of sync.
     */
    const playSpeech = () => {
        /*
         * Check mute one final time immediately
         * before playback.
         */
        if (this.muted) {
            this.locked = false;

            console.log(
                "AUDIO ENGINE: SPEECH CANCELLED — MUTED"
            );

            return;
        }

        try {
            window.speechSynthesis.speak(
                speech
            );
        } catch (error) {
            this.locked = false;

            console.error(
                "AUDIO ENGINE: FAILED TO SPEAK:",
                error
            );
        }
    };

    /*
     * Give the browser one event-loop cycle.
     * This is much safer than an arbitrary 150ms delay.
     */
    setTimeout(
        playSpeech,
        0
    );
}

/*
 * =====================================================
 * QUESTION / ANSWER AUDIO
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
        "AUDIO ENGINE: READING QUESTION:",
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
    if (
        "speechSynthesis" in window
    ) {
        window.speechSynthesis.cancel();
    }

    this.locked = false;

    console.log(
        "AUDIO ENGINE: STOPPED"
    );
}

/*
 * =====================================================
 * BROWSER AUDIO UNLOCK
 * =====================================================
 */

unlock() {
    if (this.muted) {
        console.log(
            "AUDIO ENGINE: UNLOCK SKIPPED — MUTED"
        );
        return;
    }

    if (
        !("speechSynthesis" in window)
    ) {
        return;
    }

    /*
     * Calling resume() is important on browsers
     * that leave speech synthesis suspended.
     */
    if (
        typeof window.speechSynthesis.resume ===
        "function"
    ) {
        window.speechSynthesis.resume();
    }

    console.log(
        "AUDIO ENGINE: UNLOCKED"
    );
}

/*
 * =====================================================
 * OPTIONAL SOUND COMPATIBILITY
 * =====================================================
 *
 * Your display.js may call audioEngine.play().
 * Keep this method so those calls don't fail.
 */

play(soundName) {
    if (this.muted) {
        console.log(
            "AUDIO ENGINE: SOUND BLOCKED — MUTED:",
            soundName
        );
        return;
    }

    console.log(
        "AUDIO ENGINE: PLAY REQUEST:",
        soundName
    );

    const sound =
        this.sounds[soundName];

    if (
        sound &&
        typeof sound.play === "function"
    ) {
        try {
            sound.currentTime = 0;

            const promise =
                sound.play();

            if (
                promise &&
                typeof promise.catch ===
                    "function"
            ) {
                promise.catch(error => {
                    console.warn(
                        "AUDIO ENGINE: SOUND PLAY FAILED:",
                        error
                    );
                });
            }
        } catch (error) {
            console.warn(
                "AUDIO ENGINE: SOUND ERROR:",
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
BROWSER AUDIO UNLOCK
=========================================================
The first click/touch on the display unlocks
browser speech/audio.
*/
const unlockAudio = () => {
if (
window.audioEngine &&
typeof window.audioEngine.unlock ===
"function"
) {
window.audioEngine.unlock();
}
};

document.addEventListener(
"click",
unlockAudio,
{
once: true
}
);

document.addEventListener(
"touchstart",
unlockAudio,
{
once: true,
passive: true
}
);

console.log(
"SAFETY BINGO AUDIO ENGINE READY"
);
