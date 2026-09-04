"use strict";

const liveWebsiteAddressUrl = `${window.location.protocol}//${window.location.host}`;
const socket = io(liveWebsiteAddressUrl);

let display = null;

let timer = {
    max: 30,
    current: 30,
    interval: null
};

let timerEnabled = true;

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

let lastQuestion = "";
let lastGameStatus = "";
let lastAudioQuestion = "";
let lastRepeatAudioState = false;

let bingoOverlayActive = false;
let bingoOverlayTimeout = null;

document.addEventListener("DOMContentLoaded", () => {
    display = document.getElementById("questionDisplay");

    if (!display) {
        console.error("questionDisplay element not found.");
        return;
    }

    setupBingoStyles();
    setupDisplayNetworkHandlers();
    setIdleDisplay();
});

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

function forceGreenDisplay() {
    if (!display) return;

    clearCustomSweepingStyles();
    clearTimerClasses();
    display.classList.add("timer-green");
}

function setIdleDisplay() {
    if (!display) return;

    clearTimer();

    lastQuestion = "";
    lastAudioQuestion = "";
    lastRepeatAudioState = false;

    clearTimerClasses();

    display.className = "idle-waiting-mode";
    display.textContent = "Waiting for host to start...";

    startIdleSweepingAnimation();
}

function startIdleSweepingAnimation() {
    if (!display || continuousWaveInterval) return;

    continuousColorIndex = 0;
    applyIdleColor(sweepingColors[continuousColorIndex]);

    continuousWaveInterval = setInterval(() => {
        if (!display || !display.classList.contains("idle-waiting-mode")) {
            clearInterval(continuousWaveInterval);
            continuousWaveInterval = null;
            return;
        }

        continuousColorIndex =
            (continuousColorIndex + 1) % sweepingColors.length;

        applyIdleColor(sweepingColors[continuousColorIndex]);
    }, 1200);
}

function applyIdleColor(color) {
    if (!display) return;

    display.style.borderColor = color;

    display.style.boxShadow = `
        0 0 18px ${color},
        0 0 40px ${color},
        0 0 70px ${color},
        0 0 100px ${color},
        inset 0 0 12px ${color},
        0 16px 45px rgba(0,0,0,.6)
    `;
}

function clearCustomSweepingStyles() {
    if (continuousWaveInterval) {
        clearInterval(continuousWaveInterval);
    }

    continuousWaveInterval = null;

    if (display) {
        display.style.borderColor = "";
        display.style.boxShadow = "";
    }
}

function readQuestionOnDisplay(question) {
    if (!question) return;

    if (!window.audioEngine) {
        console.warn("DISPLAY AUDIO ENGINE NOT AVAILABLE");
        return;
    }

    if (typeof window.audioEngine.readQuestion !== "function") {
        console.warn("DISPLAY AUDIO ENGINE DOES NOT PROVIDE readQuestion()");
        return;
    }

    console.log("DISPLAY AUDIO:", question);
    window.audioEngine.readQuestion(question);
    lastAudioQuestion = question;
}

function setupDisplayNetworkHandlers() {
    socket.on("timerSettingsUpdated", settings => {
        if (!settings) return;

        timerEnabled = !Boolean(settings.noTimer);
        timer.max = Number(settings.seconds) || 30;

        if (!timerEnabled) {
            clearTimer();
            forceGreenDisplay();
            return;
        }

        updateTimerUI();
    });

    socket.on("timerUpdate", time => {
        if (typeof time !== "number") return;

        timer.current = time;

        if (!timerEnabled) {
            forceGreenDisplay();
            return;
        }

        updateTimerUI();
    });

    socket.on("gameState", state => {
        if (!state || !display) return;

        if (state.status === "idle") {
            timerEnabled = true;
            setIdleDisplay();
            lastGameStatus = "idle";
            return;
        }

        if (state.status === "running") {
            if (state.noTimer === true) {
                timerEnabled = false;
                clearTimer();
                clearCustomSweepingStyles();
                forceGreenDisplay();
            } else {
                timerEnabled = true;

                if (state.timerSeconds) {
                    timer.max = Number(state.timerSeconds) || 30;
                }
            }

            const targetText = state.currentQuestion || "";
            const questionChanged = targetText !== lastQuestion;
            const repeatRequested = state.repeatQuestion === true;

            if (targetText && (questionChanged || repeatRequested)) {
                readQuestionOnDisplay(targetText);
            }

            if (questionChanged) {
                lastQuestion = targetText;
            }

            if (state.isPaused) {
                clearTimer();

                if (!timerEnabled) {
                    forceGreenDisplay();
                } else {
                    clearCustomSweepingStyles();
                    clearTimerClasses();
                    display.classList.add("timer-paused");
                }

                lastGameStatus = "running";
                return;
            }

            if (questionChanged) {
                clearCustomSweepingStyles();

                if (state.noTimer === true) {
                    clearTimer();

                    display.className = "timer-green";
                    display.textContent = targetText;
                    display.style.borderColor = "";
                    display.style.boxShadow = "";

                    display.classList.remove(
                        "timer-red",
                        "timer-dead",
                        "timer-orange",
                        "timer-amber"
                    );

                    display.classList.add("timer-green");
                } else {
                    display.className = "timer-green swoosh-out";

                    setTimeout(() => {
                        if (!display) return;

                        display.textContent = targetText;
                        display.className = "timer-green prepare-in";

                        requestAnimationFrame(() => {
                            requestAnimationFrame(() => {
                                if (!display) return;

                                display.className = "timer-green fade-in";

                                if (timerEnabled) {
                                    startTimer(state.timerSeconds || 30);
                                } else {
                                    forceGreenDisplay();
                                }
                            });
                        });
                    }, 350);
                }
            } else {
                if (state.noTimer === true) {
                    clearTimer();
                    forceGreenDisplay();
                } else {
                    updateTimerUI();
                }
            }

            lastRepeatAudioState = repeatRequested;
            lastGameStatus = "running";
            return;
        }

        if (state.status === "ended") {
            clearTimer();
            clearCustomSweepingStyles();

            timerEnabled = true;
            clearTimerClasses();

            display.className = "timer-dead";
            display.textContent = "Game Over";

            if (window.audioEngine) {
                if (typeof window.audioEngine.play === "function") {
                    window.audioEngine.play("end");
                }

                if (typeof window.audioEngine.speak === "function") {
                    window.audioEngine.speak(
                        "Game over. Thank you for playing Safety Standdown Bingo.",
                        {
                            rate: 0.8,
                            force: true
                        }
                    );
                }
            }

            lastGameStatus = "ended";
            return;
        }
    });

    socket.on("connect", () => {
        console.log("PROJECTOR INTERFACE SYNCHRONIZED TO CENTRAL COMMUNICATOR");
        console.log("DISPLAY SOCKET:", liveWebsiteAddressUrl);
        socket.emit("requestGameStateSyncFallback");
    });

    socket.on("winApproved", () => {
        showBingoCelebration();
    });

    socket.on("physicalWinApproved", () => {
        showBingoCelebration();
    });
}

function startTimer(seconds = 30) {
    clearTimer();

    if (!timerEnabled || seconds === 0) {
        forceGreenDisplay();
        return;
    }

    timer.max = Number(seconds) || 30;
    timer.current = timer.max;

    updateTimerUI();

    timer.interval = setInterval(() => {
        if (!timerEnabled) {
            clearTimer();
            forceGreenDisplay();
            return;
        }

        timer.current--;
        updateTimerUI();

        if (timer.current <= 0) {
            clearTimer();

            if (timerEnabled) {
                socket.emit("requestNext");
            }
        }
    }, 1000);
}

function updateTimerUI() {
    if (!display) return;

    if (!timerEnabled) {
        forceGreenDisplay();
        return;
    }

    if (display.classList.contains("idle-waiting-mode")) return;

    clearTimerClasses();

    const max = Number(timer.max) || 30;
    const current = Number(timer.current) || 0;
    const ratio = current / max;

    if (ratio > 0.75) {
        display.classList.add("timer-green");
        return;
    }

    if (ratio > 0.50) {
        display.classList.add("timer-amber");
        return;
    }

    if (ratio > 0.25) {
        display.classList.add("timer-orange");
        return;
    }

    if (ratio > 0) {
        display.classList.add("timer-red");
        return;
    }

    display.classList.add("timer-dead");
}

function pauseDisplay() {
    clearTimer();

    if (!display) return;

    if (!timerEnabled) {
        forceGreenDisplay();
        return;
    }

    clearCustomSweepingStyles();
    clearTimerClasses();
    display.classList.add("timer-paused");
}

function resumeDisplay() {
    if (!display) return;

    if (!timerEnabled) {
        forceGreenDisplay();
        return;
    }

    clearTimerClasses();
    display.classList.add("timer-green");

    startTimer(timer.current || timer.max || 30);
}

function setupBingoStyles() {
    if (document.getElementById("displayBingoStyles")) return;

    const style = document.createElement("style");

    style.id = "displayBingoStyles";

    style.textContent = `
        .display-bingo-overlay {
            position: fixed;
            inset: 0;
            width: 100vw;
            height: 100vh;
            height: 100dvh;
            background: radial-gradient(
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
            font-family: Arial Black, Impact, Arial, sans-serif;
            font-size: clamp(70px, 12vw, 150px);
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
            transform: scale(.55);
            opacity: 0;
            animation:
                bingoTitleEnter .55s cubic-bezier(.2,.9,.3,1.25) forwards,
                bingoTitlePulse 1.1s ease-in-out .55s infinite alternate;
        }

        .display-bingo-sub {
            position: relative;
            z-index: 1000000;
            margin-top: 25px;
            font-family: Arial, sans-serif;
            font-size: clamp(24px, 4vw, 42px);
            font-weight: 900;
            letter-spacing: .12em;
            color: white;
            text-align: center;
            text-shadow:
                0 0 10px white,
                0 0 25px #FFD84D;
            opacity: 0;
            animation: bingoSubEnter .55s ease-out .45s forwards;
        }

        .display-confetti {
            position: absolute;
            top: -30px;
            z-index: 999999;
            pointer-events: none;
            will-change: transform, opacity;
        }

        @keyframes bingoTitleEnter {
            0% {
                opacity: 0;
                transform: scale(.55) rotate(-4deg);
            }

            65% {
                opacity: 1;
                transform: scale(1.12) rotate(1deg);
            }

            100% {
                opacity: 1;
                transform: scale(1) rotate(0deg);
            }
        }

        @keyframes bingoTitlePulse {
            from {
                filter: brightness(1);
            }

            to {
                filter: brightness(1.35);
            }
        }

        @keyframes bingoSubEnter {
            from {
                opacity: 0;
                transform: translateY(15px);
            }

            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        @keyframes displayConfettiFall {
            0% {
                transform: translate3d(0, -5vh, 0) rotate(0deg);
                opacity: 1;
            }

            100% {
                transform: translate3d(0, 105vh, 0) rotate(720deg);
                opacity: 0;
            }
        }
    `;

    document.head.appendChild(style);
}

function showBingoCelebration() {
    if (bingoOverlayActive) return;

    bingoOverlayActive = true;

    if (bingoOverlayTimeout) {
        clearTimeout(bingoOverlayTimeout);
    }

    if (window.audioEngine) {
        if (typeof window.audioEngine.play === "function") {
            window.audioEngine.play("bingo");
        }

        if (typeof window.audioEngine.speak === "function") {
            window.audioEngine.speak(
                "Bingo! We have a winner!",
                {
                    rate: 0.9,
                    force: true
                }
            );
        }
    }

    const overlay = document.createElement("div");
    overlay.className = "display-bingo-overlay";

    const title = document.createElement("div");
    title.className = "display-bingo-title";
    title.textContent = "BINGO!";

    const sub = document.createElement("div");
    sub.className = "display-bingo-sub";
    sub.textContent = "SAFETY STANDDOWN WINNER!";

    overlay.appendChild(title);
    overlay.appendChild(sub);
    document.body.appendChild(overlay);

    const confettiColors = [
        "#FFD84D",
        "#22c55e",
        "#3b82f6",
        "#ef4444",
        "#a855f7",
        "#ffffff",
        "#f97316"
    ];

    for (let i = 0; i < 90; i++) {
        const confetti = document.createElement("div");
        confetti.className = "display-confetti";

        const size = Math.floor(Math.random() * 10) + 8;

        confetti.style.width = `${size}px`;
        confetti.style.height = `${size * 0.6}px`;

        confetti.style.backgroundColor =
            confettiColors[
                Math.floor(Math.random() * confettiColors.length)
            ];

        confetti.style.left = `${Math.random() * 100}vw`;

        const duration = Math.random() * 2 + 2.5;
        const delay = Math.random() * 1.5;

        confetti.style.animation =
            `displayConfettiFall ${duration}s linear ${delay}s forwards`;

        overlay.appendChild(confetti);
    }

    bingoOverlayTimeout = setTimeout(() => {
        if (overlay && overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
        }

        bingoOverlayActive = false;
    }, 7000);
}
