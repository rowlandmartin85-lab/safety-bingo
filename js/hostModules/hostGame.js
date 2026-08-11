=====================================================
*/
console.log(
"HOST GAME MODULE LOADED"
);
/*
HOST SOCKET
*/
let socket = null;

/*
INITIALIZE HOST GAME
*/
function initializeHostGame() {

console.log(
    "INITIALIZING HOST GAME"
);

/*
=================================================
VERIFY SOCKET.IO
=================================================
*/

if (
    typeof io === "undefined"
) {

    console.error(
        "SOCKET.IO NOT AVAILABLE"
    );

    return;

}

/*
=================================================
PREVENT DUPLICATE SOCKET
=================================================
*/

if (socket) {

    console.warn(
        "HOST SOCKET ALREADY EXISTS"
    );

    return;

}

/*
=================================================
CREATE ONE HOST SOCKET
=================================================
*/

console.log(
    "CREATING HOST SOCKET"
);

socket =
    io(
        window.location.origin,
        {
            transports: [
                "websocket",
                "polling"
            ],

            reconnection: true,

            reconnectionAttempts: 10
        }
    );

/*
=================================================
MAKE SOCKET AVAILABLE TO OTHER MODULES

host.js uses this when HOME is pressed.
=================================================
*/

window.hostSocket =
    socket;

/*
=================================================
REGISTER SOCKET EVENTS
=================================================
*/

setupSocketEvents();

/*
=================================================
REGISTER GAME BUTTONS
=================================================
*/

setupGameButtons();

console.log(
    "HOST GAME READY"
);

}
/*
SOCKET EVENTS
*/
function setupSocketEvents() {

/*
=================================================
CONNECT
=================================================
*/

socket.on(
    "connect",
    () => {

        console.log(
            "HOST CONNECTED:",
            socket.id
        );

        if (
            window.hostState
        ) {

            hostState.connected =
                true;

        }

        /*
        =========================================
        REGISTER THIS SOCKET AS HOST
        =========================================
        */

        console.log(
            "REGISTERING HOST WITH SERVER"
        );

        socket.emit(
            "registerHost"
        );

        /*
        =========================================
        CHECK FOR NEW HOST GAME FLAG
        =========================================

        index.html can set:

        startNewHostGame = "true"

        This resets the previous server game
        exactly once.
        =========================================
        */

        const startNewHostGame =
            sessionStorage.getItem(
                "startNewHostGame"
            );

        if (
            startNewHostGame ===
            "true"
        ) {

            console.log(
                "STARTING COMPLETELY NEW BINGO GAME"
            );

            /*
            Remove immediately.

            A page refresh must NOT reset
            the game again.
            */

            sessionStorage.removeItem(
                "startNewHostGame"
            );

            /*
            Reset the server game.
            */

            socket.emit(
                "hostReset"
            );

        }

    }
);

/*
=================================================
HOST REGISTERED
=================================================
*/

socket.on(
    "hostRegistered",
    () => {

        console.log(
            "HOST REGISTERED WITH SERVER"
        );

    }
);

/*
=================================================
HOST REGISTRATION REJECTED
=================================================
*/

socket.on(
    "hostRegistrationRejected",
    data => {

        console.error(
            "HOST REGISTRATION REJECTED:",
            data
        );

        if (
            window.hostState
        ) {

            hostState.connected =
                false;

        }

        alert(
            data?.reason ||
            "Another host is already connected."
        );

    }
);

/*
=================================================
GAME START ERROR
=================================================
*/

socket.on(
    "gameStartError",
    data => {

        console.error(
            "GAME START ERROR:",
            data
        );

        if (
            window.hostState
        ) {

            hostState.started =
                false;

        }

        updateButtonVisibility(
            false
        );

        alert(
            data?.error ||
            "Unable to start game."
        );

    }
);

/*
=================================================
DISCONNECT
=================================================
*/

socket.on(
    "disconnect",
    reason => {

        console.warn(
            "HOST DISCONNECTED:",
            reason
        );

        if (
            window.hostState
        ) {

            hostState.connected =
                false;

        }

    }
);

/*
=================================================
GAME STATE
=================================================
*/

socket.on(
    "gameState",
    state => {

        if (!state) {

            return;

        }

        console.log(
            "GAME STATE RECEIVED:",
            state
        );

        /*
        =========================================
        UPDATE DISPLAY
        =========================================
        */

        updateGameDisplay(
            state
        );

        /*
        =========================================
        UPDATE INTERNAL STATE
        =========================================
        */

        updateHostState(
            state
        );

        /*
        =========================================
        SERVER IS AUTHORITATIVE
        =========================================
        */

        updateButtonVisibility(
            state.status ===
            "running"
        );

        /*
        =========================================
        AUDIO
        =========================================
        */

        if (
            window.audioEngine &&
            state.currentQuestion
        ) {

            if (
                state.currentQuestion !==
                hostState.lastSpokenQuestion
            ) {

                hostState.lastSpokenQuestion =
                    state.currentQuestion;

                if (
                    typeof window.audioEngine.readQuestion ===
                    "function"
                ) {

                    window.audioEngine.readQuestion(
                        state.currentQuestion
                    );

                }

            }

        }

    }
);

/*
=================================================
GAME RESET
=================================================
*/

socket.on(
    "gameReset",
    () => {

        console.log(
            "GAME RESET RECEIVED"
        );

        if (
            window.hostState
        ) {

            hostState.reset();

        }

        clearHostDisplay();

        updateButtonVisibility(
            false
        );

    }
);

/*
=================================================
GAME ENDED
=================================================
*/

socket.on(
    "gameEnded",
    data => {

        console.log(
            "GAME ENDED:",
            data
        );

        if (
            window.hostState
        ) {

            hostState.started =
                false;

        }

    }
);

}
/*
GAME BUTTONS
*/
function setupGameButtons() {

/*
=================================================
START
=================================================
*/

hostUI.startBtn?.addEventListener(
    "click",
    startGame
);

/*
=================================================
NEXT
=================================================
*/

hostUI.nextBtn?.addEventListener(
    "click",
    () => {

        if (!socket) {

            return;

        }

        socket.emit(
            "hostNext"
        );

    }
);

/*
=================================================
PREVIOUS
=================================================
*/

hostUI.previousBtn?.addEventListener(
    "click",
    () => {

        if (!socket) {

            return;

        }

        socket.emit(
            "hostPrevious"
        );

    }
);

/*
=================================================
PAUSE / RESUME
=================================================
*/

hostUI.pausePlayBtn?.addEventListener(
    "click",
    () => {

        if (!socket) {

            return;

        }

        socket.emit(
            "togglePausePlay"
        );

    }
);

/*
=================================================
REPEAT
=================================================
*/

hostUI.repeatBtn?.addEventListener(
    "click",
    () => {

        if (!socket) {

            return;

        }

        socket.emit(
            "hostRepeat"
        );

    }
);

/*
=================================================
RESET
=================================================
*/

hostUI.resetBtn?.addEventListener(
    "click",
    () => {

        if (!socket) {

            return;

        }

        if (
            confirm(
                "Reset game?"
            )
        ) {

            socket.emit(
                "hostReset"
            );

        }

    }
);

}
/*
START GAME
*/
function startGame() {

console.log(
    "START GAME REQUEST"
);

/*
=================================================
SOCKET CHECK
=================================================
*/

if (!socket) {

    console.error(
        "CANNOT START GAME: HOST SOCKET NOT READY"
    );

    alert(
        "Host is not connected to the game server yet."
    );

    return;

}

if (
    !socket.connected
) {

    console.error(
        "CANNOT START GAME: HOST SOCKET DISCONNECTED"
    );

    alert(
        "Host is not connected to the game server yet."
    );

    return;

}

/*
=================================================
TIMER SETTING
=================================================
*/

const timerValue =
    hostUI.timerMode?.value ||
    "none";

/*
=================================================
WINNER LIMIT
=================================================
*/

const winnerLimit =
    parseInt(
        hostUI.winLimit?.value ||
        "1",
        10
    );

/*
=================================================
UPDATE LOCAL STATE
=================================================
*/

if (
    window.hostState
) {

    hostState.started =
        true;

    hostState.paused =
        false;

    hostState.maxWinners =
        winnerLimit;

}

/*
=================================================
SEND TIMER SETTINGS
=================================================
*/

socket.emit(
    "setTimerSettings",
    {
        seconds:
            timerValue === "none"
                ? 0
                : Number(
                    timerValue
                ),

        noTimer:
            timerValue === "none"
    }
);

/*
=================================================
SEND WINNER SETTINGS
=================================================
*/

socket.emit(
    "setWinnerSettings",
    {
        maxWinners:
            winnerLimit
    }
);

/*
=================================================
QUESTION MANAGER SELECTION
=================================================

If Question Manager has populated:

hostState.selectedQuestionIds

those IDs are sent to the server.

If empty, server.js intentionally uses
all database questions.
=================================================
*/

let selectedQuestionIds =
    [];

if (
    window.hostState &&
    Array.isArray(
        hostState.selectedQuestionIds
    )
) {

    selectedQuestionIds =
        hostState.selectedQuestionIds
            .map(Number)
            .filter(
                id =>
                    Number.isInteger(id) &&
                    id > 0
            );

}

console.log(
    "QUESTION IDS BEING SENT:",
    selectedQuestionIds
);

/*
=================================================
START SERVER GAME
=================================================
*/

socket.emit(
    "hostStart",
    {
        selectedQuestionIds:
            selectedQuestionIds
    }
);

/*
=================================================
AUDIO
=================================================
*/

if (
    window.audioEngine &&
    typeof window.audioEngine.gameStart ===
    "function"
) {

    window.audioEngine.gameStart();

}

}
/*
UPDATE HOST STATE
*/
function updateHostState(
state
) {

if (
    !window.hostState
) {

    return;

}

/*
=================================================
BASIC GAME STATE
=================================================
*/

hostState.started =
    state.status ===
    "running";

hostState.paused =
    state.isPaused ||
    false;

hostState.currentQuestion =
    state.currentQuestion ||
    "";

hostState.currentAnswer =
    state.currentAnswer ||
    "";

hostState.currentCategory =
    state.currentCategory ||
    "";

hostState.currentDifficulty =
    state.currentDifficulty ||
    "";

/*
=================================================
CALLED ANSWERS
=================================================
*/

hostState.calledAnswers =
    Array.isArray(
        state.calledAnswers
    )
        ? [
            ...state.calledAnswers
        ]
        : [];

window.calledAnswers =
    [
        ...(state.calledAnswers || [])
    ];

/*
=================================================
CURRENT QUESTION INDEX
=================================================
*/

hostState.currentQuestionIndex =
    Number.isInteger(
        state.currentQuestionIndex
    )
        ? state.currentQuestionIndex
        : -1;

/*
=================================================
SELECTED QUESTION IDS

Preserve the server's authoritative list.
=================================================
*/

if (
    Array.isArray(
        state.selectedQuestionIds
    )
) {

    hostState.selectedQuestionIds =
        [
            ...state.selectedQuestionIds
        ];

}

}
/*
UPDATE GAME DISPLAY
*/
function updateGameDisplay(
state
) {

/*
=================================================
GAME OVER
=================================================
*/

if (
    state.status ===
    "ended"
) {

    if (
        hostUI.questionBox
    ) {

        hostUI.questionBox.textContent =
            "Game Over";

    }

    if (
        hostUI.answerBox
    ) {

        hostUI.answerBox.textContent =
            "";

    }

    if (
        hostUI.pausePlayBtn
    ) {

        hostUI.pausePlayBtn.textContent =
            "PAUSE";

    }

    return;

}

/*
=================================================
QUESTION
=================================================
*/

if (
    hostUI.questionBox
) {

    hostUI.questionBox.textContent =
        state.currentQuestion ||
        "Waiting for game...";

}

/*
=================================================
ANSWER
=================================================
*/

if (
    hostUI.answerBox
) {

    hostUI.answerBox.textContent =
        state.currentAnswer ||
        "";

}

/*
=================================================
PAUSE / RESUME
=================================================
*/

if (
    hostUI.pausePlayBtn
) {

    hostUI.pausePlayBtn.textContent =
        state.isPaused
            ? "RESUME"
            : "PAUSE";

}

}
/*
BUTTON VISIBILITY
*/
function updateButtonVisibility(
running
) {

/*
=================================================
START BUTTON
=================================================
*/

if (
    hostUI.startBtn
) {

    hostUI.startBtn.style.display =
        running
            ? "none"
            : "inline-flex";

}

/*
=================================================
ACTIVE GAME BUTTONS
=================================================
*/

[
    hostUI.nextBtn,
    hostUI.previousBtn,
    hostUI.pausePlayBtn,
    hostUI.repeatBtn,
    hostUI.resetBtn

].forEach(
    button => {

        if (!button) {

            return;

        }

        button.style.display =
            running
                ? "inline-flex"
                : "none";

    }
);

}
/*
CLEAR HOST DISPLAY
*/
function clearHostDisplay() {

if (
    hostUI.questionBox
) {

    hostUI.questionBox.textContent =
        "Waiting for game...";

}

if (
    hostUI.answerBox
) {

    hostUI.answerBox.textContent =
        "";

}

}
/*
EXPORT
*/
window.initializeHostGame =
initializeHostGame;
