"use strict";
/*
SAFETY BINGO DISPLAY CONTROLLER
COMPATIBLE WITH CURRENT SERVER.JS
Preserves:

Live Socket.IO connection
Question display
Question-reading audio
Timer color shifting
Neon idle animation
Question transition animation
Pause display
Game Over audio
Bingo winner celebration
Physical winner celebration
Reconnect/state synchronization
=====================================================
*/
// =====================================================
// LIVE SERVER CONNECTION
// =====================================================
const liveWebsiteAddressUrl =
${window.location.protocol}//${window.location.host};

const socket =
io(liveWebsiteAddressUrl, {
transports: ["websocket", "polling"],
reconnection: true,
reconnectionAttempts: Infinity,
reconnectionDelay: 1000
});

// =====================================================
// DISPLAY VARIABLES
// =====================================================

let display = null;

let lastQuestion = "";

let paused = false;

let gameRunning = false;

let gameEnded = false;

// =====================================================
// TIMER
// =====================================================

const timer = {

max: 30,

current: 30,

interval: null

};
let timerEnabled = true;

// =====================================================
// NEON IDLE COLORS
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
            "DISPLAY ERROR: #questionDisplay NOT FOUND"
        );

        return;

    }

    setupDisplayNetworkHandlers();

    startIdleSweepingAnimation();

    console.log(
        "SAFETY BINGO DISPLAY READY"
    );

}

);
// =====================================================
// AUDIO UNLOCK
// =====================================================

document.addEventListener(
"click",
() => {

    if (
        window.audioEngine &&
        typeof window.audioEngine.unlock === "function"
    ) {

        window.audioEngine.unlock();

        console.log(
            "DISPLAY AUDIO UNLOCKED"
        );

    }

},
{
    once: true
}

);
// =====================================================
// IDLE NEON ANIMATION
// =====================================================

function startIdleSweepingAnimation() {

if (continuousWaveInterval) {
    return;
}

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

            const activeColor =
                sweepingColors[
                    continuousColorIndex
                ];

            display.style.borderColor =
                activeColor;

            display.style.boxShadow =
                `
                0 0 18px ${activeColor},
                0 0 40px ${activeColor},
                0 0 70px ${activeColor},
                0 16px 45px rgba(0,0,0,.6)
                `;

            continuousColorIndex =
                (
                    continuousColorIndex + 1
                ) %
                sweepingColors.length;

        },
        416
    );

}
// =====================================================
// CLEAR IDLE NEON
// =====================================================

function clearCustomSweepingStyles() {

if (continuousWaveInterval) {

    clearInterval(
        continuousWaveInterval
    );

    continuousWaveInterval =
        null;

}

if (display) {

    display.style.borderColor =
        "";

    display.style.boxShadow =
        "";

}

}
// =====================================================
// CLEAR TIMER
// =====================================================

function clearTimer() {

if (timer.interval) {

    clearInterval(
        timer.interval
    );

    timer.interval =
        null;

}

}
// =====================================================
// DISPLAY CLASS CLEANUP
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

    "idle-cycle",

    "idle-waiting-mode",

    "swoosh-out",

    "prepare-in",

    "fade-in"

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

paused = false;

gameRunning = false;

gameEnded = false;

clearCustomSweepingStyles();

clearTimerClasses();

display.textContent =
    "Waiting for host to start...";

display.classList.add(
    "idle-waiting-mode"
);

/*
Keep compatibility with the
original display.html CSS.
*/

display.classList.add(
    "idle-cycle"
);

startIdleSweepingAnimation();

}
// =====================================================
// START TIMER
// =====================================================

function startTimer(
seconds = 30
) {

clearTimer();

if (
    !timerEnabled ||
    Number(seconds) === 0
) {

    updateTimerUI();

    return;

}

timer.max =
    Number(seconds) || 30;

/*
Only initialize current time if
it isn't already being supplied
by the server.
*/

if (
    !Number.isFinite(timer.current) ||
    timer.current <= 0 ||
    timer.current > timer.max
) {

    timer.current =
        timer.max;

}

updateTimerUI();

timer.interval =
    setInterval(
        () => {

            if (paused) {
                return;
            }

            /*
            The server is the authoritative
            timer. This local interval is only
            a visual fallback.

            Do not request a question here.
            The server controls question changes.
            */

            timer.current--;

            if (
                timer.current < 0
            ) {

                timer.current = 0;

            }

            updateTimerUI();

            if (
                timer.current <= 0
            ) {

                clearTimer();

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

if (
    display.classList.contains(
        "idle-waiting-mode"
    )
) {

    return;

}

if (paused) {

    display.classList.remove(

        "timer-green",
        "timer-amber",
        "timer-orange",
        "timer-red",
        "timer-dead"

    );

    display.classList.add(
        "timer-paused"
    );

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

const max =
    Number(timer.max) || 30;

const current =
    Number(timer.current);

const ratio =
    current / max;

if (ratio > 0.75) {

    display.classList.add(
        "timer-green"
    );

}
else if (ratio > 0.50) {

    display.classList.add(
        "timer-amber"
    );

}
else if (ratio > 0.25) {

    display.classList.add(
        "timer-orange"
    );

}
else if (ratio > 0) {

    display.classList.add(
        "timer-red"
    );

}
else {

    display.classList.add(
        "timer-dead"
    );

}

}
// =====================================================
// QUESTION AUDIO
// =====================================================

function readQuestionWithAudio(
question
) {

if (
    !question ||
    !window.audioEngine
) {

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
        "audioEngine.readQuestion() NOT FOUND"
    );

    return;

}

try {

    console.log(
        "DISPLAY READING QUESTION:",
        question
    );

    window.audioEngine.readQuestion(
        question
    );

}
catch (error) {

    console.error(
        "DISPLAY QUESTION AUDIO ERROR:",
        error
    );

}

}
// =====================================================
// DISPLAY QUESTION
// =====================================================

function showQuestion(
question,
repeatQuestion = false
) {

if (!display) {
    return;
}

if (
    !question &&
    !repeatQuestion
) {

    return;

}

clearCustomSweepingStyles();

display.classList.remove(
    "idle-waiting-mode",
    "idle-cycle"
);

/*
Repeat question:
speak it again without destroying
the visible question.
*/

if (
    repeatQuestion &&
    question === lastQuestion
) {

    readQuestionWithAudio(
        question
    );

    return;

}

lastQuestion =
    question;

/*
Read the question immediately.
This preserves the original working
audio behavior.
*/

readQuestionWithAudio(
    question
);

/*
Question transition.
These classes are compatible with
the existing display CSS if present.
*/

clearTimerClasses();

display.classList.add(
    "timer-green",
    "swoosh-out"
);

setTimeout(
    () => {

        if (!display) {
            return;
        }

        display.textContent =
            question;

        display.classList.remove(
            "swoosh-out"
        );

        display.classList.add(
            "prepare-in"
        );

        requestAnimationFrame(
            () => {

                setTimeout(
                    () => {

                        if (!display) {
                            return;
                        }

                        display.classList.remove(
                            "prepare-in"
                        );

                        display.classList.add(
                            "fade-in"
                        );

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
// GAME OVER
// =====================================================

function showGameOver() {

if (!display) {
    return;
}

clearTimer();

paused = false;

gameRunning = false;

gameEnded = true;

clearCustomSweepingStyles();

clearTimerClasses();

display.textContent =
    "Game Over";

display.classList.add(
    "timer-dead"
);

/*
Preserve the original game-over
sound effect if audio.js provides it.
*/

if (
    window.audioEngine
) {

    try {

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
    catch (error) {

        console.error(
            "GAME OVER AUDIO ERROR:",
            error
        );

    }

}

}
// =====================================================
// BINGO CELEBRATION
// =====================================================

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
    document.createElement(
        "div"
    );

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

document.body.appendChild(
    overlay
);

const colors = [

    "#FFD84D",
    "#2ecc71",
    "#3498db",
    "#e74c3c",
    "#9b59b6",
    "#f1c40f",
    "#e67e22"

];

/*
Create confetti.
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
        "confetti-flake";

    const size =
        Math.random() * 14 + 6;

    flake.style.width =
        `${size}px`;

    flake.style.height =
        `${size}px`;

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

/*
Bingo audio.
*/

if (
    window.audioEngine &&
    typeof window.audioEngine.speak ===
    "function"
) {

    try {

        window.audioEngine.speak(

            "Bingo! Winner confirmed.",

            {
                rate: 0.8,
                force: true
            }

        );

    }
    catch (error) {

        console.error(
            "BINGO AUDIO ERROR:",
            error
        );

    }

}

/*
Remove celebration after 10 seconds.
*/

setTimeout(
    () => {

        if (
            overlay &&
            overlay.parentNode
        ) {

            overlay.remove();

        }

    },
    10000
);

}
// =====================================================
// SOCKET HANDLERS
// =====================================================

function setupDisplayNetworkHandlers() {

/*
-----------------------------------------
TIMER SETTINGS
-----------------------------------------
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
            Number(
                settings.seconds
            ) || 30;

        if (!timerEnabled) {

            clearTimer();

            updateTimerUI();

        }

    }
);

/*
-----------------------------------------
TIMER UPDATE
-----------------------------------------
*/

socket.on(
    "timerUpdate",
    seconds => {

        if (
            typeof seconds !==
            "number"
        ) {

            return;

        }

        timer.current =
            seconds;

        if (
            timer.current >
            timer.max
        ) {

            timer.max =
                timer.current;

        }

        if (!paused) {

            updateTimerUI();

        }

    }
);

/*
-----------------------------------------
GAME STATE
-----------------------------------------
*/

socket.on(
    "gameState",
    state => {

        if (
            !state ||
            !display
        ) {

            return;

        }

        console.log(
            "DISPLAY RECEIVED GAME STATE:",
            state
        );

        /*
        =================================
        IDLE
        =================================
        */

        if (
            state.status ===
            "idle"
        ) {

            setIdleDisplay();

            return;

        }

        /*
        =================================
        RUNNING
        =================================
        */

        if (
            state.status ===
            "running"
        ) {

            gameRunning = true;

            gameEnded = false;

            paused =
                state.isPaused === true;

            timerEnabled =
                state.noTimer !== true;

            if (
                Number.isFinite(
                    Number(
                        state.timerSeconds
                    )
                )
            ) {

                timer.max =
                    Number(
                        state.timerSeconds
                    );

            }

            /*
            PAUSED
            */

            if (paused) {

                clearTimer();

                clearCustomSweepingStyles();

                clearTimerClasses();

                display.classList.add(
                    "timer-paused"
                );

            }
            else {

                display.classList.remove(
                    "timer-paused"
                );

            }

            /*
            QUESTION
            */

            const question =
                state.currentQuestion ||
                "";

            if (
                question &&
                (
                    question !==
                    lastQuestion
                )
            ) {

                showQuestion(
                    question,
                    false
                );

            }

            /*
            NO TIMER MODE
            */

            if (
                state.noTimer
            ) {

                clearTimer();

                timerEnabled =
                    false;

                updateTimerUI();

            }
            else if (
                !paused
            ) {

                /*
                Do not reset the server's
                timer. timerUpdate is the
                authoritative value.
                */

                updateTimerUI();

            }

            return;

        }

        /*
        =================================
        ENDED
        =================================
        */

        if (
            state.status ===
            "ended"
        ) {

            showGameOver();

            return;

        }

    }
);

/*
-----------------------------------------
SERVER-SIDE GAME ENDED EVENT
-----------------------------------------
*/

socket.on(
    "gameEnded",
    data => {

        console.log(
            "DISPLAY GAME ENDED:",
            data
        );

        /*
        Do not depend solely on this event.
        Server also sends gameState ended.
        */

    }
);

/*
-----------------------------------------
BINGO WIN APPROVED
-----------------------------------------
*/

socket.on(
    "winApproved",
    data => {

        console.log(
            "DISPLAY BINGO WIN APPROVED:",
            data
        );

        showBingoCelebOverlay();

    }
);

/*
-----------------------------------------
PHYSICAL WIN APPROVED
-----------------------------------------
*/

socket.on(
    "physicalWinApproved",
    data => {

        console.log(
            "DISPLAY PHYSICAL WIN APPROVED:",
            data
        );

        showBingoCelebOverlay();

    }
);

/*
-----------------------------------------
WIN REJECTED
-----------------------------------------
*/

socket.on(
    "winRejected",
    data => {

        console.log(
            "DISPLAY WIN REJECTED:",
            data
        );

    }
);

/*
-----------------------------------------
PHYSICAL WIN REJECTED
-----------------------------------------
*/

socket.on(
    "physicalWinRejected",
    data => {

        console.log(
            "DISPLAY PHYSICAL WIN REJECTED:",
            data
        );

    }
);

/*
-----------------------------------------
CONNECT
-----------------------------------------
*/

socket.on(
    "connect",
    () => {

        console.log(
            "PROJECTOR INTERFACE SYNCHRONIZED:",
            socket.id
        );

        /*
        Ask the server for the current state.
        */

        socket.emit(
            "requestGameStateSyncFallback"
        );

    }
);

/*
-----------------------------------------
DISCONNECT
-----------------------------------------
*/

socket.on(
    "disconnect",
    reason => {

        console.warn(
            "DISPLAY SOCKET DISCONNECTED:",
            reason
        );

    }
);

/*
-----------------------------------------
RECONNECT ERROR
-----------------------------------------
*/

socket.on(
    "connect_error",
    error => {

        console.error(
            "DISPLAY SOCKET CONNECTION ERROR:",
            error
        );

    }
);

}
// =====================================================
// EXPOSE BINGO FUNCTION FOR OTHER OLD CODE
// =====================================================

window.showBingoCelebOverlay =
showBingoCelebOverlay;

// =====================================================
// EXPOSE TIMER FOR COMPATIBILITY
// =====================================================

window.displayTimer =
timer;

// =====================================================
// DEBUG HELPER
// =====================================================

console.log(
"DISPLAY.JS LOADED - CONSOLIDATED VERSION"
);
