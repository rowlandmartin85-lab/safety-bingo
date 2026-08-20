"use strict";

/*
=========================================================
SAFETY STANDDOWN BINGO
HOST.JS
=========================================================

HOST RESPONSIBILITIES:

- Host controls the game.
- Host displays the current question locally.
- Host controls START / NEXT / PREVIOUS / PAUSE / REPEAT / RESET.
- HOST DOES NOT READ QUESTIONS ALOUD.
- Display page is responsible for question audio.
- NEXT QUESTION is locked until the DISPLAY reports that
  the current question has finished being read.

AUDIO FLOW:

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
  |
  | displayQuestionReading
  | displayQuestionReadComplete
  v
HOST
  |
  | unlock NEXT
  v
HOST may press NEXT
=========================================================
*/


console.log(
    "SAFETY STANDDOWN BINGO HOST.JS LOADED"
);


// =====================================================
// HOST SOCKET
// =====================================================

let hostSocket = null;


// =====================================================
// HOST AUDIO STATE
//
// IMPORTANT:
// There is intentionally NO AudioEngine on the host.
//
// The host only tracks whether the DISPLAY has finished
// reading the current question.
// =====================================================

let displayAudioState = {

    reading: false,

    readyForNext: true,

    question: "",

    questionId: null

};


// =====================================================
// HOST INITIALIZATION
// =====================================================

let hostInitialized = false;


// =====================================================
// DOM READY
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    initializeHost
);


// =====================================================
// INITIALIZE HOST
// =====================================================

function initializeHost() {

    if (
        hostInitialized
    ) {

        return;

    }


    hostInitialized =
        true;


    console.log(
        "INITIALIZING HOST.JS"
    );


    /*
    ==========================================
    CREATE / REUSE HOST SOCKET

    hostGame.js is also designed to reuse
    window.hostSocket.
    ==========================================
    */

    if (
        window.hostSocket
    ) {

        hostSocket =
            window.hostSocket;

    }

    else {

        if (
            typeof io === "undefined"
        ) {

            console.error(
                "SOCKET.IO IS NOT AVAILABLE."
            );

            return;

        }


        hostSocket =
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
            hostSocket;

    }


    /*
    ==========================================
    HOST UI
    ==========================================
    */

    setupHostUI();


    /*
    ==========================================
    SOCKET EVENTS
    ==========================================
    */

    setupHostSocketEvents();


    /*
    ==========================================
    INITIAL NEXT BUTTON STATE

    Until the display confirms that it has
    read the question, NEXT is locked.
    ==========================================
    */

    setNextButtonLocked(
        true
    );


    /*
    ==========================================
    INITIAL CONNECTION UI
    ==========================================
    */

    updateHostConnectionUI(
        false,
        "Connecting to game server..."
    );


    console.log(
        "HOST.JS INITIALIZED"
    );

}


// =====================================================
// HOST UI
// =====================================================

function setupHostUI() {

    /*
    ==========================================
    START
    ==========================================
    */

    const startBtn =
        document.getElementById(
            "startBtn"
        );


    if (
        startBtn
    ) {

        startBtn.addEventListener(
            "click",
            () => {

                /*
                ------------------------------------------
                Let hostGame.js perform the actual start.
                ------------------------------------------
                */

                if (
                    typeof window.initializeHostGame ===
                    "function"
                ) {

                    window.initializeHostGame();

                }

            }
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


    if (
        nextBtn
    ) {

        nextBtn.addEventListener(
            "click",
            handleNextQuestion
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


    if (
        repeatBtn
    ) {

        repeatBtn.addEventListener(
            "click",
            handleRepeatQuestion
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


    if (
        previousBtn
    ) {

        previousBtn.addEventListener(
            "click",
            handlePreviousQuestion
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


    if (
        pausePlayBtn
    ) {

        pausePlayBtn.addEventListener(
            "click",
            handlePausePlay
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


    if (
        resetBtn
    ) {

        resetBtn.addEventListener(
            "click",
            handleReset
        );

    }


    /*
    ==========================================
    HOME
    ==========================================
    */

    const homeBtn =
        document.getElementById(
            "homeBtn"
        );


    const homeModal =
        document.getElementById(
            "homeModal"
        );


    const cancelHome =
        document.getElementById(
            "cancelHome"
        );


    const confirmHome =
        document.getElementById(
            "confirmHome"
        );


    if (
        homeBtn
    ) {

        homeBtn.addEventListener(
            "click",
            () => {

                if (
                    homeModal
                ) {

                    homeModal.style.display =
                        "flex";

                }

            }
        );

    }


    if (
        cancelHome
    ) {

        cancelHome.addEventListener(
            "click",
            () => {

                if (
                    homeModal
                ) {

                    homeModal.style.display =
                        "none";

                }

            }
        );

    }


    if (
        confirmHome
    ) {

        confirmHome.addEventListener(
            "click",
            () => {

                if (
                    hostSocket &&
                    hostSocket.connected
                ) {

                    hostSocket.emit(
                        "hostReset"
                    );

                }


                sessionStorage.setItem(
                    "startNewHostGame",
                    "true"
                );


                window.location.href =
                    "/";

            }
        );

    }

}


// =====================================================
// SOCKET EVENTS
// =====================================================

function setupHostSocketEvents() {

    if (
        !hostSocket
    ) {

        return;

    }


    /*
    ==========================================
    CONNECT
    ==========================================
    */

    hostSocket.on(
        "connect",
        () => {

            console.log(
                "HOST CONNECTED:",
                hostSocket.id
            );


            updateHostConnectionUI(
                true,
                "Server: Connected"
            );


            /*
            ======================================
            REGISTER HOST
            ======================================
            */

            hostSocket.emit(
                "registerHost"
            );


            /*
            ======================================
            REQUEST CURRENT GAME STATE
            ======================================
            */

            hostSocket.emit(
                "requestGameStateSyncFallback"
            );

        }
    );


    /*
    ==========================================
    DISCONNECT
    ==========================================
    */

    hostSocket.on(
        "disconnect",
        reason => {

            console.warn(
                "HOST DISCONNECTED:",
                reason
            );


            updateHostConnectionUI(
                false,
                `Server: Disconnected (${reason}). Reconnecting...`
            );


            /*
            ------------------------------------------
            Keep NEXT locked while display/server
            connection is unavailable.
            ------------------------------------------
            */

            setNextButtonLocked(
                true
            );

        }
    );


    /*
    ==========================================
    CONNECT ERROR
    ==========================================
    */

    hostSocket.on(
        "connect_error",
        error => {

            console.error(
                "HOST CONNECTION ERROR:",
                error
            );


            updateHostConnectionUI(
                false,
                "Server: Connection error. Retrying..."
            );

        }
    );


    /*
    ==========================================
    HOST REGISTERED
    ==========================================
    */

    hostSocket.on(
        "hostRegistered",
        () => {

            console.log(
                "HOST REGISTERED"
            );

        }
    );


    /*
    ==========================================
    HOST REGISTRATION REJECTED
    ==========================================
    */

    hostSocket.on(
        "hostRegistrationRejected",
        data => {

            console.error(
                "HOST REGISTRATION REJECTED:",
                data
            );


            setNextButtonLocked(
                true
            );


            alert(
                data?.reason ||
                "Another host is already connected."
            );

        }
    );


    /*
    ==========================================
    GAME STATE
    ==========================================
    */

    hostSocket.on(
        "gameState",
        state => {

            handleHostGameState(
                state
            );

        }
    );


    /*
    ==========================================
    GAME RESET
    ==========================================
    */

    hostSocket.on(
        "gameReset",
        () => {

            console.log(
                "HOST RECEIVED GAME RESET"
            );


            resetDisplayAudioState();


            setNextButtonLocked(
                true
            );

        }
    );


    /*
    ==========================================
    GAME ENDED
    ==========================================
    */

    hostSocket.on(
        "gameEnded",
        () => {

            console.log(
                "HOST RECEIVED GAME ENDED"
            );


            resetDisplayAudioState();


            setNextButtonLocked(
                true
            );

        }
    );


    /*
    =====================================================
    DISPLAY STARTED READING
    =====================================================

    The DISPLAY sends this when SpeechSynthesis /
    AudioEngine begins reading the question.
    */

    hostSocket.on(
        "displayQuestionReading",
        data => {

            console.log(
                "DISPLAY STARTED READING:",
                data
            );


            displayAudioState.reading =
                true;


            displayAudioState.readyForNext =
                false;


            displayAudioState.question =
                data?.question ||
                "";


            displayAudioState.questionId =
                data?.questionId ??
                null;


            setNextButtonLocked(
                true
            );

        }
    );


    /*
    =====================================================
    DISPLAY FINISHED READING
    =====================================================
    */

    hostSocket.on(
        "displayQuestionReadComplete",
        data => {

            console.log(
                "DISPLAY FINISHED READING:",
                data
            );


            /*
            ------------------------------------------
            Ignore stale completion messages.
            ------------------------------------------
            */

            if (
                data?.question &&
                displayAudioState.question &&
                data.question !==
                displayAudioState.question
            ) {

                console.warn(
                    "IGNORING STALE DISPLAY AUDIO COMPLETION"
                );

                return;

            }


            displayAudioState.reading =
                false;


            displayAudioState.readyForNext =
                true;


            /*
            ======================================
            UNLOCK NEXT
            ======================================
            */

            setNextButtonLocked(
                false
            );

        }
    );

}


// =====================================================
// GAME STATE HANDLER
// =====================================================

function handleHostGameState(
    state
) {

    if (
        !state
    ) {

        return;

    }


    console.log(
        "HOST GAME STATE:",
        state
    );


    /*
    ==========================================
    IDLE
    ==========================================
    */

    if (
        state.status ===
        "idle"
    ) {

        resetDisplayAudioState();


        setNextButtonLocked(
            true
        );


        return;

    }


    /*
    ==========================================
    RUNNING
    ==========================================
    */

    if (
        state.status ===
        "running"
    ) {

        const question =
            state.currentQuestion ||
            "";


        /*
        ======================================
        NEW QUESTION

        Lock NEXT immediately.

        The DISPLAY must acknowledge that it
        has read the question before NEXT
        becomes available again.
        ======================================
        */

        if (
            question &&
            question !==
            displayAudioState.question
        ) {

            displayAudioState.question =
                question;


            displayAudioState.questionId =
                state.currentQuestionID ??
                null;


            displayAudioState.reading =
                true;


            displayAudioState.readyForNext =
                false;


            setNextButtonLocked(
                true
            );

        }


        /*
        ======================================
        PAUSED

        Keep NEXT locked while paused.
        ======================================
        */

        if (
            state.isPaused ===
            true
        ) {

            setNextButtonLocked(
                true
            );

        }

    }


    /*
    ==========================================
    GAME OVER
    ==========================================
    */

    if (
        state.status ===
        "ended"
    ) {

        resetDisplayAudioState();


        setNextButtonLocked(
            true
        );

    }

}


// =====================================================
// NEXT QUESTION
// =====================================================

function handleNextQuestion() {

    const nextBtn =
        document.getElementById(
            "nextBtn"
        );


    /*
    ==========================================
    HARD CLIENT-SIDE LOCK
    ==========================================
    */

    if (
        nextBtn &&
        nextBtn.disabled
    ) {

        console.log(
            "NEXT BLOCKED: DISPLAY HAS NOT FINISHED READING"
        );

        return;

    }


    /*
    ==========================================
    AUDIO LOCK
    ==========================================
    */

    if (
        displayAudioState.reading ||
        !displayAudioState.readyForNext
    ) {

        console.log(
            "NEXT BLOCKED: DISPLAY AUDIO STILL PLAYING"
        );

        return;

    }


    /*
    ==========================================
    SOCKET CHECK
    ==========================================
    */

    if (
        !hostSocket ||
        !hostSocket.connected
    ) {

        console.warn(
            "NEXT BLOCKED: HOST SOCKET NOT CONNECTED"
        );

        return;

    }


    /*
    ==========================================
    LOCK IMMEDIATELY

    This prevents double-clicking NEXT.
    ==========================================
    */

    setNextButtonLocked(
        true
    );


    /*
    ==========================================
    CLEAR READY STATE

    The next question must be read by the
    display before NEXT becomes available.
    ==========================================
    */

    displayAudioState.reading =
        true;


    displayAudioState.readyForNext =
        false;


    /*
    ==========================================
    SEND NEXT TO SERVER
    ==========================================
    */

    hostSocket.emit(
        "hostNext"
    );

}


// =====================================================
// REPEAT QUESTION
// =====================================================

function handleRepeatQuestion() {

    if (
        !hostSocket ||
        !hostSocket.connected
    ) {

        console.warn(
            "REPEAT BLOCKED: HOST SOCKET NOT CONNECTED"
        );

        return;

    }


    /*
    ==========================================
    LOCK NEXT WHILE READING
    ==========================================
    */

    displayAudioState.reading =
        true;


    displayAudioState.readyForNext =
        false;


    setNextButtonLocked(
        true
    );


    /*
    ==========================================
    REQUEST REPEAT
    ==========================================
    */

    hostSocket.emit(
        "hostRepeat"
    );

}


// =====================================================
// PREVIOUS QUESTION
// =====================================================

function handlePreviousQuestion() {

    if (
        !hostSocket ||
        !hostSocket.connected
    ) {

        return;

    }


    /*
    ==========================================
    PREVIOUS ALSO REQUIRES DISPLAY AUDIO
    ==========================================
    */

    displayAudioState.reading =
        true;


    displayAudioState.readyForNext =
        false;


    setNextButtonLocked(
        true
    );


    hostSocket.emit(
        "hostPrevious"
    );

}


// =====================================================
// PAUSE / PLAY
// =====================================================

function handlePausePlay() {

    if (
        !hostSocket ||
        !hostSocket.connected
    ) {

        return;

    }


    hostSocket.emit(
        "togglePausePlay"
    );


    /*
    ------------------------------------------
    NEXT remains locked until the display
    gives us a fresh completion event.
    ------------------------------------------
    */

    setNextButtonLocked(
        true
    );

}


// =====================================================
// RESET
// =====================================================

function handleReset() {

    if (
        !hostSocket ||
        !hostSocket.connected
    ) {

        return;

    }


    if (
        !confirm(
            "Reset game?"
        )
    ) {

        return;

    }


    resetDisplayAudioState();


    setNextButtonLocked(
        true
    );


    hostSocket.emit(
        "hostReset"
    );

}


// =====================================================
// NEXT BUTTON LOCK
// =====================================================

function setNextButtonLocked(
    locked
) {

    const nextBtn =
        document.getElementById(
            "nextBtn"
        );


    if (
        !nextBtn
    ) {

        return;

    }


    nextBtn.disabled =
        Boolean(
            locked
        );


    /*
    ==========================================
    VISUAL STATE
    ==========================================
    */

    if (
        locked
    ) {

        nextBtn.classList.add(
            "audio-locked"
        );


        nextBtn.setAttribute(
            "aria-disabled",
            "true"
        );


        nextBtn.title =
            "Waiting for the display to finish reading the question.";

    }

    else {

        nextBtn.classList.remove(
            "audio-locked"
        );


        nextBtn.setAttribute(
            "aria-disabled",
            "false"
        );


        nextBtn.title =
            "Next Question";

    }

}


// =====================================================
// RESET DISPLAY AUDIO STATE
// =====================================================

function resetDisplayAudioState() {

    displayAudioState = {

        reading:
            false,

        readyForNext:
            true,

        question:
            "",

        questionId:
            null

    };

}


// =====================================================
// CONNECTION STATUS
// =====================================================

function updateHostConnectionUI(
    connected,
    message
) {

    if (
        typeof window.updateConnectionStatusUI ===
        "function"
    ) {

        window.updateConnectionStatusUI(
            connected,
            message
        );

    }

}


// =====================================================
// OPTIONAL GLOBAL ACCESS
// =====================================================

window.hostAudioState =
    displayAudioState;


window.setHostNextLocked =
    setNextButtonLocked;


// =====================================================
// END
// =====================================================

console.log(
    "HOST.JS READY - DISPLAY AUDIO CONTROLS NEXT"
);
