"use strict";

/*
=========================================================
SAFETY STANDDOWN BINGO
SERVER.JS
=========================================================

SERVER RESPONSIBILITIES

1. Create HTTP server.
2. Create Socket.IO server.
3. Maintain ONE authoritative game state.
4. Accept HOST controls.
5. Broadcast game state to DISPLAY.
6. Relay HOST AUDIO ON/OFF to DISPLAY.
7. Preserve audio state across reconnects.
8. Support timer control.
9. Support question repeat.
10. Support BINGO approval.
11. Support physical BINGO approval.
12. Handle host leaving the game.
13. Provide fallback game-state synchronization.

IMPORTANT

HOST PAGE:
    - Has all controls.
    - Controls AUDIO ON/OFF.
    - Does NOT play game audio.

DISPLAY PAGE:
    - Has NO game control buttons.
    - Plays audio only when server says audio is enabled.
    - Displays questions and game state.

=========================================================
*/


// =====================================================
// MODULES
// =====================================================

const express =
    require("express");

const http =
    require("http");

const path =
    require("path");

const {
    Server
} =
    require("socket.io");


// =====================================================
// APP
// =====================================================

const app =
    express();


// =====================================================
// HTTP SERVER
// =====================================================

const server =
    http.createServer(
        app
    );


// =====================================================
// SOCKET.IO
// =====================================================

const io =
    new Server(
        server,
        {

            cors: {
                origin: "*",

                methods: [
                    "GET",
                    "POST"
                ]

            },

            transports: [
                "polling",
                "websocket"
            ]

        }
    );


// =====================================================
// PORT
// =====================================================

const PORT =
    process.env.PORT ||
    3000;


// =====================================================
// STATIC FILES
// =====================================================

app.use(
    express.static(
        path.join(
            __dirname,
            "public"
        )
    )
);


// =====================================================
// ROOT
// =====================================================

app.get(
    "/",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "public",
                "index.html"
            )
        );

    }
);


// =====================================================
// GAME STATE
// =====================================================
//
// THIS IS THE AUTHORITATIVE SERVER STATE.
//
// The host controls it.
// Displays receive it.
//
// =====================================================

let gameState = {

    status:
        "idle",

    currentQuestion:
        "",

    questionIndex:
        -1,

    isPaused:
        false,

    noTimer:
        false,

    timerSeconds:
        30,

    repeatQuestion:
        false,

    audioMuted:
        false

};


// =====================================================
// TIMER STATE
// =====================================================

let timerInterval =
    null;


let timerCurrent =
    30;


// =====================================================
// HOST TRACKING
// =====================================================

let hostSocketId =
    null;


// =====================================================
// DISPLAY TRACKING
// =====================================================

const displaySockets =
    new Set();


// =====================================================
// QUESTIONS
// =====================================================
//
// If your existing application loads questions from
// another file/database, replace this section with your
// existing question source.
//
// =====================================================

let questions = [];


// =====================================================
// OPTIONAL QUESTION LOADER
// =====================================================

function loadQuestions() {

    /*
    -----------------------------------------------------
    Attempt to load questions.json if it exists.
    -----------------------------------------------------
    */

    try {

        const fs =
            require("fs");

        const questionFile =
            path.join(
                __dirname,
                "public",
                "questions.json"
            );


        if (
            fs.existsSync(
                questionFile
            )
        ) {

            const raw =
                fs.readFileSync(
                    questionFile,
                    "utf8"
                );


            const parsed =
                JSON.parse(
                    raw
                );


            if (
                Array.isArray(
                    parsed
                )
            ) {

                questions =
                    parsed;

            }

            else if (
                Array.isArray(
                    parsed.questions
                )
            ) {

                questions =
                    parsed.questions;

            }

        }

    }

    catch (error) {

        console.warn(
            "QUESTION FILE LOAD ERROR:",
            error.message
        );

    }


    console.log(
        "QUESTIONS LOADED:",
        questions.length
    );

}


loadQuestions();


// =====================================================
// NORMALIZE QUESTION
// =====================================================

function normalizeQuestion(
    question
) {

    if (
        typeof question ===
        "string"
    ) {

        return question;

    }


    if (
        question &&
        typeof question.text ===
        "string"
    ) {

        return question.text;

    }


    if (
        question &&
        typeof question.question ===
        "string"
    ) {

        return question.question;

    }


    return "";

}


// =====================================================
// GET CURRENT GAME STATE
// =====================================================

function getGameState() {

    return {

        ...gameState,

        repeatQuestion:
            false,

        timerCurrent:
            timerCurrent

    };

}


// =====================================================
// BROADCAST GAME STATE
// =====================================================

function broadcastGameState(
    extraState = {}
) {

    const state = {

        ...getGameState(),

        ...extraState

    };


    io.emit(
        "gameState",
        state
    );

}


// =====================================================
// SEND STATE TO ONE SOCKET
// =====================================================

function sendGameStateToSocket(
    socket
) {

    if (
        !socket
    ) {

        return;

    }


    socket.emit(
        "gameState",
        getGameState()
    );


    socket.emit(
        "timerUpdate",
        timerCurrent
    );


    socket.emit(
        "timerSettingsUpdated",
        {

            noTimer:
                gameState.noTimer,

            seconds:
                gameState.timerSeconds

        }
    );


    socket.emit(
        "setDisplayAudio",
        {

            muted:
                gameState.audioMuted

        }
    );

}


// =====================================================
// SEND AUDIO STATE TO DISPLAYS
// =====================================================
//
// THIS IS THE IMPORTANT AUDIO CONNECTION.
//
// HOST:
//
//     setDisplayAudio
//
// SERVER:
//
//     remembers audioMuted
//
// SERVER:
//
//     broadcasts setDisplayAudio
//
// DISPLAY:
//
//     receives setDisplayAudio
//
// =====================================================

function broadcastDisplayAudioState() {

    const audioState = {

        muted:
            gameState.audioMuted

    };


    console.log(
        "BROADCAST DISPLAY AUDIO:",
        audioState
    );


    io.emit(
        "setDisplayAudio",
        audioState
    );

}


// =====================================================
// STOP TIMER
// =====================================================

function stopTimer() {

    if (
        timerInterval
    ) {

        clearInterval(
            timerInterval
        );

        timerInterval =
            null;

    }

}


// =====================================================
// START TIMER
// =====================================================

function startTimer(
    seconds
) {

    stopTimer();


    if (
        gameState.noTimer
    ) {

        timerCurrent =
            Number(
                seconds
            ) ||
            Number(
                gameState.timerSeconds
            ) ||
            30;


        io.emit(
            "timerUpdate",
            timerCurrent
        );


        return;

    }


    const startingSeconds =
        Number(
            seconds
        ) ||
        Number(
            gameState.timerSeconds
        ) ||
        30;


    timerCurrent =
        startingSeconds;


    io.emit(
        "timerUpdate",
        timerCurrent
    );


    timerInterval =
        setInterval(
            () => {

                if (
                    gameState.status !==
                    "running"
                ) {

                    stopTimer();

                    return;

                }


                if (
                    gameState.isPaused
                ) {

                    return;

                }


                if (
                    gameState.noTimer
                ) {

                    stopTimer();

                    return;

                }


                timerCurrent--;


                io.emit(
                    "timerUpdate",
                    timerCurrent
                );


                if (
                    timerCurrent <=
                    0
                ) {

                    stopTimer();


                    /*
                    -------------------------------------
                    Tell display to advance.
                    -------------------------------------
                    */

                    io.emit(
                        "timerExpired"
                    );


                    /*
                    -------------------------------------
                    Automatically request next question
                    only if the host/game remains running.
                    -------------------------------------
                    */

                    if (
                        gameState.status ===
                        "running" &&
                        !gameState.isPaused
                    ) {

                        advanceToNextQuestion();

                    }

                }

            },

            1000
        );

}


// =====================================================
// ADVANCE QUESTION
// =====================================================

function advanceToNextQuestion() {

    if (
        questions.length ===
        0
    ) {

        console.warn(
            "NO QUESTIONS AVAILABLE"
        );

        return;

    }


    let nextIndex =
        gameState.questionIndex +
        1;


    if (
        nextIndex >=
        questions.length
    ) {

        /*
        ---------------------------------------------
        End game when all questions are exhausted.
        ---------------------------------------------
        */

        gameState.status =
            "ended";

        gameState.currentQuestion =
            "";

        gameState.isPaused =
            false;

        stopTimer();


        broadcastGameState();


        return;

    }


    const nextQuestion =
        normalizeQuestion(
            questions[
                nextIndex
            ]
        );


    gameState.questionIndex =
        nextIndex;


    gameState.currentQuestion =
        nextQuestion;


    gameState.repeatQuestion =
        false;


    gameState.isPaused =
        false;


    timerCurrent =
        Number(
            gameState.timerSeconds
        ) ||
        30;


    broadcastGameState();


    io.emit(
        "timerUpdate",
        timerCurrent
    );


    if (
        gameState.noTimer
    ) {

        stopTimer();

    }

    else {

        startTimer(
            gameState.timerSeconds
        );

    }

}


// =====================================================
// SOCKET CONNECTION
// =====================================================

io.on(
    "connection",
    socket => {

        console.log(
            "SOCKET CONNECTED:",
            socket.id
        );


        // =================================================
        // DEFAULT ROLE
        // =================================================

        socket.data.role =
            "unknown";


        // =================================================
        // SEND CURRENT STATE
        // =================================================

        sendGameStateToSocket(
            socket
        );


        // =================================================
        // IDENTIFY HOST
        // =================================================

        socket.on(
            "registerHost",
            () => {

                hostSocketId =
                    socket.id;


                socket.data.role =
                    "host";


                console.log(
                    "HOST REGISTERED:",
                    socket.id
                );


                sendGameStateToSocket(
                    socket
                );

            }
        );


        // =================================================
        // IDENTIFY DISPLAY
        // =================================================

        socket.on(
            "registerDisplay",
            () => {

                socket.data.role =
                    "display";


                displaySockets.add(
                    socket.id
                );


                console.log(
                    "DISPLAY REGISTERED:",
                    socket.id
                );


                /*
                -----------------------------------------
                Immediately send audio state.
                -----------------------------------------
                */

                socket.emit(
                    "setDisplayAudio",
                    {

                        muted:
                            gameState.audioMuted

                    }
                );


                sendGameStateToSocket(
                    socket
                );

            }
        );


        // =================================================
        // HOST START GAME
        // =================================================

        socket.on(
            "startGame",
            data => {

                if (
                    hostSocketId &&
                    socket.id !==
                    hostSocketId
                ) {

                    console.warn(
                        "NON-HOST ATTEMPTED startGame:",
                        socket.id
                    );

                    return;

                }


                socket.data.role =
                    "host";


                gameState.status =
                    "running";


                gameState.isPaused =
                    false;


                /*
                -----------------------------------------
                Timer settings
                -----------------------------------------
                */

                if (
                    data &&
                    data.noTimer !==
                    undefined
                ) {

                    gameState.noTimer =
                        Boolean(
                            data.noTimer
                        );

                }


                if (
                    data &&
                    data.timerSeconds !==
                    undefined
                ) {

                    gameState.timerSeconds =
                        Number(
                            data.timerSeconds
                        ) ||
                        30;

                }


                /*
                -----------------------------------------
                Start from first question.
                -----------------------------------------
                */

                gameState.questionIndex =
                    -1;


                gameState.currentQuestion =
                    "";


                gameState.repeatQuestion =
                    false;


                timerCurrent =
                    gameState.timerSeconds;


                broadcastGameState();


                /*
                -----------------------------------------
                Move to first question.
                -----------------------------------------
                */

                setTimeout(
                    () => {

                        if (
                            gameState.status ===
                            "running"
                        ) {

                            advanceToNextQuestion();

                        }

                    },

                    50
                );

            }
        );


        // =================================================
        // START NEW GAME
        // =================================================

        socket.on(
            "startNewGame",
            data => {

                if (
                    hostSocketId &&
                    socket.id !==
                    hostSocketId
                ) {

                    return;

                }


                socket.data.role =
                    "host";


                stopTimer();


                gameState = {

                    status:
                        "running",

                    currentQuestion:
                        "",

                    questionIndex:
                        -1,

                    isPaused:
                        false,

                    noTimer:
                        Boolean(
                            data &&
                            data.noTimer
                        ),

                    timerSeconds:
                        Number(
                            data &&
                            data.timerSeconds
                        ) ||
                        30,

                    repeatQuestion:
                        false,

                    /*
                    IMPORTANT:
                    Preserve host audio setting
                    when starting another game.
                    */

                    audioMuted:
                        gameState.audioMuted

                };


                timerCurrent =
                    gameState.timerSeconds;


                broadcastGameState();


                setTimeout(
                    () => {

                        if (
                            gameState.status ===
                            "running"
                        ) {

                            advanceToNextQuestion();

                        }

                    },

                    50
                );

            }
        );


        // =================================================
        // REQUEST NEXT QUESTION
        // =================================================

        socket.on(
            "requestNext",
            () => {

                if (
                    hostSocketId &&
                    socket.id !==
                    hostSocketId
                ) {

                    /*
                    Display may request this when its local
                    timer reaches zero. Allowing it is useful
                    as a fallback, but normally the server
                    timer handles this.
                    */

                    if (
                        socket.data.role !==
                        "display"
                    ) {

                        return;

                    }

                }


                if (
                    gameState.status !==
                    "running"
                ) {

                    return;

                }


                if (
                    gameState.isPaused
                ) {

                    return;

                }


                advanceToNextQuestion();

            }
        );


        // =================================================
        // REPEAT QUESTION
        // =================================================
        //
        // Host presses REPEAT QUESTION.
        //
        // Server sends the same question again with
        // repeatQuestion:true.
        //
        // Display sees this and speaks it again.
        //
        // =================================================

        socket.on(
            "repeatQuestion",
            () => {

                if (
                    hostSocketId &&
                    socket.id !==
                    hostSocketId
                ) {

                    return;

                }


                if (
                    gameState.status !==
                    "running"
                ) {

                    return;

                }


                if (
                    !gameState.currentQuestion
                ) {

                    return;

                }


                console.log(
                    "REPEAT QUESTION:",
                    gameState.currentQuestion
                );


                broadcastGameState(
                    {

                        repeatQuestion:
                            true

                    }
                );

            }
        );


        // =================================================
        // ALTERNATIVE REPEAT EVENT
        // =================================================

        socket.on(
            "requestRepeatQuestion",
            () => {

                if (
                    hostSocketId &&
                    socket.id !==
                    hostSocketId
                ) {

                    return;

                }


                if (
                    gameState.status !==
                    "running"
                ) {

                    return;

                }


                if (
                    !gameState.currentQuestion
                ) {

                    return;

                }


                broadcastGameState(
                    {

                        repeatQuestion:
                            true

                    }
                );

            }
        );


        // =================================================
        // PAUSE GAME
        // =================================================

        socket.on(
            "pauseGame",
            () => {

                if (
                    hostSocketId &&
                    socket.id !==
                    hostSocketId
                ) {

                    return;

                }


                if (
                    gameState.status !==
                    "running"
                ) {

                    return;

                }


                gameState.isPaused =
                    true;


                stopTimer();


                broadcastGameState();


                io.emit(
                    "timerPaused"
                );

            }
        );


        // =================================================
        // RESUME GAME
        // =================================================

        socket.on(
            "resumeGame",
            () => {

                if (
                    hostSocketId &&
                    socket.id !==
                    hostSocketId
                ) {

                    return;

                }


                if (
                    gameState.status !==
                    "running"
                ) {

                    return;

                }


                gameState.isPaused =
                    false;


                broadcastGameState();


                if (
                    !gameState.noTimer
                ) {

                    startTimer(
                        timerCurrent ||
                        gameState.timerSeconds
                    );

                }

                else {

                    io.emit(
                        "timerUpdate",
                        timerCurrent
                    );

                }

            }
        );


        // =================================================
        // TIMER SETTINGS
        // =================================================

        socket.on(
            "setTimerSettings",
            settings => {

                if (
                    hostSocketId &&
                    socket.id !==
                    hostSocketId
                ) {

                    return;

                }


                if (
                    !settings
                ) {

                    return;

                }


                if (
                    settings.noTimer !==
                    undefined
                ) {

                    gameState.noTimer =
                        Boolean(
                            settings.noTimer
                        );

                }


                if (
                    settings.seconds !==
                    undefined
                ) {

                    gameState.timerSeconds =
                        Number(
                            settings.seconds
                        ) ||
                        30;

                }


                if (
                    gameState.noTimer
                ) {

                    stopTimer();

                    timerCurrent =
                        gameState.timerSeconds;

                }


                io.emit(
                    "timerSettingsUpdated",
                    {

                        noTimer:
                            gameState.noTimer,

                        seconds:
                            gameState.timerSeconds

                    }
                );


                broadcastGameState();

            }
        );


        // =================================================
        // TIMER SETTINGS UPDATED
        // =================================================
        //
        // Supports hosts that already emit this event.
        //
        // =================================================

        socket.on(
            "timerSettingsUpdated",
            settings => {

                if (
                    hostSocketId &&
                    socket.id !==
                    hostSocketId
                ) {

                    return;

                }


                if (
                    !settings
                ) {

                    return;

                }


                if (
                    settings.noTimer !==
                    undefined
                ) {

                    gameState.noTimer =
                        Boolean(
                            settings.noTimer
                        );

                }


                if (
                    settings.seconds !==
                    undefined
                ) {

                    gameState.timerSeconds =
                        Number(
                            settings.seconds
                        ) ||
                        30;

                }


                io.emit(
                    "timerSettingsUpdated",
                    {

                        noTimer:
                            gameState.noTimer,

                        seconds:
                            gameState.timerSeconds

                    }
                );


                broadcastGameState();

            }
        );


        // =================================================
        // HOST AUDIO ON / OFF
        // =================================================
        //
        // THIS IS THE MAIN AUDIO CONTROL.
        //
        // host.js sends:
        //
        // socket.emit(
        //     "setDisplayAudio",
        //     {
        //         muted: true/false
        //     }
        // );
        //
        // server remembers it and broadcasts it.
        //
        // =================================================

        socket.on(
            "setDisplayAudio",
            audioState => {

                /*
                -----------------------------------------
                ONLY HOST CONTROLS AUDIO.
                -----------------------------------------
                */

                if (
                    hostSocketId &&
                    socket.id !==
                    hostSocketId
                ) {

                    console.warn(
                        "NON-HOST ATTEMPTED AUDIO CONTROL:",
                        socket.id
                    );

                    return;

                }


                /*
                -----------------------------------------
                REGISTER AS HOST IF NOT ALREADY DONE.
                -----------------------------------------
                */

                if (
                    !hostSocketId
                ) {

                    hostSocketId =
                        socket.id;

                }


                socket.data.role =
                    "host";


                /*
                -----------------------------------------
                Validate audio state.
                -----------------------------------------
                */

                if (
                    !audioState ||
                    typeof audioState.muted !==
                    "boolean"
                ) {

                    console.warn(
                        "INVALID DISPLAY AUDIO STATE:",
                        audioState
                    );

                    return;

                }


                /*
                -----------------------------------------
                STORE AUTHORITATIVE STATE.
                -----------------------------------------
                */

                gameState.audioMuted =
                    audioState.muted;


                console.log(
                    "HOST AUDIO CONTROL:",
                    gameState.audioMuted
                        ? "MUTED"
                        : "ON"
                );


                /*
                -----------------------------------------
                BROADCAST TO DISPLAY.
                -----------------------------------------
                */

                broadcastDisplayAudioState();

            }
        );


        // =================================================
        // AUDIO STATE REQUEST
        // =================================================
        //
        // Allows a display to request the current state
        // after reconnecting.
        //
        // =================================================

        socket.on(
            "requestDisplayAudioState",
            () => {

                socket.emit(
                    "setDisplayAudio",
                    {

                        muted:
                            gameState.audioMuted

                    }
                );

            }
        );


        // =================================================
        // FALLBACK GAME STATE SYNC
        // =================================================

        socket.on(
            "requestGameStateSyncFallback",
            () => {

                console.log(
                    "GAME STATE SYNC REQUEST:",
                    socket.id
                );


                sendGameStateToSocket(
                    socket
                );

            }
        );


        // =================================================
        // WIN APPROVAL
        // =================================================

        socket.on(
            "approveWin",
            data => {

                if (
                    hostSocketId &&
                    socket.id !==
                    hostSocketId
                ) {

                    return;

                }


                console.log(
                    "WIN APPROVED:",
                    data || {}
                );


                io.emit(
                    "winApproved",
                    data || {}
                );

            }
        );


        // =================================================
        // PHYSICAL WIN APPROVAL
        // =================================================

        socket.on(
            "approvePhysicalWin",
            data => {

                if (
                    hostSocketId &&
                    socket.id !==
                    hostSocketId
                ) {

                    return;

                }


                console.log(
                    "PHYSICAL WIN APPROVED:",
                    data || {}
                );


                io.emit(
                    "physicalWinApproved",
                    data || {}
                );

            }
        );


        // =================================================
        // BINGO WIN
        // =================================================

        socket.on(
            "winApproved",
            data => {

                if (
                    hostSocketId &&
                    socket.id !==
                    hostSocketId
                ) {

                    return;

                }


                io.emit(
                    "winApproved",
                    data || {}
                );

            }
        );


        // =================================================
        // PHYSICAL BINGO WIN
        // =================================================

        socket.on(
            "physicalWinApproved",
            data => {

                if (
                    hostSocketId &&
                    socket.id !==
                    hostSocketId
                ) {

                    return;

                }


                io.emit(
                    "physicalWinApproved",
                    data || {}
                );

            }
        );


        // =================================================
        // END GAME
        // =================================================

        socket.on(
            "endGame",
            () => {

                if (
                    hostSocketId &&
                    socket.id !==
                    hostSocketId
                ) {

                    return;

                }


                stopTimer();


                gameState.status =
                    "ended";


                gameState.isPaused =
                    false;


                gameState.repeatQuestion =
                    false;


                broadcastGameState();

            }
        );


        // =================================================
        // HOST LEFT GAME
        // =================================================

        socket.on(
            "hostLeftGame",
            () => {

                if (
                    hostSocketId &&
                    socket.id !==
                    hostSocketId
                ) {

                    return;

                }


                console.log(
                    "HOST LEFT GAME"
                );


                stopTimer();


                gameState = {

                    status:
                        "idle",

                    currentQuestion:
                        "",

                    questionIndex:
                        -1,

                    isPaused:
                        false,

                    noTimer:
                        false,

                    timerSeconds:
                        30,

                    repeatQuestion:
                        false,

                    /*
                    Keep audio state available for
                    the next host/display connection.
                    */

                    audioMuted:
                        gameState.audioMuted

                };


                timerCurrent =
                    gameState.timerSeconds;


                broadcastGameState();


                io.emit(
                    "timerUpdate",
                    timerCurrent
                );


                /*
                -----------------------------------------
                Do NOT forcibly mute the display here.
                The next host controls the audio state.
                -----------------------------------------
                */

            }
        );


        // =================================================
        // DISCONNECT
        // =================================================

        socket.on(
            "disconnect",
            reason => {

                console.log(
                    "SOCKET DISCONNECTED:",
                    socket.id,
                    reason
                );


                /*
                -----------------------------------------
                Remove display.
                -----------------------------------------
                */

                displaySockets.delete(
                    socket.id
                );


                /*
                -----------------------------------------
                Host disconnected.
                -----------------------------------------
                */

                if (
                    socket.id ===
                    hostSocketId
                ) {

                    console.log(
                        "HOST SOCKET DISCONNECTED"
                    );


                    hostSocketId =
                        null;


                    /*
                    -------------------------------------
                    Stop the active game timer.
                    -------------------------------------
                    */

                    stopTimer();


                    /*
                    -------------------------------------
                    Return game to idle.
                    -------------------------------------
                    */

                    gameState.status =
                        "idle";


                    gameState.currentQuestion =
                        "";


                    gameState.questionIndex =
                        -1;


                    gameState.isPaused =
                        false;


                    gameState.repeatQuestion =
                        false;


                    timerCurrent =
                        gameState.timerSeconds;


                    broadcastGameState();

                }

            }
        );

    }
);


// =====================================================
// SERVER HEALTH
// =====================================================

app.get(
    "/health",
    (req, res) => {

        res.json(
            {

                ok:
                    true,

                status:
                    gameState.status,

                hostConnected:
                    Boolean(
                        hostSocketId
                    ),

                displaysConnected:
                    displaySockets.size,

                audioMuted:
                    gameState.audioMuted,

                timer:
                    timerCurrent

            }
        );

    }
);


// =====================================================
// START SERVER
// =====================================================

server.listen(
    PORT,
    () => {

        console.log(
            "================================================="
        );

        console.log(
            "SAFETY STANDDOWN BINGO SERVER"
        );

        console.log(
            "================================================="
        );

        console.log(
            `SERVER RUNNING ON PORT ${PORT}`
        );

        console.log(
            `HTTP: http://localhost:${PORT}`
        );

        console.log(
            "SOCKET.IO READY"
        );

        console.log(
            "HOST AUDIO CONTROL READY"
        );

        console.log(
            "DISPLAY AUDIO RELAY READY"
        );

        console.log(
            "================================================="
        );

    }
);


// =====================================================
// PROCESS SAFETY
// =====================================================

process.on(
    "SIGINT",
    () => {

        console.log(
            "SERVER SHUTTING DOWN..."
        );


        stopTimer();


        io.close(
            () => {

                server.close(
                    () => {

                        process.exit(
                            0
                        );

                    }
                );

            }
        );

    }
);


process.on(
    "SIGTERM",
    () => {

        console.log(
            "SERVER TERMINATING..."
        );


        stopTimer();


        io.close(
            () => {

                server.close(
                    () => {

                        process.exit(
                            0
                        );

                    }
                );

            }
        );

    }
);
