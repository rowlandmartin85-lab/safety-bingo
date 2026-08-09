"use strict";

// =====================================================
// SAFETY STANDDOWN BINGO - DISPLAY.JS
// RESTORED WORKING DISPLAY LOGIC
// =====================================================

// CRITICAL:
// Always connect to the exact host that served this page.
// This works on localhost, cloud hosting, phones, tablets,
// projector computers, etc.
const liveWebsiteAddressUrl =
    `${window.location.protocol}//${window.location.host}`;

const socket = io(liveWebsiteAddressUrl);

let display = null;

// =====================================================
// CENTRAL TIMER
// =====================================================

let timer = {
    max: 30,
    current: 30,
    interval: null
};

let timerEnabled = true;

// =====================================================
// DISPLAY STATE
// =====================================================

let lastQuestion = "";
let paused = false;

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
// INITIALIZE
// =====================================================

document.addEventListener("DOMContentLoaded", () => {

    display = document.getElementById("questionDisplay");

    if (!display) {
        console.error(
            "DISPLAY ERROR: #questionDisplay was not found."
        );
        return;
    }

    setupDisplayNetworkHandlers();

    startIdleSweepingAnimation();

    console.log("SAFETY BINGO DISPLAY READY");

});

// =====================================================
// IDLE NEON COLOR CYCLING
// =====================================================

function startIdleSweepingAnimation() {

    if (continuousWaveInterval) {
        return;
    }

    continuousWaveInterval = setInterval(() => {

        if (
            !display ||
            !display.classList.contains("idle-waiting-mode")
        ) {

            clearInterval(continuousWaveInterval);
            continuousWaveInterval = null;

            return;
        }

        const activeColor =
            sweepingColors[continuousColorIndex];

        display.style.borderColor = activeColor;

        display.style.boxShadow =
            `0 0 20px ${activeColor},
             0 0 40px ${activeColor},
             inset 0 0 10px ${activeColor}`;

        continuousColorIndex =
            (continuousColorIndex + 1)
            % sweepingColors.length;

    }, 416);
}

// =====================================================
// CLEAR IDLE NEON
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
// TIMER CLEAR
// =====================================================

function clearTimer() {

    if (timer.interval) {

        clearInterval(
            timer.interval
        );

        timer.interval = null;
    }
}

// =====================================================
// SOCKET / NETWORK EVENTS
// =====================================================

function setupDisplayNetworkHandlers() {

    // -------------------------------------------------
    // TIMER SETTINGS
    // -------------------------------------------------

    socket.on(
        "timerSettingsUpdated",
        (settings) => {

            if (!settings) {
                return;
            }

            timerEnabled =
                !settings.noTimer;

            timer.max =
                Number(settings.seconds) || 30;

            console.log(
                "DISPLAY TIMER SETTINGS:",
                settings
            );

            if (!timerEnabled) {

                clearTimer();

                updateTimerUI();
            }
        }
    );

    // -------------------------------------------------
    // SERVER TIMER UPDATE
    // -------------------------------------------------

    socket.on(
        "timerUpdate",
        (time) => {

            if (typeof time !== "number") {
                return;
            }

            timer.current = time;

            updateTimerUI();
        }
    );

    // =================================================
    // GAME STATE
    // =================================================

    socket.on(
        "gameState",
        (state) => {

            if (!state) {
                console.warn(
                    "DISPLAY RECEIVED EMPTY GAME STATE"
                );
                return;
            }

            if (!display) {
                console.error(
                    "DISPLAY ELEMENT MISSING"
                );
                return;
            }

            console.log(
                "DISPLAY GAME STATE:",
                state
            );

            // =========================================
            // IDLE
            // =========================================

            if (state.status === "idle") {

                clearTimer();

                paused = false;

                lastQuestion = "";

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

                display.classList.add(
                    "idle-waiting-mode"
                );

                display.textContent =
                    "Waiting for host to start...";

                startIdleSweepingAnimation();

                return;
            }

            // =========================================
            // RUNNING
            // =========================================

            if (state.status === "running") {

                display.classList.remove(
                    "idle-waiting-mode"
                );

                clearCustomSweepingStyles();

                // -------------------------------------
                // PAUSED
                // -------------------------------------

                if (state.isPaused || state.paused) {

                    paused = true;

                    clearTimer();

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

                    display.classList.add(
                        "timer-paused"
                    );

                } else {

                    paused = false;

                    display.classList.remove(
                        "timer-paused"
                    );
                }

                // -------------------------------------
                // GET QUESTION
                // -------------------------------------

                const targetText =
                    state.currentQuestion || "";

                console.log(
                    "DISPLAY QUESTION:",
                    targetText
                );

                // -------------------------------------
                // QUESTION CHANGED
                // -------------------------------------

                if (
                    targetText &&
                    (
                        targetText !== lastQuestion ||
                        state.repeatQuestion === true
                    )
                ) {

                    lastQuestion =
                        targetText;

                    // IMPORTANT:
                    // Put the question on the screen
                    // BEFORE trying to use audio.
                    display.textContent =
                        targetText;

                    console.log(
                        "QUESTION DISPLAYED:",
                        targetText
                    );

                    // ---------------------------------
                    // AUDIO
                    // ---------------------------------

                    if (
                        window.audioEngine &&
                        typeof window.audioEngine.readQuestion ===
                            "function"
                    ) {

                        console.log(
                            "READING QUESTION WITH AUDIO ENGINE"
                        );

                        try {

                            window.audioEngine.readQuestion(
                                targetText
                            );

                        } catch (error) {

                            console.error(
                                "QUESTION AUDIO ERROR:",
                                error
                            );
                        }

                    } else {

                        console.warn(
                            "audioEngine.readQuestion() NOT AVAILABLE"
                        );
                    }

                    // ---------------------------------
                    // QUESTION ANIMATION
                    // ---------------------------------

                    display.classList.remove(
                        "timer-green",
                        "timer-amber",
                        "timer-orange",
                        "timer-red",
                        "timer-dead",
                        "timer-paused",
                        "prepare-in",
                        "fade-in"
                    );

                    display.classList.add(
                        "swoosh-out"
                    );

                    setTimeout(() => {

                        if (!display) {
                            return;
                        }

                        display.textContent =
                            targetText;

                        display.classList.remove(
                            "swoosh-out"
                        );

                        display.classList.add(
                            "prepare-in"
                        );

                        requestAnimationFrame(() => {

                            setTimeout(() => {

                                if (!display) {
                                    return;
                                }

                                display.classList.remove(
                                    "prepare-in"
                                );

                                display.classList.add(
                                    "fade-in"
                                );

                                // -------------------------
                                // START TIMER
                                // -------------------------

                                if (
                                    !state.noTimer &&
                                    !paused
                                ) {

                                    startTimer(
                                        Number(
                                            state.timerSeconds
                                        ) || 30
                                    );

                                }

                            }, 20);

                        });

                    }, 350);

                } else {

                    // ---------------------------------
                    // SAME QUESTION
                    // ---------------------------------

                    // Do NOT erase the question.
                    // Do NOT restart audio.
                    // Do NOT restart the animation.

                    if (
                        !display.textContent &&
                        targetText
                    ) {

                        display.textContent =
                            targetText;
                    }

                    // ---------------------------------
                    // NO TIMER MODE
                    // ---------------------------------

                    if (state.noTimer) {

                        clearTimer();

                        timerEnabled = false;

                        display.classList.remove(
                            "timer-green",
                            "timer-amber",
                            "timer-orange",
                            "timer-red",
                            "timer-dead"
                        );

                    } else {

                        timerEnabled = true;
                    }
                }

                return;
            }

            // =================================================
            // GAME ENDED
            // =================================================

            if (state.status === "ended") {

                clearTimer();

                clearCustomSweepingStyles();

                paused = false;

                display.classList.remove(
                    "idle-waiting-mode",
                    "timer-green",
                    "timer-amber",
                    "timer-orange",
                    "timer-red",
                    "timer-paused",
                    "swoosh-out",
                    "prepare-in",
                    "fade-in"
                );

                display.classList.add(
                    "timer-dead"
                );

                display.textContent =
                    "Game Over";

                console.log(
                    "DISPLAY: GAME OVER"
                );

                // -------------------------------------
                // GAME OVER AUDIO
                // -------------------------------------

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

                    } catch (error) {

                        console.error(
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

                    } catch (error) {

                        console.error(
                            "GAME OVER SPEECH ERROR:",
                            error
                        );
                    }
                }

                return;
            }

        }
    );

    // =================================================
    // SOCKET CONNECTED
    // =================================================

    socket.on(
        "connect",
        () => {

            console.log(
                "PROJECTOR DISPLAY CONNECTED:",
                socket.id
            );

            // Ask server for current state immediately.
            socket.emit(
                "requestGameStateSyncFallback"
            );
        }
    );

    // =================================================
    // SOCKET DISCONNECTED
    // =================================================

    socket.on(
        "disconnect",
        (reason) => {

            console.warn(
                "DISPLAY SOCKET DISCONNECTED:",
                reason
            );
        }
    );

    // =================================================
    // SOCKET ERROR
    // =================================================

    socket.on(
        "connect_error",
        (error) => {

            console.error(
                "DISPLAY SOCKET ERROR:",
                error
            );
        }
    );

    // =================================================
    // BINGO APPROVED
    // =================================================

    socket.on(
        "winApproved",
        (data) => {

            console.log(
                "DISPLAY: BINGO WIN APPROVED",
                data
            );

            showBingoCelebration();
        }
    );

    // =================================================
    // PHYSICAL WIN APPROVED
    // =================================================

    socket.on(
        "physicalWinApproved",
        (data) => {

            console.log(
                "DISPLAY: PHYSICAL BINGO APPROVED",
                data
            );

            showBingoCelebration();
        }
    );
}

// =====================================================
// TIMER
// =====================================================

function startTimer(seconds = 30) {

    clearTimer();

    if (
        !timerEnabled ||
        seconds === 0 ||
        paused
    ) {

        updateTimerUI();

        return;
    }

    timer.max =
        Number(seconds) || 30;

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

                // Keep the event name used by
                // your working display code.
                socket.emit(
                    "requestNext"
                );
            }

        }, 1000);
}

// =====================================================
// TIMER COLOR ENGINE
// =====================================================

function updateTimerUI() {

    if (
        !display ||
        display.classList.contains(
            "idle-waiting-mode"
        )
    ) {

        return;
    }

    if (paused) {
        return;
    }

    display.classList.remove(
        "timer-green",
        "timer-amber",
        "timer-orange",
        "timer-red",
        "timer-dead"
    );

    if (!timerEnabled) {

        display.classList.add(
            "timer-green"
        );

        return;
    }

    if (
        !timer.max ||
        timer.max <= 0
    ) {

        display.classList.add(
            "timer-green"
        );

        return;
    }

    const ratio =
        timer.current / timer.max;

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
// BINGO WIN ANIMATION
// =====================================================

function showBingoCelebration() {

    // Prevent duplicate overlays.
    if (
        document.querySelector(
            ".bingo-overlay"
        )
    ) {

        return;
    }

    console.log(
        "DISPLAY: SHOWING BINGO CELEBRATION"
    );

    const overlay =
        document.createElement("div");

    overlay.className =
        "bingo-overlay";

    overlay.innerHTML = `
        <div class="bingo-title">
            B I N G O !
        </div>

        <div class="bingo-sub">
            WIN CONFIRMED
        </div>
    `;

    // =================================================
    // INLINE SAFETY STYLES
    // This means the animation still works even if
    // the HTML CSS was accidentally changed.
    // =================================================

    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.zIndex = "99999";
    overlay.style.background = "rgba(0,0,0,.88)";
    overlay.style.display = "flex";
    overlay.style.flexDirection = "column";
    overlay.style.justifyContent = "center";
    overlay.style.alignItems = "center";
    overlay.style.overflow = "hidden";

    document.body.appendChild(
        overlay
    );

    const title =
        overlay.querySelector(
            ".bingo-title"
        );

    const subtitle =
        overlay.querySelector(
            ".bingo-sub"
        );

    if (title) {

        title.style.fontFamily =
            "Arial Black, Impact, Arial, sans-serif";

        title.style.fontSize =
            "clamp(70px, 11vw, 150px)";

        title.style.fontWeight =
            "900";

        title.style.color =
            "#FFD84D";

        title.style.textShadow =
            "0 0 25px #FFD84D, " +
            "0 0 50px #ff9400, " +
            "0 0 90px #ff6600";

        title.style.animation =
            "displayBingoPulse 1s ease-in-out infinite alternate";
    }

    if (subtitle) {

        subtitle.style.fontSize =
            "clamp(24px, 4vw, 50px)";

        subtitle.style.fontWeight =
            "bold";

        subtitle.style.color =
            "#ffffff";

        subtitle.style.textShadow =
            "0 0 15px #ffffff";
    }

    // =================================================
    // CONFETTI
    // =================================================

    const colors = [
        "#FFD84D",
        "#2ecc71",
        "#3498db",
        "#e74c3c",
        "#9b59b6",
        "#f1c40f",
        "#e67e22",
        "#ffffff"
    ];

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

        flake.style.position =
            "absolute";

        flake.style.top =
            "-30px";

        flake.style.left =
            Math.random() * 100 + "vw";

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

        flake.style.zIndex =
            "100000";

        const duration =
            5 + Math.random() * 5;

        const delay =
            Math.random() * 1.5;

        flake.style.animation =
            `displayConfettiFall ${duration}s linear ${delay}s forwards`;

        if (Math.random() > 0.5) {

            flake.style.borderRadius =
                "50%";
        }

        overlay.appendChild(
            flake
        );
    }

    // =================================================
    // BINGO AUDIO
    // =================================================

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

        } catch (error) {

            console.error(
                "BINGO AUDIO ERROR:",
                error
            );
        }
    }

    // =================================================
    // REMOVE AFTER 10 SECONDS
    // =================================================

    setTimeout(() => {

        if (overlay) {

            overlay.remove();
        }

    }, 10000);
}

// =====================================================
// BINGO ANIMATION CSS
// =====================================================

(function installBingoAnimationStyles() {

    if (
        document.getElementById(
            "displayBingoAnimationStyles"
        )
    ) {

        return;
    }

    const style =
        document.createElement("style");

    style.id =
        "displayBingoAnimationStyles";

    style.textContent = `

        @keyframes displayBingoPulse {

            from {
                transform: scale(.95);
            }

            to {
                transform: scale(1.08);
            }

        }

        @keyframes displayConfettiFall {

            from {
                transform:
                    translateY(0)
                    rotate(0deg);

                opacity: 1;
            }

            to {
                transform:
                    translateY(110vh)
                    rotate(720deg);

                opacity: 0;
            }

        }

    `;

    document.head.appendChild(
        style
    );

})();

// =====================================================
// AUDIO UNLOCK
// Browser audio normally requires user interaction.
// =====================================================

function unlockDisplayAudio() {

    if (
        window.audioEngine &&
        typeof window.audioEngine.unlock ===
            "function"
    ) {

        try {

            window.audioEngine.unlock();

            console.log(
                "DISPLAY AUDIO UNLOCKED"
            );

        } catch (error) {

            console.error(
                "AUDIO UNLOCK ERROR:",
                error
            );
        }
    }
}

document.addEventListener(
    "click",
    unlockDisplayAudio,
    {
        once: true
    }
);

document.addEventListener(
    "touchstart",
    unlockDisplayAudio,
    {
        once: true,
        passive: true
    }
);

// =====================================================
// EXPORT FOR OTHER DISPLAY CODE
// =====================================================

window.displayBingoAnimation = {
    show: showBingoCelebration
};

console.log(
    "SAFETY BINGO DISPLAY.JS LOADED"
);
