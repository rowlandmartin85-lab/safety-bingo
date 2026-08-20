"use strict";

/*
==========================================================
SAFETY BINGO HOST GAME ENGINE
==========================================================

IMPORTANT:

This module is responsible for:

- Host socket connection
- Host registration
- Game controls
- Game state
- Timer settings
- Winner settings
- Host display

The HOST page does NOT play game audio.

Audio belongs to display.js.

IMPORTANT SOCKET RULE:

hostGame.js will:

1. Reuse window.hostSocket if host.js already created it.
2. Otherwise create the Socket.IO connection itself.
3. NEVER use VS Code Live Server / port 5500.
4. Always connect to the current Node server origin.

==========================================================
*/

console.log("HOST GAME MODULE LOADED");


/*
==========================================================
SOCKET
==========================================================
*/

let socket = null;


/*
==========================================================
INITIALIZATION GUARDS
==========================================================
*/

let hostGameInitialized = false;
let hostGameEventsRegistered = false;
let hostGameButtonsRegistered = false;


/*
==========================================================
GET / CREATE HOST SOCKET
==========================================================
*/

function getHostSocket() {

    /*
    ------------------------------------------------------
    1. Already have local socket
    ------------------------------------------------------
    */

    if (socket) {

        return socket;

    }


    /*
    ------------------------------------------------------
    2. Reuse socket created by host.js
    ------------------------------------------------------
    */

    if (
        window.hostSocket &&
        typeof window.hostSocket.on === "function"
    ) {

        socket = window.hostSocket;

        console.log(
            "USING EXISTING HOST SOCKET:",
            socket.id || "NOT CONNECTED YET"
        );

        return socket;

    }


    /*
    ------------------------------------------------------
    3. Socket.IO must exist
    ------------------------------------------------------
    */

    if (typeof io === "undefined") {

        console.error(
            "SOCKET.IO NOT AVAILABLE."
        );

        console.error(
            "Make sure host.html loads /socket.io/socket.io.js"
        );

        return null;

    }


    /*
    ------------------------------------------------------
    4. CREATE SOCKET

    This is the important fix.

    If host.js did not create one yet,
    hostGame.js creates it.

    window.location.origin should be:

        http://localhost:3000

    NOT:

        http://127.0.0.1:5500
    ------------------------------------------------------
    */

    console.warn(
        "HOST SOCKET NOT FOUND - CREATING SOCKET"
    );


    console.log(
        "SOCKET SERVER:",
        window.location.origin
    );


    socket = io(
        window.location.origin,
        {

            transports: [
                "polling",
                "websocket"
            ],

            reconnection: true,

            reconnectionAttempts: Infinity,

            reconnectionDelay: 1000,

            reconnectionDelayMax: 5000

        }
    );


    /*
    ------------------------------------------------------
    SAVE GLOBALLY

    Other host modules can reuse this same socket.
    ------------------------------------------------------
    */

    window.hostSocket = socket;


    console.log(
        "HOST SOCKET CREATED"
    );


    return socket;

}


/*
==========================================================
INITIALIZE HOST GAME
==========================================================
*/

function initializeHostGame() {

    console.log(
        "INITIALIZING HOST GAME"
    );


    /*
    ------------------------------------------------------
    GET SOCKET
    ------------------------------------------------------
    */

    const hostSocket =
        getHostSocket();


    if (!hostSocket) {

        console.error(
            "HOST GAME CANNOT INITIALIZE: SOCKET IS MISSING"
        );

        return false;

    }


    /*
    ------------------------------------------------------
    SOCKET EVENTS
    ------------------------------------------------------
    */

    if (!hostGameEventsRegistered) {

        setupSocketEvents();

        hostGameEventsRegistered = true;

    }


    /*
    ------------------------------------------------------
    BUTTONS

    hostUI may load after hostGame.js.

    Therefore, if unavailable now, host.js can call
    initializeHostGame again later.
    ------------------------------------------------------
    */

    if (!hostGameButtonsRegistered) {

        const registered =
            setupGameButtons();

        if (registered) {

            hostGameButtonsRegistered = true;

        }

    }


    /*
    ------------------------------------------------------
    READY
    ------------------------------------------------------
    */

    hostGameInitialized = true;


    console.log(
        "HOST GAME READY"
    );


    return true;

}


/*
==========================================================
SOCKET EVENTS
==========================================================
*/

function setupSocketEvents() {

    if (!socket) {

        console.error(
            "CANNOT SETUP SOCKET EVENTS: SOCKET MISSING"
        );

        return;

    }


    /*
    ======================================================
    CONNECT
    ======================================================
    */

    socket.on(
        "connect",
        () => {

            console.log(
                "HOST CONNECTED:",
                socket.id
            );


            /*
            ----------------------------------------------
            CONNECTION UI
            ----------------------------------------------
            */

            if (
                typeof window.updateConnectionStatusUI ===
                "function"
            ) {

                window.updateConnectionStatusUI(
                    true
                );

            }


            /*
            ----------------------------------------------
            LOCAL STATE
            ----------------------------------------------
            */

            if (window.hostState) {

                window.hostState.connected = true;

            }


            /*
            ----------------------------------------------
            REGISTER HOST
            ----------------------------------------------
            */

            console.log(
                "REGISTERING HOST WITH SERVER"
            );


            socket.emit(
                "registerHost"
            );


            /*
            ----------------------------------------------
            START NEW GAME FLAG
            ----------------------------------------------
            */

            const startNewHostGame =
                sessionStorage.getItem(
                    "startNewHostGame"
                );


            if (
                startNewHostGame === "true"
            ) {

                console.log(
                    "STARTING COMPLETELY NEW BINGO GAME"
                );


                sessionStorage.removeItem(
                    "startNewHostGame"
                );


                socket.emit(
                    "hostReset"
                );

            }

        }
    );


    /*
    ======================================================
    HOST REGISTERED
    ======================================================
    */

    socket.on(
        "hostRegistered",
        () => {

            console.log(
                "HOST REGISTERED WITH SERVER"
            );


            if (window.hostState) {

                window.hostState.connected = true;

            }

        }
    );


    /*
    ======================================================
    HOST REGISTRATION REJECTED
    ======================================================
    */

    socket.on(
        "hostRegistrationRejected",
        data => {

            console.error(
                "HOST REGISTRATION REJECTED:",
                data
            );


            if (window.hostState) {

                window.hostState.connected = false;

                window.hostState.started = false;

                window.hostState.paused = false;

            }


            updateButtonVisibility(
                false
            );


            if (
                typeof window.updateConnectionStatusUI ===
                "function"
            ) {

                window.updateConnectionStatusUI(
                    false,
                    "Server: Host registration rejected."
                );

            }


            alert(
                data?.reason ||
                "Another host is already connected."
            );

        }
    );


    /*
    ======================================================
    GAME START ERROR
    ======================================================
    */

    socket.on(
        "gameStartError",
        data => {

            console.error(
                "GAME START ERROR:",
                data
            );


            if (window.hostState) {

                window.hostState.started = false;

                window.hostState.paused = false;

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
    ======================================================
    DISCONNECT
    ======================================================
    */

    socket.on(
        "disconnect",
        reason => {

            console.warn(
                "HOST DISCONNECTED:",
                reason
            );


            if (
                typeof window.updateConnectionStatusUI ===
                "function"
            ) {

                window.updateConnectionStatusUI(
                    false,
                    `Server: Disconnected (${reason}). Reconnecting...`
                );

            }


            if (window.hostState) {

                window.hostState.connected = false;

            }

        }
    );


    /*
    ======================================================
    CONNECT ERROR
    ======================================================
    */

    socket.on(
        "connect_error",
        error => {

            console.error(
                "HOST SOCKET CONNECTION ERROR:",
                error
            );


            if (
                typeof window.updateConnectionStatusUI ===
                "function"
            ) {

                window.updateConnectionStatusUI(
                    false,
                    "Server: Connection error. Retrying..."
                );

            }

        }
    );


    /*
    ======================================================
    GAME STATE
    ======================================================
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


            updateHostState(
                state
            );


            updateGameDisplay(
                state
            );


            updateButtonVisibility(
                state.status === "running"
            );

        }
    );


    /*
    ======================================================
    GAME RESET
    ======================================================
    */

    socket.on(
        "gameReset",
        () => {

            console.log(
                "GAME RESET RECEIVED"
            );


            if (window.hostState) {

                if (
                    typeof window.hostState.reset ===
                    "function"
                ) {

                    window.hostState.reset();

                }

                else {

                    window.hostState.started = false;

                    window.hostState.paused = false;

                    window.hostState.currentQuestion = "";

                    window.hostState.currentAnswer = "";

                    window.hostState.currentCategory = "";

                    window.hostState.currentDifficulty = "";

                    window.hostState.currentQuestionIndex = -1;

                    window.hostState.currentQuestionNumber = null;

                    window.hostState.currentQuestionID = null;

                    window.hostState.calledAnswers = [];

                    window.hostState.selectedQuestionIds = [];

                    window.hostState.approvedWinnersCount = 0;

                    window.hostState.approvedWinnersList = [];

                    window.hostState.lastSpokenQuestion = "";

                }

            }


            clearHostDisplay();


            updateButtonVisibility(
                false
            );

        }
    );


    /*
    ======================================================
    GAME ENDED
    ======================================================
    */

    socket.on(
        "gameEnded",
        data => {

            console.log(
                "GAME ENDED:",
                data
            );


            if (window.hostState) {

                window.hostState.started = false;

                window.hostState.paused = false;

            }


            updateButtonVisibility(
                false
            );

        }
    );

}


/*
==========================================================
GAME BUTTONS
==========================================================
*/

function setupGameButtons() {

    if (!window.hostUI) {

        console.warn(
            "HOST UI NOT AVAILABLE - BUTTONS WILL BE REGISTERED LATER"
        );

        return false;

    }


    /*
    ======================================================
    START
    ======================================================
    */

    if (hostUI.startBtn) {

        hostUI.startBtn.addEventListener(
            "click",
            startGame
        );

    }


    /*
    ======================================================
    NEXT
    ======================================================
    */

    if (hostUI.nextBtn) {

        hostUI.nextBtn.addEventListener(
            "click",
            () => {

                if (
                    !socket ||
                    !socket.connected
                ) {

                    console.warn(
                        "NEXT IGNORED: SOCKET NOT CONNECTED"
                    );

                    return;

                }


                socket.emit(
                    "hostNext"
                );

            }
        );

    }


    /*
    ======================================================
    PREVIOUS
    ======================================================
    */

    if (hostUI.previousBtn) {

        hostUI.previousBtn.addEventListener(
            "click",
            () => {

                if (
                    !socket ||
                    !socket.connected
                ) {

                    console.warn(
                        "PREVIOUS IGNORED: SOCKET NOT CONNECTED"
                    );

                    return;

                }


                socket.emit(
                    "hostPrevious"
                );

            }
        );

    }


    /*
    ======================================================
    PAUSE / RESUME
    ======================================================
    */

    if (hostUI.pausePlayBtn) {

        hostUI.pausePlayBtn.addEventListener(
            "click",
            () => {

                if (
                    !socket ||
                    !socket.connected
                ) {

                    console.warn(
                        "PAUSE/RESUME IGNORED: SOCKET NOT CONNECTED"
                    );

                    return;

                }


                socket.emit(
                    "togglePausePlay"
                );

            }
        );

    }


    /*
    ======================================================
    REPEAT
    ======================================================
    */

    if (hostUI.repeatBtn) {

        hostUI.repeatBtn.addEventListener(
            "click",
            () => {

                if (
                    !socket ||
                    !socket.connected
                ) {

                    console.warn(
                        "REPEAT IGNORED: SOCKET NOT CONNECTED"
                    );

                    return;

                }


                socket.emit(
                    "hostRepeat"
                );

            }
        );

    }


    /*
    ======================================================
    RESET
    ======================================================
    */

    if (hostUI.resetBtn) {

        hostUI.resetBtn.addEventListener(
            "click",
            () => {

                if (
                    !socket ||
                    !socket.connected
                ) {

                    console.warn(
                        "RESET IGNORED: SOCKET NOT CONNECTED"
                    );

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


    console.log(
        "HOST GAME BUTTONS REGISTERED"
    );


    return true;

}


/*
==========================================================
START GAME
==========================================================
*/

function startGame() {

    console.log(
        "START GAME REQUEST"
    );


    /*
    ======================================================
    SOCKET CHECK
    ======================================================
    */

    if (!socket) {

        console.error(
            "CANNOT START GAME: SOCKET MISSING"
        );


        alert(
            "Host is not connected to the game server yet."
        );


        return;

    }


    if (!socket.connected) {

        console.error(
            "CANNOT START GAME: SOCKET DISCONNECTED"
        );


        alert(
            "Host is not connected to the game server yet."
        );


        return;

    }


    /*
    ======================================================
    HOST UI CHECK
    ======================================================
    */

    if (!window.hostUI) {

        console.error(
            "CANNOT START GAME: HOST UI NOT AVAILABLE"
        );

        return;

    }


    /*
    ======================================================
    TIMER
    ======================================================
    */

    const timerValue =
        hostUI.timerMode?.value ||
        "none";


    /*
    ======================================================
    WINNER LIMIT
    ======================================================
    */

    let winnerLimit =
        parseInt(
            hostUI.winLimit?.value || "1",
            10
        );


    if (
        !Number.isInteger(winnerLimit) ||
        winnerLimit < 1
    ) {

        winnerLimit = 1;

    }


    /*
    ======================================================
    QUESTION SELECTION
    ======================================================
    */

    let selectedQuestionIds = [];


    if (
        window.hostState &&
        Array.isArray(
            window.hostState.selectedQuestionIds
        )
    ) {

        selectedQuestionIds =
            window.hostState.selectedQuestionIds
                .map(Number)
                .filter(
                    id =>
                        Number.isInteger(id) &&
                        id > 0
                );

    }


    /*
    ======================================================
    REMOVE DUPLICATES
    ======================================================
    */

    selectedQuestionIds =
        [
            ...new Set(
                selectedQuestionIds
            )
        ];


    console.log(
        "=========================================="
    );


    console.log(
        "STARTING HOST GAME"
    );


    console.log(
        "TIMER:",
        timerValue
    );


    console.log(
        "MAX WINNERS:",
        winnerLimit
    );


    console.log(
        "SELECTED QUESTION IDS:",
        selectedQuestionIds
    );


    console.log(
        "=========================================="
    );


    /*
    ======================================================
    LOCAL SETTINGS
    ======================================================
    */

    if (window.hostState) {

        window.hostState.paused = false;

        window.hostState.maxWinners =
            winnerLimit;

    }


    /*
    ======================================================
    TIMER SETTINGS
    ======================================================
    */

    socket.emit(
        "setTimerSettings",
        {

            seconds:
                timerValue === "none"
                    ? 0
                    : Number(timerValue),

            noTimer:
                timerValue === "none"

        }
    );


    /*
    ======================================================
    WINNER SETTINGS
    ======================================================
    */

    socket.emit(
        "setWinnerSettings",
        {

            maxWinners:
                winnerLimit

        }
    );


    /*
    ======================================================
    START GAME
    ======================================================
    */

    socket.emit(
        "hostStart",
        {

            selectedQuestionIds:
                selectedQuestionIds

        }
    );

}


/*
==========================================================
UPDATE HOST STATE
==========================================================
*/

function updateHostState(state) {

    if (
        !window.hostState ||
        !state
    ) {

        return;

    }


    window.hostState.started =
        state.status === "running";


    window.hostState.paused =
        state.isPaused === true;


    window.hostState.currentQuestion =
        state.currentQuestion || "";


    window.hostState.currentAnswer =
        state.currentAnswer || "";


    window.hostState.currentCategory =
        state.currentCategory || "";


    window.hostState.currentDifficulty =
        state.currentDifficulty || "";


    /*
    ------------------------------------------------------
    CALLED ANSWERS
    ------------------------------------------------------
    */

    window.hostState.calledAnswers =
        Array.isArray(
            state.calledAnswers
        )
            ? [...state.calledAnswers]
            : [];


    window.calledAnswers =
        Array.isArray(
            state.calledAnswers
        )
            ? [...state.calledAnswers]
            : [];


    /*
    ------------------------------------------------------
    QUESTION INDEX
    ------------------------------------------------------
    */

    window.hostState.currentQuestionIndex =
        Number.isInteger(
            state.currentQuestionIndex
        )
            ? state.currentQuestionIndex
            : -1;


    /*
    ------------------------------------------------------
    QUESTION NUMBER
    ------------------------------------------------------
    */

    if (
        "currentQuestionNumber" in state
    ) {

        window.hostState.currentQuestionNumber =
            state.currentQuestionNumber;

    }


    /*
    ------------------------------------------------------
    QUESTION ID
    ------------------------------------------------------
    */

    if (
        "currentQuestionID" in state
    ) {

        window.hostState.currentQuestionID =
            state.currentQuestionID;

    }


    /*
    ------------------------------------------------------
    TIMER
    ------------------------------------------------------
    */

    if (
        "timerSeconds" in state
    ) {

        window.hostState.timerSeconds =
            state.timerSeconds;

    }


    if (
        "noTimer" in state
    ) {

        window.hostState.noTimer =
            state.noTimer === true;

    }


    /*
    ------------------------------------------------------
    WINNER SETTINGS
    ------------------------------------------------------
    */

    if (
        "maxWinners" in state
    ) {

        window.hostState.maxWinners =
            state.maxWinners;

    }


    if (
        "approvedWinnersCount" in state
    ) {

        window.hostState.approvedWinnersCount =
            state.approvedWinnersCount;

    }


    if (
        Array.isArray(
            state.approvedWinnersList
        )
    ) {

        window.hostState.approvedWinnersList =
            [
                ...state.approvedWinnersList
            ];

    }


    /*
    ------------------------------------------------------
    SELECTED QUESTIONS
    ------------------------------------------------------
    */

    if (
        Array.isArray(
            state.selectedQuestionIds
        )
    ) {

        window.hostState.selectedQuestionIds =
            [
                ...state.selectedQuestionIds
            ];

    }


    /*
    ------------------------------------------------------
    REPEAT
    ------------------------------------------------------
    */

    if (
        "repeatQuestion" in state
    ) {

        window.hostState.repeatQuestion =
            state.repeatQuestion === true;

    }

}


/*
==========================================================
UPDATE HOST DISPLAY
==========================================================
*/

function updateGameDisplay(state) {

    if (
        !window.hostUI ||
        !state
    ) {

        return;

    }


    /*
    ======================================================
    GAME OVER
    ======================================================
    */

    if (
        state.status === "ended"
    ) {

        if (hostUI.questionBox) {

            hostUI.questionBox.textContent =
                "Game Over";

        }


        if (hostUI.answerBox) {

            hostUI.answerBox.textContent =
                "";

        }


        if (hostUI.pausePlayBtn) {

            hostUI.pausePlayBtn.textContent =
                "PAUSE";

        }


        return;

    }


    /*
    ======================================================
    QUESTION
    ======================================================
    */

    if (hostUI.questionBox) {

        hostUI.questionBox.textContent =
            state.currentQuestion ||
            "Waiting for game...";

    }


    /*
    ======================================================
    ANSWER
    ======================================================
    */

    if (hostUI.answerBox) {

        hostUI.answerBox.textContent =
            state.currentAnswer ||
            "";

    }


    /*
    ======================================================
    PAUSE / RESUME
    ======================================================
    */

    if (hostUI.pausePlayBtn) {

        hostUI.pausePlayBtn.textContent =
            state.isPaused
                ? "RESUME"
                : "PAUSE";

    }

}


/*
==========================================================
BUTTON VISIBILITY
==========================================================
*/

function updateButtonVisibility(running) {

    if (!window.hostUI) {

        return;

    }


    /*
    ------------------------------------------------------
    START
    ------------------------------------------------------
    */

    if (hostUI.startBtn) {

        hostUI.startBtn.style.display =
            running
                ? "none"
                : "inline-flex";

    }


    /*
    ------------------------------------------------------
    GAME CONTROLS
    ------------------------------------------------------
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
==========================================================
CLEAR HOST DISPLAY
==========================================================
*/

function clearHostDisplay() {

    if (!window.hostUI) {

        return;

    }


    if (hostUI.questionBox) {

        hostUI.questionBox.textContent =
            "Waiting for game...";

    }


    if (hostUI.answerBox) {

        hostUI.answerBox.textContent =
            "";

    }


    if (hostUI.pausePlayBtn) {

        hostUI.pausePlayBtn.textContent =
            "PAUSE";

    }

}


/*
==========================================================
EXPORT
==========================================================
*/

window.initializeHostGame =
    initializeHostGame;


/*
==========================================================
OPTIONAL DEBUG EXPORT
==========================================================
*/

window.getHostSocket =
    getHostSocket;


console.log(
    "HOST GAME MODULE READY"
);
