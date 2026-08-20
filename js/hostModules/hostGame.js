"use strict";

/*
==========================================================
SAFETY BINGO HOST GAME ENGINE
==========================================================

IMPORTANT SOCKET ARCHITECTURE

host.js is responsible for creating the ONE and ONLY
Socket.IO connection.

hostGame.js NEVER creates a socket.

hostGame.js only uses:

    window.hostSocket

This prevents:

    - duplicate Socket.IO connections
    - fallback sockets
    - port 5500 WebSocket attempts
    - host.js / hostGame.js socket conflicts

==========================================================
*/

console.log(
    "HOST GAME MODULE LOADED"
);


/*
==========================================================
HOST SOCKET
==========================================================
*/

let socket = null;


/*
==========================================================
INITIALIZATION GUARDS
==========================================================
*/

let hostGameInitialized =
    false;

let hostGameEventsRegistered =
    false;

let hostGameButtonsRegistered =
    false;

let hostSocketWaitTimer =
    null;


/*
==========================================================
GET HOST SOCKET
==========================================================

IMPORTANT:

This function NEVER creates a socket.

host.js must create it.

==========================================================
*/

function getHostSocket() {

    /*
    ======================================================
    EXISTING GLOBAL SOCKET
    ======================================================
    */

    if (
        window.hostSocket
    ) {

        socket =
            window.hostSocket;


        console.log(
            "HOST GAME USING EXISTING SOCKET:",
            socket.id ||
            "NOT CONNECTED YET"
        );


        return socket;

    }


    /*
    ======================================================
    SOCKET DOES NOT EXIST
    ======================================================
    */

    console.error(
        "HOST GAME CANNOT INITIALIZE: window.hostSocket is missing."
    );


    return null;

}


/*
==========================================================
WAIT FOR HOST SOCKET
==========================================================
*/

function waitForHostSocket() {

    /*
    ======================================================
    SOCKET ALREADY EXISTS
    ======================================================
    */

    if (
        window.hostSocket
    ) {

        socket =
            window.hostSocket;


        console.log(
            "HOST GAME SOCKET FOUND"
        );


        initializeHostGame();

        return;

    }


    /*
    ======================================================
    ALREADY WAITING
    ======================================================
    */

    if (
        hostSocketWaitTimer
    ) {

        return;

    }


    console.warn(
        "HOST GAME WAITING FOR window.hostSocket..."
    );


    hostSocketWaitTimer =
        setInterval(
            () => {

                if (
                    window.hostSocket
                ) {

                    clearInterval(
                        hostSocketWaitTimer
                    );


                    hostSocketWaitTimer =
                        null;


                    socket =
                        window.hostSocket;


                    console.log(
                        "HOST GAME SOCKET FOUND AFTER WAIT"
                    );


                    initializeHostGame();

                }

            },
            100
        );

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
    ======================================================
    GET THE SOCKET CREATED BY host.js
    ======================================================
    */

    const hostSocket =
        getHostSocket();


    /*
    ======================================================
    NO SOCKET YET
    ======================================================
    */

    if (
        !hostSocket
    ) {

        waitForHostSocket();

        return false;

    }


    /*
    ======================================================
    SOCKET READY
    ======================================================
    */

    socket =
        hostSocket;


    /*
    ======================================================
    REGISTER SOCKET EVENTS ONCE
    ======================================================
    */

    if (
        !hostGameEventsRegistered
    ) {

        setupSocketEvents();

        hostGameEventsRegistered =
            true;

    }


    /*
    ======================================================
    REGISTER BUTTONS ONCE
    ======================================================
    */

    if (
        !hostGameButtonsRegistered
    ) {

        const registered =
            setupGameButtons();


        if (
            registered
        ) {

            hostGameButtonsRegistered =
                true;

        }

    }


    /*
    ======================================================
    READY
    ======================================================
    */

    hostGameInitialized =
        true;


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

    if (
        !socket
    ) {

        console.error(
            "CANNOT SETUP HOST SOCKET EVENTS: SOCKET MISSING"
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
            ==============================================
            UPDATE CONNECTION UI
            ==============================================
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
            ==============================================
            UPDATE HOST STATE
            ==============================================
            */

            if (
                window.hostState
            ) {

                hostState.connected =
                    true;

            }


            /*
            ==============================================
            REGISTER HOST
            ==============================================
            */

            console.log(
                "REGISTERING HOST WITH SERVER"
            );


            socket.emit(
                "registerHost"
            );


            /*
            ==============================================
            START NEW HOST GAME FLAG
            ==============================================
            */

            let startNewHostGame =
                null;


            try {

                startNewHostGame =
                    sessionStorage.getItem(
                        "startNewHostGame"
                    );

            } catch (error) {

                console.warn(
                    "SESSION STORAGE ERROR:",
                    error
                );

            }


            if (
                startNewHostGame ===
                "true"
            ) {

                console.log(
                    "STARTING COMPLETELY NEW BINGO GAME"
                );


                try {

                    sessionStorage.removeItem(
                        "startNewHostGame"
                    );

                } catch (error) {

                    console.warn(
                        "SESSION STORAGE REMOVE ERROR:",
                        error
                    );

                }


                /*
                ==========================================
                RESET SERVER GAME
                ==========================================
                */

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


            if (
                window.hostState
            ) {

                hostState.connected =
                    true;

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


            if (
                window.hostState
            ) {

                hostState.connected =
                    false;

                hostState.started =
                    false;

                hostState.paused =
                    false;

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


            if (
                window.hostState
            ) {

                hostState.started =
                    false;

                hostState.paused =
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


            if (
                window.hostState
            ) {

                hostState.connected =
                    false;

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

            if (
                !state
            ) {

                return;

            }


            console.log(
                "GAME STATE RECEIVED:",
                state
            );


            /*
            ==============================================
            SERVER IS AUTHORITATIVE
            ==============================================
            */

            updateHostState(
                state
            );


            updateGameDisplay(
                state
            );


            updateButtonVisibility(
                state.status ===
                "running"
            );


            /*
            ==============================================
            NO AUDIO HERE
            ==============================================

            display.js is responsible for:

            - question audio
            - repeat audio
            - bingo audio
            - game-over audio

            ==============================================
            */

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


            if (
                window.hostState
            ) {

                if (
                    typeof hostState.reset ===
                    "function"
                ) {

                    hostState.reset();

                }

                else {

                    hostState.started =
                        false;

                    hostState.paused =
                        false;

                    hostState.currentQuestion =
                        "";

                    hostState.currentAnswer =
                        "";

                    hostState.currentCategory =
                        "";

                    hostState.currentDifficulty =
                        "";

                    hostState.currentQuestionIndex =
                        -1;

                    hostState.currentQuestionNumber =
                        null;

                    hostState.currentQuestionID =
                        null;

                    hostState.calledAnswers =
                        [];

                    hostState.selectedQuestionIds =
                        [];

                    hostState.approvedWinnersCount =
                        0;

                    hostState.approvedWinnersList =
                        [];

                    hostState.lastSpokenQuestion =
                        "";

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


            if (
                window.hostState
            ) {

                hostState.started =
                    false;

                hostState.paused =
                    false;

            }


            updateButtonVisibility(
                false
            );

        }
    );


    /*
    ======================================================
    TIMER UPDATE
    ======================================================
    */

    socket.on(
        "timerUpdate",
        data => {

            if (
                !data ||
                !window.hostState
            ) {

                return;

            }


            if (
                "timerSeconds" in data
            ) {

                hostState.timerSeconds =
                    data.timerSeconds;

            }


            if (
                "noTimer" in data
            ) {

                hostState.noTimer =
                    data.noTimer === true;

            }

        }
    );

}


/*
==========================================================
GAME BUTTONS
==========================================================
*/

function setupGameButtons() {

    if (
        !window.hostUI
    ) {

        console.warn(
            "HOST UI NOT AVAILABLE - GAME BUTTONS WILL BE REGISTERED LATER"
        );


        return false;

    }


    /*
    ======================================================
    START
    ======================================================
    */

    if (
        hostUI.startBtn &&
        hostUI.startBtn.dataset.gameReady !==
        "true"
    ) {

        hostUI.startBtn.dataset.gameReady =
            "true";


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

    if (
        hostUI.nextBtn &&
        hostUI.nextBtn.dataset.gameReady !==
        "true"
    ) {

        hostUI.nextBtn.dataset.gameReady =
            "true";


        hostUI.nextBtn.addEventListener(
            "click",
            () => {

                if (
                    !isSocketConnected()
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
    ======================================================
    PREVIOUS
    ======================================================
    */

    if (
        hostUI.previousBtn &&
        hostUI.previousBtn.dataset.gameReady !==
        "true"
    ) {

        hostUI.previousBtn.dataset.gameReady =
            "true";


        hostUI.previousBtn.addEventListener(
            "click",
            () => {

                if (
                    !isSocketConnected()
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
    ======================================================
    PAUSE / RESUME
    ======================================================
    */

    if (
        hostUI.pausePlayBtn &&
        hostUI.pausePlayBtn.dataset.gameReady !==
        "true"
    ) {

        hostUI.pausePlayBtn.dataset.gameReady =
            "true";


        hostUI.pausePlayBtn.addEventListener(
            "click",
            () => {

                if (
                    !isSocketConnected()
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
    ======================================================
    REPEAT
    ======================================================
    */

    if (
        hostUI.repeatBtn &&
        hostUI.repeatBtn.dataset.gameReady !==
        "true"
    ) {

        hostUI.repeatBtn.dataset.gameReady =
            "true";


        hostUI.repeatBtn.addEventListener(
            "click",
            () => {

                if (
                    !isSocketConnected()
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
    ======================================================
    RESET
    ======================================================
    */

    if (
        hostUI.resetBtn &&
        hostUI.resetBtn.dataset.gameReady !==
        "true"
    ) {

        hostUI.resetBtn.dataset.gameReady =
            "true";


        hostUI.resetBtn.addEventListener(
            "click",
            () => {

                if (
                    !isSocketConnected()
                ) {

                    console.warn(
                        "RESET IGNORED: HOST SOCKET NOT CONNECTED"
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
SOCKET CONNECTION CHECK
==========================================================
*/

function isSocketConnected() {

    return (
        socket &&
        socket.connected === true
    );

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

    if (
        !socket
    ) {

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
    ======================================================
    HOST UI CHECK
    ======================================================
    */

    if (
        !window.hostUI
    ) {

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
            hostUI.winLimit?.value ||
            "1",
            10
        );


    if (
        !Number.isInteger(
            winnerLimit
        ) ||
        winnerLimit < 1
    ) {

        winnerLimit =
            1;

    }


    /*
    ======================================================
    QUESTION SELECTION
    ======================================================
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
                .map(
                    Number
                )
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
    LOCAL STATE
    ======================================================
    */

    if (
        window.hostState
    ) {

        hostState.paused =
            false;

        hostState.maxWinners =
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
                    : Number(
                        timerValue
                    ),

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
    START SERVER GAME
    ======================================================
    */

    socket.emit(
        "hostStart",
        {

            selectedQuestionIds:
                selectedQuestionIds

        }
    );


    /*
    ======================================================
    NO AUDIO
    ======================================================
    */

}


/*
==========================================================
UPDATE HOST STATE
==========================================================
*/

function updateHostState(
    state
) {

    if (
        !window.hostState ||
        !state
    ) {

        return;

    }


    /*
    ======================================================
    BASIC STATE
    ======================================================
    */

    hostState.started =
        state.status ===
        "running";


    hostState.paused =
        state.isPaused ===
        true;


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
    ======================================================
    CALLED ANSWERS
    ======================================================
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
    ======================================================
    QUESTION INDEX
    ======================================================
    */

    hostState.currentQuestionIndex =
        Number.isInteger(
            state.currentQuestionIndex
        )
            ? state.currentQuestionIndex
            : -1;


    /*
    ======================================================
    QUESTION NUMBER
    ======================================================
    */

    if (
        "currentQuestionNumber" in state
    ) {

        hostState.currentQuestionNumber =
            state.currentQuestionNumber;

    }


    /*
    ======================================================
    QUESTION ID
    ======================================================
    */

    if (
        "currentQuestionID" in state
    ) {

        hostState.currentQuestionID =
            state.currentQuestionID;

    }


    /*
    ======================================================
    TIMER
    ======================================================
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
    ======================================================
    WINNER SETTINGS
    ======================================================
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
            [
                ...state.approvedWinnersList
            ];

    }


    /*
    ======================================================
    SELECTED QUESTIONS
    ======================================================
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


    /*
    ======================================================
    REPEAT FLAG
    ======================================================
    */

    if (
        "repeatQuestion" in state
    ) {

        hostState.repeatQuestion =
            state.repeatQuestion === true;

    }

}


/*
==========================================================
UPDATE HOST DISPLAY
==========================================================
*/

function updateGameDisplay(
    state
) {

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
    ======================================================
    QUESTION
    ======================================================
    */

    if (
        hostUI.questionBox
    ) {

        hostUI.questionBox.textContent =
            state.currentQuestion ||
            "Waiting for game...";

    }


    /*
    ======================================================
    ANSWER
    ======================================================
    */

    if (
        hostUI.answerBox
    ) {

        hostUI.answerBox.textContent =
            state.currentAnswer ||
            "";

    }


    /*
    ======================================================
    PAUSE / RESUME
    ======================================================
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
==========================================================
BUTTON VISIBILITY
==========================================================
*/

function updateButtonVisibility(
    running
) {

    if (
        !window.hostUI
    ) {

        return;

    }


    /*
    ======================================================
    START
    ======================================================
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
    ======================================================
    GAME CONTROLS
    ======================================================
    */

    [
        hostUI.nextBtn,
        hostUI.previousBtn,
        hostUI.pausePlayBtn,
        hostUI.repeatBtn,
        hostUI.resetBtn

    ].forEach(
        button => {

            if (
                !button
            ) {

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

    if (
        !window.hostUI
    ) {

        return;

    }


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


    if (
        hostUI.pausePlayBtn
    ) {

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


window.getHostSocket =
    getHostSocket;


window.updateHostState =
    updateHostState;


window.updateGameDisplay =
    updateGameDisplay;


window.updateButtonVisibility =
    updateButtonVisibility;


window.clearHostDisplay =
    clearHostDisplay;
