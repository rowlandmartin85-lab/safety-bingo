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
   NO GLOW

3. RUNNING + NO TIMER
   NO GLOW

4. PAUSED
   NO GLOW

5. GAME OVER
   DARK RED / NO NEON GLOW

6. BINGO WIN
   BINGO overlay + confetti

QUESTION ANIMATION:

NEXT:
    Current question → slides LEFT
    New question → enters from RIGHT

PREVIOUS:
    Current question → slides RIGHT
    New question → enters from LEFT
=========================================================
*/


// =====================================================
// LIVE SOCKET CONNECTION
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
// IDLE NEON COLORS
// =====================================================

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


// =====================================================
// GAME TRACKING
// =====================================================

let lastQuestion = "";

let lastQuestionIndex = null;

let lastGameStatus = "";


// =====================================================
// QUESTION ANIMATION CONTROL
// =====================================================

/*
Every question transition receives a new number.

If the host clicks NEXT/PREVIOUS again while an
animation is still running, older animation callbacks
will be ignored.
*/

let questionTransitionToken = 0;


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

        "no-timer",

        "running-no-glow",

        "swoosh-out",

        "prepare-in",

        "fade-in"

    );

}


// =====================================================
// FORCE GREEN DISPLAY
// =====================================================

/*
IMPORTANT:

This function used to add the timer-green class.

That class creates the neon glow.

Running games should NOT glow.

Therefore this function now routes through
forceNoGlowDisplay().
*/

function forceGreenDisplay() {

    if (!display) {

        return;

    }


    forceNoGlowDisplay();

}


// =====================================================
// FORCE RUNNING DISPLAY — NO GLOW
// =====================================================

function forceNoGlowDisplay() {

    if (!display) {

        return;

    }


    /*
    ==========================================
    STOP IDLE COLOR SWEEP
    ==========================================
    */

    clearCustomSweepingStyles();


    /*
    ==========================================
    REMOVE ALL TIMER / GLOW CLASSES
    ==========================================
    */

    clearTimerClasses();


    /*
    ==========================================
    EXPLICITLY REMOVE INLINE GLOW
    ==========================================
    */

    display.style.boxShadow =
        "none";


    display.style.textShadow =
        "none";


    display.style.filter =
        "none";


    /*
    ==========================================
    REMOVE IDLE BORDER COLOR
    ==========================================
    */

    display.style.borderColor =
        "";


    /*
    ==========================================
    MARK DISPLAY AS RUNNING WITH NO GLOW
    ==========================================
    */

    display.classList.add(
        "running-no-glow"
    );

}


// =====================================================
// SET IDLE DISPLAY
// =====================================================

function setIdleDisplay() {

    if (!display) {

        return;

    }


    clearTimer();

    questionTransitionToken++;


    lastQuestion =
        "";

    lastQuestionIndex =
        null;


    clearTimerClasses();


    /*
    ==========================================
    REMOVE RUNNING INLINE STYLES
    ==========================================
    */

    display.style.boxShadow =
        "";

    display.style.textShadow =
        "";

    display.style.filter =
        "";

    display.style.borderColor =
        "";


    /*
    ==========================================
    IDLE CLASS
    ==========================================
    */

    display.className =
        "idle-waiting-mode";


    /*
    ==========================================
    RECREATE INNER QUESTION ELEMENT
    ==========================================
    */

    display.innerHTML = `
        <span
            id="questionTextInner"
            class="question-text-inner"
        >
            Waiting for host to start...
        </span>
    `;


    startIdleSweepingAnimation();

}


// =====================================================
// IDLE NEON COLOR CYCLE
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


    continuousColorIndex =
        0;


    applyIdleColor(
        sweepingColors[
            continuousColorIndex
        ]
    );


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


                applyIdleColor(
                    sweepingColors[
                        continuousColorIndex
                    ]
                );

            },

            1200
        );

}


// =====================================================
// APPLY IDLE COLOR
// =====================================================

function applyIdleColor(
    color
) {

    if (!display) {

        return;

    }


    /*
    ==========================================
    ONLY APPLY NEON EFFECT IN IDLE MODE
    ==========================================
    */

    if (
        !display.classList.contains(
            "idle-waiting-mode"
        )
    ) {

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
        settings => {

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

                forceNoGlowDisplay();

                return;

            }


            /*
            ==========================================
            TIMER SETTINGS MAY ARRIVE BEFORE GAME
            STARTS.

            Do not create a glow here.
            ==========================================
            */

            if (
                lastGameStatus ===
                "running"
            ) {

                updateTimerUI();

            }

        }
    );


    // =================================================
    // SERVER TIMER UPDATE
    // =================================================

    socket.on(
        "timerUpdate",
        time => {

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

                forceNoGlowDisplay();

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
        state => {

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

                handleRunningState(
                    state
                );


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

                handleGameEnded();


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
// HANDLE RUNNING GAME STATE
// =====================================================

function handleRunningState(
    state
) {

    /*
    ==========================================
    TIMER MODE
    ==========================================
    */

    if (
        state.noTimer === true
    ) {

        timerEnabled =
            false;

        clearTimer();

    }

    else {

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


    /*
    ==========================================
    PAUSED
    ==========================================
    */

    if (
        state.isPaused
    ) {

        clearTimer();

        pauseDisplay();

        return;

    }


    /*
    ==========================================
    CURRENT QUESTION
    ==========================================
    */

    const targetText =
        state.currentQuestion ||
        "";


    const targetIndex =
        Number.isInteger(
            state.currentQuestionIndex
        )
            ? state.currentQuestionIndex
            : null;


    /*
    ==========================================
    DETERMINE WHETHER QUESTION CHANGED
    ==========================================
    */

    const questionChanged =
        targetText !==
        lastQuestion;


    if (
        questionChanged
    ) {

        animateQuestionChange(
            targetText,
            targetIndex,
            state
        );

    }

    else {

        /*
        ==========================================
        SAME QUESTION

        Timer may continue internally,
        but display remains glow-free.
        ==========================================
        */

        forceNoGlowDisplay();

    }

}


// =====================================================
// QUESTION CHANGE ANIMATION
// =====================================================

function animateQuestionChange(
    targetText,
    targetIndex,
    state
) {

    if (!display) {

        return;

    }


    /*
    ==========================================
    STOP IDLE ANIMATION
    ==========================================
    */

    clearCustomSweepingStyles();


    /*
    ==========================================
    DETERMINE DIRECTION
    ==========================================

    index increased:
        NEXT

    index decreased:
        PREVIOUS

    if no usable index:
        default to NEXT
    */

    let direction =
        "next";


    if (
        Number.isInteger(
            lastQuestionIndex
        ) &&
        Number.isInteger(
            targetIndex
        )
    ) {

        if (
            targetIndex <
            lastQuestionIndex
        ) {

            direction =
                "previous";

        }

        else if (
            targetIndex >
            lastQuestionIndex
        ) {

            direction =
                "next";

        }

    }


    console.log(
        "QUESTION TRANSITION:",
        direction,
        "FROM:",
        lastQuestionIndex,
        "TO:",
        targetIndex
    );


    /*
    ==========================================
    NEW TRANSITION TOKEN
    ==========================================
    */

    questionTransitionToken++;

    const transitionToken =
        questionTransitionToken;


    /*
    ==========================================
    UPDATE TRACKING IMMEDIATELY
    ==========================================
    */

    lastQuestion =
        targetText;


    lastQuestionIndex =
        targetIndex;


    /*
    ==========================================
    AUDIO
    ==========================================
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
    ==========================================
    GET / CREATE INNER QUESTION ELEMENT
    ==========================================
    */

    let inner =
        document.getElementById(
            "questionTextInner"
        );


    if (!inner) {

        const oldText =
            display.textContent ||
            "";


        display.innerHTML = "";


        inner =
            document.createElement(
                "span"
            );


        inner.id =
            "questionTextInner";


        inner.className =
            "question-text-inner";


        inner.textContent =
            oldText;


        display.appendChild(
            inner
        );

    }


    /*
    ==========================================
    MAKE SURE DISPLAY IS IN ACTIVE MODE

    IMPORTANT:

    DO NOT add timer-green.

    Running game must have NO GLOW.
    ==========================================
    */

    forceNoGlowDisplay();


    /*
    ==========================================
    EXIT DIRECTION
    ==========================================

    NEXT:
        old question goes LEFT

    PREVIOUS:
        old question goes RIGHT
    */

    const exitClass =
        direction === "previous"
            ? "question-exit-right"
            : "question-exit-left";


    const enterClass =
        direction === "previous"
            ? "question-enter-from-left"
            : "question-enter-from-right";


    /*
    ==========================================
    CLEAN OLD ANIMATION CLASSES
    ==========================================
    */

    inner.classList.remove(

        "question-exit-left",

        "question-exit-right",

        "question-enter-from-left",

        "question-enter-from-right",

        "question-enter-active"

    );


    /*
    ==========================================
    FORCE INITIAL POSITION
    ==========================================
    */

    inner.classList.add(
        exitClass
    );


    /*
    ==========================================
    WAIT FOR EXIT
    ==========================================
    */

    setTimeout(
        () => {

            /*
            ==========================================
            IGNORE OLD TRANSITION
            ==========================================
            */

            if (
                transitionToken !==
                questionTransitionToken
            ) {

                return;

            }


            if (!display) {

                return;

            }


            /*
            ==========================================
            SWITCH QUESTION
            ==========================================
            */

            inner.textContent =
                targetText;


            /*
            ==========================================
            REMOVE EXIT POSITION
            ==========================================
            */

            inner.classList.remove(
                exitClass
            );


            /*
            ==========================================
            PUT NEW QUESTION ON OPPOSITE SIDE
            ==========================================
            */

            inner.classList.add(
                enterClass
            );


            /*
            ==========================================
            FORCE BROWSER REPAINT

            This is critical.

            It makes the browser recognize the
            starting position before animation begins.
            ==========================================
            */

            void inner.offsetWidth;


            /*
            ==========================================
            START ENTER ANIMATION
            ==========================================
            */

            inner.classList.add(
                "question-enter-active"
            );


            inner.classList.remove(
                enterClass
            );


            /*
            ==========================================
            ENTER ANIMATION COMPLETE
            ==========================================
            */

            setTimeout(
                () => {

                    if (
                        transitionToken !==
                        questionTransitionToken
                    ) {

                        return;

                    }


                    if (!display) {

                        return;

                    }


                    inner.classList.remove(
                        "question-enter-active"
                    );


                    /*
                    ==================================
                    IMPORTANT:

                    Keep the display glow-free after
                    the question animation completes.
                    ==================================
                    */

                    forceNoGlowDisplay();


                    /*
                    ==================================
                    START TIMER AFTER ANIMATION
                    ==================================
                    */

                    if (
                        timerEnabled
                    ) {

                        startTimer(
                            state.timerSeconds ||
                            timer.max ||
                            30
                        );

                    }

                    else {

                        forceNoGlowDisplay();

                    }

                },

                420
            );

        },

        420
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

        forceNoGlowDisplay();

        return;

    }


    timer.max =
        Number(
            seconds
        ) ||
        30;


    timer.current =
        timer.max;


    /*
    ==========================================
    DISPLAY REMAINS GLOW-FREE
    ==========================================
    */

    forceNoGlowDisplay();


    timer.interval =
        setInterval(
            () => {

                if (
                    !timerEnabled
                ) {

                    clearTimer();

                    forceNoGlowDisplay();

                    return;

                }


                timer.current--;


                /*
                ==========================================
                TIMER STILL RUNS.

                UI intentionally remains glow-free.
                ==========================================
                */

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
// TIMER UI
// =====================================================

function updateTimerUI() {

    if (!display) {

        return;

    }


    /*
    ==========================================
    IMPORTANT

    Timer continues running internally.

    The display does NOT use timer-green,
    timer-amber, timer-orange, timer-red,
    or timer-dead classes during the game.

    This prevents the neon glow.
    ==========================================
    */

    forceNoGlowDisplay();

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
    PAUSED = NO GLOW
    ==========================================
    */

    forceNoGlowDisplay();

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
    RESUME = NO GLOW
    ==========================================
    */

    forceNoGlowDisplay();


    startTimer(
        timer.current ||
        timer.max ||
        30
    );

}


// =====================================================
// GAME OVER
// =====================================================

function handleGameEnded() {

    clearTimer();

    clearCustomSweepingStyles();

    questionTransitionToken++;


    timerEnabled =
        true;


    clearTimerClasses();


    /*
    ==========================================
    REMOVE INLINE GLOW
    ==========================================
    */

    display.style.boxShadow =
        "none";

    display.style.textShadow =
        "none";

    display.style.filter =
        "none";

    display.style.borderColor =
        "";


    /*
    ==========================================
    GAME OVER CLASS
    ==========================================
    */

    display.className =
        "timer-dead";


    display.innerHTML = `
        <span
            id="questionTextInner"
            class="question-text-inner"
        >
            Game Over
        </span>
    `;


    /*
    ==========================================
    GAME OVER AUDIO
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

}


// =====================================================
// BINGO CSS & QUESTION ANIMATION CSS
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

        /*
        ==========================================
        RUNNING GAME — NO GLOW
        ==========================================
        */

        #questionDisplay.running-no-glow {

            box-shadow: none !important;

            text-shadow: none !important;

            filter: none !important;

        }


        /*
        ==========================================
        QUESTION TEXT
        ==========================================
        */

        .question-text-inner {

            display: block;

            width: 100%;

            will-change:
                transform,
                opacity;

            transform:
                translateX(0);

            opacity: 1;

            transition:
                transform
                .42s
                cubic-bezier(
                    .4,
                    0,
                    .2,
                    1
                ),

                opacity
                .42s
                ease;

        }


        /*
        ==========================================
        NEXT QUESTION

        OLD:
            slides LEFT

        NEW:
            comes from RIGHT
        ==========================================
        */

        .question-exit-left {

            transform:
                translateX(-110vw);

            opacity: 0;

        }


        .question-enter-from-right {

            transform:
                translateX(110vw);

            opacity: 0;

        }


        /*
        ==========================================
        PREVIOUS QUESTION

        OLD:
            slides RIGHT

        NEW:
            comes from LEFT
        ==========================================
        */

        .question-exit-right {

            transform:
                translateX(110vw);

            opacity: 0;

        }


        .question-enter-from-left {

            transform:
                translateX(-110vw);

            opacity: 0;

        }


        /*
        ==========================================
        ACTIVE ENTER ANIMATION
        ==========================================
        */

        .question-enter-active {

            transform:
                translateX(0);

            opacity: 1;

        }


        /*
        ==========================================
        BINGO OVERLAY
        ==========================================
        */

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
                clamp(
                    70px,
                    12vw,
                    150px
                );

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
                cubic-bezier(
                    .2,
                    .9,
                    .3,
                    1.25
                )
                forwards,

                bingoTitlePulse
                1.1s
                ease-in-out
                .55s
                infinite
                alternate;

        }


        .display-bingo-sub {

            position: relative;

            z-index: 1000000;

            margin-top: 25px;

            font-family:
                Arial,
                sans-serif;

            font-size:
                clamp(
                    24px,
                    4vw,
                    42px
                );

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
                    rotate(720deg);

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

    if (
        bingoOverlayActive
    ) {

        return;

    }


    bingoOverlayActive =
        true;


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
    CONFETTI
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


        const duration =
            3 +
            Math.random() * 3;


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
    CLEANUP
    ==========================================
    */

    bingoOverlayTimeout =
        setTimeout(
            () => {

                if (
                    overlay &&
                    overlay.parentNode
                ) {

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
