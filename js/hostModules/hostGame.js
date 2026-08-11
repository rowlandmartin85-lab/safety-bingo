"use strict";

/*
==========================================
SAFETY BINGO HOST GAME ENGINE
==========================================
*/

console.log(
    "HOST GAME MODULE LOADED"
);


// =====================================================
// SOCKET
// =====================================================

let socket = null;


// =====================================================
// QUESTION SELECTION STORAGE
// =====================================================

const QUESTION_SELECTION_STORAGE_KEY =
    "safetyBingoSelectedQuestions";


// =====================================================
// GET SAVED QUESTION SELECTION
// =====================================================

function getSelectedQuestionIds() {

    try {

        const saved =
            localStorage.getItem(
                QUESTION_SELECTION_STORAGE_KEY
            );

        if (!saved) {

            return [];

        }


        const parsed =
            JSON.parse(
                saved
            );


        if (!Array.isArray(parsed)) {

            return [];

        }


        return [
            ...new Set(
                parsed
                    .map(Number)
                    .filter(
                        id =>
                            Number.isInteger(id) &&
                            id > 0
                    )
            )
        ];

    } catch (error) {

        console.error(
            "READ SELECTED QUESTIONS ERROR:",
            error
        );

        return [];

    }

}


// =====================================================
// INITIALIZE HOST GAME
// =====================================================

function initializeHostGame() {

    console.log(
        "INITIALIZING HOST GAME"
    );


    /*
    IMPORTANT:

    host.js already creates the Socket.IO
    connection.

    Do NOT create another socket here.
    */

    if (
        window.hostSocket
    ) {

        socket =
            window.hostSocket;

        console.log(
            "USING EXISTING HOST SOCKET:",
            socket.id
        );

    } else {

        /*
        Fallback in case host.js was not loaded.
        */

        if (
            typeof io ===
            "undefined"
        ) {

            console.error(
                "SOCKET.IO NOT AVAILABLE"
            );

            return;

        }


        console.warn(
            "HOST SOCKET WAS NOT INITIALIZED BY HOST.JS - CREATING FALLBACK"
        );


        socket =
            io(
                window.location.origin,
                {
                    transports: [
                        "websocket",
                        "polling"
                    ],

                    reconnection:
                        true,

                    reconnectionAttempts:
                        10
                }
            );


        window.hostSocket =
            socket;

    }


    setupSocketEvents();

    setupGameButtons();


    console.log(
        "HOST GAME READY"
    );

}


// =====================================================
// SOCKET EVENTS
// =====================================================

function setupSocketEvents() {


    if (!socket) {

        console.error(
            "CANNOT SET UP SOCKET EVENTS - SOCKET MISSING"
        );

        return;

    }


    /*
    =====================================================
    CONNECT
    =====================================================
    */

    socket.on(
        "connect",
        () => {

            console.log(
                "HOST GAME SOCKET CONNECTED:",
                socket.id
            );


            if (window.hostState) {

                hostState.connected =
                    true;

            }

            /*
            host.js also has a connect handler.

            It will register the host with the server.
            */


        }
    );


    /*
    =====================================================
    DISCONNECT
    =====================================================
    */

    socket.on(
        "disconnect",
        () => {

            console.warn(
                "HOST DISCONNECTED"
            );


            if (window.hostState) {

                hostState.connected =
                    false;

            }

        }
    );


    /*
    =====================================================
    GAME STATE
    =====================================================
    */

    socket.on(
        "gameState",
        state => {

            if (!state) {

                return;

            }


            console.log(
                "GAME STATE RECEIVED:",
                state.currentQuestion
            );


            /*
            UPDATE DISPLAY
            */

            updateGameDisplay(
                state
            );


            /*
            UPDATE INTERNAL STATE
            */

            updateHostState(
                state
            );


            /*
            AUDIO
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
    =====================================================
    GAME RESET
    =====================================================
    */

    socket.on(
        "gameReset",
        () => {

            console.log(
                "GAME RESET RECEIVED"
            );


            if (window.hostState) {

                hostState.reset();

            }


            clearHostDisplay();


            updateButtonVisibility(
                false
            );

        }
    );

}


// =====================================================
// BUTTON SETUP
// =====================================================

function setupGameButtons() {

    if (!hostUI) {

        console.error(
            "HOST UI NOT AVAILABLE"
        );

        return;

    }


    /*
    =====================================================
    START
    =====================================================
    */

    hostUI.startBtn?.addEventListener(
        "click",
        startGame
    );


    /*
    =====================================================
    NEXT
    =====================================================
    */

    hostUI.nextBtn?.addEventListener(
        "click",
        () => {

            socket.emit(
                "hostNext"
            );

        }
    );


    /*
    =====================================================
    PREVIOUS
    =====================================================
    */

    hostUI.previousBtn?.addEventListener(
        "click",
        () => {

            socket.emit(
                "hostPrevious"
            );

        }
    );


    /*
    =====================================================
    PAUSE / PLAY
    =====================================================
    */

    hostUI.pausePlayBtn?.addEventListener(
        "click",
        () => {

            socket.emit(
                "togglePausePlay"
            );

        }
    );


    /*
    =====================================================
    REPEAT
    =====================================================
    */

    hostUI.repeatBtn?.addEventListener(
        "click",
        () => {

            socket.emit(
                "hostRepeat"
            );

        }
    );


    /*
    =====================================================
    RESET
    =====================================================
    */

    hostUI.resetBtn?.addEventListener(
        "click",
        () => {

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


// =====================================================
// START GAME
// =====================================================

function startGame() {

    console.log(
        "START GAME REQUEST"
    );


    /*
    =====================================================
    GET SELECTED QUESTIONS
    =====================================================
    */

    const selectedQuestionIds =
        getSelectedQuestionIds();


    console.log(
        "SELECTED QUESTION IDS:",
        selectedQuestionIds
    );


    /*
    Do not allow the host to start a game
    with zero selected questions.
    */

    if (
        selectedQuestionIds.length ===
        0
    ) {

        alert(
            "Please select at least one question before starting the game."
        );

        console.warn(
            "START GAME BLOCKED - NO QUESTIONS SELECTED"
        );

        return;

    }


    /*
    =====================================================
    TIMER
    =====================================================
    */

    const timerValue =
        hostUI.timerMode?.value ||
        "none";


    /*
    =====================================================
    WINNER LIMIT
    =====================================================
    */

    const winnerLimit =
        parseInt(
            hostUI.winLimit?.value ||
            1,
            10
        );


    /*
    =====================================================
    LOCAL HOST STATE
    =====================================================
    */

    hostState.started =
        true;


    hostState.paused =
        false;


    hostState.maxWinners =
        winnerLimit;


    /*
    =====================================================
    TIMER SETTINGS
    =====================================================
    */

    socket.emit(
        "setTimerSettings",
        {

            seconds:
                timerValue ===
                "none"
                    ? 0
                    : Number(
                        timerValue
                    ),

            noTimer:
                timerValue ===
                "none"

        }
    );


    /*
    =====================================================
    WINNER SETTINGS
    =====================================================
    */

    socket.emit(
        "setWinnerSettings",
        {

            maxWinners:
                winnerLimit

        }
    );


    /*
    =====================================================
    START SERVER GAME
    =====================================================

    The selected question IDs are sent to
    the server.

    The server should validate these IDs
    against the database and build the game
    using ONLY those questions.
    */

    socket.emit(
        "hostStart",
        {
            selectedQuestionIds:
                selectedQuestionIds
        }
    );


    /*
    =====================================================
    AUDIO
    =====================================================
    */

    if (
        window.audioEngine
    ) {

        window.audioEngine.gameStart();

    }


    /*
    =====================================================
    BUTTONS
    =====================================================
    */

    updateButtonVisibility(
        true
    );

}


// =====================================================
// UPDATE HOST STATE
// =====================================================

function updateHostState(
    state
) {

    if (!window.hostState) {

        return;

    }


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


    hostState.calledAnswers =
        state.calledAnswers ||
        [];


    window.calledAnswers =
        [
            ...(state.calledAnswers || [])
        ];

}


// =====================================================
// DISPLAY UPDATE
// =====================================================

function updateGameDisplay(
    state
) {

    /*
    =====================================================
    GAME OVER
    =====================================================
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


        updateButtonVisibility(
            false
        );


        return;

    }


    /*
    =====================================================
    QUESTION
    =====================================================
    */

    if (
        hostUI.questionBox
    ) {

        hostUI.questionBox.textContent =
            state.currentQuestion ||
            "Waiting for game...";

    }


    /*
    =====================================================
    ANSWER
    =====================================================
    */

    if (
        hostUI.answerBox
    ) {

        hostUI.answerBox.textContent =
            state.currentAnswer ||
            "";

    }


    /*
    =====================================================
    PAUSE / RESUME
    =====================================================
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


// =====================================================
// BUTTON VISIBILITY
// =====================================================

function updateButtonVisibility(
    running
) {

    /*
    =====================================================
    START
    =====================================================
    */

    if (
        hostUI.startBtn
    ) {

        hostUI.startBtn.style.display =
            running
                ? "none"
                : "inline-block";

    }


    /*
    =====================================================
    GAME CONTROLS
    =====================================================
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
                    ? "inline-block"
                    : "none";

        }
    );

}


// =====================================================
// CLEAR HOST DISPLAY
// =====================================================

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


// =====================================================
// EXPORT
// =====================================================

window.initializeHostGame =
    initializeHostGame;
