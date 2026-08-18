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
   BINGO overlay + confetti
   Slow game-show style announcement
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

        "fade-in",

        "swipe-left-out",

        "swipe-left-in"

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
    CSS transition handles interpolation.
    ==========================================
    */

    continuousWaveInterval =
        setInterval(
            () => {

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

                const innerEl = document.getElementById("questionTextInner") || display;
                const currentDisplayedText = innerEl.textContent || display.textContent;

                if (currentDisplayedText !== targetText) {

                    clearCustomSweepingStyles();


                    /*
                    ==================================
                    AUDIO

                    USES THE AUDIO ENGINE YOU PROVIDED.
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


                        if (innerEl !== display) {
                            innerEl.textContent = targetText;
                            innerEl.className = "";
                        } else {
                            display.textContent = targetText;
                        }


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

                        SWIPE ANIMATION VIA INNER ELEMENT
                        ==================================
                        */

                        if (innerEl !== display && !display.contains(innerEl)) {
                            display.innerHTML = `<span id="questionTextInner" style="display: block; width: 100%; transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1);">${innerEl.textContent}</span>`;
                        }
                        
                        const targetInner = document.getElementById("questionTextInner") || display;

                        // 1. Slide current question out to the left
                        targetInner.classList.add("swipe-left-out");


                        setTimeout(
                            () => {

                                if (!display) {

                                    return;

                                }


                                // 2. Switch text while hidden off-screen
                                targetInner.textContent =
                                    targetText;


                                // 3. Jump instantly to the right side
                                targetInner.classList.remove("swipe-left-out");
                                targetInner.classList.add("swipe-right-instant");


                                // Force browser repaint
                                void targetInner.offsetWidth;


                                // 4. Slide in from right to center
                                targetInner.classList.remove("swipe-right-instant");
                                targetInner.classList.add("swipe-left-in");


                                setTimeout(
                                    () => {

                                        if (!display) {

                                            return;

                                        }


                                        targetInner.classList.remove("swipe-left-in");


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
                                    400 // Matches entrance duration
                                );

                            },
                            400 // Matches exit duration
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


                /*
                =========================================
                GAME OVER AUDIO
                =========================================
                */

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

                if (
                    !timerEnabled
                ) {

                    clearTimer();

                    forceGreenDisplay();

                    return;

                }


                timer.current--;


                updateTimerUI();


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


    if (
        !timerEnabled
    ) {

        forceGreenDisplay();

        return;

    }


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


    if (
        ratio > 0.75
    ) {

        display.classList.add(
            "timer-green"
        );

        return;

    }


    if (
        ratio > 0.50
    ) {

        display.classList.add(
            "timer-amber"
        );

        return;

    }


    if (
        ratio > 0.25
    ) {

        display.classList.add(
            "timer-orange"
        );

        return;

    }


    if (
        ratio > 0
    ) {

        display.classList.add(
            "timer-red"
        );

        return;

    }


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
// BINGO CSS & SWIPE ANIMATIONS
// =====================================================

function setupBingoStyles() {

    if (
        document.getElementById(
            "displayBingoStyles"
        )
    ) {

        return;

    }


    if (display && !document.getElementById("questionTextInner")) {
        const currentText = display.textContent;
        display.innerHTML = `<span id="questionTextInner" style="display: block; width: 100%; transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1);">${currentText}</span>`;
    }


    const style =
        document.createElement(
            "style"
        );


    style.id =
        "displayBingoStyles";


    style.textContent = `

        .swipe-left-out {
            transform: translateX(-105vw);
            opacity: 0;
        }

        .swipe-right-instant {
            transition: none !important;
            transform: translateX(105vw);
            opacity: 0;
        }

        .swipe-left-in {
            transform: translateX(0) !important;
            opacity: 1 !important;
        }

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
                .55s
                cubic-bezier(.2,.9,.3,1.25)
                forwards,
                bingoTitlePulse
                1.1s
                ease-in-out
                .55s
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
                .55s
                ease-out
                .45s
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
    STOP CURRENT TIMER
    ==========================================
    */

    clearTimer();


    /*
    ==========================================
    CREATE OVERLAY
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
        CONFETTI FALL
        ==================================
        */

        const duration =
            3.0 +
            Math.random() * 3.0;


        const delay =
            Math.random() * .45;


        flake.style.animation =
            `
            displayConfettiFall
            ${duration}s
            linear
            ${delay}s
            forwards
            `;


        if (
            Math.random() >
            .55
        ) {

            flake.style.borderRadius =
                "50%";

        }


        flake.style.transform =
            `rotate(${Math.random() * 360}deg)`;


        overlay.appendChild(
            flake
        );

    }


    /*
    ==========================================
    BINGO AUDIO
    ==========================================
    */

    if (
        window.audioEngine
    ) {

        if (
            typeof window.audioEngine.play ===
            "function"
        ) {

            window.audioEngine.play(
                "win"
            );

        }


        if (
            typeof window.audioEngine.speak ===
            "function"
        ) {

            window.audioEngine.speak(

                "Bingo! Win confirmed.",

                {
                    rate: 0.9,
                    force: true
                }

            );

        }

    }


    /*
    ==========================================
    AUTO CLEANUP BINGO OVERLAY
    ==========================================
    */

    bingoOverlayTimeout =
        setTimeout(
            () => {

                if (overlay && overlay.parentNode) {

                    overlay.parentNode.removeChild(
                        overlay
                    );

                }

                bingoOverlayActive =
                    false;

            },

            10000
        );

}
