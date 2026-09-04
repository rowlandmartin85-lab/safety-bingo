
"use strict";

console.log("SAFETY BINGO AUDIO ENGINE LOADED");

class AudioEngine {

    constructor() {

        this.voiceEnabled = true;

        /*
         * IMPORTANT:
         * Mute is controlled by the HOST.
         * The DISPLAY does not require a click to
         * enable or unlock the audio control system.
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

        window.speechSynthesis.onvoiceschanged = load;
    }


    /*
    =====================================================
    VOICE SELECTION
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
            )

            ||

            voices.find(
                voice =>
                    voice.lang &&
                    voice.lang.startsWith("en")
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
         * If muted while something is speaking,
         * immediately stop the current speech.
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
    SPEECH ENGINE
    =====================================================
    */

    speak(text, options = {}) {

        if (!text) {
            return;
        }


        /*
         * MUTE IS THE ONLY AUDIO BLOCK.
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


        if (!("speechSynthesis" in window)) {

            console.error(
                "AUDIO ENGINE: speechSynthesis unavailable."
            );

            return;
        }


        /*
         * Stop any previous question before
         * reading the new question.
         */
        try {

            window.speechSynthesis.cancel();

            /*
             * Some browsers can leave speech synthesis
             * suspended. Resume it before speaking.
             */
            window.speechSynthesis.resume();

        } catch (error) {

            console.warn(
                "AUDIO ENGINE: SPEECH RESET ERROR:",
                error
            );
        }


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
         * No audioUnlocked check.
         * No fake click.
         * No unlock message.
         * No setTimeout delay.
         *
         * The display simply attempts to speak
         * when the host sends the question.
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
    =====================================================
    QUESTION
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
    ANSWER
    =====================================================
    */

    readAnswer(answer) {

        if (!answer) {
            return;
        }

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
    GAME START
    =====================================================
    */

    gameStart() {

        this.intro();

    }


    /*
    =====================================================
    STOP ALL SPEECH
    =====================================================
    */

    stop() {

        if ("speechSynthesis" in window) {

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
    OPTIONAL SOUND SUPPORT
    =====================================================
    */

    play(soundName) {

        if (this.muted) {
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


console.log(
    "SAFETY BINGO AUDIO ENGINE READY"
);
