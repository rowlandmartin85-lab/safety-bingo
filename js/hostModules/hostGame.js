/*
==========================================
SAFETY BINGO HOST GAME ENGINE
==========================================
*/

console.log(
    "HOST GAME MODULE LOADED"
);


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


    if (typeof io === "undefined") {

        console.error(
            "SOCKET.IO NOT AVAILABLE"
        );

        return;
    }


    socket = io(
        window.location.origin,
        {

            transports: [
                "websocket",
                "polling"
            ],

            reconnection: true

        }
    );


    window.hostSocket =
        socket;


    setupSocketEvents();

    setupGameButtons();


    console.log(
        "HOST GAME READY"
    );

}


/*
==========================================
SOCKET EVENTS
==========================================
*/

function setupSocketEvents() {


    socket.on(
        "connect",
        () => {


            console.log(
                "HOST CONNECTED"
            );


            if (window.hostState) {

                hostState.connected =
                    true;

            }


            /*
            ==========================================
            NEW GAME RESET
            ==========================================

            index.html sets this flag when the user
            presses HOST GAME.

            When this host connects, reset the game
            on the server BEFORE the user starts again.
            ==========================================
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
                Remove the flag immediately.

                This is important because if the host
                refreshes the page, we do NOT want the
                game to reset again.
                */

                sessionStorage.removeItem(
                    "startNewHostGame"
                );


                /*
                Tell the Socket.IO server to reset
                the existing game.
                */

                socket.emit(
                    "hostReset"
                );

            }

        }
    );


    /*
    ==========================================
    DISCONNECT
    ==========================================
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
    ==========================================
    GAME STATE
    ==========================================
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
            ==============================
            UPDATE DISPLAY FIRST
            ==============================
            */

            updateGameDisplay(
                state
            );


            /*
            ==============================
            UPDATE INTERNAL STATE
            ==============================
            */

            updateHostState(
                state
            );


            /*
            ==============================
            AUDIO QUESTION READ
            ==============================
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


/*
==========================================
BUTTON SETUP
==========================================
*/

function setupGameButtons() {


    hostUI.startBtn?.addEventListener(
        "click",
        startGame
    );


    hostUI.nextBtn?.addEventListener(
        "click",
        () => {


            socket.emit(
                "hostNext"
            );


        }
    );


    hostUI.previousBtn?.addEventListener(
        "click",
        () => {


            socket.emit(
                "hostPrevious"
            );


        }
    );


    hostUI.pausePlayBtn?.addEventListener(
        "click",
        () => {


            socket.emit(
                "togglePausePlay"
            );


        }
    );


    hostUI.repeatBtn?.addEventListener(
        "click",
        () => {


            socket.emit(
                "hostRepeat"
            );


        }
    );


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


/*
==========================================
START GAME
==========================================
*/

function startGame() {


    console.log(
        "START GAME REQUEST"
    );


    const timerValue =
        hostUI.timerMode?.value ||
        "none";


    const winnerLimit =
        parseInt(
            hostUI.winLimit?.value || 1,
            10
        );


    hostState.started =
        true;


    hostState.paused =
        false;


    hostState.maxWinners =
        winnerLimit;


    /*
    ==========================================
    TIMER SETTINGS
    ==========================================
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
    ==========================================
    WINNER SETTINGS
    ==========================================
    */

    socket.emit(
        "setWinnerSettings",
        {

            maxWinners:
                winnerLimit

        }
    );


    /*
    ==========================================
    START SERVER GAME
    ==========================================
    */

    socket.emit(
        "hostStart"
    );


    /*
    ==========================================
    AUDIO
    ==========================================
    */

    if (window.audioEngine) {

        window.audioEngine.gameStart();

    }


    updateButtonVisibility(
        true
    );

}


/*
==========================================
UPDATE STATE
==========================================
*/

function updateHostState(
    state
) {


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


/*
==========================================
DISPLAY UPDATE
==========================================
*/

function updateGameDisplay(
    state
) {


    /*
    ==========================================
    GAME OVER
    ==========================================
    */

    if (
        state.status ===
        "ended"
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
    ==========================================
    QUESTION
    ==========================================
    */

    if (hostUI.questionBox) {

        hostUI.questionBox.textContent =
            state.currentQuestion ||
            "Waiting for game...";

    }


    /*
    ==========================================
    ANSWER
    ==========================================
    */

    if (hostUI.answerBox) {

        hostUI.answerBox.textContent =
            state.currentAnswer ||
            "";

    }


    /*
    ==========================================
    PAUSE / RESUME
    ==========================================
    */

    if (hostUI.pausePlayBtn) {

        hostUI.pausePlayBtn.textContent =
            state.isPaused
                ? "RESUME"
                : "PAUSE";

    }

}


/*
==========================================
BUTTON VISIBILITY
==========================================
*/

function updateButtonVisibility(
    running
) {


    /*
    ==========================================
    START BUTTON
    ==========================================
    */

    if (hostUI.startBtn) {

        hostUI.startBtn.style.display =
            running
                ? "none"
                : "inline-block";

    }


    /*
    ==========================================
    GAME CONTROL BUTTONS
    ==========================================
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


/*
==========================================
CLEAR DISPLAY
==========================================
*/

function clearHostDisplay() {


    if (hostUI.questionBox) {

        hostUI.questionBox.textContent =
            "Waiting for game...";

    }


    if (hostUI.answerBox) {

        hostUI.answerBox.textContent =
            "";

    }

}


/*
==========================================
EXPORT
==========================================
*/

window.initializeHostGame =
    initializeHostGame;
