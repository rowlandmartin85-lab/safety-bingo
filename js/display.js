// CRITICAL WEBPAGE FIX: Automatically grab the live cloud URL address of whatever device opens the link
const liveWebsiteAddressUrl = `${window.location.protocol}//${window.location.host}`;
const socket = io(liveWebsiteAddressUrl);

let display = null;

// CENTRAL COUNTER CONTROLLER OBJECT
let timer = {
    max: 30,
    current: 30,
    interval: null
};
let timerEnabled = true;

// Continuous sweeping color configuration array data for idle mode
const sweepingColors = ["#22c55e", "#fbbf24", "#f97316", "#ef4444", "#3b82f6", "#a855f7"];
let continuousColorIndex = 0;
let continuousWaveInterval = null;

document.addEventListener("DOMContentLoaded", () => {
    display = document.getElementById("questionDisplay");
    setupDisplayNetworkHandlers();
    startIdleSweepingAnimation();
});

// ==========================================
// INFINITE IDLE COLOR CYCLING WAVE ENGINE
// ==========================================
function startIdleSweepingAnimation() {
    if (continuousWaveInterval) return;

    continuousWaveInterval = setInterval(() => {
        if (!display || !display.classList.contains("idle-waiting-mode")) {
            clearInterval(continuousWaveInterval);
            continuousWaveInterval = null;
            return;
        }

        const activeColor = sweepingColors[continuousColorIndex];
        display.style.borderColor = activeColor;
        display.style.boxShadow = `0 0 20px ${activeColor}, inset 0 0 10px ${activeColor}`;

        continuousColorIndex = (continuousColorIndex + 1) % sweepingColors.length;
    }, 416);
}

function clearCustomSweepingStyles() {
    clearInterval(continuousWaveInterval);
    continuousWaveInterval = null;
    if (display) {
        display.style.borderColor = "";
        display.style.boxShadow = "";
    }
}

// ==========================================
// REAL-TIME COMMUNICATOR NETWORK CAPTURES
// ==========================================
function setupDisplayNetworkHandlers() {
    
    socket.on("timerSettingsUpdated", (settings) => {
        timerEnabled = !settings.noTimer;
        timer.max = settings.seconds || 30;
        
        if (!timerEnabled) {
            clearInterval(timer.interval);
            updateTimerUI();
        }
    });

    socket.on("timerUpdate", (time) => {
        if (typeof time === "number") {
            timer.current = time;
            updateTimerUI();
        }
    });

    socket.on("gameState", (state) => {
        if (!state || !display) return;

        if (state.status === "idle") {
            clearInterval(timer.interval);
            display.textContent = "Waiting for host to start...";
            display.className = "idle-waiting-mode";
            startIdleSweepingAnimation();
            return;
        }

        if (state.status === "running") {
            let targetText = state.currentQuestion || "";

            if (display.textContent !== targetText) {
                clearCustomSweepingStyles();
                
                if (window.audioEngine) {
                    window.audioEngine.readQuestion(targetText);
                }

                // RESTORED: Uses your original timer-green class name base for screen layouts
                display.className = "timer-green swoosh-out";

                setTimeout(() => {
                    display.textContent = targetText;
                    display.className = "timer-green prepare-in";
                    
                    requestAnimationFrame(() => {
                        setTimeout(() => {
                            display.className = "timer-green fade-in";
                            startTimer(state.timerSeconds || 30);
                        }, 20);
                    });
                }, 350);
            }
            return;
        }

        if (state.status === "ended") {
            clearInterval(timer.interval);
            clearCustomSweepingStyles();
            display.textContent = "Game Over";
            display.className = "timer-dead";

            if (window.audioEngine) {
                window.audioEngine.play("end");
                window.audioEngine.speak("Game over. Thank you for playing Safety Standdown Bingo.");
            }
            return;
        }
    });

    socket.on("connect", () => {
        console.log("PROJECTOR INTERFACE SYNCHRONIZED TO CENTRAL COMMUNICATOR");
        socket.emit("requestGameStateSyncFallback");
    });

    socket.on("winApproved", () => {
        if (window.bingoAnimation) {
            window.bingoAnimation.show();
        }
    });
}

// ==========================================
// DYNAMIC JEOPARDY COUNTDOWN SYSTEM
// ==========================================
function startTimer(seconds = 30) {
    clearInterval(timer.interval);

    if (!timerEnabled || seconds === 0) {
        updateTimerUI();
        return;
    }

    timer.max = seconds;
    timer.current = seconds;

    timer.interval = setInterval(() => {
        timer.current--;
        updateTimerUI();

        if (timer.current <= 0) {
            clearInterval(timer.interval);
            socket.emit("requestNext");
        }
    }, 1000);

    updateTimerUI();
}

// ==========================================
// RESTORED ORIGINAL COLOR-SHIFTING TIMER ENGINE
// ==========================================
function updateTimerUI() {
    if (!display || display.classList.contains("idle-waiting-mode")) return;

    // RESTORED: Completely clears out old layout values before recalculating color codes
    display.classList.remove(
        "timer-green", "timer-amber", "timer-orange", "timer-red", "timer-dead",
        "swoosh-out", "prepare-in", "fade-in"
    );

    if (!timerEnabled) {
        display.classList.add("timer-green");
        return;
    }

    const ratio = timer.current / timer.max;

    // RESTORED: Re-maps your exact original multi-colored time depletion scale markers
    if (ratio > 0.75) {
        display.classList.add("timer-green");
    } else if (ratio > 0.5) {
        display.classList.add("timer-amber");
    } else if (ratio > 0.25) {
        display.classList.add("timer-orange");
    } else if (ratio > 0) {
        display.classList.add("timer-red");
    } else {
        display.classList.add("timer-dead");
    }
}
