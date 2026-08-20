"use strict";

/*
============================================================
SAFETY STANDDOWN BINGO
HOST GAME ENGINE
============================================================

IMPORTANT:

host.js is responsible for creating the ONE Socket.IO
connection:

    window.hostSocket

hostGame.js NEVER creates another socket.

This prevents:
    - duplicate Socket.IO connections
    - fallback sockets
    - port 5500 Live Server problems
    - hostSocket race conditions
    - multiple game registrations
============================================================
*/

console.log("HOST GAME MODULE LOADED");


/*
============================================================
SOCKET
============================================================
*/

let socket = null;


/*
============================================================
INITIALIZATION GUARDS
============================================================
*/

let hostGameInitialized = false;
let hostGameEventsRegistered = false;
let hostGameButtonsRegistered = false;


/*
============================================================
GET HOST SOCKET
============================================================
*/

function getHostSocket() {

    /*
    --------------------------------------------------------
    host.js MUST create this.
    --------------------------------------------------------
    */

    if (
        window.hostSocket &&
        typeof window.hostSocket.emit === "function"
    ) {

        socket = window.hostSocket;

        return socket;

    }


    /*
    --------------------------------------------------------
    DO NOT CREATE A FALLBACK SOCKET.
    --------------------------------------------------------
    */

    console.error(
        "HOST SOCKET NOT FOUND. " +
        "host.js must create window.hostSocket before hostGame.js initializes."
    );

    return null;

}


/*
============================================================
INITIALIZE HOST GAME
============================================================
*/

function initializeHostGame() {

    console.log("INITIALIZING HOST GAME");


    /*
    --------------------------------------------------------
    GET EXISTING SOCKET
    --------------------------------------------------------
    */

    socket = getHostSocket();


    if (!socket) {

        console.error(
            "HOST GAME CANNOT INITIALIZE: window.hostSocket is missing."
        );

        return false;

    }


    console.log(
        "HOST SOCKET FOUND:",
        socket.id || "NOT CONNECTED YET"
    );


    /*
    --------------------------------------------------------
    SOCKET EVENTS
    --------------------------------------------------------
    */

    if (!hostGameEventsRegistered) {

        setupSocketEvents();

        hostGameEventsRegistered = true;

    }


    /*
    --------------------------------------------------------
    BUTTONS
    --------------------------------------------------------
    */

    if (!hostGameButtonsRegistered) {

        const registered =
            setupGameButtons();

        if (registered) {

            hostGameButtonsRegistered = true;

        }

    }


    hostGameInitialized = true;


    console.log("HOST GAME READY");

    return true;

}


/*
============================================================
SOCKET EVENTS
============================================================
*/

function setupSocketEvents() {

    if (!socket) {

        console.error(
            "CANNOT SETUP HOST SOCKET EVENTS: SOCKET MISSING"
        );

        return;

    }


    /*
    ========================================================
    CONNECT
    ========================================================
    */

    socket.on(
        "connect",
        () => {

            console.log(
                "HOST CONNECTED:",
                socket.id
            );


            /*
            ------------------------------------------------
            CONNECTION UI
            ------------------------------------------------
            */

            if (
                typeof window.updateConnectionStatusUI ===
                "function"
            ) {

                window.updateConnectionStatusUI(true);

            }


            /*
            ------------------------------------------------
            LOCAL STATE
            ------------------------------------------------
            */

            if (window.hostState) {

                hostState.connected = true;

            }


            /*
            ------------------------------------------------
            REGISTER HOST
            ------------------------------------------------
            */

            console.log(
                "REGISTERING HOST WITH SERVER"
            );


            socket.emit(
                "registerHost"
            );


            /*
            ------------------------------------------------
            NEW GAME FLAG
            ------------------------------------------------
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
    ========================================================
    HOST REGISTERED
    ========================================================
    */

    socket.on(
        "hostRegistered",
        () => {

            console.log(
                "HOST REGISTERED WITH SERVER"
            );


            if (window.hostState) {

                hostState.connected = true;

            }

        }
    );


    /*
    ========================================================
    HOST REGISTRATION REJECTED
    ========================================================
    */

    socket.on(
        "hostRegistrationRejected",
        data => {

            console.error(
                "HOST REGISTRATION REJECTED:",
                data
            );


            if (window.hostState) {

                hostState.connected = false;
                hostState.started = false;
                hostState.paused = false;

            }


            updateButtonVisibility(false);


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
    ========================================================
    GAME START ERROR
    ========================================================
    */

    socket.on(
        "gameStartError",
        data => {

            console.error(
                "GAME START ERROR:",
                data
            );


            if (window.hostState) {

                hostState.started = false;
                hostState.paused = false;

            }


            updateButtonVisibility(false);


            alert(
                data?.error ||
                "Unable to start game."
            );

        }
    );


    /*
    ========================================================
    DISCONNECT
    ========================================================
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

                hostState.connected = false;

            }

        }
    );


    /*
    ========================================================
    CONNECT ERROR
    ========================================================
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
    ========================================================
    GAME STATE
    ========================================================
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


            updateHostState(state);

            updateGameDisplay(state);

            updateButtonVisibility(
                state.status === "running"
            );

        }
    );


    /*
    ========================================================
    GAME RESET
    ========================================================
    */

    socket.on(
        "gameReset",
        () => {

            console.log(
                "GAME RESET RECEIVED"
            );


            if (window.hostState) {

                if (
                    typeof hostState.reset ===
                    "function"
                ) {

                    hostState.reset();

                }

                else {

                    hostState.started = false;
                    hostState.paused = false;
                    hostState.currentQuestion = "";
                    hostState.currentAnswer = "";
                    hostState.currentCategory = "";
                    hostState.currentDifficulty = "";
                    hostState.currentQuestionIndex = -1;
                    hostState.currentQuestionNumber = null;
                    hostState.currentQuestionID = null;
                    hostState.calledAnswers = [];
                    hostState.selectedQuestionIds = [];
                    hostState.approvedWinnersCount = 0;
                    hostState.approvedWinnersList = [];
                    hostState.lastSpokenQuestion = "";

                }

            }


            clearHostDisplay();

            updateButtonVisibility(false);

        }
    );


    /*
    ========================================================
    GAME ENDED
    ========================================================
    */

    socket.on(
        "gameEnded",
        data => {

            console.log(
                "GAME ENDED:",
                data
            );


            if (window.hostState) {

                hostState.started = false;
                hostState.paused = false;

            }


            updateButtonVisibility(false);

        }
    );

}


/*
============================================================
GAME BUTTONS
============================================================
*/

function setupGameButtons() {

    if (!window.hostUI) {

        console.warn(
            "HOST UI NOT AVAILABLE - BUTTONS WILL REGISTER LATER"
        );

        return false;

    }


    /*
    ========================================================
    START
    ========================================================
    */

    if (hostUI.startBtn) {

        hostUI.startBtn.addEventListener(
            "click",
            startGame
        );

    }


    /*
    ========================================================
    NEXT
    ========================================================
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
                        "NEXT IGNORED: HOST SOCKET NOT CONNECTED"
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
    ========================================================
    PREVIOUS
    ========================================================
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
                        "PREVIOUS IGNORED: HOST SOCKET NOT CONNECTED"
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
    ========================================================
    PAUSE / RESUME
    ========================================================
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
                        "PAUSE/RESUME IGNORED: HOST SOCKET NOT CONNECTED"
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
    ========================================================
    REPEAT
    ========================================================
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
                        "REPEAT IGNORED: HOST SOCKET NOT CONNECTED"
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
    ========================================================
    RESET
    ========================================================
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
                        "RESET IGNORED: HOST SOCKET NOT CONNECTED"
                    );

                    return;

                }


                if (
                    confirm("Reset game?")
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
============================================================
START GAME
============================================================
*/

function startGame() {

    console.log(
        "START GAME REQUEST"
    );


    /*
    --------------------------------------------------------
    SOCKET
    --------------------------------------------------------
    */

    if (!socket) {

        socket = getHostSocket();

    }


    if (!socket) {

        console.error(
            "CANNOT START GAME: HOST SOCKET NOT READY"
        );


        alert(
            "Host is not connected to the game server yet."
        );


        return;

    }


    if (!socket.connected) {

        console.error(
            "CANNOT START GAME: HOST SOCKET DISCONNECTED"
        );


        alert(
            "Host is not connected to the game server yet."
        );


        return;

    }


    /*
    --------------------------------------------------------
    HOST UI
    --------------------------------------------------------
    */

    if (!window.hostUI) {

        console.error(
            "CANNOT START GAME: HOST UI NOT AVAILABLE"
        );

        return;

    }


    /*
    --------------------------------------------------------
    TIMER
    --------------------------------------------------------
    */

    const timerValue =
        hostUI.timerMode?.value ||
        "none";


    /*
    --------------------------------------------------------
    WINNER LIMIT
    --------------------------------------------------------
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
    --------------------------------------------------------
    QUESTION SELECTION
    --------------------------------------------------------
    */

    let selectedQuestionIds = [];


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


    /*
    --------------------------------------------------------
    REMOVE DUPLICATES
    --------------------------------------------------------
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
    --------------------------------------------------------
    LOCAL SETTINGS ONLY
    --------------------------------------------------------
    */

    if (window.hostState) {

        hostState.paused = false;
        hostState.maxWinners = winnerLimit;

    }


    /*
    --------------------------------------------------------
    TIMER SETTINGS
    --------------------------------------------------------
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
    --------------------------------------------------------
    WINNER SETTINGS
    --------------------------------------------------------
    */

    socket.emit(
        "setWinnerSettings",
        {
            maxWinners:
                winnerLimit
        }
    );


    /*
    --------------------------------------------------------
    START SERVER GAME
    --------------------------------------------------------
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
============================================================
UPDATE HOST STATE
============================================================
*/

function updateHostState(state) {

    if (
        !window.hostState ||
        !state
    ) {

        return;

    }


    hostState.started =
        state.status === "running";


    hostState.paused =
        state.isPaused === true;


    hostState.currentQuestion =
        state.currentQuestion || "";


    hostState.currentAnswer =
        state.currentAnswer || "";


    hostState.currentCategory =
        state.currentCategory || "";


    hostState.currentDifficulty =
        state.currentDifficulty || "";


    /*
    --------------------------------------------------------
    CALLED ANSWERS
    --------------------------------------------------------
    */

    hostState.calledAnswers =
        Array.isArray(state.calledAnswers)
            ? [...state.calledAnswers]
            : [];


    window.calledAnswers =
        [...hostState.calledAnswers];


    /*
    --------------------------------------------------------
    QUESTION INDEX
    --------------------------------------------------------
    */

    hostState.currentQuestionIndex =
        Number.isInteger(
            state.currentQuestionIndex
        )
            ? state.currentQuestionIndex
            : -1;


    /*
    --------------------------------------------------------
    QUESTION NUMBER
    --------------------------------------------------------
    */

    if (
        "currentQuestionNumber" in state
    ) {

        hostState.currentQuestionNumber =
            state.currentQuestionNumber;

    }


    /*
    --------------------------------------------------------
    QUESTION ID
    --------------------------------------------------------
    */

    if (
        "currentQuestionID" in state
    ) {

        hostState.currentQuestionID =
            state.currentQuestionID;

    }


    /*
    --------------------------------------------------------
    TIMER
    --------------------------------------------------------
    */

    if (
        "timerSeconds" in state
    ) {

        hostState.timerSeconds =
            state.timerSeconds;

    }


    if (
        "noTimer" in state
    ) {

        hostState.noTimer =
            state.noTimer === true;

    }


    /*
    --------------------------------------------------------
    WINNERS
    --------------------------------------------------------
    */

    if (
        "maxWinners" in state
    ) {

        hostState.maxWinners =
            state.maxWinners;

    }


    if (
        "approvedWinnersCount" in state
    ) {

        hostState.approvedWinnersCount =
            state.approvedWinnersCount;

    }


    if (
        Array.isArray(
            state.approvedWinnersList
        )
    ) {

        hostState.approvedWinnersList =
            [...state.approvedWinnersList];

    }


    /*
    --------------------------------------------------------
    SELECTED QUESTIONS
    --------------------------------------------------------
    */

    if (
        Array.isArray(
            state.selectedQuestionIds
        )
    ) {

        hostState.selectedQuestionIds =
            [...state.selectedQuestionIds];

    }


    /*
    --------------------------------------------------------
    REPEAT FLAG
    --------------------------------------------------------
    */

    if (
        "repeatQuestion" in state
    ) {

        hostState.repeatQuestion =
            state.repeatQuestion === true;

    }

}


/*
============================================================
UPDATE HOST DISPLAY
============================================================
*/

function updateGameDisplay(state) {

    if (
        !window.hostUI ||
        !state
    ) {

        return;

    }


    /*
    --------------------------------------------------------
    GAME OVER
    --------------------------------------------------------
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
    --------------------------------------------------------
    QUESTION
    --------------------------------------------------------
    */

    if (hostUI.questionBox) {

        hostUI.questionBox.textContent =
            state.currentQuestion ||
            "Waiting for game...";

    }


    /*
    --------------------------------------------------------
    ANSWER
    --------------------------------------------------------
    */

    if (hostUI.answerBox) {

        hostUI.answerBox.textContent =
            state.currentAnswer ||
            "";

    }


    /*
    --------------------------------------------------------
    PAUSE / RESUME
    --------------------------------------------------------
    */

    if (hostUI.pausePlayBtn) {

        hostUI.pausePlayBtn.textContent =
            state.isPaused
                ? "RESUME"
                : "PAUSE";

    }

}


/*
============================================================
BUTTON VISIBILITY
============================================================
*/

function updateButtonVisibility(running) {

    if (!window.hostUI) {

        return;

    }


    /*
    --------------------------------------------------------
    START
    --------------------------------------------------------
    */

    if (hostUI.startBtn) {

        hostUI.startBtn.style.display =
            running
                ? "none"
                : "inline-flex";

    }


    /*
    --------------------------------------------------------
    GAME CONTROLS
    --------------------------------------------------------
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
============================================================
CLEAR HOST DISPLAY
============================================================
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
============================================================
EXPORT
============================================================
*/

window.initializeHostGame =
    initializeHostGame;

console.log(
    "HOST GAME MODULE READY"
);
