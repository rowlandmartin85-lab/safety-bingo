"use strict";

console.log("SAFETY BINGO AUDIO ENGINE LOADED");

class AudioEngine {
constructor() {
this.voiceEnabled = true;
this.muted = false;
this.locked = false;
this.voicesLoaded = false;
this.selectedVoice = null;
this.audioUnlocked = false;

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
            "AUDIO ENGINE: Speech synthesis unavailable."
        );
        return;
    }

    const load = () => {
        const voices =
            window.speechSynthesis.getVoices();

        if (!voices.length) {
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
 * AUDIO UNLOCK
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
     * resume() is important for browsers that
     * leave SpeechSynthesis suspended.
     */
    try {
        window.speechSynthesis.resume();
    } catch (error) {
        console.warn(
            "AUDIO ENGINE: RESUME ERROR:",
            error
        );
    }

    /*
     * Mark the display as user-authorized.
     */
    this.audioUnlocked = true;

    console.log(
        "AUDIO ENGINE: USER AUDIO UNLOCKED"
    );
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
            "AUDIO ENGINE: SPEECH BLOCKED — MUTED"
        );

        return;
    }

    if (!this.voiceEnabled) {
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
     * If the browser has never received a user
     * interaction, speech may be rejected with
     * "not-allowed".
     *
     * Do NOT try to fake a user gesture.
     */
    if (!this.audioUnlocked) {
        console.warn(
            "AUDIO ENGINE: SPEECH BLOCKED — DISPLAY HAS NOT BEEN USER-UNLOCKED"
        );

        this.showUnlockMessage();

        return;
    }

    /*
     * Stop previous speech before starting
     * the new question.
     */
    try {
        window.speechSynthesis.cancel();
        window.speechSynthesis.resume();
    } catch (error) {
        console.warn(
            "AUDIO ENGINE: RESET SPEECH ERROR:",
            error
        );
    }

    this.locked = true;

    const cleanText =
        String(text)
            .replace(/\s+/g, " ")
            .trim();

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
            event.error
        );

        /*
         * If the browser says not-allowed,
         * the display needs another user gesture.
         */
        if (
            event.error ===
            "not-allowed"
        ) {
            this.audioUnlocked = false;

            this.showUnlockMessage();
        }
    };

    /*
     * Start immediately.
     *
     * Do not use a delayed setTimeout here.
     */
    try {
        window.speechSynthesis.speak(
            speech
        );
    } catch (error) {
        this.locked = false;

        console.error(
            "AUDIO ENGINE: SPEAK FAILED:",
            error
        );
    }
}

/*
 * =====================================================
 * USER UNLOCK MESSAGE
 * =====================================================
 */

showUnlockMessage() {
    /*
     * Don't repeatedly create messages.
     */
    if (
        document.getElementById(
            "audioUnlockMessage"
        )
    ) {
        return;
    }

    const message =
        document.createElement(
            "div"
        );

    message.id =
        "audioUnlockMessage";

    message.textContent =
        "CLICK OR TAP THIS DISPLAY ONCE TO ENABLE QUESTION AUDIO";

    message.style.position =
        "fixed";

    message.style.left =
        "50%";

    message.style.bottom =
        "30px";

    message.style.transform =
        "translateX(-50%)";

    message.style.zIndex =
        "9999999";

    message.style.padding =
        "18px 28px";

    message.style.borderRadius =
        "12px";

    message.style.background =
        "rgba(0,0,0,.9)";

    message.style.color =
        "#FFD84D";

    message.style.fontFamily =
        "Arial, sans-serif";

    message.style.fontSize =
        "clamp(16px, 2vw, 28px)";

    message.style.fontWeight =
        "900";

    message.style.textAlign =
        "center";

    message.style.boxShadow =
        "0 0 25px rgba(255,216,77,.6)";

    document.body.appendChild(
        message
    );
}

hideUnlockMessage() {
    const message =
        document.getElementById(
            "audioUnlockMessage"
        );

    if (message) {
        message.remove();
    }
}

/*
 * =====================================================
 * QUESTION / ANSWER
 * =====================================================
 */

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
        try {
            window.speechSynthesis.cancel();
        } catch (error) {
            console.warn(
                "AUDIO ENGINE: STOP ERROR:",
                error
            );
        }
    }

    this.locked = false;
}

/*
 * =====================================================
 * OPTIONAL SOUND COMPATIBILITY
 * =====================================================
 */

play(soundName) {
    if (this.muted) {
        return;
    }

    const sound =
        this.sounds[soundName];

    if (
        sound &&
        typeof sound.play ===
            "function"
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
                promise.catch(
                    error => {
                        console.warn(
                            "AUDIO ENGINE SOUND ERROR:",
                            error
                        );
                    }
                );
            }
        } catch (error) {
            console.warn(
                "AUDIO ENGINE SOUND ERROR:",
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
window.audioEngine =
new AudioEngine();

/*

=========================================================
IMPORTANT:
USER GESTURE UNLOCK
=========================================================
*/
function unlockDisplayAudio() {
if (
!window.audioEngine
) {
return;
}

window.audioEngine.unlock();
window.audioEngine.hideUnlockMessage();

}

/*

Capture both mouse and touch.
These listeners remain available because some
browsers will not authorize speech from a
synthetic/indirect event.
*/
document.addEventListener(
"click",
unlockDisplayAudio,
{
passive: true
}
);

document.addEventListener(
"touchstart",
unlockDisplayAudio,
{
passive: true
}
);

document.addEventListener(
"pointerdown",
unlockDisplayAudio,
{
passive: true
}
);

console.log(
"SAFETY BINGO AUDIO ENGINE READY"
);
