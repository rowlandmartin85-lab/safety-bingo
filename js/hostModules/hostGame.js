/*
==========================================
SAFETY BINGO HOST GAME ENGINE
==========================================
*/

"use strict";

console.log(
    "HOST GAME MODULE LOADED"
);


/*
==========================================
LOCAL SOCKET REFERENCE

IMPORTANT:

host.js owns the Socket.IO connection.

hostGame.js MUST NOT create another
connection.

This prevents two host sockets from
registering at the same time.
==========================================
*/

let socket = null;


/*
==========================================
INITIALIZE HOST GAME
==========================================
*/

function initializeHostGame() {

    console.log(
        "INITIALIZING HOST GAME"
    );


    /*
    ==========================================
    USE THE SOCKET CREATED BY host.js
    ==========================================
    */

    socket =
        window.hostSocket || null;


    if (!socket) {

        console.error(
            "HOST SOCKET NOT AVAILABLE"
        );

        return;

    }


    console.log(
        "HOST GAME USING EXISTING HOST SOCKET:",
        socket.id || "WAITING FOR CONNECTION"
    );


    /*
    ==========================================
    SETUP GAME EVENTS
    ==========================================
    */

    setupGameSocketEvents();


    /*
    ==========================================
    SETUP GAME BUTTONS
    ==========================================
    */

    setupGameButtons();


    /*
    ==========================================
    RESTORE CURRENT SERVER STATE

    If host.js receives gameState before
    initializeHostGame() runs, the server
    state is still available through the
    socket connection and future gameState
    events will be handled by host.js.

    We also expose restoreHostGameState()
    for host.js compatibility.
    ==========================================
    */

    console.log(
        "HOST GAME READY"
    );

}


/*
==========================================
SOCKET EVENTS
==========================================
*/

function setupGameSocketEvents() {

    if (!socket) {

        console.error(
            "CANNOT SETUP GAME SOCKET EVENTS - NO SOCKET"
        );

        return;

    }


    /*
    ==========================================
    HOST REGISTERED
    ==========================================
    */

    socket.on(
        "hostRegistered",
        () => {

            console.log(
                "HOST GAME MODULE CONFIRMED HOST REGISTRATION"
            );

        }
    );


    /*
    ==========================================
    HOST REGISTRATION REJECTED
    ==========================================
    */

    socket.on(
        "hostRegistrationRejected",
        data => {

            console.error(
                "HOST REGISTRATION REJECTED:",
                data
            );

        }
    );


    /*
    ==========================================
    GAME START ERROR
    ==========================================
    */

    socket.on(
        "gameStartError",
        data => {

            console.error(
                "GAME START ERROR:",
                data
            );


            if (window.hostState) {

                hostState.started =
                    false;

            }


            updateButtonVisibility(
                false
            );


            if (data?.error) {

                alert(
                    data.error
                );

            }

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
                "GAME ENDED:",
                data
            );


            if (window.hostState) {

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
    ==========================================
    TIMER UPDATE
    ==========================================
    */

    socket.on(
        "timerUpdate",
        seconds => {

            console.log(
                "HOST TIMER:",
                seconds
            );


            /*
            Let hostUI handle the visual timer
            if that function exists.
            */

            if (
                typeof updateHostTimer ===
                "function"
            ) {

                updateHostTimer(
                    seconds
                );

            }

        }
    );


    /*
    ==========================================
    GAME STATE

    host.js already listens for gameState.

    We also listen here because the game
    module needs to keep its own local state
    synchronized.

    This does NOT create another socket.
    ==========================================
    */

    socket.on(
        "gameState",
        state => {

            if (!state) {

                return;

            }


            console.log(
                "HOST GAME MODULE RECEIVED GAME STATE:",
                state
            );


            /*
            ==========================================
            UPDATE LOCAL HOST STATE
            ==========================================
            */

            updateHostState(
                state
            );


            /*
            ==========================================
            UPDATE DISPLAY
            ==========================================
            */

            updateGameDisplay(
                state
            );


            /*
            ==========================================
            UPDATE BUTTON VISIBILITY
            ==========================================
            */

            updateButtonVisibility(
                state.status ===
                "running"
            );

        }
    );


    /*
    ==========================================
    GAME RESET
    ==========================================
    */

    socket.on(
        "gameReset",
        () => {

            console.log(
                "HOST GAME MODULE RECEIVED GAME RESET"
            );


            if (window.hostState) {

                hostState.reset();

            }


            if (
                typeof clearHostDisplay ===
                "function"
            ) {

                clearHostDisplay();

            }


            updateButtonVisibility(
                false
            );

        }
    );

}


/*
==========================================
BUTTON SETUP
==========================================
*/

function setupGameButtons() {

    console.log(
        "SETTING UP HOST GAME BUTTONS"
    );


    /*
    ==========================================
    START
    ==========================================
    */

    const startBtn =
        document.getElementById(
            "startBtn"
        );


    if (startBtn) {

        startBtn.addEventListener(
            "click",
            startGame
        );

    }


    /*
    ==========================================
    NEXT
    ==========================================
    */

    const nextBtn =
        document.getElementById(
            "nextBtn"
        );


    if (nextBtn) {

        nextBtn.addEventListener(
            "click",
            () => {

                if (!socket) {

                    console.error(
                        "NEXT: HOST SOCKET NOT AVAILABLE"
                    );

                    return;

                }


                console.log(
                    "HOST NEXT QUESTION"
                );


                socket.emit(
                    "hostNext"
                );

            }
        );

    }


    /*
    ==========================================
    PREVIOUS
    ==========================================
    */

    const previousBtn =
        document.getElementById(
            "previousBtn"
        );


    if (previousBtn) {

        previousBtn.addEventListener(
            "click",
            () => {

                if (!socket) {

                    console.error(
                        "PREVIOUS: HOST SOCKET NOT AVAILABLE"
                    );

                    return;

                }


                console.log(
                    "HOST PREVIOUS QUESTION"
                );


                socket.emit(
                    "hostPrevious"
                );

            }
        );

    }


    /*
    ==========================================
    PAUSE / PLAY
    ==========================================
    */

    const pausePlayBtn =
        document.getElementById(
            "pausePlayBtn"
        );


    if (pausePlayBtn) {

        pausePlayBtn.addEventListener(
            "click",
            () => {

                if (!socket) {

                    console.error(
                        "PAUSE: HOST SOCKET NOT AVAILABLE"
                    );

                    return;

                }


                console.log(
                    "HOST TOGGLE PAUSE"
                );


                socket.emit(
                    "togglePausePlay"
                );

            }
        );

    }


    /*
    ==========================================
    REPEAT
    ==========================================
    */

    const repeatBtn =
        document.getElementById(
            "repeatBtn"
        );


    if (repeatBtn) {

        repeatBtn.addEventListener(
            "click",
            () => {

                if (!socket) {

                    console.error(
                        "REPEAT: HOST SOCKET NOT AVAILABLE"
                    );

                    return;

                }


                console.log(
                    "HOST REPEAT QUESTION"
                );


                socket.emit(
                    "hostRepeat"
                );

            }
        );

    }


    /*
    ==========================================
    RESET
    ==========================================
    */

    const resetBtn =
        document.getElementById(
            "resetBtn"
        );


    if (resetBtn) {

        resetBtn.addEventListener(
            "click",
            () => {

                if (!socket) {

                    console.error(
                        "RESET: HOST SOCKET NOT AVAILABLE"
                    );

                    return;

                }


                console.log(
                    "HOST RESET GAME"
                );


                socket.emit(
                    "hostReset"
                );

            }
        );

    }


    /*
    ==========================================
    TIMER MODE
    ==========================================
    */

    const timerMode =
        document.getElementById(
            "timerMode"
        );


    if (timerMode) {

        timerMode.addEventListener(
            "change",
            () => {

                if (!socket) {

                    return;

                }


                const value =
                    timerMode.value;


                if (
                    value ===
                    "none"
                ) {

                    console.log(
                        "HOST TIMER: NO TIMER"
                    );


                    socket.emit(
                        "setTimerSettings",
                        {

                            seconds:
                                0,

                            noTimer:
                                true

                        }
                    );

                } else {

                    const seconds =
                        Number(
                            value
                        );


                    if (
                        !Number.isFinite(seconds) ||
                        seconds <= 0
                    ) {

                        return;

                    }


                    console.log(
                        "HOST TIMER:",
                        seconds
                    );


                    socket.emit(
                        "setTimerSettings",
                        {

                            seconds:
                                seconds,

                            noTimer:
                                false

                        }
                    );

                }

            }
        );

    }


    /*
    ==========================================
    WIN LIMIT
    ==========================================
    */

    const winLimitMode =
        document.getElementById(
            "winLimitMode"
        );


    if (winLimitMode) {

        winLimitMode.addEventListener(
            "change",
            () => {

                if (!socket) {

                    return;

                }


                const maxWinners =
                    Number(
                        winLimitMode.value
                    );


                if (
                    !Number.isInteger(
                        maxWinners
                    ) ||
                    maxWinners < 1
                ) {

                    return;

                }


                console.log(
                    "HOST WIN LIMIT:",
                    maxWinners
                );


                socket.emit(
                    "setWinnerSettings",
                    {

                        maxWinners:
                            maxWinners

                    }
                );

            }
        );

    }


    console.log(
        "HOST GAME BUTTONS READY"
    );

}


/*
==========================================
START GAME
==========================================
*/

function startGame() {

    console.log(
        "=========================================="
    );

    console.log(
        "HOST START GAME CLICKED"
    );

    console.log(
        "=========================================="
    );


    if (!socket) {

        console.error(
            "START GAME FAILED: HOST SOCKET NOT AVAILABLE"
        );

        alert(
            "Host connection is not ready yet."
        );

        return;

    }


    /*
    ==========================================
    FIND SELECTED QUESTIONS

    Question Manager may expose its selection
    in localStorage.

    If nothing is found, send an empty array.

    The server is intentionally designed to
    interpret an empty array as:

        USE ALL DATABASE QUESTIONS
    ==========================================
    */

    let selectedQuestionIds = [];


    /*
    ==========================================
    TRY COMMON STORED QUESTION SELECTIONS
    ==========================================
    */

    const possibleKeys = [

        "selectedQuestionIds",

        "safetyBingoSelectedQuestionIds",

        "questionManagerSelectedQuestionIds"

    ];


    for (
        const key
        of possibleKeys
    ) {

        const stored =
            localStorage.getItem(
                key
            );


        if (!stored) {

            continue;

        }


        try {

            const parsed =
                JSON.parse(
                    stored
                );


            if (
                Array.isArray(
                    parsed
                )
            ) {

                selectedQuestionIds =
                    parsed;

                console.log(
                    "FOUND SELECTED QUESTION IDS:",
                    key,
                    selectedQuestionIds
                );

                break;

            }

        } catch (error) {

            console.warn(
                "COULD NOT PARSE QUESTION SELECTION:",
                key,
                error
            );

        }

    }


    /*
    ==========================================
    CLEAN QUESTION IDS
    ==========================================
    */

    selectedQuestionIds =
        [
            ...new Set(
                selectedQuestionIds
                    .map(Number)
                    .filter(
                        id =>
                            Number.isInteger(id) &&
                            id > 0
                    )
            )
        ];


    console.log(
        "QUESTION IDS SENT TO SERVER:",
        selectedQuestionIds
    );


    /*
    ==========================================
    START SERVER GAME
    ==========================================
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
==========================================
RESTORE HOST GAME STATE

host.js expects this function.

This function is intentionally global.
==========================================
*/

function restoreHostGameState(
    state
) {

    if (!state) {

        return;

    }


    console.log(
        "RESTORING HOST GAME STATE:",
        state
    );


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
    ==========================================
    RESTORE TIMER SELECT
    ==========================================
    */

    const timerMode =
        document.getElementById(
            "timerMode"
        );


    if (timerMode) {

        if (
            state.noTimer ===
            true
        ) {

            timerMode.value =
                "none";

        } else {

            const seconds =
                String(
                    state.timerSeconds
                );


            const matchingOption =
                Array.from(
                    timerMode.options
                ).find(
                    option =>
                        option.value ===
                        seconds
                );


            if (matchingOption) {

                timerMode.value =
                    seconds;

            }

        }

    }


    /*
    ==========================================
    RESTORE WIN LIMIT SELECT
    ==========================================
    */

    const winLimitMode =
        document.getElementById(
            "winLimitMode"
        );


    if (winLimitMode) {

        const winners =
            String(
                state.maxWinners
            );


        const matchingOption =
            Array.from(
                winLimitMode.options
            ).find(
                option =>
                    option.value ===
                    winners
            );


        if (matchingOption) {

            winLimitMode.value =
                winners;

        }

    }


    /*
    ==========================================
    RESTORE PAUSE BUTTON TEXT
    ==========================================
    */

    const pausePlayBtn =
        document.getElementById(
            "pausePlayBtn"
        );


    if (pausePlayBtn) {

        pausePlayBtn.textContent =
            state.isPaused
                ? "PLAY"
                : "PAUSE";

    }

}


/*
==========================================
UPDATE HOST LOCAL STATE
==========================================
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


    hostState.currentQuestionIndex =
        Number.isInteger(
            state.currentQuestionIndex
        )
            ? state.currentQuestionIndex
            : -1;


    hostState.calledAnswers =
        Array.isArray(
            state.calledAnswers
        )
            ? [
                ...state.calledAnswers
            ]
            : [];


    hostState.timerSeconds =
        Number(
            state.timerSeconds
        ) || 0;


    hostState.noTimer =
        state.noTimer ===
        true;


    hostState.maxWinners =
        Number(
            state.maxWinners
        ) || 1;


    /*
    ==========================================
    WIN TRACKING
    ==========================================
    */

    hostState.approvedWinners =
        Array.isArray(
            state.approvedWinnersList
        )
            ? [
                ...state.approvedWinnersList
            ]
            : [];

}


/*
==========================================
EXPORT GLOBAL FUNCTIONS

host.js calls restoreHostGameState()
directly.
==========================================
*/

window.restoreHostGameState =
    restoreHostGameState;


/*
==========================================
MODULE READY
==========================================
*/

console.log(
    "HOST GAME ENGINE READY"
);
