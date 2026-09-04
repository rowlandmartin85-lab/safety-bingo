"use strict";

/*
 * =========================================================
 * DISPLAY.JS
 * SAFETY STANDDOWN BINGO PROJECTOR DISPLAY
 * =========================================================
 */

const liveWebsiteAddressUrl =
    `${window.location.protocol}//${window.location.host}`;

const socket = io(liveWebsiteAddressUrl);

let display = null;


/* =========================================================
   TIMER
========================================================= */

let timer = {
    max: 30,
    current: 30,
    interval: null
};

let timerEnabled = true;


/* =========================================================
   DISPLAY AUDIO MUTE STATE
========================================================= */

let displayMuted = false;


/* =========================================================
   IDLE DISPLAY COLORS
========================================================= */

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


/* =========================================================
   QUESTION STATE
========================================================= */

let lastQuestion = "";
let lastGameStatus = "";
let lastAudioQuestion = "";
let lastRepeatAudioState = false;


/* =========================================================
   BINGO OVERLAY
========================================================= */

let bingoOverlayActive = false;
let bingoOverlayTimeout = null;


/* =========================================================
   DOM READY
========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    display =
        document.getElementById("questionDisplay");

    if (!display) {
        console.error(
            "questionDisplay element not found."
        );

        return;
    }

    setupBingoStyles();

    setupDisplayNetworkHandlers();

    setIdleDisplay();

    console.log(
        "SAFETY BINGO DISPLAY READY"
    );
});


/* =========================================================
   TIMER HELPERS
========================================================= */

function clearTimer() {

    if (timer.interval) {
        clearInterval(timer.interval);
        timer.interval = null;
    }
}


function clearTimerClasses() {

    if (!display) return;

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


/* =========================================================
   FORCE GREEN DISPLAY
========================================================= */

function forceGreenDisplay() {

    if (!display) return;

    clearCustomSweepingStyles();

    clearTimerClasses();

    display.classList.add(
        "timer-green"
    );
}


/* =========================================================
   IDLE DISPLAY
========================================================= */

function setIdleDisplay() {

    if (!display) return;

    clearTimer();

    lastQuestion = "";
    lastAudioQuestion = "";
    lastRepeatAudioState = false;

    clearTimerClasses();

    display.className =
        "idle-waiting-mode";

    display.textContent =
        "Waiting for host to start...";

    startIdleSweepingAnimation();
}


/* =========================================================
   IDLE SWEEPING ANIMATION
========================================================= */

function startIdleSweepingAnimation() {

    if (
        !display ||
        continuousWaveInterval
    ) {
        return;
    }

    continuousColorIndex = 0;

    applyIdleColor(
        sweepingColors[
            continuousColorIndex
        ]
    );

    continuousWaveInterval =
        setInterval(() => {

            if (
                !display ||
                !display.classList.contains(
                    "idle-waiting-mode"
                )
            ) {
                clearInterval(
                    continuousWaveInterval
                );

                continuousWaveInterval = null;

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

        }, 1200);
}


/* =========================================================
   APPLY IDLE COLOR
========================================================= */

function applyIdleColor(color) {

    if (!display) return;

    display.style.borderColor =
        color;

    display.style.boxShadow = `
        0 0 18px ${color},
        0 0 40px ${color},
        0 0 70px ${color},
        0 0 100px ${color},
        inset 0 0 12px ${color},
        0 16px 45px rgba(0,0,0,.6)
    `;
}


/* =========================================================
   CLEAR CUSTOM DISPLAY STYLES
========================================================= */

function clearCustomSweepingStyles() {

    if (continuousWaveInterval) {

        clearInterval(
            continuousWaveInterval
        );
    }

    continuousWaveInterval = null;

    if (display) {

        display.style.borderColor = "";

        display.style.boxShadow = "";
    }
}


/* =========================================================
   AUDIO HELPERS
========================================================= */

/*
 * Stop currently speaking audio.
 *
 * Different audio engines may expose different
 * cancellation methods, so we safely support:
 *
 * - cancel()
 * - stop()
 * - speechSynthesis.cancel()
 */

function cancelDisplayAudio() {

    try {

        if (
            window.audioEngine &&
            typeof window.audioEngine.cancel ===
                "function"
        ) {
            window.audioEngine.cancel();
        }

    } catch (error) {

        console.warn(
            "DISPLAY AUDIO CANCEL ERROR:",
            error
        );
    }


    try {

        if (
            window.audioEngine &&
            typeof window.audioEngine.stop ===
                "function"
        ) {
            window.audioEngine.stop();
        }

    } catch (error) {

        console.warn(
            "DISPLAY AUDIO STOP ERROR:",
            error
        );
    }


    try {

        if (
            window.speechSynthesis &&
            typeof window.speechSynthesis.cancel ===
                "function"
        ) {
            window.speechSynthesis.cancel();
        }

    } catch (error) {

        console.warn(
            "BROWSER SPEECH CANCEL ERROR:",
            error
        );
    }
}


/* =========================================================
   READ QUESTION
========================================================= */

function readQuestionOnDisplay(question) {

    if (!question) return;

    /*
     * IMPORTANT:
     *
     * The question should still appear visually
     * when muted.
     *
     * Only the audio is suppressed.
     */

    if (displayMuted) {

        console.log(
            "DISPLAY AUDIO MUTED - QUESTION WILL NOT BE SPOKEN:",
            question
        );

        return;
    }


    if (!window.audioEngine) {

        console.warn(
            "DISPLAY AUDIO ENGINE NOT AVAILABLE"
        );

        return;
    }


    if (
        typeof window.audioEngine.readQuestion !==
            "function"
    ) {

        console.warn(
            "DISPLAY AUDIO ENGINE DOES NOT PROVIDE readQuestion()"
        );

        return;
    }


    console.log(
        "DISPLAY AUDIO:",
        question
    );


    try {

        window.audioEngine.readQuestion(
            question
        );

        lastAudioQuestion =
            question;

    } catch (error) {

        console.error(
            "DISPLAY QUESTION AUDIO ERROR:",
            error
        );
    }
}


/* =========================================================
   PLAY DISPLAY AUDIO SAFELY
========================================================= */

function playDisplayAudio(sound) {

    if (displayMuted) {

        console.log(
            "DISPLAY MUTED - AUDIO SUPPRESSED:",
            sound
        );

        return;
    }


    if (
        !window.audioEngine ||
        typeof window.audioEngine.play !==
            "function"
    ) {
        return;
    }


    try {

        window.audioEngine.play(
            sound
        );

    } catch (error) {

        console.error(
            "DISPLAY AUDIO PLAY ERROR:",
            error
        );
    }
}


/* =========================================================
   SPEAK DISPLAY AUDIO SAFELY
========================================================= */

function speakDisplayAudio(
    text,
    options = {}
) {

    if (displayMuted) {

        console.log(
            "DISPLAY MUTED - SPEECH SUPPRESSED"
        );

        return;
    }


    if (
        !window.audioEngine ||
        typeof window.audioEngine.speak !==
            "function"
    ) {
        return;
    }


    try {

        window.audioEngine.speak(
            text,
            options
        );

    } catch (error) {

        console.error(
            "DISPLAY SPEECH ERROR:",
            error
        );
    }
}


/* =========================================================
   APPLY DISPLAY MUTE STATE
========================================================= */

function applyDisplayMuteState(
    muted
) {

    displayMuted =
        muted === true;


    console.log(
        "DISPLAY AUDIO STATE:",
        displayMuted
            ? "MUTED"
            : "UNMUTED"
    );


    /*
     * If the host mutes the display while speech
     * is currently playing, immediately stop it.
     */

    if (displayMuted) {

        cancelDisplayAudio();
    }


    /*
     * Optional visual indicator.
     *
     * We intentionally do NOT replace the question
     * display with a mute message.
     *
     * The projector should continue showing the game.
     */

    if (display) {

        display.dataset.audioMuted =
            displayMuted
                ? "true"
                : "false";
    }
}


/* =========================================================
   NETWORK / SOCKET HANDLERS
========================================================= */

function setupDisplayNetworkHandlers() {


    /* -----------------------------------------------------
       DISPLAY MUTE STATE
    ----------------------------------------------------- */

    socket.on(
        "displayMuteState",
        data => {

            if (
                typeof data ===
                    "boolean"
            ) {

                applyDisplayMuteState(
                    data
                );

                return;
            }


            if (
                data &&
                typeof data.muted ===
                    "boolean"
            ) {

                applyDisplayMuteState(
                    data.muted
                );
            }
        }
    );


    /* -----------------------------------------------------
       TIMER SETTINGS
    ----------------------------------------------------- */

    socket.on(
        "timerSettingsUpdated",
        settings => {

            if (!settings) return;


            timerEnabled =
                !Boolean(
                    settings.noTimer
                );


            timer.max =
                Number(
                    settings.seconds
                ) || 30;


            if (!timerEnabled) {

                clearTimer();

                forceGreenDisplay();

                return;
            }


            updateTimerUI();
        }
    );


    /* -----------------------------------------------------
       TIMER UPDATE
    ----------------------------------------------------- */

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


            if (!timerEnabled) {

                forceGreenDisplay();

                return;
            }


            updateTimerUI();
        }
    );


    /* -----------------------------------------------------
       GAME STATE
    ----------------------------------------------------- */

    socket.on(
        "gameState",
        state => {

            if (
                !state ||
                !display
            ) {
                return;
            }


            /* =============================================
               IDLE
            ============================================= */

            if (
                state.status ===
                    "idle"
            ) {

                timerEnabled = true;

                setIdleDisplay();

                lastGameStatus =
                    "idle";

                return;
            }


            /* =============================================
               RUNNING
            ============================================= */

            if (
                state.status ===
                    "running"
            ) {


                /*
                 * Apply mute state if the server
                 * includes it in gameState.
                 *
                 * This makes reconnect synchronization
                 * more reliable.
                 */

                if (
                    typeof state.displayMuted ===
                        "boolean"
                ) {

                    applyDisplayMuteState(
                        state.displayMuted
                    );
                }


                /* -----------------------------------------
                   TIMER MODE
                ----------------------------------------- */

                if (
                    state.noTimer ===
                        true
                ) {

                    timerEnabled =
                        false;

                    clearTimer();

                    clearCustomSweepingStyles();

                    forceGreenDisplay();

                } else {

                    timerEnabled =
                        true;


                    if (
                        state.timerSeconds
                    ) {

                        timer.max =
                            Number(
                                state.timerSeconds
                            ) || 30;
                    }
                }


                /* -----------------------------------------
                   QUESTION
                ----------------------------------------- */

                const targetText =
                    state.currentQuestion ||
                    "";


                const questionChanged =
                    targetText !==
                    lastQuestion;


                const repeatRequested =
                    state.repeatQuestion ===
                        true;


                /*
                 * Read new question or repeat.
                 */

                if (
                    targetText &&
                    (
                        questionChanged ||
                        repeatRequested
                    )
                ) {

                    readQuestionOnDisplay(
                        targetText
                    );
                }


                if (questionChanged) {

                    lastQuestion =
                        targetText;
                }


                /* -----------------------------------------
                   PAUSED
                ----------------------------------------- */

                if (
                    state.isPaused
                ) {

                    clearTimer();


                    if (
                        !timerEnabled
                    ) {

                        forceGreenDisplay();

                    } else {

                        clearCustomSweepingStyles();

                        clearTimerClasses();

                        display.classList.add(
                            "timer-paused"
                        );
                    }


                    lastGameStatus =
                        "running";

                    return;
                }


                /* -----------------------------------------
                   QUESTION CHANGED
                ----------------------------------------- */

                if (
                    questionChanged
                ) {

                    clearCustomSweepingStyles();


                    /*
                     * NO TIMER
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

                    /*
                     * TIMER ENABLED
                     */

                    else {

                        display.className =
                            "timer-green swoosh-out";


                        setTimeout(
                            () => {

                                if (
                                    !display
                                ) {
                                    return;
                                }


                                display.textContent =
                                    targetText;


                                display.className =
                                    "timer-green prepare-in";


                                requestAnimationFrame(
                                    () => {

                                        requestAnimationFrame(
                                            () => {

                                                if (
                                                    !display
                                                ) {
                                                    return;
                                                }


                                                display.className =
                                                    "timer-green fade-in";


                                                /*
                                                 * IMPORTANT:
                                                 *
                                                 * The SERVER owns
                                                 * the authoritative
                                                 * countdown.
                                                 *
                                                 * We do not emit
                                                 * requestNext here.
                                                 *
                                                 * timerUpdate events
                                                 * from server.js
                                                 * control the visual
                                                 * timer.
                                                 */

                                                if (
                                                    timerEnabled
                                                ) {

                                                    timer.current =
                                                        Number(
                                                            state.timerSeconds
                                                        ) || 30;

                                                    updateTimerUI();

                                                } else {

                                                    forceGreenDisplay();
                                                }

                                            }
                                        );
                                    }
                                );

                            },
                            350
                        );
                    }

                }

                /*
                 * Same question, just update timer.
                 */

                else {

                    if (
                        state.noTimer ===
                            true
                    ) {

                        clearTimer();

                        forceGreenDisplay();

                    } else {

                        updateTimerUI();
                    }
                }


                lastRepeatAudioState =
                    repeatRequested;

                lastGameStatus =
                    "running";

                return;
            }


            /* =============================================
               ENDED
            ============================================= */

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
                 * Audio automatically respects
                 * displayMuted.
                 */

                playDisplayAudio(
                    "end"
                );


                speakDisplayAudio(
                    "Game over. Thank you for playing Safety Standdown Bingo.",
                    {
                        rate: 0.8,
                        force: true
                    }
                );


                lastGameStatus =
                    "ended";

                return;
            }
        }
    );


    /* -----------------------------------------------------
       SOCKET CONNECT
    ----------------------------------------------------- */

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
             * Ask server for current state.
             */

            socket.emit(
                "requestGameStateSyncFallback"
            );


            /*
             * Ask server specifically for
             * the current mute state.
             *
             * This is safe even if the server does
             * not yet implement the event.
             */

            socket.emit(
                "requestDisplayMuteState"
            );
        }
    );


    /* -----------------------------------------------------
       BINGO - DIGITAL WIN
    ----------------------------------------------------- */

    socket.on(
        "winApproved",
        () => {

            showBingoCelebration();
        }
    );


    /* -----------------------------------------------------
       BINGO - PHYSICAL WIN
    ----------------------------------------------------- */

    socket.on(
        "physicalWinApproved",
        () => {

            showBingoCelebration();
        }
    );
}


/* =========================================================
   VISUAL TIMER
========================================================= */

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
        Number(seconds) || 30;


    timer.current =
        timer.max;


    updateTimerUI();


    /*
     * This function is retained for compatibility
     * with existing display code.
     *
     * IMPORTANT:
     * It does NOT request the next question.
     *
     * The server is authoritative.
     */

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

                    /*
                     * DO NOT emit requestNext.
                     *
                     * server.js calls sendNextQuestion()
                     * when its authoritative timer expires.
                     */
                }

            },
            1000
        );
}


/* =========================================================
   UPDATE TIMER UI
========================================================= */

function updateTimerUI() {

    if (!display) return;


    if (!timerEnabled) {

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
        Number(timer.max) || 30;


    const current =
        Number(timer.current) || 0;


    const ratio =
        current / max;


    if (ratio > 0.75) {

        display.classList.add(
            "timer-green"
        );

        return;
    }


    if (ratio > 0.50) {

        display.classList.add(
            "timer-amber"
        );

        return;
    }


    if (ratio > 0.25) {

        display.classList.add(
            "timer-orange"
        );

        return;
    }


    if (ratio > 0) {

        display.classList.add(
            "timer-red"
        );

        return;
    }


    display.classList.add(
        "timer-dead"
    );
}


/* =========================================================
   PAUSE DISPLAY
========================================================= */

function pauseDisplay() {

    clearTimer();


    if (!display) return;


    if (!timerEnabled) {

        forceGreenDisplay();

        return;
    }


    clearCustomSweepingStyles();

    clearTimerClasses();


    display.classList.add(
        "timer-paused"
    );
}


/* =========================================================
   RESUME DISPLAY
========================================================= */

function resumeDisplay() {

    if (!display) return;


    if (!timerEnabled) {

        forceGreenDisplay();

        return;
    }


    clearTimerClasses();


    display.classList.add(
        "timer-green"
    );


    /*
     * Resume visual countdown only.
     *
     * Server remains authoritative.
     */

    startTimer(
        timer.current ||
        timer.max ||
        30
    );
}


/* =========================================================
   BINGO STYLES
========================================================= */

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
                cubic-bezier(.2,.9,.3,1.25)
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
                        105vh,
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


/* =========================================================
   BINGO CELEBRATION
========================================================= */

function showBingoCelebration() {

    if (bingoOverlayActive) {
        return;
    }


    bingoOverlayActive = true;


    if (bingoOverlayTimeout) {

        clearTimeout(
            bingoOverlayTimeout
        );
    }


    /*
     * Audio respects mute state.
     */

    playDisplayAudio(
        "bingo"
    );


    speakDisplayAudio(
        "Bingo! We have a winner!",
        {
            rate: 0.9,
            force: true
        }
    );


    /* -----------------------------------------------------
       OVERLAY
    ----------------------------------------------------- */

    const overlay =
        document.createElement(
            "div"
        );


    overlay.className =
        "display-bingo-overlay";


    const title =
        document.createElement(
            "div"
        );


    title.className =
        "display-bingo-title";


    title.textContent =
        "BINGO!";


    const sub =
        document.createElement(
            "div"
        );


    sub.className =
        "display-bingo-sub";


    sub.textContent =
        "SAFETY STANDDOWN WINNER!";


    overlay.appendChild(
        title
    );


    overlay.appendChild(
        sub
    );


    document.body.appendChild(
        overlay
    );


    /* -----------------------------------------------------
       CONFETTI
    ----------------------------------------------------- */

    const confettiColors = [
        "#FFD84D",
        "#22c55e",
        "#3b82f6",
        "#ef4444",
        "#a855f7",
        "#ffffff",
        "#f97316"
    ];


    for (
        let i = 0;
        i < 90;
        i++
    ) {

        const confetti =
            document.createElement(
                "div"
            );


        confetti.className =
            "display-confetti";


        const size =
            Math.floor(
                Math.random() * 10
            ) + 8;


        confetti.style.width =
            `${size}px`;


        confetti.style.height =
            `${size * 0.6}px`;


        confetti.style.backgroundColor =
            confettiColors[
                Math.floor(
                    Math.random() *
                    confettiColors.length
                )
            ];


        confetti.style.left =
            `${Math.random() * 100}vw`;


        const duration =
            Math.random() * 2 +
            2.5;


        const delay =
            Math.random() * 1.5;


        confetti.style.animation =
            `displayConfettiFall ${duration}s linear ${delay}s forwards`;


        overlay.appendChild(
            confetti
        );
    }


    /* -----------------------------------------------------
       REMOVE OVERLAY
    ----------------------------------------------------- */

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


                bingoOverlayTimeout =
                    null;

            },
            7000
        );
}


/* =========================================================
   GLOBAL HELPERS
========================================================= */

window.applyDisplayMuteState =
    applyDisplayMuteState;

window.cancelDisplayAudio =
    cancelDisplayAudio;

window.readQuestionOnDisplay =
    readQuestionOnDisplay;

window.showBingoCelebration =
    showBingoCelebration;

window.pauseDisplay =
    pauseDisplay;

window.resumeDisplay =
    resumeDisplay;
