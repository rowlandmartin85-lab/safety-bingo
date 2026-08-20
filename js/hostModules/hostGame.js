"use strict";

/*
=========================================================
SAFETY BINGO HOST GAME ENGINE
=========================================================

IMPORTANT AUDIO / NEXT-QUESTION RULE

The HOST owns the controls.

The DISPLAY owns the question audio.

Flow:

HOST
  |
  | hostNext
  v
SERVER
  |
  | gameState
  v
DISPLAY
  |
  | reads question
  v
DISPLAY
  |
  | displayQuestionRead
  v
SERVER
  |
  | displayQuestionRead
  v
HOST
  |
  | NEXT QUESTION unlocked
  v

Therefore:

NEXT QUESTION cannot be pressed until the
DISPLAY reports that the current question
has finished being read.
=========================================================
*/

console.log(
    "HOST GAME MODULE LOADED"
);


/*
=========================================================
HOST SOCKET

host.js creates window.hostSocket.

hostGame.js reuses it.
=========================================================
*/

let socket = null;


/*
=========================================================
INITIALIZATION GUARDS
=========================================================
*/

let hostGameInitialized = false;

let hostGameEventsRegistered = false;

let hostGameButtonsRegistered = false;


/*
=========================================================
AUDIO / NEXT QUESTION LOCK

true  = display has finished reading
false = display is still reading

Start unlocked because there is no question yet.
=========================================================
*/

let nextQuestionUnlocked = true;


/*
=========================================================
QUESTION TOKEN

Used to identify which question the display
has finished reading.

This prevents an old audio-complete event from
unlocking the button for a newer question.
=========================================================
*/

let activeQuestionToken = null;


/*
=========================================================
INITIALIZE HOST GAME
=========================================================
*/

function initializeHostGame() {

    console.log(
        "INITIALIZING HOST GAME"
    );


    /*
    ==========================================
    VERIFY SOCKET.IO
    ==========================================
    */

    if (
        typeof io === "undefined"
    ) {

        console.error(
            "SOCKET.IO NOT AVAILABLE"
        );

        return false;

    }


    /*
    ==========================================
    REUSE HOST SOCKET
    ==========================================
    */

    if (
        window.hostSocket
    ) {

        socket =
            window.hostSocket;


        console.log(
            "USING EXISTING HOST SOCKET:",
            socket.id || "NOT CONNECTED YET"
        );

    }


    /*
    ==========================================
    FALLBACK SOCKET
    ==========================================
    */

    if (
        !socket
    ) {

        console.warn(
            "HOST SOCKET NOT FOUND - CREATING FALLBACK SOCKET"
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
                        Infinity,

                    reconnectionDelay:
                        1000,

                    reconnectionDelayMax:
                        5000

                }
            );


        window.hostSocket =
            socket;

    }


    /*
    ==========================================
    REGISTER SOCKET EVENTS ONCE
    ==========================================
    */

    if (
        !hostGameEventsRegistered
    ) {

        setupSocketEvents();

        hostGameEventsRegistered =
            true;

    }


    /*
    ==========================================
    REGISTER BUTTONS
    ==========================================
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
    ==========================================
    READY
    ==========================================
    */

    hostGameInitialized =
        true;


    console.log(
        "HOST GAME READY"
    );


    /*
    ==========================================
    NEXT STARTS LOCKED ONLY WHEN A QUESTION
    EXISTS.
    ==========================================
    */

    setNextQuestionUnlocked(
        true
    );


    return true;

}


/*
=========================================================
SOCKET EVENTS
=========================================================
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
    ==========================================
    CONNECT
    ==========================================
    */

    socket.on(
        "connect",
        () => {

            console.log(
                "HOST CONNECTED:",
                socket.id
            );


            if (
                typeof window.updateConnectionStatusUI ===
                "function"
            ) {

                window.updateConnectionStatusUI(
                    true
                );

            }


            if (
                window.hostState
            ) {

                hostState.connected =
                    true;

            }


            socket.emit(
                "registerHost"
            );


            const startNewHostGame =
                sessionStorage.getItem(
                    "startNewHostGame"
                );


            if (
                startNewHostGame ===
                "true"
            ) {

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
    ==========================================
    HOST REGISTERED
    ==========================================
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


            setNextQuestionUnlocked(
                false
            );


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


            if (
                window.hostState
            ) {

                hostState.started =
                    false;

                hostState.paused =
                    false;

            }


            setNextQuestionUnlocked(
                false
            );


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
    ==========================================
    DISPLAY FINISHED READING QUESTION
    ==========================================

    THIS IS THE IMPORTANT NEW EVENT.

    The display sends this only AFTER its
    audio has completed.
    ==========================================
    */

    socket.on(
        "displayQuestionRead",
        data => {

            console.log(
                "DISPLAY FINISHED READING:",
                data
            );


            /*
            ======================================
            IGNORE IF NO QUESTION IS ACTIVE
            ======================================
            */

            if (
                !window.hostState ||
                !hostState.started
            ) {

                return;

            }


            /*
            ======================================
            QUESTION TOKEN CHECK
            ======================================

            If the server provides a token,
            verify it.

            If not, fall back to the question
            text.
            ======================================
            */

            const receivedToken =
                data?.questionToken ??
                data?.question ??
                null;


            if (
                activeQuestionToken !== null &&
                receivedToken !== null &&
                String(receivedToken) !==
                String(activeQuestionToken)
            ) {

                console.warn(
                    "IGNORING OLD DISPLAY AUDIO COMPLETE EVENT"
                );

                return;

            }


            /*
            ======================================
            UNLOCK NEXT
            ======================================
            */

            setNextQuestionUnlocked(
                true
            );

        }
    );


    /*
    ==========================================
    DISCONNECT
    ==========================================
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
    ==========================================
    CONNECT ERROR
    ==========================================
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
    ==========================================
    GAME STATE
    ==========================================
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
            ======================================
            QUESTION CHANGED
            ======================================

            IMPORTANT:

            Every NEW question locks NEXT.

            The DISPLAY will unlock it when
            the audio finishes.
            ======================================
            */

            if (
                state.status === "running" &&
                state.currentQuestion
            ) {

                const questionChanged =
                    state.currentQuestion !==
                    hostState.lastSpokenQuestion;


                if (
                    questionChanged
                ) {

                    /*
                    ==================================
                    LOCK NEXT IMMEDIATELY
                    ==================================
                    */

                    setNextQuestionUnlocked(
                        false
                    );


                    /*
                    ==================================
                    SAVE QUESTION TOKEN
                    ==================================
                    */

                    activeQuestionToken =
                        state.currentQuestion;


                    /*
                    ==================================
                    HOST DOES NOT READ THE QUESTION.

                    AUDIO IS OWNED BY DISPLAY.
                    ==================================
                    */

                    hostState.lastSpokenQuestion =
                        state.currentQuestion;

                }


                /*
                ======================================
                REPEAT

                Repeat also locks NEXT because the
                display must finish the repeated
                reading first.
                ======================================
                */

                if (
                    state.repeatQuestion ===
                    true
                ) {

                    setNextQuestionUnlocked(
                        false
                    );


                    activeQuestionToken =
                        state.currentQuestion;

                }

            }


            /*
            ======================================
            GAME ENDED
            ======================================
            */

            if (
                state.status ===
                "ended"
            ) {

                setNextQuestionUnlocked(
                    false
                );

            }

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


            activeQuestionToken =
                null;


            setNextQuestionUnlocked(
                false
            );


            clearHostDisplay();


            updateButtonVisibility(
                false
            );

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


            if (
                window.hostState
            ) {

                hostState.started =
                    false;

                hostState.paused =
                    false;

            }


            activeQuestionToken =
                null;


            setNextQuestionUnlocked(
                false
            );


            updateButtonVisibility(
                false
            );

        }
    );

}


/*
=========================================================
GAME BUTTONS
=========================================================
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
    ==========================================
    START
    ==========================================
    */

    if (
        hostUI.startBtn
    ) {

        hostUI.startBtn.addEventListener(
            "click",
            startGame
        );

    }


    /*
    ==========================================
    NEXT
    ==========================================
    */

    if (
        hostUI.nextBtn
    ) {

        hostUI.nextBtn.addEventListener(
            "click",
            () => {

                /*
                ==================================
                HARD LOCAL LOCK
                ==================================
                */

                if (
                    !nextQuestionUnlocked
                ) {

                    console.warn(
                        "NEXT IGNORED: DISPLAY IS STILL READING"
                    );

                    return;

                }


                if (
                    !socket ||
                    !socket.connected
                ) {

                    console.warn(
                        "NEXT IGNORED: HOST SOCKET NOT CONNECTED"
                    );

                    return;

                }


                /*
                ==================================
                LOCK IMMEDIATELY

                Prevent double-clicking while
                server processes the request.
                ==================================
                */

                setNextQuestionUnlocked(
                    false
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

    if (
        hostUI.previousBtn
    ) {

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
    ==========================================
    PAUSE / RESUME
    ==========================================
    */

    if (
        hostUI.pausePlayBtn
    ) {

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
    ==========================================
    REPEAT
    ==========================================
    */

    if (
        hostUI.repeatBtn
    ) {

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
    ==========================================
    RESET
    ==========================================
    */

    if (
        hostUI.resetBtn
    ) {

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
=========================================================
NEXT QUESTION LOCK CONTROLLER
=========================================================
*/

function setNextQuestionUnlocked(
    unlocked
) {

    nextQuestionUnlocked =
        unlocked === true;


    if (
        !window.hostUI ||
        !hostUI.nextBtn
    ) {

        return;

    }


    /*
    ==========================================
    BUTTON DISABLED STATE
    ==========================================
    */

    hostUI.nextBtn.disabled =
        !nextQuestionUnlocked;


    /*
    ==========================================
    VISUAL STATE
    ==========================================
    */

    if (
        nextQuestionUnlocked
    ) {

        hostUI.nextBtn.classList.remove(
            "next-question-locked"
        );

        hostUI.nextBtn.title =
            "Next question";

    }
    else {

        hostUI.nextBtn.classList.add(
            "next-question-locked"
        );

        hostUI.nextBtn.title =
            "Waiting for the display to finish reading the question";

    }


    console.log(
        "NEXT QUESTION:",
        nextQuestionUnlocked
            ? "UNLOCKED"
            : "LOCKED"
    );

}


/*
=========================================================
START GAME
=========================================================
*/

function startGame() {

    console.log(
        "START GAME REQUEST"
    );


    if (
        !socket
    ) {

        alert(
            "Host is not connected to the game server yet."
        );

        return;

    }


    if (
        !socket.connected
    ) {

        alert(
            "Host is not connected to the game server yet."
        );

        return;

    }


    if (
        !window.hostUI
    ) {

        console.error(
            "CANNOT START GAME: HOST UI NOT AVAILABLE"
        );

        return;

    }


    const timerValue =
        hostUI.timerMode?.value ||
        "none";


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


    selectedQuestionIds =
        [
            ...new Set(
                selectedQuestionIds
            )
        ];


    if (
        window.hostState
    ) {

        hostState.paused =
            false;

        hostState.maxWinners =
            winnerLimit;

    }


    /*
    ==========================================
    LOCK NEXT UNTIL DISPLAY READS FIRST
    ==========================================
    */

    setNextQuestionUnlocked(
        false
    );


    activeQuestionToken =
        null;


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


    socket.emit(
        "setWinnerSettings",
        {

            maxWinners:
                winnerLimit

        }
    );


    socket.emit(
        "hostStart",
        {

            selectedQuestionIds:
                selectedQuestionIds

        }
    );


    /*
    ==========================================
    IMPORTANT

    DO NOT READ AUDIO HERE.

    The DISPLAY page owns question audio.
    ==========================================
    */

}


/*
=========================================================
UPDATE HOST STATE
=========================================================
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


    hostState.currentQuestionIndex =
        Number.isInteger(
            state.currentQuestionIndex
        )
            ? state.currentQuestionIndex
            : -1;


    if (
        "currentQuestionNumber" in state
    ) {

        hostState.currentQuestionNumber =
            state.currentQuestionNumber;

    }


    if (
        "currentQuestionID" in state
    ) {

        hostState.currentQuestionID =
            state.currentQuestionID;

    }


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


    if (
        "repeatQuestion" in state
    ) {

        hostState.repeatQuestion =
            state.repeatQuestion === true;

    }

}


/*
=========================================================
UPDATE HOST DISPLAY
=========================================================
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


    if (
        hostUI.questionBox
    ) {

        hostUI.questionBox.textContent =
            state.currentQuestion ||
            "Waiting for game...";

    }


    if (
        hostUI.answerBox
    ) {

        hostUI.answerBox.textContent =
            state.currentAnswer ||
            "";

    }


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
=========================================================
BUTTON VISIBILITY
=========================================================
*/

function updateButtonVisibility(
    running
) {

    if (
        !window.hostUI
    ) {

        return;

    }


    if (
        hostUI.startBtn
    ) {

        hostUI.startBtn.style.display =
            running
                ? "none"
                : "inline-flex";

    }


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


    /*
    ==========================================
    RE-APPLY NEXT LOCK AFTER VISIBILITY
    ==========================================
    */

    if (
        running
    ) {

        setNextQuestionUnlocked(
            nextQuestionUnlocked
        );

    }

}


/*
=========================================================
CLEAR HOST DISPLAY
=========================================================
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
=========================================================
EXPORT
=========================================================
*/

window.initializeHostGame =
    initializeHostGame;
