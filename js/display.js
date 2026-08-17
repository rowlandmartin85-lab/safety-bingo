"use strict";

/*
=========================================================
SAFETY STANDDOWN BINGO
DISPLAY.JS
=========================================================

DISPLAY STATES:

1. IDLE
   Waiting for host to start...
   Neon color cycle:
   GREEN → AMBER → ORANGE → RED → BLUE → PURPLE

2. RUNNING + TIMER
   GREEN → AMBER → ORANGE → RED → DARK RED

3. RUNNING + NO TIMER
   ALWAYS NEON GREEN

4. PAUSED
   NEON GREEN

5. GAME OVER
   DARK RED

=========================================================
*/


// =====================================================
// LIVE CLOUD SOCKET CONNECTION
// =====================================================

const liveWebsiteAddressUrl =
    `${window.location.protocol}//${window.location.host}`;

const socket =
    io(liveWebsiteAddressUrl);


// =====================================================
// DISPLAY ELEMENT
// =====================================================

let display = null;


// =====================================================
// CENTRAL TIMER CONTROLLER
// =====================================================

let timer = {

    max: 30,

    current: 30,

    interval: null

};


// =====================================================
// TIMER ENABLED / DISABLED
// =====================================================

let timerEnabled = true;


// =====================================================
// IDLE NEON COLOR CONFIGURATION
// =====================================================

const sweepingColors = [

    "#22c55e", // Neon Green

    "#fbbf24", // Amber

    "#f97316", // Orange

    "#ef4444", // Red

    "#3b82f6", // Blue

    "#a855f7"  // Purple

];


let continuousColorIndex = 0;

let continuousWaveInterval = null;


// =====================================================
// GAME TRACKING
// =====================================================

let lastQuestion = "";

let lastGameStatus = "";


// =====================================================
// DOM READY
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        display =
            document.getElementById(
                "questionDisplay"
            );


        if (!display) {

            console.error(
                "questionDisplay element not found."
            );

            return;

        }


        setupDisplayNetworkHandlers();


        /*
        ==========================================
        START IN IDLE MODE
        ==========================================
        */

        setIdleDisplay();

    }
);


// =====================================================
// TIMER CLEANUP
// =====================================================

function clearTimer() {

    if (
        timer.interval
    ) {

        clearInterval(
            timer.interval
        );

        timer.interval =
            null;

    }

}


// =====================================================
// REMOVE TIMER / TRANSITION CLASSES
// =====================================================

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


// =====================================================
// FORCE SOLID NEON GREEN
//
// IMPORTANT:
// This is ONLY for:
// - No Timer
// - Paused
//
// It is NOT used for idle mode because idle
// mode is supposed to cycle through colors.
// =====================================================

function forceGreenDisplay() {

    if (!display) {

        return;

    }


    /*
    ==========================================
    STOP IDLE INLINE COLOR
    ==========================================
    */

    clearCustomSweepingStyles();


    /*
    ==========================================
    REMOVE ALL TIMER COLORS
    ==========================================
    */

    clearTimerClasses();


    /*
    ==========================================
    ADD GREEN
    ==========================================
    */

    display.classList.add(
        "timer-green"
    );

}


// =====================================================
// SET IDLE DISPLAY
// =====================================================

function setIdleDisplay() {

    if (!display) {

        return;

    }


    /*
    ==========================================
    STOP TIMER
    ==========================================
    */

    clearTimer();


    /*
    ==========================================
    RESET QUESTION
    ==========================================
    */

    lastQuestion = "";


    /*
    ==========================================
    REMOVE TIMER COLORS
    ==========================================
    */

    clearTimerClasses();


    /*
    ==========================================
    IDLE CLASS

    The color-cycle engine looks for this
    exact class before changing colors.
    ==========================================
    */

    display.className =
        "idle-waiting-mode";


    display.textContent =
        "Waiting for host to start...";


    /*
    ==========================================
    START NEON IDLE COLOR CYCLE
    ==========================================
    */

    startIdleSweepingAnimation();

}


// =====================================================
// INFINITE IDLE NEON COLOR CYCLE
// =====================================================

function startIdleSweepingAnimation() {

    if (!display) {

        return;

    }


    /*
    ==========================================
    ALREADY RUNNING
    ==========================================
    */

    if (
        continuousWaveInterval
    ) {

        return;

    }


    /*
    ==========================================
    START WITH GREEN
    ==========================================
    */

    continuousColorIndex =
        0;


    const firstColor =
        sweepingColors[
            continuousColorIndex
        ];


    display.style.borderColor =
        firstColor;


    display.style.boxShadow =
        `
        0 0 20px ${firstColor},
        0 0 40px ${firstColor},
        0 0 70px ${firstColor},
        inset 0 0 10px ${firstColor}
        `;


    /*
    ==========================================
    CONTINUOUS COLOR WAVE
    ==========================================
    */

    continuousWaveInterval =
        setInterval(
            () => {

                /*
                ==================================
                ONLY RUN WHILE IDLE
                ==================================
                */

                if (
                    !display ||
                    !display.classList.contains(
                        "idle-waiting-mode"
                    )
                ) {

                    clearInterval(
                        continuousWaveInterval
                    );

                    continuousWaveInterval =
                        null;

                    return;

                }


                /*
                ==================================
                NEXT COLOR
                ==================================
                */

                continuousColorIndex =
                    (
                        continuousColorIndex + 1
                    ) %
                    sweepingColors.length;


                const activeColor =
                    sweepingColors[
                        continuousColorIndex
                    ];


                /*
                ==================================
                NEON BORDER
                ==================================
                */

                display.style.borderColor =
                    activeColor;


                /*
                ==================================
                NEON GLOW
                ==================================
                */

                display.style.boxShadow =
                    `
                    0 0 20px ${activeColor},
                    0 0 40px ${activeColor},
                    0 0 70px ${activeColor},
                    inset 0 0 10px ${activeColor}
                    `;

            },

            416
        );

}


// =====================================================
// STOP IDLE COLOR CYCLE
// =====================================================

function clearCustomSweepingStyles() {

    if (
        continuousWaveInterval
    ) {

        clearInterval(
            continuousWaveInterval
        );

    }


    continuousWaveInterval =
        null;


    if (display) {

        display.style.borderColor =
            "";

        display.style.boxShadow =
            "";

    }

}


// =====================================================
// NETWORK HANDLERS
// =====================================================

function setupDisplayNetworkHandlers() {


    // =================================================
    // TIMER SETTINGS UPDATED
    // =================================================

    socket.on(
        "timerSettingsUpdated",
        (settings) => {

            if (!settings) {

                return;

            }


            /*
            ==========================================
            DETERMINE TIMER MODE
            ==========================================
            */

            timerEnabled =
                !Boolean(
                    settings.noTimer
                );


            timer.max =
                Number(
                    settings.seconds
                ) ||
                30;


            /*
            ==========================================
            NO TIMER

            Immediately force neon green.
            ==========================================
            */

            if (
                !timerEnabled
            ) {

                clearTimer();


                /*
                Do NOT allow any old red/amber/
                orange class to remain.
                */

                forceGreenDisplay();


                return;

            }


            /*
            ==========================================
            TIMER ENABLED
            ==========================================
            */

            updateTimerUI();

        }
    );


    // =================================================
    // SERVER TIMER UPDATE
    // =================================================

    socket.on(
        "timerUpdate",
        (time) => {

            if (
                typeof time !==
                "number"
            ) {

                return;

            }


            timer.current =
                time;


            /*
            ==========================================
            NO TIMER OVERRIDE

            Server timer messages should never
            turn a No Timer display red.
            ==========================================
            */

            if (
                !timerEnabled
            ) {

                forceGreenDisplay();

                return;

            }


            updateTimerUI();

        }
    );


    // =================================================
    // GAME STATE
    // =================================================

    socket.on(
        "gameState",
        (state) => {

            if (
                !state ||
                !display
            ) {

                return;

            }


            // =========================================
            // IDLE
            // =========================================

            if (
                state.status ===
                "idle"
            ) {

                timerEnabled =
                    true;


                setIdleDisplay();


                lastGameStatus =
                    "idle";


                return;

            }


            // =========================================
            // RUNNING
            // =========================================

            if (
                state.status ===
                "running"
            ) {

                /*
                ======================================
                NO TIMER MODE
                ======================================
                */

                if (
                    state.noTimer ===
                    true
                ) {

                    timerEnabled =
                        false;


                    clearTimer();


                    /*
                    ==================================
                    STOP IDLE COLOR CYCLING
                    ==================================
                    */

                    clearCustomSweepingStyles();


                    /*
                    ==================================
                    ALWAYS NEON GREEN
                    ==================================
                    */

                    forceGreenDisplay();

                }
                else {

                    /*
                    ==================================
                    TIMER ENABLED
                    ==================================
                    */

                    timerEnabled =
                        true;


                    if (
                        state.timerSeconds
                    ) {

                        timer.max =
                            Number(
                                state.timerSeconds
                            ) ||
                            30;

                    }

                }


                const targetText =
                    state.currentQuestion ||
                    "";


                // =====================================
                // PAUSED
                // =====================================

                if (
                    state.isPaused
                ) {

                    clearTimer();


                    /*
                    ==================================
                    PAUSED + NO TIMER
                    ==================================
                    */

                    if (
                        !timerEnabled
                    ) {

                        forceGreenDisplay();

                    }
                    else {

                        clearCustomSweepingStyles();

                        clearTimerClasses();


                        display.classList.add(
                            "timer-paused"
                        );

                    }

                }


                // =====================================
                // QUESTION CHANGED
                // =====================================

                if (
                    display.textContent !==
                    targetText
                ) {

                    /*
                    ==================================
                    STOP IDLE COLOR CYCLING
                    ==================================
                    */

                    clearCustomSweepingStyles();


                    /*
                    ==================================
                    AUDIO
                    ==================================
                    */

                    if (
                        window.audioEngine &&
                        typeof window.audioEngine.readQuestion ===
                        "function" &&
                        targetText
                    ) {

                        window.audioEngine.readQuestion(
                            targetText
                        );

                    }


                    /*
                    ==================================
                    NO TIMER

                    No transition into red/amber/
                    orange. Question stays green.
                    ==================================
                    */

                    if (
                        state.noTimer ===
                        true
                    ) {

                        clearTimer();


                        display.className =
                            "timer-green";


                        display.textContent =
                            targetText;


                        /*
                        Make sure inline styles from
                        idle are gone.
                        */

                        display.style.borderColor =
                            "";

                        display.style.boxShadow =
                            "";


                        /*
                        Explicitly restore CSS
                        neon-green state.
                        */

                        display.classList.remove(
                            "timer-red",
                            "timer-dead",
                            "timer-orange",
                            "timer-amber"
                        );


                        display.classList.add(
                            "timer-green"
                        );


                    }
                    else {

                        /*
                        ==================================
                        TIMER ENABLED

                        Preserve your question transition.
                        ==================================
                        */

                        display.className =
                            "timer-green swoosh-out";


                        setTimeout(
                            () => {

                                if (!display) {

                                    return;

                                }


                                display.textContent =
                                    targetText;


                                display.className =
                                    "timer-green prepare-in";


                                requestAnimationFrame(
                                    () => {

                                        setTimeout(
                                            () => {

                                                if (!display) {

                                                    return;

                                                }


                                                display.className =
                                                    "timer-green fade-in";


                                                /*
                                                ==================
                                                START TIMER
                                                ==================
                                                */

                                                if (
                                                    timerEnabled
                                                ) {

                                                    startTimer(
                                                        state.timerSeconds ||
                                                        30
                                                    );

                                                }
                                                else {

                                                    forceGreenDisplay();

                                                }

                                            },
                                            20
                                        );

                                    }
                                );

                            },
                            350
                        );

                    }

                }
                else {

                    /*
                    ==================================
                    SAME QUESTION

                    IMPORTANT FOR NO TIMER:

                    Even if the question didn't change,
                    force green again.
                    ==================================
                    */

                    if (
                        state.noTimer ===
                        true
                    ) {

                        clearTimer();


                        forceGreenDisplay();

                    }
                    else if (
                        !state.isPaused
                    ) {

                        updateTimerUI();

                    }

                }


                lastGameStatus =
                    "running";


                return;

            }


            // =========================================
            // GAME ENDED
            // =========================================

            if (
                state.status ===
                "ended"
            ) {

                clearTimer();


                clearCustomSweepingStyles();


                timerEnabled =
                    true;


                clearTimerClasses();


                display.className =
                    "timer-dead";


                display.textContent =
                    "Game Over";


                if (
                    window.audioEngine
                ) {

                    if (
                        typeof window.audioEngine.play ===
                        "function"
                    ) {

                        window.audioEngine.play(
                            "end"
                        );

                    }


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


                lastGameStatus =
                    "ended";


                return;

            }

        }
    );


    // =================================================
    // SOCKET CONNECTION
    // =================================================

    socket.on(
        "connect",
        () => {

            console.log(
                "PROJECTOR INTERFACE SYNCHRONIZED TO CENTRAL COMMUNICATOR"
            );


            console.log(
                "DISPLAY SOCKET:",
                liveWebsiteAddressUrl
            );


            /*
            ==========================================
            REQUEST CURRENT GAME STATE
            ==========================================
            */

            socket.emit(
                "requestGameStateSyncFallback"
            );

        }
    );


    // =================================================
    // BINGO WIN APPROVAL
    // =================================================

    socket.on(
        "winApproved",
        () => {

            if (
                window.bingoAnimation &&
                typeof window.bingoAnimation.show ===
                "function"
            ) {

                window.bingoAnimation.show();

            }

        }
    );


    // =================================================
    // PHYSICAL BINGO WIN APPROVAL
    // =================================================

    socket.on(
        "physicalWinApproved",
        () => {

            if (
                window.bingoAnimation &&
                typeof window.bingoAnimation.show ===
                "function"
            ) {

                window.bingoAnimation.show();

            }

        }
    );

}


// =====================================================
// TIMER ENGINE
// =====================================================

function startTimer(
    seconds = 30
) {

    clearTimer();


    /*
    ==========================================
    NO TIMER

    NEVER START A COUNTDOWN.
    ==========================================
    */

    if (
        !timerEnabled ||
        seconds === 0
    ) {

        forceGreenDisplay();

        return;

    }


    timer.max =
        Number(
            seconds
        ) ||
        30;


    timer.current =
        timer.max;


    updateTimerUI();


    timer.interval =
        setInterval(
            () => {

                /*
                ======================================
                NO TIMER SAFETY CHECK
                ======================================
                */

                if (
                    !timerEnabled
                ) {

                    clearTimer();


                    forceGreenDisplay();


                    return;

                }


                timer.current--;


                updateTimerUI();


                /*
                ======================================
                TIMER EXPIRED
                ======================================
                */

                if (
                    timer.current <=
                    0
                ) {

                    clearTimer();


                    if (
                        timerEnabled
                    ) {

                        socket.emit(
                            "requestNext"
                        );

                    }

                }

            },
            1000
        );

}


// =====================================================
// TIMER COLOR ENGINE
// =====================================================

function updateTimerUI() {

    if (!display) {

        return;

    }


    /*
    ==========================================
    NO TIMER = ALWAYS GREEN

    THIS MUST BE THE FIRST CHECK.
    ==========================================
    */

    if (
        !timerEnabled
    ) {

        forceGreenDisplay();

        return;

    }


    /*
    ==========================================
    NEVER MODIFY IDLE COLORS HERE
    ==========================================
    */

    if (
        display.classList.contains(
            "idle-waiting-mode"
        )
    ) {

        return;

    }


    /*
    ==========================================
    REMOVE OLD TIMER COLORS
    ==========================================
    */

    clearTimerClasses();


    /*
    ==========================================
    TIMER RATIO
    ==========================================
    */

    const max =
        Number(
            timer.max
        ) ||
        30;


    const current =
        Number(
            timer.current
        ) ||
        0;


    const ratio =
        current /
        max;


    // =========================================
    // GREEN
    // =========================================

    if (
        ratio > 0.75
    ) {

        display.classList.add(
            "timer-green"
        );


        return;

    }


    // =========================================
    // AMBER
    // =========================================

    if (
        ratio > 0.50
    ) {

        display.classList.add(
            "timer-amber"
        );


        return;

    }


    // =========================================
    // ORANGE
    // =========================================

    if (
        ratio > 0.25
    ) {

        display.classList.add(
            "timer-orange"
        );


        return;

    }


    // =========================================
    // RED
    // =========================================

    if (
        ratio > 0
    ) {

        display.classList.add(
            "timer-red"
        );


        return;

    }


    // =========================================
    // TIMER EXPIRED
    // =========================================

    display.classList.add(
        "timer-dead"
    );

}


// =====================================================
// PAUSE DISPLAY
// =====================================================

function pauseDisplay() {

    clearTimer();


    if (!display) {

        return;

    }


    /*
    ==========================================
    NO TIMER + PAUSED

    Still GREEN.
    ==========================================
    */

    if (
        !timerEnabled
    ) {

        forceGreenDisplay();

        return;

    }


    clearCustomSweepingStyles();


    clearTimerClasses();


    display.classList.add(
        "timer-paused"
    );

}


// =====================================================
// RESUME DISPLAY
// =====================================================

function resumeDisplay() {

    if (!display) {

        return;

    }


    /*
    ==========================================
    NO TIMER = GREEN
    ==========================================
    */

    if (
        !timerEnabled
    ) {

        forceGreenDisplay();

        return;

    }


    clearTimerClasses();


    display.classList.add(
        "timer-green"
    );


    startTimer(
        timer.current ||
        timer.max ||
        30
    );

}


// =====================================================
// VISIBILITY SAFETY
// =====================================================

document.addEventListener(
    "visibilitychange",
    () => {

        if (
            document.hidden
        ) {

            return;

        }


        /*
        ==========================================
        IF IDLE, MAKE SURE COLOR CYCLE IS RUNNING
        ==========================================
        */

        if (
            display &&
            display.classList.contains(
                "idle-waiting-mode"
            )
        ) {

            startIdleSweepingAnimation();

            return;

        }


        /*
        ==========================================
        IF NO TIMER, RESTORE GREEN
        ==========================================
        */

        if (
            display &&
            !timerEnabled
        ) {

            forceGreenDisplay();

        }

    }
);


// =====================================================
// DEBUG
// =====================================================

console.log(
    "SAFETY STANDDOWN BINGO DISPLAY.JS LOADED"
);

console.log(
    "LIVE CLOUD SOCKET:",
    liveWebsiteAddressUrl
);
