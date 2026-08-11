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


    socket =
        io(
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


    /*
    ==========================================
    CONNECT
    ==========================================
    */

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
            REGISTER THIS SOCKET AS THE HOST
            ==========================================
            */

            socket.emit(
                "registerHost"
            );


            /*
            ==========================================
            NEW GAME RESET
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

                This prevents a page refresh from
                resetting the game again.
                */

                sessionStorage.removeItem(
                    "startNewHostGame"
                );


                /*
                Tell the server to reset the
                previous game.
                */

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


            if (window.hostState) {

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
                state
            );


            /*
            ==========================================
            UPDATE DISPLAY FIRST
            ==========================================
            */

            updateGameDisplay(
                state
            );


            /*
            ==========================================
            UPDATE INTERNAL STATE
            ==========================================
            */

            updateHostState(
                state
            );


            /*
            ==========================================
            UPDATE BUTTONS BASED ON SERVER STATE
            ==========================================
            */

            updateButtonVisibility(
                state.status ===
                "running"
            );


            /*
            ==========================================
            AUDIO QUESTION READ
            ==========================================
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


    /*
    ==========================================
    START
    ==========================================
    */

    hostUI.startBtn?.addEventListener(
        "click",
        startGame
    );


    /*
    ==========================================
    NEXT
    ==========================================
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
    ==========================================
    PREVIOUS
    ==========================================
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
    ==========================================
    PAUSE / PLAY
    ==========================================
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
    ==========================================
    REPEAT
    ==========================================
    */

    hostUI.repeatBtn?.addEventListener(
        "click",
        () => {
