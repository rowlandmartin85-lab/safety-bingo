"use strict";

/*
=========================================================
SAFETY STANDDOWN BINGO
DISPLAY.JS
=========================================================

IMPORTANT:
- Preserves the working display behavior.
- Preserves question display.
- Preserves question-reading audio.
- Preserves neon timer colors.
- Preserves idle neon cycling.
- Preserves timer synchronization.
- Preserves Game Over audio.
- Restores BINGO winner animation directly on display.
- Supports both winApproved and physicalWinApproved.
- Uses the original "hostNext" event when timer expires.
=========================================================
*/


// ======================================================
// SOCKET CONNECTION
// ======================================================

// Automatically use whatever live/cloud address opened this page.
const liveWebsiteAddressUrl =
    `${window.location.protocol}//${window.location.host}`;

const socket = io(liveWebsiteAddressUrl);


// ======================================================
// DISPLAY ELEMENT
// ======================================================

let display = null;


// ======================================================
// TIMER
// ======================================================

let timer = {
    max: 30,
    current: 30,
    interval: null
};

let timerEnabled = true;


// ======================================================
// DISPLAY STATE
// ======================================================

let lastQuestion = "";
let lastQuestionIndex = null;
let paused = false;
let savedTimerClass = "timer-green";


// ======================================================
// IDLE NEON COLORS
// ======================================================

const sweepingColors = [
    "#22c55e",
    "#fbbf24",
    "#f97316",
    "#ef4444",
    "#3b82f6",
    "#a855f7"
];

let continuousColorIndex = 0;
let continuousWaveInterval = null;


// ======================================================
// INITIALIZE
// ======================================================

document.addEventListener("DOMContentLoaded", () => {

    display = document.getElementById("questionDisplay");

    if (!display) {
        console.error(
            "DISPLAY ERROR: #questionDisplay was not found."
        );
        return;
    }

    setupDisplayNetworkHandlers();

    // Your HTML uses idle-cycle.
    // Start with the original neon idle animation.
    display.classList.add("idle-cycle");

    startIdleSweepingAnimation();

    console.log("SAFETY BINGO DISPLAY READY");

});


// ======================================================
// TIMER CLEAR
// ======================================================

function clearTimer() {

    if (timer.interval) {
        clearInterval(timer.interval);
        timer.interval = null;
    }

}


// ======================================================
// IDLE NEON SWEEP
// ======================================================

function startIdleSweepingAnimation() {

    if (continuousWaveInterval) {
        return;
    }

    continuousWaveInterval = setInterval(() => {

        if (!display) {
            return;
        }

        /*
        IMPORTANT:
        Your original HTML uses "idle-cycle".
        Do NOT use idle-waiting-mode here.
        */

        if (!display.classList.contains("idle-cycle")) {

            clearInterval(continuousWaveInterval);

            continuousWaveInterval = null;

            return;
        }


        const activeColor =
            sweepingColors[continuousColorIndex];


        display.style.borderColor =
            activeColor;


        display.style.boxShadow =
            `
            0 0 20px ${activeColor},
            0 0 40px ${activeColor},
            inset 0 0 10px ${activeColor}
            `;


        continuousColorIndex =
            (continuousColorIndex + 1)
            % sweepingColors.length;


    }, 416);

}


// ======================================================
// CLEAR CUSTOM IDLE STYLES
// ======================================================

function clearCustomSweepingStyles() {

    if (continuousWaveInterval) {

        clearInterval(
            continuousWaveInterval
        );

        continuousWaveInterval = null;
    }


    if (display) {

        display.style.borderColor = "";
        display.style.boxShadow = "";

    }

}


// ======================================================
// RESET TIMER COLOR CLASSES
// ======================================================

function clearTimerClasses() {

    if (!display) {
        return;
    }

    display.classList.remove(

        "timer-green",
        "timer-amber",
        "timer-orange",
        "timer-red",
        "timer-dead",
        "timer-paused",

        "swoosh-out",
        "prepare-in",
        "fade-in"

    );

}


// ======================================================
// DISPLAY NETWORK EVENTS
// ======================================================

function setupDisplayNetworkHandlers() {


    // --------------------------------------------------
    // TIMER SETTINGS
    // --------------------------------------------------

    socket.on(
        "timerSettingsUpdated",
        (settings) => {

            if (!settings) {
                return;
            }


            timerEnabled =
                !Boolean(settings.noTimer);


            const configuredSeconds =
                Number(settings.seconds);


            if (
                Number.isFinite(configuredSeconds) &&
                configuredSeconds > 0
            ) {

                timer.max =
                    configuredSeconds;

            }


            if (!timerEnabled) {

                clearTimer();

                updateTimerUI();

            }

        }
    );


    // --------------------------------------------------
    // SERVER TIMER UPDATE
    // --------------------------------------------------

    socket.on(
        "timerUpdate",
        (time) => {

            if (
                typeof time !== "number" ||
                !Number.isFinite(time)
            ) {

                return;
            }


            timer.current =
                Math.max(0, time);


            updateTimerUI();

        }
    );


    // --------------------------------------------------
    // GAME STATE
    // --------------------------------------------------

    socket.on(
        "gameState",
        handleDisplayGameState
    );


    // --------------------------------------------------
    // CONNECTION
    // --------------------------------------------------

    socket.on(
        "connect",
        () => {

            console.log(
                "DISPLAY CONNECTED:",
                socket.id
            );


            /*
            Ask the server for the current game state.

            This is important when the projector loads
            after the host has already started the game.
            */

            socket.emit(
                "requestGameStateSyncFallback"
            );

        }
    );


    // --------------------------------------------------
    // DISCONNECT
    // --------------------------------------------------

    socket.on(
        "disconnect",
        () => {

            console.warn(
                "DISPLAY DISCONNECTED"
            );

        }
    );


    // --------------------------------------------------
    // SOCKET ERROR
    // --------------------------------------------------

    socket.on(
        "connect_error",
        (error) => {

            console.error(
                "DISPLAY SOCKET ERROR:",
                error
            );

        }
    );


    // --------------------------------------------------
    // BINGO APPROVED
    // --------------------------------------------------

    socket.on(
        "winApproved",
        (data) => {

            console.log(
                "DISPLAY: BINGO APPROVED",
                data
            );

            showBingoCelebOverlay();

        }
    );


    // --------------------------------------------------
    // PHYSICAL BINGO APPROVED
    // --------------------------------------------------

    socket.on(
        "physicalWinApproved",
        (data) => {

            console.log(
                "DISPLAY: PHYSICAL BINGO APPROVED",
                data
            );

            showBingoCelebOverlay();

        }
    );

}


// ======================================================
// GAME STATE HANDLER
// ======================================================

function handleDisplayGameState(state) {

    if (!state || !display) {
        return;
    }


    // ==================================================
    // IDLE
    // ==================================================

    if (state.status === "idle") {

        clearTimer();

        paused = false;

        clearTimerClasses();

        clearCustomSweepingStyles();

        /*
        Restore the ORIGINAL idle class from your HTML.
        */

        display.classList.add(
            "idle-cycle"
        );


        display.textContent =
            "Waiting for host to start...";


        /*
        Restart JavaScript neon sweep.
        */

        startIdleSweepingAnimation();


        return;
    }


    // ==================================================
    // RUNNING
    // ==================================================

    if (state.status === "running") {

        /*
        Stop idle mode.
        */

        display.classList.remove(
            "idle-cycle"
        );

        clearCustomSweepingStyles();


        // ----------------------------------------------
        // PAUSED
        // ----------------------------------------------

        if (state.isPaused) {

            paused = true;

            clearTimer();

            clearTimerClasses();

            display.classList.add(
                "timer-paused"
            );

        }
        else {

            paused = false;

            display.classList.remove(
                "timer-paused"
            );

        }


        // ----------------------------------------------
        // TIMER SETTINGS FROM GAME STATE
        // ----------------------------------------------

        if (
            typeof state.noTimer === "boolean"
        ) {

            timerEnabled =
                !state.noTimer;

        }


        if (
            Number.isFinite(
                Number(state.timerSeconds)
            ) &&
            Number(state.timerSeconds) > 0
        ) {

            timer.max =
                Number(state.timerSeconds);

        }


        // ----------------------------------------------
        // QUESTION
        // ----------------------------------------------

        const question =
            state.currentQuestion || "";


        /*
        Detect a genuinely new question.

        repeatQuestion is also supported because the
        host may intentionally call the same question again.
        */

        const questionIndex =
            state.currentQuestionIndex ??
            state.questionIndex ??
            null;


        const isNewQuestion =
            question !== lastQuestion ||
            Boolean(state.repeatQuestion) ||
            (
                questionIndex !== null &&
                questionIndex !== lastQuestionIndex
            );


        if (
            question &&
            isNewQuestion
        ) {

            lastQuestion =
                question;


            lastQuestionIndex =
                questionIndex;


            /*
            Read the question BEFORE changing the
            display text, just like the working version.
            */

            if (
                window.audioEngine &&
                typeof window.audioEngine.readQuestion === "function"
            ) {

                try {

                    window.audioEngine.readQuestion(
                        question
                    );

                }
                catch (error) {

                    console.error(
                        "DISPLAY AUDIO ERROR:",
                        error
                    );

                }

            }


            /*
            Preserve the original transition sequence.
            */

            display.className =
                "timer-green swoosh-out";


            setTimeout(() => {

                /*
                Don't perform an old transition after
                the game has already changed state.
                */

                if (!display) {
                    return;
                }


                display.textContent =
                    question;


                display.className =
                    "timer-green prepare-in";


                requestAnimationFrame(() => {

                    setTimeout(() => {

                        if (!display) {
                            return;
                        }


                        /*
                        If the host paused during the
                        transition, don't overwrite it.
                        */

                        if (paused) {

                            display.className =
                                "timer-paused";

                            return;
                        }


                        display.className =
                            "timer-green fade-in";


                        /*
                        Start local countdown as a fallback.
                        Server timerUpdate messages will
                        continue synchronizing it.
                        */

                        if (timerEnabled) {

                            startTimer(
                                Number(
                                    state.timerSeconds
                                ) || timer.max || 30
                            );

                        }
                        else {

                            clearTimer();

                            updateTimerUI();

                        }

                    }, 20);

                });

            }, 350);

        }
        else {

            /*
            Same question.

            Do NOT erase the question.
            Do NOT replay the audio every time a
            gameState packet arrives.
            */

            if (state.isPaused) {

                clearTimerClasses();

                display.classList.add(
                    "timer-paused"
                );

            }
            else if (!state.noTimer) {

                updateTimerUI();

            }

        }


        // ----------------------------------------------
        // NO TIMER MODE
        // ----------------------------------------------

        if (state.noTimer) {

            clearTimer();

            clearTimerClasses();

            display.classList.add(
                "timer-green"
            );

        }


        return;
    }


    // ==================================================
    // GAME ENDED
    // ==================================================

    if (state.status === "ended") {

        clearTimer();

        paused = false;

        clearCustomSweepingStyles();

        clearTimerClasses();


        display.textContent =
            "Game Over";


        display.classList.add(
            "timer-dead"
        );


        /*
        Preserve your original Game Over audio.
        */

        if (window.audioEngine) {

            try {

                if (
                    typeof window.audioEngine.play ===
                    "function"
                ) {

                    window.audioEngine.play(
                        "end"
                    );

                }

            }
            catch (error) {

                console.warn(
                    "GAME OVER SOUND ERROR:",
                    error
                );

            }


            try {

                if (
                    typeof window.audioEngine.speak ===
                    "function"
                ) {

                    window.audioEngine.speak(

                        "Game over. Thank you for playing Safety Standdown Bingo.",

                        {
                            rate: 0.8,
                            force: true
                        }

                    );

                }

            }
            catch (error) {

                console.warn(
                    "GAME OVER SPEECH ERROR:",
                    error
                );

            }

        }


        return;
    }

}


// ======================================================
// TIMER
// ======================================================

function startTimer(seconds = 30) {

    clearTimer();


    if (
        !timerEnabled ||
        seconds === 0
    ) {

        updateTimerUI();

        return;
    }


    const safeSeconds =
        Number(seconds);


    timer.max =
        Number.isFinite(safeSeconds) &&
        safeSeconds > 0
            ? safeSeconds
            : 30;


    timer.current =
        timer.max;


    updateTimerUI();


    timer.interval =
        setInterval(() => {

            if (paused) {
                return;
            }


            timer.current--;


            updateTimerUI();


            if (timer.current <= 0) {

                clearTimer();


                /*
                IMPORTANT:
                This is the event used by your original
                working display code.

                Do not change this to requestNext.
                */

                socket.emit(
                    "hostNext"
                );

            }

        }, 1000);

}


// ======================================================
// TIMER UI
// ======================================================

function updateTimerUI() {

    if (!display) {
        return;
    }


    if (paused) {
        return;
    }


    /*
    Never modify idle-cycle while in idle mode.
    */

    if (
        display.classList.contains(
            "idle-cycle"
        )
    ) {

        return;
    }


    clearTimerClasses();


    // --------------------------------------------------
    // NO TIMER
    // --------------------------------------------------

    if (!timerEnabled) {

        display.classList.add(
            "timer-green"
        );

        savedTimerClass =
            "timer-green";

        return;
    }


    // --------------------------------------------------
    // PROTECT AGAINST ZERO / INVALID MAX
    // --------------------------------------------------

    if (
        !Number.isFinite(timer.max) ||
        timer.max <= 0
    ) {

        timer.max = 30;

    }


    const ratio =
        timer.current /
        timer.max;


    // --------------------------------------------------
    // GREEN
    // --------------------------------------------------

    if (ratio > 0.75) {

        savedTimerClass =
            "timer-green";

    }

    // --------------------------------------------------
    // AMBER
    // --------------------------------------------------

    else if (ratio > 0.50) {

        savedTimerClass =
            "timer-amber";

    }

    // --------------------------------------------------
    // ORANGE
    // --------------------------------------------------

    else if (ratio > 0.25) {

        savedTimerClass =
            "timer-orange";

    }

    // --------------------------------------------------
    // RED
    // --------------------------------------------------

    else if (ratio > 0) {

        savedTimerClass =
            "timer-red";

    }

    // --------------------------------------------------
    // DEAD
    // --------------------------------------------------

    else {

        savedTimerClass =
            "timer-dead";

    }


    display.classList.add(
        savedTimerClass
    );

}


// ======================================================
// PAUSE DISPLAY
// ======================================================

function pauseDisplay() {

    paused = true;

    clearTimer();

    clearTimerClasses();


    display.classList.add(
        "timer-paused"
    );

}


// ======================================================
// RESUME DISPLAY
// ======================================================

function resumeDisplay() {

    paused = false;


    display.classList.remove(
        "timer-paused"
    );


    display.classList.add(
        savedTimerClass
    );


    startTimer(
        timer.current > 0
            ? timer.current
            : timer.max
    );

}


// ======================================================
// BINGO CELEBRATION
// ======================================================

function showBingoCelebOverlay() {

    /*
    Prevent duplicate overlays.
    */

    if (
        document.querySelector(
            ".bingo-overlay"
        )
    ) {

        return;
    }


    const overlay =
        document.createElement("div");


    overlay.className =
        "bingo-overlay";


    /*
    This matches the original HTML
    celebration design.
    */

    overlay.innerHTML = `

        <div class="bingo-title">
            B I N G O !
        </div>

        <div class="bingo-sub">
            WIN CONFIRMED
        </div>

    `;


    document.body.appendChild(
        overlay
    );


    // --------------------------------------------------
    // CONFETTI COLORS
    // --------------------------------------------------

    const colors = [

        "#FFD84D",
        "#2ecc71",
        "#3498db",
        "#e74c3c",
        "#9b59b6",
        "#f1c40f",
        "#e67e22"

    ];


    // --------------------------------------------------
    // CREATE CONFETTI
    // --------------------------------------------------

    for (
        let i = 0;
        i < 300;
        i++
    ) {

        const flake =
            document.createElement("div");


        flake.className =
            "confetti-flake";


        const size =
            Math.random() * 14 + 6;


        flake.style.width =
            size + "px";


        flake.style.height =
            size + "px";


        flake.style.background =
            colors[
                Math.floor(
                    Math.random() *
                    colors.length
                )
            ];


        flake.style.left =
            Math.random() * 100 + "vw";


        const duration =
            5 + Math.random() * 5;


        flake.style.animation =
            `confettiFall ${duration}s linear forwards`;


        if (
            Math.random() > 0.5
        ) {

            flake.style.borderRadius =
                "50%";

        }


        overlay.appendChild(
            flake
        );

    }


    // --------------------------------------------------
    // BINGO AUDIO
    // --------------------------------------------------

    if (window.audioEngine) {

        try {

            if (
                typeof window.audioEngine.speak ===
                "function"
            ) {

                window.audioEngine.speak(

                    "Bingo! Winner confirmed.",

                    {
                        rate: 0.8,
                        force: true
                    }

                );

            }

        }
        catch (error) {

            console.warn(
                "BINGO AUDIO ERROR:",
                error
            );

        }

    }


    // --------------------------------------------------
    // REMOVE AFTER 10 SECONDS
    // --------------------------------------------------

    setTimeout(() => {

        if (overlay) {

            overlay.remove();

        }

    }, 10000);

}


// ======================================================
// OPTIONAL GLOBAL DISPLAY API
// ======================================================

window.displayBingoAnimation =
    showBingoCelebOverlay;


window.displayPause =
    pauseDisplay;


window.displayResume =
    resumeDisplay;


// ======================================================
// AUDIO UNLOCK
// ======================================================

/*
Browsers may block speech/audio until the projector
page receives a user interaction.

Your existing /js/audio.js remains responsible for
the actual audio engine.
*/

document.addEventListener(
    "click",
    () => {

        if (
            window.audioEngine &&
            typeof window.audioEngine.unlock ===
            "function"
        ) {

            try {

                window.audioEngine.unlock();

            }
            catch (error) {

                console.warn(
                    "AUDIO UNLOCK ERROR:",
                    error
                );

            }

        }

    },
    {
        once: true
    }
);


// ======================================================
// DEBUG HELPERS
// ======================================================

window.getDisplayState =
    function () {

        return {

            connected:
                socket.connected,

            question:
                lastQuestion,

            questionIndex:
                lastQuestionIndex,

            timerEnabled:
                timerEnabled,

            timerMax:
                timer.max,

            timerCurrent:
                timer.current,

            paused:
                paused

        };

    };


console.log(
    "DISPLAY.JS LOADED - ORIGINAL DISPLAY BEHAVIOR PRESERVED"
);
