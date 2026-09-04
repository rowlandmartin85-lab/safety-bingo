
"use strict";

console.log(
    "SAFETY BINGO AUDIO ENGINE LOADED"
);

class AudioEngine {

    constructor() {

        this.voiceEnabled = true;

        /*
        =====================================================
        DISPLAY MUTE STATE
        =====================================================

        This is controlled by the HOST through Socket.IO.

        false = audio works normally
        true  = audio is suppressed
        */
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


    /*
    =====================================================
    VOICE LOADING
    =====================================================
    */

    loadVoices() {

        if (
            !("speechSynthesis" in window)
        ) {

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

        for (
            let name of preferred
        ) {

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
                    v.lang.startsWith("en")
            )

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
        If the host mutes while speech is
        currently playing, stop it immediately.
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
        IMPORTANT:

        Mute only affects whether audio plays.

        It does NOT change the original
        browser audio/unlock behavior.
        */

        if (this.muted) {

            console.log(
                "AUDIO MUTED — SPEECH SUPPRESSED"
            );

            return;
        }


        if (
            !this.voiceEnabled
        ) {

            return;
        }


        if (
            !text
        ) {

            return;
        }


        if (
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
            text
                .replace(
                    /\s+/g,
                    " "
                );


        const speech =
            new SpeechSynthesisUtterance(
                cleanText
            );


        if (
            this.selectedVoice
        ) {

            speech.voice =
                this.selectedVoice;
        }


        speech.rate =
            options.rate || .82;


        speech.pitch =
            options.pitch || 1;


        speech.volume =
            options.volume || 1;


        speech.onend =
            () => {

                this.locked = false;
            };


        speech.onerror =
            () => {

                this.locked = false;
            };


        /*
        Safari needs a slight delay.
        */

        setTimeout(
            () => {

                /*
                Check mute one more time before
                actually speaking.

                This prevents a queued question
                from playing after the host presses
                MUTE during the 150ms delay.
                */

                if (this.muted) {

                    this.locked = false;

                    return;
                }


                window.speechSynthesis.speak(
                    speech
                );

            },
            150
        );
    }


    /*
    =====================================================
    SAFETY BINGO INTRO
    =====================================================
    */

    intro() {

        this.speak(

            "This... is... Safety Standdown Bingo",

            {

                rate: .65,

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

                rate: .78,

                pitch: 1,

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

            "The answer is... " + answer,

            {

                rate: .75,

                pitch: 1,

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

            window.speechSynthesis.cancel();
        }

        this.locked = false;
    }


    /*
    =====================================================
    BROWSER AUDIO UNLOCK
    =====================================================
    */

    unlock() {

        /*
        DO NOT REMOVE THIS.

        This is part of the original working
        audio behavior.
        */

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
=====================================================
GLOBAL ACCESS
=====================================================
*/

window.audioEngine =
    new AudioEngine();


/*
=====================================================
FIRST USER INTERACTION UNLOCK
=====================================================

This remains exactly like your original.

We are NOT changing the audio initialization.
=====================================================
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
