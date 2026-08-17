"use strict";

/*
=========================================================
SAFETY STANDDOWN BINGO
DISPLAY.JS
=========================================================

DISPLAY STATES:

1. IDLE
   Waiting for host to start...
   Smooth neon color cycle:
   GREEN → AMBER → ORANGE → RED → BLUE → PURPLE

2. RUNNING + TIMER
   GREEN → AMBER → ORANGE → RED → DARK RED

3. RUNNING + NO TIMER
   ALWAYS NEON GREEN

4. PAUSED
   NEON GREEN

5. GAME OVER
   DARK RED

6. BINGO WIN
   Immediate BINGO overlay + confetti
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
// BINGO TRACKING
// =====================================================

let bingoOverlayActive = false;

let bingoOverlayTimeout = null;


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


        setupBingoStyles();


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
// ONLY USED FOR:
// - NO TIMER
// - PAUSED
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
    ==========================================
    */

    display.className =
        "idle-waiting-mode";


    display.textContent =
        "Waiting for host to start...";


    /*
    ==========================================
    START NEON COLOR CYCLE
    ==========================================
    */

    startIdleSweepingAnimation();

}


// =====================================================
// SMOOTH IDLE NEON COLOR CYCLE
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


    applyIdleColor(
        sweepingColors[
            continuousColorIndex
        ]
    );


    /*
    ==========================================
    SMOOTH COLOR CHANGE

    1.2 seconds between colors.
    CSS transition handles the
    smooth neon interpolation.
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


                applyIdleColor(
                    activeColor
                );

            },

            1200
        );

}


// =====================================================
// APPLY IDLE NEON COLOR
// =====================================================

function applyIdleColor(
    color
) {

    if (!display) {

        return;

    }


    display.style.borderColor =
        color;


    display.style.boxShadow =
        `
        0 0 18px ${color},
        0 0 40px ${color},
        0 0 70px ${color},
        0 0 100px ${color},
        inset 0 0 12px ${color},
        0 16px 45px rgba(0,0,0,.6)
        `;

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
            ==========================================
            */

            if (
                !timerEnabled
            ) {

                clearTimer();

                forceGreenDisplay();

                return;

            }


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


                    clearCustomSweepingStyles();


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


                        display.style.borderColor =
                            "";

                        display.style.boxShadow =
                            "";


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

                        QUESTION TRANSITION
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

            showBingoCelebration();

        }
    );


    // =================================================
    // PHYSICAL BINGO WIN APPROVAL
    // =================================================

    socket.on(
        "physicalWinApproved",
        () => {

            showBingoCelebration();

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

    NEVER START COUNTDOWN.
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
    NEVER MODIFY IDLE COLORS
    ==========================================
    */

    if (
        display.classList.contains(
            "idle-waiting-mode"
        )
    ) {

        return;

    }


    clearTimerClasses();


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
    NO TIMER + PAUSED = GREEN
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
// BINGO CSS
//
// Created here so display.js owns the entire
// Bingo celebration.
// =====================================================

function setupBingoStyles() {

    if (
        document.getElementById(
            "displayBingoStyles"
        )
    ) {

        return;

    }


    const style =
        document.createElement(
            "style"
        );


    style.id =
        "displayBingoStyles";


    style.textContent = `

        .display-bingo-overlay {

            position: fixed;

            inset: 0;

            width: 100vw;

            height: 100vh;

            height: 100dvh;

            background:
                radial-gradient(
                    circle at center,
                    rgba(20,20,20,.70),
                    rgba(0,0,0,.94)
                );

            display: flex;

            flex-direction: column;

            justify-content: center;

            align-items: center;

            z-index: 999999;

            overflow: hidden;

            pointer-events: none;

            opacity: 1;

        }


        .display-bingo-title {

            position: relative;

            z-index: 1000000;

            font-family:
                Arial Black,
                Impact,
                Arial,
                sans-serif;

            font-size:
                clamp(70px, 12vw, 150px);

            line-height: .9;

            font-weight: 900;

            letter-spacing: .06em;

            color: #FFD84D;

            text-align: center;

            text-shadow:

                0 0 10px #fff3a1,

                0 0 25px #FFD84D,

                0 0 50px #ffae00,

                0 0 90px #ff6a00;

            transform:
                scale(.55);

            opacity: 0;

            animation:
                bingoTitleEnter
                .28s
                cubic-bezier(.2,.9,.3,1.25)
                forwards,
                bingoTitlePulse
                .65s
                ease-in-out
                .28s
                infinite alternate;

        }


        .display-bingo-sub {

            position: relative;

            z-index: 1000000;

            margin-top: 25px;

            font-family:
                Arial,
                sans-serif;

            font-size:
                clamp(24px, 4vw, 42px);

            font-weight: 900;

            letter-spacing: .12em;

            color: white;

            text-align: center;

            text-shadow:
                0 0 10px white,
                0 0 25px #FFD84D;

            opacity: 0;

            animation:
                bingoSubEnter
                .25s
                ease-out
                .18s
                forwards;

        }


        .display-confetti {

            position: absolute;

            top: -30px;

            z-index: 999999;

            pointer-events: none;

            will-change:
                transform,
                opacity;

        }


        @keyframes bingoTitleEnter {

            0% {

                opacity: 0;

                transform:
                    scale(.55)
                    rotate(-4deg);

            }

            65% {

                opacity: 1;

                transform:
                    scale(1.12)
                    rotate(1deg);

            }

            100% {

                opacity: 1;

                transform:
                    scale(1)
                    rotate(0deg);

            }

        }


        @keyframes bingoTitlePulse {

            from {

                filter:
                    brightness(1);

            }

            to {

                filter:
                    brightness(1.35);

            }

        }


        @keyframes bingoSubEnter {

            from {

                opacity: 0;

                transform:
                    translateY(15px);

            }

            to {

                opacity: 1;

                transform:
                    translateY(0);

            }

        }


        @keyframes displayConfettiFall {

            0% {

                transform:
                    translate3d(
                        0,
                        -5vh,
                        0
                    )
                    rotate(0deg);

                opacity: 1;

            }

            100% {

                transform:
                    translate3d(
                        0,
                        115vh,
                        0
                    )
                    rotate(
                        720deg
                    );

                opacity: 0;

            }

        }

    `;


    document.head.appendChild(
        style
    );

}


// =====================================================
// SHOW BINGO CELEBRATION
// =====================================================

function showBingoCelebration() {

    /*
    ==========================================
    PREVENT DUPLICATE CELEBRATIONS
    ==========================================
    */

    if (
        bingoOverlayActive
    ) {

        return;

    }


    bingoOverlayActive =
        true;


    /*
    ==========================================
    CREATE OVERLAY IMMEDIATELY

    The visual celebration starts right away.
    The announcement itself is intentionally
    slower and more dramatic.
    ==========================================
    */

    const overlay =
        document.createElement(
            "div"
        );


    overlay.className =
        "display-bingo-overlay";


    overlay.innerHTML = `

        <div class="display-bingo-title">
            B I N G O !
        </div>

        <div class="display-bingo-sub">
            WIN CONFIRMED
        </div>

    `;


    document.body.appendChild(
        overlay
    );


    /*
    ==========================================
    CONFETTI COLORS
    ==========================================
    */

    const colors = [

        "#FFD84D",

        "#22c55e",

        "#3b82f6",

        "#ef4444",

        "#a855f7",

        "#f97316",

        "#ffffff"

    ];


    /*
    ==========================================
    CREATE 300 CONFETTI PIECES
    ==========================================
    */

    for (
        let i = 0;
        i < 300;
        i++
    ) {

        const flake =
            document.createElement(
                "div"
            );


        flake.className =
            "display-confetti";


        const size =
            Math.random() * 12 + 6;


        flake.style.width =
            `${size}px`;


        flake.style.height =
            `${size * 0.65}px`;


        flake.style.background =
            colors[
                Math.floor(
                    Math.random() *
                    colors.length
                )
            ];


        flake.style.left =
            `${Math.random() * 100}vw`;


        /*
        ==================================
        RANDOM FALL SPEED
        ==================================
        */

        const duration =
            2.5 +
            Math.random() * 2.5;


        const delay =
            Math.random() * .35;


        flake.style.animation =
            `
            displayConfettiFall
            ${duration}s
            linear
            ${delay}s
            forwards
            `;


        /*
        ==================================
        RANDOM SHAPE
        ==================================
        */

        if (
            Math.random() >
            .55
        ) {

            flake.style.borderRadius =
                "50%";

        }


        /*
        ==================================
        RANDOM ROTATION
        ==================================
        */

        flake.style.transform =
            `rotate(${Math.random() * 360}deg)`;


        overlay.appendChild(
            flake
        );

    }


    /*
    ==========================================
    BINGO AUDIO

    Uses the exact Bingo audio engine
    from the supplied version:

        audioEngine.play("bingo")
        audioEngine.speak(...)

    The sound effect begins immediately.

    The spoken announcement is intentionally
    slower and more dramatic so it sounds
    like a game-show winner announcement.
    ==========================================
    */

    if (
        window.audioEngine
    ) {

        /*
        ======================================
        BINGO SOUND EFFECT
        ======================================
        */

        if (
            typeof window.audioEngine.play ===
            "function"
        ) {

            try {

                window.audioEngine.play(
                    "bingo"
                );

            }
            catch (error) {

                console.warn(
                    "Bingo sound unavailable:",
                    error
                );

            }

        }


        /*
        ======================================
        SLOW GAME-SHOW ANNOUNCEMENT
        ======================================

        Slightly slower speech gives the
        announcement room to breathe.

        The pauses in the text make the
        announcement feel more dramatic.
        ======================================
        */

        if (
            typeof window.audioEngine.speak ===
            "function"
        ) {

            /*
            Small pause before the spoken
            announcement begins.

            This lets the Bingo sound effect
            establish the celebration first.
            */

            setTimeout(
                () => {

                    if (
                        !window.audioEngine ||
                        typeof window.audioEngine.speak !==
                        "function"
                    ) {

                        return;

                    }


                    window.audioEngine.speak(

                        "Bingo!... Winner confirmed!",

                        {
                            rate: 0.72,
                            force: true
                        }

                    );

                },
                450
            );

        }

    }


    /*
    ==========================================
    REMOVE AFTER 10 SECONDS
    ==========================================
    */

    bingoOverlayTimeout =
        setTimeout(
            () => {

                if (
                    overlay &&
                    overlay.parentNode
                ) {

                    overlay.remove();

                }


                bingoOverlayActive =
                    false;


                bingoOverlayTimeout =
                    null;

            },
            10000
        );

}


// =====================================================
// OPTIONAL GLOBAL BINGO API
//
// Allows other scripts to call:
//
// window.bingoAnimation.show()
// =====================================================

window.bingoAnimation = {

    show:
        showBingoCelebration

};


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
        IDLE = RESTORE COLOR CYCLE
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
        NO TIMER = RESTORE GREEN
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
