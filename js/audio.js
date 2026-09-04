"use strict";

console.log(
    "SAFETY BINGO AUDIO ENGINE LOADED"
);

class AudioEngine {

    constructor() {

        this.voiceEnabled = true;

        /*
         * NEW:
         * Mute is controlled by the HOST.
         * It does NOT require a display click.
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


    /*
    =====================================================
    VOICE LOADING
    =====================================================
    */

    loadVoices() {

        if (!("speechSynthesis" in window)) {

            console.warn(
                "Speech synthesis unavailable"
            );

            return;
        }

        const load = () => {

            const voices =
                window.speechSynthesis.getVoices();

            if (voices.length) {

                this.voicesLoaded = true;

                this.selectedVoice =
                    this.findBestVoice(
                        voices
                    );

                console.log(
                    "VOICE SELECTED:",
                    this.selectedVoice?.name
                );
            }
        };

        load();

        window.speechSynthesis.onvoiceschanged =
            load;
    }


    /*
    =====================================================
    VOICE SELECTION ENGINE
    =====================================================
    */

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

            const match =
                voices.find(
                    voice =>
                        voice.name.includes(name)
                );

            if (match) {
                return match;
            }
        }

        return (

            voices.find(
                v =>
                    v.lang === "en-US"
            )

            ||

            voices.find(
                v =>
                    v.lang &&
                    v.lang.startsWith("en")
            )

            ||

            voices[0]
        );
    }


    /*
    =====================================================
    MUTE CONTROL
    =====================================================
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

        /*
         * If the host mutes the display,
         * immediately stop anything currently speaking.
         */
        if (this.muted) {

            this.stop();
        }
    }


    isMuted() {

        return this.muted === true;
    }


    /*
    =====================================================
    SPEECH CORE
    =====================================================
    */

    speak(text, options = {}) {

        /*
         * MUTE CHECK
         */
        if (this.muted) {

            console.log(
                "AUDIO ENGINE: SPEECH BLOCKED — MUTED"
            );

            return;
        }


        if (!this.voiceEnabled) {

            return;
        }


        if (!text) {

            return;
        }


        if (!("speechSynthesis" in window)) {

            console.warn(
                "Speech synthesis unavailable"
            );

            return;
        }


        /*
         * Prevent overlapping questions.
         *
         * force:true is still respected because
         * your existing display.js uses it.
         */
        if (
            this.locked &&
            !options.force
        ) {

            return;
        }


        this.locked = true;


        /*
         * Cancel previous speech.
         */
        try {

            window.speechSynthesis.cancel();

        } catch (error) {

            console.warn(
                "AUDIO ENGINE: CANCEL ERROR:",
                error
            );
        }


        /*
         * Clean the text.
         */
        const cleanText =
            String(text)
                .replace(
                    /\s+/g,
                    " "
                )
                .trim();


        if (!cleanText) {

            this.locked = false;

            return;
        }


        /*
         * Create speech.
         */
        const speech =
            new SpeechSynthesisUtterance(
                cleanText
            );


        /*
         * Selected voice.
         */
        if (this.selectedVoice) {

            speech.voice =
                this.selectedVoice;
        }


        /*
         * Language.
         */
        speech.lang =
            this.selectedVoice?.lang ||
            "en-US";


        /*
         * Speech settings.
         */
        speech.rate =
            typeof options.rate === "number"
                ? options.rate
                : 0.82;


        speech.pitch =
            typeof options.pitch === "number"
                ? options.pitch
                : 1;


        speech.volume =
            typeof options.volume === "number"
                ? options.volume
                : 1;


        /*
         * Speech started.
         */
        speech.onstart = () => {

            console.log(
                "AUDIO ENGINE: SPEAKING:",
                cleanText
            );
        };


        /*
         * Speech finished.
         */
        speech.onend = () => {

            this.locked = false;

            console.log(
                "AUDIO ENGINE: SPEECH COMPLETE"
            );
        };


        /*
         * Speech error.
         */
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
         * We are NOT checking audioUnlocked.
         *
         * We are NOT requiring a display click.
         *
         * We are NOT showing an unlock message.
         *
         * We are returning to the behavior of
         * your original working audio engine.
         */

        setTimeout(
            () => {

                /*
                 * Host may have muted audio during
                 * the tiny delay.
                 */
                if (this.muted) {

                    this.locked = false;

                    return;
                }


                try {

                    /*
                     * Resume if the browser has
                     * suspended speech synthesis.
                     */
                    if (
                        typeof window.speechSynthesis.resume ===
                        "function"
                    ) {

                        window.speechSynthesis.resume();
                    }


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

            },
            150
        );
    }


    /*
    =====================================================
    INTRO
    =====================================================
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


    /*
    =====================================================
    QUESTION ANNOUNCER
    =====================================================
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


    /*
    =====================================================
    ANSWER ANNOUNCER
    =====================================================
    */

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


    /*
    =====================================================
    GAME START
    =====================================================
    */

    gameStart() {

        this.intro();
    }


    /*
    =====================================================
    STOP ALL AUDIO
    =====================================================
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
    =====================================================
    OPTIONAL SOUND EFFECT COMPATIBILITY
    =====================================================
    */

    play(soundName) {

        if (this.muted) {

            console.log(
                "AUDIO ENGINE: SOUND BLOCKED — MUTED:",
                soundName
            );

            return;
        }


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

                    promise.catch(
                        error => {

                            console.warn(
                                "AUDIO ENGINE: SOUND ERROR:",
                                error
                            );
                        }
                    );
                }

            } catch (error) {

                console.warn(
                    "AUDIO ENGINE: SOUND ERROR:",
                    error
                );
            }
        }
    }


    /*
    =====================================================
    OPTIONAL UNLOCK
    =====================================================
    *
    * Kept only for compatibility with any existing
    * code that might call audioEngine.unlock().
    *
    * It does NOT create an "audioUnlocked" state.
    * It does NOT require a display click.
    */

    unlock() {

        if (this.muted) {

            console.log(
                "AUDIO ENGINE: UNLOCK SKIPPED — MUTED"
            );

            return;
        }


        if (
            "speechSynthesis" in window &&
            typeof window.speechSynthesis.resume ===
            "function"
        ) {

            try {

                window.speechSynthesis.resume();

            } catch (error) {

                console.warn(
                    "AUDIO ENGINE: RESUME ERROR:",
                    error
                );
            }
        }

        console.log(
            "AUDIO ENGINE: READY"
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


console.log(
    "SAFETY BINGO AUDIO ENGINE READY"
);
