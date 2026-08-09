"use strict";

// =====================================================
// SAFETY BINGO DISPLAY.JS
// SERVER-AUTHORITATIVE DISPLAY CONTROLLER
// =====================================================

// Automatically use the live address of whatever device
// opens the page.
const liveWebsiteAddressUrl =
    `${window.location.protocol}//${window.location.host}`;

const socket = io(liveWebsiteAddressUrl, {
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: Infinity
});

let display = null;

// =====================================================
// CENTRAL DISPLAY TIMER
// =====================================================

const timer = {
    max: 30,
    current: 30,
    interval: null
};

let timerEnabled = true;

// =====================================================
// IDLE COLOR SWEEP
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

// Used to invalidate delayed question animations
// when a reset happens during an animation.
let displayTransitionToken = 0;

// Prevent repeated Game Over audio.
let gameOverAnnounced = false;

// =====================================================
// DOM READY
// =====================================================

document.addEventListener("DOMContentLoaded", () => {

    display = document.getElementById("questionDisplay");

    if (!display) {
        console.error(
            "DISPLAY ERROR: #questionDisplay NOT FOUND"
        );
        return;
    }

    resetDisplayToIdle();

    setupDisplayNetworkHandlers();

    console.log(
        "SAFETY BINGO DISPLAY READY"
    );
});

// =====================================================
// IDLE DISPLAY
// =====================================================

function resetDisplayToIdle() {

    displayTransitionToken++;

    clearDisplayTimer();

    clearCustomSweepingStyles();

    gameOverAnnounced = false;

    if (!display) {
        return;
    }

    display.textContent =
        "Waiting for host to start...";

    display.className =
        "idle-waiting-mode";

    display.style.borderColor = "";
    display.style.boxShadow = "";

    continuousColorIndex = 0;

    startIdleSweepingAnimation();

    console.log(
        "DISPLAY RESET TO IDLE"
    );
}

// =====================================================
// INFINITE IDLE COLOR CYCLING
// =====================================================

function startIdleSweepingAnimation() {

    if (continuousWaveInterval) {
        return;
    }

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

            const activeColor =
                sweepingColors[
                    continuousColorIndex
                ];

            display.style.borderColor =
                activeColor;

            display.style.boxShadow =
                `0 0 20px ${activeColor}, ` +
                `inset 0 0 10px ${activeColor}`;

            continuousColorIndex =
                (
                    continuousColorIndex + 1
                ) %
                sweepingColors.length;

        }, 416);
}

// =====================================================
// CLEAR IDLE SWEEP
// =====================================================

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

// =====================================================
// CLEAR DISPLAY TIMER
// =====================================================

function clearDisplayTimer() {

    if (timer.interval) {

        clearInterval(
            timer.interval
        );

        timer.interval = null;
    }
}

// =====================================================
// NETWORK HANDLERS
// =====================================================

function setupDisplayNetworkHandlers() {

    /*
    ==========================================
    CONNECTION
    ==========================================
    */

    socket.on(
        "connect",
        () => {

            console.log(
                "DISPLAY CONNECTED:",
                socket.id
            );

            /*
            Ask server for the authoritative
            current game state.
            */

            socket.emit(
                "requestGameStateSyncFallback"
            );
        }
    );


    /*
    ==========================================
    DISCONNECT
    ==========================================
    */

    socket.on(
        "disconnect",
        reason => {

            console.warn(
                "DISPLAY DISCONNECTED:",
                reason
            );

            /*
            We do NOT pretend the game is running
            while disconnected.
            */

            clearDisplayTimer();

        }
    );


    /*
    ==========================================
    CONNECTION ERROR
    ==========================================
    */

    socket.on(
        "connect_error",
        error => {

            console.error(
                "DISPLAY SOCKET ERROR:",
                error
            );
        }
    );


    /*
    ==========================================
    TIMER SETTINGS
    ==========================================
    */

    socket.on(
        "timerSettingsUpdated",
        settings => {

            if (!settings) {
                return;
            }

            timerEnabled =
                settings.noTimer !== true;

            timer.max =
                Number(settings.seconds) ||
                30;

            if (!timerEnabled) {

                clearDisplayTimer();

                updateTimerUI();
            }
        }
    );


    /*
    ==========================================
    AUTHORITATIVE TIMER UPDATE
    ==========================================
    */

    socket.on(
        "timerUpdate",
        time => {

            if (
                typeof time !==
                "number"
            ) {
                return;
            }

            timer.current = time;

            updateTimerUI();
        }
    );


    /*
    ==========================================
    GAME STATE
    ==========================================
    */

    socket.on(
        "gameState",
        state => {

            handleGameState(state);

        }
    );


    /*
    ==========================================
    EXPLICIT GAME RESET
    ==========================================
    */

    socket.on(
        "gameReset",
        () => {

            console.log(
                "DISPLAY RECEIVED GAME RESET"
            );

            resetDisplayToIdle();

        }
    );


    /*
    ==========================================
    GAME ENDED
    ==========================================
    */

    socket.on(
        "gameEnded",
        data => {

            console.log(
                "DISPLAY GAME ENDED:",
                data
            );

            handleGameEnded();

        }
    );


    /*
    ==========================================
    BINGO APPROVED
    ==========================================
    */

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

}

// =====================================================
// HANDLE AUTHORITATIVE GAME STATE
// =====================================================

function handleGameState(state) {

    if (!state || !display) {
        return;
    }


    /*
    ==========================================
    IDLE
    ==========================================
    */

    if (
        state.status ===
        "idle"
    ) {

        resetDisplayToIdle();

        return;
    }


    /*
    ==========================================
    RUNNING
    ==========================================
    */

    if (
        state.status ===
        "running"
    ) {

        gameOverAnnounced = false;

        /*
        Get timer configuration directly
        from authoritative server state.
        */

        timerEnabled =
            state.noTimer !== true;

        timer.max =
            Number(state.timerSeconds) ||
            30;

        /*
        If the question has not changed,
        don't restart the visual transition.
        */

        const targetText =
            state.currentQuestion ||
            "";

        if (
            display.dataset.question ===
            targetText
        ) {

            /*
            Server timerUpdate events control
            the actual counter.
            */

            updateTimerUI();

            return;
        }

        display.dataset.question =
            targetText;

        showQuestion(
            targetText,
            state
        );

        return;
    }


    /*
    ==========================================
    ENDED
    ==========================================
    */

    if (
        state.status ===
        "ended"
    ) {

        handleGameEnded();

        return;
    }
}

// =====================================================
// SHOW QUESTION
// =====================================================

function showQuestion(
    targetText,
    state
) {

    const transitionToken =
        ++displayTransitionToken;

    clearDisplayTimer();

    clearCustomSweepingStyles();

    /*
    ==========================================
    AUDIO
    ==========================================
    */

    if (
        window.audioEngine &&
        targetText
    ) {

        if (
            typeof window.audioEngine.readQuestion ===
            "function"
        ) {

            window.audioEngine.readQuestion(
                targetText
            );
        }
    }


    /*
    ==========================================
    OUT ANIMATION
    ==========================================
    */

    display.className =
        "timer-green swoosh-out";


    setTimeout(
        () => {

            /*
            A reset may have happened while
            this animation was running.
            */

            if (
                transitionToken !==
                displayTransitionToken
            ) {

                return;
            }


            display.textContent =
                targetText;

            display.className =
                "timer-green prepare-in";


            requestAnimationFrame(
                () => {

                    if (
                        transitionToken !==
                        displayTransitionToken
                    ) {

                        return;
                    }


                    setTimeout(
                        () => {

                            if (
                                transitionToken !==
                                displayTransitionToken
                            ) {

                                return;
                            }

                            display.className =
                                "timer-green fade-in";

                            /*
                            DO NOT create a second
                            countdown here.

                            The server sends
                            timerUpdate events.
                            */

                            updateTimerUI();

                        },
                        20
                    );

                }
            );

        },
        350
    );
}

// =====================================================
// GAME ENDED
// =====================================================

function handleGameEnded() {

    displayTransitionToken++;

    clearDisplayTimer();

    clearCustomSweepingStyles();

    if (!display) {
        return;
    }

    display.dataset.question = "";

    display.textContent =
        "Game Over";

    display.className =
        "timer-dead";

    if (!gameOverAnnounced) {

        gameOverAnnounced = true;

        if (window.audioEngine) {

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
                    "Game over. Thank you for playing Safety Standdown Bingo."
                );
            }
        }
    }
}

// =====================================================
// SERVER-AUTHORITATIVE TIMER UI
// =====================================================

function updateTimerUI() {

    if (!display) {
        return;
    }

    if (
        display.classList.contains(
            "idle-waiting-mode"
        )
    ) {

        return;
    }

    display.classList.remove(
        "timer-green",
        "timer-amber",
        "timer-orange",
        "timer-red",
        "timer-dead",
        "swoosh-out",
        "prepare-in",
        "fade-in"
    );


    /*
    ==========================================
    NO TIMER
    ==========================================
    */

    if (!timerEnabled) {

        display.classList.add(
            "timer-green"
        );

        return;
    }


    /*
    ==========================================
    PROTECT AGAINST INVALID VALUES
    ==========================================
    */

    if (
        !Number.isFinite(timer.current) ||
        !Number.isFinite(timer.max) ||
        timer.max <= 0
    ) {

        display.classList.add(
            "timer-green"
        );

        return;
    }


    const ratio =
        timer.current /
        timer.max;


    /*
    ==========================================
    COLOR SCALE
    ==========================================
    */

    if (ratio > 0.75) {

        display.classList.add(
            "timer-green"
        );

    } else if (ratio > 0.50) {

        display.classList.add(
            "timer-amber"
        );

    } else if (ratio > 0.25) {

        display.classList.add(
            "timer-orange"
        );

    } else if (ratio > 0) {

        display.classList.add(
            "timer-red"
        );

    } else {

        display.classList.add(
            "timer-dead"
        );
    }
}

// =====================================================
// CLEANUP
// =====================================================

window.addEventListener(
    "beforeunload",
    () => {

        clearDisplayTimer();

        if (continuousWaveInterval) {

            clearInterval(
                continuousWaveInterval
            );

            continuousWaveInterval = null;
        }
    }
);
