"use strict";

// =====================================================
// SAFETY BINGO SERVER
// CRASH-SAFE / PERSISTENT GAME VERSION
// =====================================================

require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const {
    pool,
    initializeDatabase
} = require("./database");


// =====================================================
// DATABASE INITIALIZATION
// =====================================================

initializeDatabase();


// =====================================================
// OPTIONAL QUESTION MIGRATION
// =====================================================

if (
    process.env.MIGRATE_QUESTIONS === "true"
) {

    require("./migrateQuestions");

}


// =====================================================
// SERVER SETUP
// =====================================================

const app =
    express();

app.use(
    express.json()
);

const server =
    http.createServer(
        app
    );

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
            }
        }
    );


// =====================================================
// STATIC FILES
// =====================================================

app.use(
    express.static(
        __dirname
    )
);

app.use(
    express.static(
        path.join(
            __dirname,
            "public"
        )
    )
);


// =====================================================
// QUESTION DATABASE
// =====================================================

let safetyQuestionBank = [];


async function loadQuestionsFromDatabase() {

    try {

        const result =
            await pool.query(`
                SELECT *
                FROM questions
                ORDER BY id ASC
            `);

        safetyQuestionBank =
            result.rows.map(
                item => ({
                    id:
                        Number(
                            item.id
                        ),

                    category:
                        item.category,

                    difficulty:
                        item.difficulty,

                    q:
                        item.question,

                    a:
                        item.answer
                })
            );

        console.log(
            `Loaded ${safetyQuestionBank.length} questions from database`
        );

    } catch (error) {

        console.error(
            "DATABASE QUESTION LOAD ERROR:",
            error
        );

        throw error;

    }

}


// =====================================================
// PAGE ROUTES
// =====================================================

app.get(
    "/",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "index.html"
            )
        );

    }
);


app.get(
    "/host.html",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "host.html"
            )
        );

    }
);


app.get(
    "/player.html",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "player.html"
            )
        );

    }
);


app.get(
    "/display.html",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "display.html"
            )
        );

    }
);


app.get(
    "/questionManager.html",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "questionManager.html"
            )
        );

    }
);


app.get(
    "/cheatsheet.html",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "cheatsheet.html"
            )
        );

    }
);


app.get(
    "/answerkey.html",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "answerkey.html"
            )
        );

    }
);


// =====================================================
// QUESTION API
// =====================================================

app.get(
    "/api/questions",
    async (req, res) => {

        try {

            const result =
                await pool.query(`
                    SELECT *
                    FROM questions
                    ORDER BY id ASC
                `);

            res.json(
                result.rows
            );

        } catch (error) {

            console.error(
                "LOAD QUESTIONS ERROR:",
                error
            );

            res.status(
                500
            ).json({
                success: false,
                error:
                    error.message
            });

        }

    }
);


app.post(
    "/api/questions/add",
    async (req, res) => {

        const newQuestion =
            req.body;

        if (
            !newQuestion.q ||
            !newQuestion.a
        ) {

            return res.status(
                400
            ).json({
                success: false,
                error:
                    "Question and answer required"
            });

        }

        try {

            const idResult =
                await pool.query(`
                    SELECT MAX(id) AS maxid
                    FROM questions
                `);

            const nextID =
                Number(
                    idResult.rows[0].maxid || 0
                ) + 1;

            await pool.query(`
                INSERT INTO questions
                (
                    id,
                    category,
                    difficulty,
                    question,
                    answer
                )
                VALUES($1, $2, $3, $4, $5)
            `, [

                nextID,

                newQuestion.category ||
                    "General",

                newQuestion.difficulty ||
                    "Medium",

                newQuestion.q,

                newQuestion.a

            ]);

            console.log(
                "QUESTION ADDED:",
                nextID
            );

            res.json({
                success: true,
                id:
                    nextID
            });

        } catch (error) {

            console.error(
                "ADD QUESTION ERROR:",
                error
            );

            res.status(
                500
            ).json({
                success: false,
                error:
                    error.message
            });

        }

    }
);


app.delete(
    "/api/questions/:id",
    async (req, res) => {

        const id =
            Number(
                req.params.id
            );

        if (
            !Number.isInteger(id) ||
            id <= 0
        ) {

            return res.status(
                400
            ).json({
                success: false,
                error:
                    "Invalid question ID"
            });

        }

        try {

            const result =
                await pool.query(`
                    DELETE FROM questions
                    WHERE id=$1
                `, [
                    id
                ]);

            if (
                result.rowCount === 0
            ) {

                return res.status(
                    404
                ).json({
                    success: false,
                    error:
                        "Question not found"
                });

            }

            console.log(
                "QUESTION REMOVED:",
                id
            );

            res.json({
                success: true
            });

        } catch (error) {

            console.error(
                "DELETE ERROR:",
                error
            );

            res.status(
                500
            ).json({
                success: false,
                error:
                    error.message
            });

        }

    }
);


// =====================================================
// GAME STATE
// =====================================================

function createFreshGameState() {

    return {

        status:
            "idle",

        currentQuestionIndex:
            -1,

        currentQuestion:
            "",

        currentAnswer:
            "",

        currentQuestionID:
            null,

        currentQuestionNumber:
            null,

        currentCategory:
            "",

        currentDifficulty:
            "",

        calledAnswers:
            [],

        askedIndices:
            [],

        gameOrder:
            [],

        selectedQuestionIds:
            [],

        timerSeconds:
            30,

        noTimer:
            false,

        // Absolute timestamp when the timer expires.
        // This is what allows recovery after a server crash.
        timerEndsAt:
            null,

        isPaused:
            false,

        maxWinners:
            1,

        approvedWinnersCount:
            0,

        approvedWinnersList:
            []

    };

}


let gameState =
    createFreshGameState();


// =====================================================
// SERVER GAME VARIABLES
// =====================================================

let timer =
    null;

let countdown =
    30;

let gamePosition =
    -1;

const pendingClaims =
    new Map();


// =====================================================
// HOST TRACKING
// =====================================================

let hostSocketId =
    null;


// =====================================================
// HOST RECONNECTION GRACE PERIOD
// =====================================================

const HOST_RECONNECT_GRACE_MS =
    60 * 1000;

let hostReconnectTimer =
    null;

let hostReconnectPending =
    false;


// =====================================================
// PERSISTENT GAME DATABASE
// =====================================================

async function ensureGameStateTable() {

    await pool.query(`
        CREATE TABLE IF NOT EXISTS game_state (
            id INTEGER PRIMARY KEY,
            state JSONB NOT NULL,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    console.log(
        "GAME STATE TABLE READY"
    );

}


// =====================================================
// PERSISTENCE SAVE QUEUE
//
// Prevents two simultaneous saves from arriving in
// the database out of order.
// =====================================================

let gameStateSaveQueue =
    Promise.resolve();


function saveGameState() {

    const snapshot = {

        ...gameState,

        gamePosition:
            gamePosition

    };


    gameStateSaveQueue =
        gameStateSaveQueue
            .catch(
                () => {}
            )
            .then(
                async () => {

                    try {

                        await pool.query(`
                            INSERT INTO game_state
                            (
                                id,
                                state,
                                updated_at
                            )
                            VALUES
                            (
                                1,
                                $1::jsonb,
                                NOW()
                            )
                            ON CONFLICT (id)
                            DO UPDATE SET
                                state =
                                    EXCLUDED.state,

                                updated_at =
                                    NOW()
                        `, [
                            JSON.stringify(
                                snapshot
                            )
                        ]);

                        console.log(
                            "GAME STATE SAVED:",
                            snapshot.status,
                            "position:",
                            snapshot.gamePosition
                        );

                    } catch (error) {

                        console.error(
                            "SAVE GAME STATE ERROR:",
                            error
                        );

                    }

                }
            );


    return gameStateSaveQueue;

}


// =====================================================
// LOAD SAVED GAME
// =====================================================

async function loadSavedGameState() {

    try {

        const result =
            await pool.query(`
                SELECT
                    state,
                    updated_at
                FROM game_state
                WHERE id = 1
            `);


        if (
            result.rowCount === 0
        ) {

            console.log(
                "NO SAVED GAME STATE FOUND"
            );

            return false;

        }


        const saved =
            result.rows[0].state;


        if (
            !saved ||
            !saved.status ||
            saved.status === "idle"
        ) {

            console.log(
                "SAVED GAME STATE IS IDLE"
            );

            return false;

        }


        // -------------------------------------------------
        // VALIDATE GAME ORDER
        // -------------------------------------------------

        if (
            !Array.isArray(
                saved.gameOrder
            )
        ) {

            console.error(
                "SAVED GAME HAS NO VALID GAME ORDER"
            );

            return false;

        }


        const validGameOrder =
            saved.gameOrder.filter(
                index => {

                    return (
                        Number.isInteger(
                            Number(index)
                        ) &&
                        Number(index) >= 0 &&
                        Number(index) <
                            safetyQuestionBank.length
                    );

                }
            );


        if (
            validGameOrder.length === 0
        ) {

            console.error(
                "SAVED GAME ORDER IS INVALID"
            );

            return false;

        }


        // -------------------------------------------------
        // RESTORE GAME STATE
        // -------------------------------------------------

        gameState = {

            ...createFreshGameState(),

            ...saved,

            gameOrder:
                validGameOrder

        };


        // -------------------------------------------------
        // RESTORE GAME POSITION
        // -------------------------------------------------

        if (
            Number.isInteger(
                Number(
                    saved.gamePosition
                )
            )
        ) {

            gamePosition =
                Number(
                    saved.gamePosition
                );

        } else {

            gamePosition =
                -1;

        }


        // -------------------------------------------------
        // VALIDATE POSITION
        // -------------------------------------------------

        if (
            gamePosition < -1
        ) {

            gamePosition =
                -1;

        }


        if (
            gamePosition >=
            gameState.gameOrder.length
        ) {

            gamePosition =
                gameState.gameOrder.length - 1;

        }


        // -------------------------------------------------
        // CLEAN ARRAYS
        // -------------------------------------------------

        if (
            !Array.isArray(
                gameState.askedIndices
            )
        ) {

            gameState.askedIndices =
                [];

        }


        if (
            !Array.isArray(
                gameState.calledAnswers
            )
        ) {

            gameState.calledAnswers =
                [];

        }


        if (
            !Array.isArray(
                gameState.selectedQuestionIds
            )
        ) {

            gameState.selectedQuestionIds =
                [];

        }


        if (
            !Array.isArray(
                gameState.approvedWinnersList
            )
        ) {

            gameState.approvedWinnersList =
                [];

        }


        // -------------------------------------------------
        // PENDING SOCKET CLAIMS
        //
        // DO NOT RESTORE THEM.
        //
        // Socket IDs from before a server crash no longer
        // exist.
        // -------------------------------------------------

        pendingClaims.clear();


        // -------------------------------------------------
        // RESTORE COUNTDOWN
        // -------------------------------------------------

        countdown =
            Number.isFinite(
                Number(
                    gameState.timerSeconds
                )
            )
                ? Number(
                    gameState.timerSeconds
                )
                : 30;


        if (
            gameState.status ===
            "running" &&
            !gameState.noTimer &&
            gameState.timerEndsAt
        ) {

            countdown =
                Math.max(
                    0,
                    Math.ceil(
                        (
                            Number(
                                gameState.timerEndsAt
                            ) -
                            Date.now()
                        ) / 1000
                    )
                );

        } else if (
            gameState.noTimer
        ) {

            countdown =
                0;

        }


        console.log(
            "=========================================="
        );

        console.log(
            "SAVED GAME RESTORED"
        );

        console.log(
            "STATUS:",
            gameState.status
        );

        console.log(
            "GAME POSITION:",
            gamePosition
        );

        console.log(
            "GAME QUESTIONS:",
            gameState.gameOrder.length
        );

        console.log(
            "CURRENT QUESTION ID:",
            gameState.currentQuestionID
        );

        console.log(
            "COUNTDOWN:",
            countdown
        );

        console.log(
            "WINNERS:",
            gameState.approvedWinnersList
        );

        console.log(
            "=========================================="
        );


        return true;

    } catch (error) {

        console.error(
            "LOAD SAVED GAME STATE ERROR:",
            error
        );

        return false;

    }

}


// =====================================================
// CLEAR PERSISTED GAME
// =====================================================

async function clearSavedGameState() {

    try {

        await pool.query(`
            DELETE FROM game_state
            WHERE id = 1
        `);

        console.log(
            "PERSISTED GAME STATE CLEARED"
        );

    } catch (error) {

        console.error(
            "CLEAR SAVED GAME STATE ERROR:",
            error
        );

    }

}


// =====================================================
// HOST RECONNECTION GRACE HELPERS
// =====================================================

function cancelHostReconnectGrace() {

    if (
        hostReconnectTimer
    ) {

        clearTimeout(
            hostReconnectTimer
        );

        hostReconnectTimer =
            null;

    }


    hostReconnectPending =
        false;


    console.log(
        "HOST RECONNECTION GRACE PERIOD CANCELLED"
    );

}


function startHostReconnectGrace(
    disconnectedHostSocketId
) {

    if (
        hostReconnectTimer
    ) {

        clearTimeout(
            hostReconnectTimer
        );

    }


    hostReconnectPending =
        true;


    console.log(
        "=========================================="
    );

    console.log(
        "HOST DISCONNECTED"
    );

    console.log(
        "STARTING 60 SECOND RECONNECTION GRACE PERIOD"
    );

    console.log(
        "DISCONNECTED HOST SOCKET:",
        disconnectedHostSocketId
    );

    console.log(
        "GAME WILL REMAIN ACTIVE DURING GRACE PERIOD"
    );

    console.log(
        "=========================================="
    );


    hostReconnectTimer =
        setTimeout(
            async () => {

                hostReconnectTimer =
                    null;


                if (
                    !hostReconnectPending
                ) {

                    return;

                }


                console.log(
                    "=========================================="
                );

                console.log(
                    "HOST RECONNECTION GRACE PERIOD EXPIRED"
                );

                console.log(
                    "RESETTING GAME"
                );

                console.log(
                    "=========================================="
                );


                hostReconnectPending =
                    false;


                await resetGame(
                    "host reconnection grace period expired"
                );


                hostSocketId =
                    null;


                console.log(
                    "HOST SLOT RELEASED AFTER 60 SECOND GRACE PERIOD"
                );

            },
            HOST_RECONNECT_GRACE_MS
        );

}


// =====================================================
// RESET GAME
// =====================================================

async function resetGame(
    reason = "unknown"
) {

    console.log(
        "=========================================="
    );

    console.log(
        "RESETTING GAME:",
        reason
    );

    console.log(
        "=========================================="
    );


    // -------------------------------------------------
    // STOP TIMER
    // -------------------------------------------------

    if (
        timer
    ) {

        clearInterval(
            timer
        );

        timer =
            null;

    }


    countdown =
        30;


    // -------------------------------------------------
    // CLEAR CLAIMS
    // -------------------------------------------------

    pendingClaims.clear();


    // -------------------------------------------------
    // CREATE COMPLETELY FRESH GAME
    // -------------------------------------------------

    gameState =
        createFreshGameState();


    gamePosition =
        -1;


    // -------------------------------------------------
    // CLEAR DATABASE COPY
    // -------------------------------------------------

    await clearSavedGameState();


    // -------------------------------------------------
    // TELL ALL CLIENTS
    // -------------------------------------------------

    io.emit(
        "gameReset"
    );

    io.emit(
        "gameState",
        gameState
    );

    io.emit(
        "timerUpdate",
        0
    );


    console.log(
        "========== GAME RESET COMPLETE =========="
    );

}


// =====================================================
// BUILD GAME ORDER
// =====================================================

function buildGameOrder(
    selectedQuestionIds = []
) {

    const normalizedIds =
        [
            ...new Set(
                selectedQuestionIds
                    .map(
                        Number
                    )
                    .filter(
                        id =>
                            Number.isInteger(id) &&
                            id > 0
                    )
            )
        ];


    let availableIndices;


    if (
        normalizedIds.length === 0
    ) {

        availableIndices =
            safetyQuestionBank.map(
                (
                    question,
                    index
                ) =>
                    index
            );

    } else {

        const selectedSet =
            new Set(
                normalizedIds
            );

        availableIndices =
            safetyQuestionBank
                .map(
                    (
                        question,
                        index
                    ) => {

                        return selectedSet.has(
                            question.id
                        )
                            ? index
                            : null;

                    }
                )
                .filter(
                    index =>
                        index !== null
                );

    }


    gameState.gameOrder =
        [
            ...availableIndices
        ];


    // -------------------------------------------------
    // SHUFFLE
    // -------------------------------------------------

    for (
        let i =
            gameState.gameOrder.length - 1;

        i > 0;

        i--
    ) {

        const j =
            Math.floor(
                Math.random() *
                (i + 1)
            );


        [
            gameState.gameOrder[i],
            gameState.gameOrder[j]

        ] = [

            gameState.gameOrder[j],
            gameState.gameOrder[i]

        ];

    }


    console.log(
        "GAME ORDER BUILT:",
        gameState.gameOrder.length,
        "QUESTIONS"
    );

}


// =====================================================
// SEND NEXT QUESTION
// =====================================================

async function sendNextQuestion() {

    if (
        timer
    ) {

        clearInterval(
            timer
        );

        timer =
            null;

    }


    gamePosition++;


    // -------------------------------------------------
    // GAME COMPLETE
    // -------------------------------------------------

    if (
        gamePosition >=
        gameState.gameOrder.length
    ) {

        gameState.status =
            "ended";

        gameState.currentQuestion =
            "";

        gameState.currentAnswer =
            "";

        gameState.timerEndsAt =
            null;

        gameState.isPaused =
            false;


        await saveGameState();


        io.emit(
            "gameState",
            gameState
        );

        io.emit(
            "gameEnded",
            {
                reason:
                    "questions exhausted"
            }
        );

        return;

    }


    const index =
        gameState.gameOrder[
            gamePosition
        ];


    const question =
        safetyQuestionBank[
            index
        ];


    if (
        !question
    ) {

        console.error(
            "QUESTION NOT FOUND:",
            index
        );

        return;

    }


    console.log(
        "SENDING QUESTION:",
        question
    );


    // -------------------------------------------------
    // QUESTION STATE
    // -------------------------------------------------

    gameState.currentQuestionIndex =
        index;

    gameState.askedIndices.push(
        index
    );

    gameState.currentQuestionID =
        question.id;

    gameState.currentQuestion =
        question.q;

    gameState.currentAnswer =
        question.a;

    gameState.currentCategory =
        question.category;

    gameState.currentDifficulty =
        question.difficulty;


    gameState.currentQuestionNumber =
        safetyQuestionBank.findIndex(
            q =>
                q.id ===
                question.id
        ) + 1;


    gameState.isPaused =
        false;


    // -------------------------------------------------
    // CALLED ANSWERS
    // -------------------------------------------------

    if (
        !gameState.calledAnswers.includes(
            question.a
        )
    ) {

        gameState.calledAnswers.push(
            question.a
        );

    }


    // -------------------------------------------------
    // CHEAT SHEET
    // -------------------------------------------------

    io.emit(
        "cheatSheetQuestion",
        {

            number:
                gameState.currentQuestionNumber,

            id:
                question.id,

            category:
                question.category,

            difficulty:
                question.difficulty,

            question:
                question.q,

            answer:
                question.a

        }
    );


    // -------------------------------------------------
    // TIMER
    // -------------------------------------------------

    if (
        !gameState.noTimer
    ) {

        countdown =
            gameState.timerSeconds;

        gameState.timerEndsAt =
            Date.now() +
            (
                countdown * 1000
            );

        io.emit(
            "timerUpdate",
            countdown
        );

        startTimer();

    } else {

        countdown =
            0;

        gameState.timerEndsAt =
            null;

        io.emit(
            "timerUpdate",
            0
        );

    }


    // -------------------------------------------------
    // SAVE BEFORE BROADCAST
    // -------------------------------------------------

    await saveGameState();


    // -------------------------------------------------
    // GAME STATE
    // -------------------------------------------------

    io.emit(
        "gameState",
        {
            ...gameState,
            repeatQuestion:
                false
        }
    );

}


// =====================================================
// START TIMER
// =====================================================

function startTimer() {

    if (
        timer
    ) {

        clearInterval(
            timer
        );

    }


    timer =
        setInterval(
            async () => {

                if (
                    gameState.isPaused
                ) {

                    return;

                }


                if (
                    gameState.noTimer
                ) {

                    return;

                }


                if (
                    !gameState.timerEndsAt
                ) {

                    return;

                }


                countdown =
                    Math.max(
                        0,
                        Math.ceil(
                            (
                                Number(
                                    gameState.timerEndsAt
                                ) -
                                Date.now()
                            ) / 1000
                        )
                    );


                io.emit(
                    "timerUpdate",
                    countdown
                );


                if (
                    countdown <= 0
                ) {

                    clearInterval(
                        timer
                    );

                    timer =
                        null;


                    gameState.timerEndsAt =
                        null;


                    await sendNextQuestion();

                }

            },
            250
        );

}


// =====================================================
// SOCKET CONNECTION
// =====================================================

io.on(
    "connection",
    socket => {

        console.log(
            "CONNECTED:",
            socket.id
        );


        // -------------------------------------------------
        // SEND CURRENT STATE
        // -------------------------------------------------

        socket.emit(
            "gameState",
            gameState
        );


        // -------------------------------------------------
        // SEND PREVIOUS QUESTIONS
        // -------------------------------------------------

        gameState.askedIndices.forEach(
            index => {

                const question =
                    safetyQuestionBank[
                        index
                    ];


                if (
                    !question
                ) {

                    return;

                }


                socket.emit(
                    "cheatSheetQuestion",
                    {

                        number:
                            safetyQuestionBank.findIndex(
                                q =>
                                    q.id ===
                                    question.id
                            ) + 1,

                        id:
                            question.id,

                        category:
                            question.category,

                        difficulty:
                            question.difficulty,

                        question:
                            question.q,

                        answer:
                            question.a

                    }
                );

            }
        );


        // =================================================
        // REGISTER HOST
        // =================================================

        socket.on(
            "registerHost",
            () => {

                console.log(
                    "HOST REGISTER REQUEST:",
                    socket.id
                );


                // =================================================
                // RECONNECTING HOST
                // =================================================

                if (
                    hostReconnectPending
                ) {

                    console.log(
                        "HOST RECONNECTING DURING GRACE PERIOD:",
                        socket.id
                    );


                    cancelHostReconnectGrace();


                    hostSocketId =
                        socket.id;


                    console.log(
                        "HOST RECONNECTED:",
                        hostSocketId
                    );


                    socket.emit(
                        "hostRegistered"
                    );


                    socket.emit(
                        "gameState",
                        gameState
                    );


                    // Restart timer if required.
                    if (
                        gameState.status ===
                            "running" &&
                        !gameState.isPaused &&
                        !gameState.noTimer &&
                        gameState.timerEndsAt
                    ) {

                        countdown =
                            Math.max(
                                0,
                                Math.ceil(
                                    (
                                        Number(
                                            gameState.timerEndsAt
                                        ) -
                                        Date.now()
                                    ) / 1000
                                )
                            );


                        io.emit(
                            "timerUpdate",
                            countdown
                        );


                        if (
                            countdown > 0
                        ) {

                            startTimer();

                        }

                    }


                    return;

                }


                // =================================================
                // NO HOST CURRENTLY REGISTERED
                // =================================================

                if (
                    !hostSocketId
                ) {

                    hostSocketId =
                        socket.id;


                    console.log(
                        "HOST REGISTERED:",
                        hostSocketId
                    );


                    socket.emit(
                        "hostRegistered"
                    );


                    socket.emit(
                        "gameState",
                        gameState
                    );


                    // -------------------------------------------------
                    // RESUME TIMER
                    // -------------------------------------------------

                    if (
                        gameState.status ===
                            "running" &&
                        !gameState.isPaused &&
                        !gameState.noTimer &&
                        gameState.timerEndsAt
                    ) {

                        countdown =
                            Math.max(
                                0,
                                Math.ceil(
                                    (
                                        Number(
                                            gameState.timerEndsAt
                                        ) -
                                        Date.now()
                                    ) / 1000
                                )
                            );


                        io.emit(
                            "timerUpdate",
                            countdown
                        );


                        if (
                            countdown > 0
                        ) {

                            startTimer();

                        } else {

                            sendNextQuestion();

                        }

                    }


                    return;

                }


                // =================================================
                // DIFFERENT HOST TAKING OVER
                //
                // IMPORTANT:
                // Do NOT automatically reset the game.
                // =================================================

                if (
                    hostSocketId !==
                    socket.id
                ) {

                    console.log(
                        "NEW HOST TAKING OVER:",
                        socket.id
                    );

                    console.log(
                        "OLD HOST:",
                        hostSocketId
                    );


                    cancelHostReconnectGrace();


                    hostSocketId =
                        socket.id;


                    console.log(
                        "NEW HOST REGISTERED:",
                        hostSocketId
                    );


                    socket.emit(
                        "hostRegistered"
                    );


                    socket.emit(
                        "gameState",
                        gameState
                    );


                    return;

                }


                // =================================================
                // SAME SOCKET REGISTERED AGAIN
                // =================================================

                socket.emit(
                    "hostRegistered"
                );


                socket.emit(
                    "gameState",
                    gameState
                );

            }
        );


        // =================================================
        // TIMER SETTINGS
        // =================================================

        socket.on(
            "setTimerSettings",
            async data => {

                if (
                    socket.id !==
                    hostSocketId
                ) {

                    return;

                }


                if (
                    !data
                ) {

                    return;

                }


                const noTimer =
                    data.noTimer ===
                    true;


                let seconds =
                    Number(
                        data.seconds
                    );


                if (
                    noTimer
                ) {

                    seconds =
                        0;

                } else if (
                    !Number.isFinite(
                        seconds
                    ) ||
                    seconds < 1
                ) {

                    seconds =
                        30;

                }


                gameState.timerSeconds =
                    seconds;

                gameState.noTimer =
                    noTimer;


                console.log(
                    "TIMER SETTINGS:",
                    {
                        seconds:
                            gameState.timerSeconds,

                        noTimer:
                            gameState.noTimer
                    }
                );


                await saveGameState();


                io.emit(
                    "gameState",
                    gameState
                );

            }
        );


        // =================================================
        // WINNER SETTINGS
        // =================================================

        socket.on(
            "setWinnerSettings",
            async data => {

                if (
                    socket.id !==
                    hostSocketId
                ) {

                    return;

                }


                if (
                    !data
                ) {

                    return;

                }


                let maxWinners =
                    Number(
                        data.maxWinners
                    );


                if (
                    !Number.isInteger(
                        maxWinners
                    ) ||
                    maxWinners < 1
                ) {

                    maxWinners =
                        1;

                }


                gameState.maxWinners =
                    maxWinners;


                console.log(
                    "MAX WINNERS:",
                    gameState.maxWinners
                );


                await saveGameState();


                io.emit(
                    "gameState",
                    gameState
                );

            }
        );


        // =================================================
        // START GAME
        // =================================================

        socket.on(
            "hostStart",
            async data => {

                if (
                    socket.id !==
                    hostSocketId
                ) {

                    console.warn(
                        "HOST START REJECTED:",
                        socket.id
                    );

                    return;

                }


                if (
                    gameState.status ===
                    "running"
                ) {

                    return;

                }


                try {

                    await loadQuestionsFromDatabase();


                    let selectedQuestionIds =
                        [];


                    if (
                        data &&
                        Array.isArray(
                            data.selectedQuestionIds
                        )
                    ) {

                        selectedQuestionIds =
                            data.selectedQuestionIds
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


                    const availableQuestionIds =
                        new Set(
                            safetyQuestionBank.map(
                                question =>
                                    question.id
                            )
                        );


                    selectedQuestionIds =
                        selectedQuestionIds.filter(
                            id =>
                                availableQuestionIds.has(
                                    id
                                )
                        );


                    gameState.selectedQuestionIds =
                        [
                            ...selectedQuestionIds
                        ];


                    if (
                        safetyQuestionBank.length ===
                        0
                    ) {

                        socket.emit(
                            "gameStartError",
                            {
                                error:
                                    "There are no questions in the database."
                            }
                        );

                        return;

                    }


                    // -------------------------------------------------
                    // RESET PER-GAME DATA
                    // -------------------------------------------------

                    pendingClaims.clear();


                    gameState.status =
                        "running";

                    gameState.currentQuestionIndex =
                        -1;

                    gameState.currentQuestion =
                        "";

                    gameState.currentAnswer =
                        "";

                    gameState.currentQuestionID =
                        null;

                    gameState.currentQuestionNumber =
                        null;

                    gameState.currentCategory =
                        "";

                    gameState.currentDifficulty =
                        "";

                    gameState.askedIndices =
                        [];

                    gameState.calledAnswers =
                        [];

                    gameState.approvedWinnersCount =
                        0;

                    gameState.approvedWinnersList =
                        [];

                    gameState.isPaused =
                        false;

                    gameState.timerEndsAt =
                        null;


                    buildGameOrder(
                        gameState.selectedQuestionIds
                    );


                    if (
                        gameState.gameOrder.length ===
                        0
                    ) {

                        gameState.status =
                            "idle";

                        socket.emit(
                            "gameStartError",
                            {
                                error:
                                    "None of the selected questions exist in the database."
                            }
                        );

                        return;

                    }


                    gamePosition =
                        -1;


                    console.log(
                        "=========================================="
                    );

                    console.log(
                        "GAME STARTED"
                    );

                    console.log(
                        "SELECTED IDS:",
                        gameState.selectedQuestionIds
                    );

                    console.log(
                        "QUESTIONS IN GAME:",
                        gameState.gameOrder.length
                    );

                    console.log(
                        "=========================================="
                    );


                    await saveGameState();


                    await sendNextQuestion();

                } catch (error) {

                    console.error(
                        "START GAME ERROR:",
                        error
                    );


                    gameState.status =
                        "idle";


                    socket.emit(
                        "gameStartError",
                        {
                            error:
                                "Unable to start game."
                        }
                    );

                }

            }
        );


        // =================================================
        // NEXT QUESTION
        // =================================================

        socket.on(
            "hostNext",
            async () => {

                if (
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


                await sendNextQuestion();

            }
        );


        // =================================================
        // PREVIOUS QUESTION
        // =================================================

        socket.on(
            "hostPrevious",
            async () => {

                if (
                    socket.id !==
                        hostSocketId ||
                    gameState.status !==
                        "running" ||
                    gamePosition <=
                        0
                ) {

                    return;

                }


                if (
                    timer
                ) {

                    clearInterval(
                        timer
                    );

                    timer =
                        null;

                }


                gamePosition--;


                const index =
                    gameState.gameOrder[
                        gamePosition
                    ];


                const question =
                    safetyQuestionBank[
                        index
                    ];


                if (
                    !question
                ) {

                    return;

                }


                gameState.currentQuestionIndex =
                    index;

                gameState.currentQuestionID =
                    question.id;

                gameState.currentQuestion =
                    question.q;

                gameState.currentAnswer =
                    question.a;

                gameState.currentCategory =
                    question.category;

                gameState.currentDifficulty =
                    question.difficulty;

                gameState.currentQuestionNumber =
                    safetyQuestionBank.findIndex(
                        q =>
                            q.id ===
                            question.id
                    ) + 1;

                gameState.isPaused =
                    false;


                if (
                    !gameState.noTimer
                ) {

                    countdown =
                        gameState.timerSeconds;

                    gameState.timerEndsAt =
                        Date.now() +
                        (
                            countdown * 1000
                        );

                    io.emit(
                        "timerUpdate",
                        countdown
                    );

                    startTimer();

                } else {

                    countdown =
                        0;

                    gameState.timerEndsAt =
                        null;

                    io.emit(
                        "timerUpdate",
                        0
                    );

                }


                await saveGameState();


                io.emit(
                    "cheatSheetQuestion",
                    {

                        number:
                            gameState.currentQuestionNumber,

                        id:
                            question.id,

                        category:
                            question.category,

                        difficulty:
                            question.difficulty,

                        question:
                            question.q,

                        answer:
                            question.a

                    }
                );


                io.emit(
                    "gameState",
                    {
                        ...gameState,
                        repeatQuestion:
                            false
                    }
                );

            }
        );


        // =================================================
        // REPEAT QUESTION
        // =================================================

        socket.on(
            "hostRepeat",
            () => {

                if (
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


                io.emit(
                    "gameState",
                    {
                        ...gameState,
                        repeatQuestion:
                            true
                    }
                );

            }
        );


        // =================================================
        // PAUSE / RESUME
        // =================================================

        socket.on(
            "togglePausePlay",
            async () => {

                if (
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


                // =================================================
                // PAUSE
                // =================================================

                if (
                    !gameState.isPaused
                ) {

                    gameState.isPaused =
                        true;


                    if (
                        timer
                    ) {

                        clearInterval(
                            timer
                        );

                        timer =
                            null;

                    }


                    if (
                        !gameState.noTimer &&
                        gameState.timerEndsAt
                    ) {

                        countdown =
                            Math.max(
                                0,
                                Math.ceil(
                                    (
                                        Number(
                                            gameState.timerEndsAt
                                        ) -
                                        Date.now()
                                    ) / 1000
                                )
                            );

                    }


                    // -------------------------------------------------
                    // Save remaining time instead of expiration time.
                    // -------------------------------------------------

                    gameState.timerEndsAt =
                        null;


                    console.log(
                        "PAUSE:",
                        true,
                        "remaining:",
                        countdown
                    );

                }

                // =================================================
                // RESUME
                // =================================================

                else {

                    gameState.isPaused =
                        false;


                    if (
                        !gameState.noTimer
                    ) {

                        countdown =
                            Math.max(
                                countdown,
                                1
                            );


                        gameState.timerEndsAt =
                            Date.now() +
                            (
                                countdown * 1000
                            );


                        startTimer();

                    }


                    console.log(
                        "PAUSE:",
                        false,
                        "remaining:",
                        countdown
                    );

                }


                await saveGameState();


                io.emit(
                    "gameState",
                    gameState
                );


                io.emit(
                    "timerUpdate",
                    countdown
                );

            }
        );


        // =================================================
        // HOST RESET BUTTON
        // =================================================

        socket.on(
            "hostReset",
            async () => {

                if (
                    socket.id !==
                    hostSocketId
                ) {

                    return;

                }


                console.log(
                    "HOST RESET BUTTON:",
                    socket.id
                );


                await resetGame(
                    "host reset button"
                );

            }
        );


        // =================================================
        // LEGACY RESET EVENT
        // =================================================

        socket.on(
            "resetGame",
            async () => {

                if (
                    socket.id !==
                    hostSocketId
                ) {

                    return;

                }


                await resetGame(
                    "legacy resetGame event"
                );

            }
        );


        // =================================================
        // HOST LEFT GAME
        // =================================================

        socket.on(
            "hostLeftGame",
            () => {

                if (
                    socket.id !==
                    hostSocketId
                ) {

                    return;

                }


                console.log(
                    "========== HOST LEFT GAME =========="
                );


                startHostReconnectGrace(
                    socket.id
                );

            }
        );


        // =================================================
        // DIGITAL CLAIM WIN
        // =================================================

        socket.on(
            "claimWin",
            data => {

                if (
                    !data
                ) {

                    return;

                }


                const cardId =
                    Number(
                        data.cardId
                    );


                if (
                    !Number.isInteger(
                        cardId
                    ) ||
                    cardId <= 0
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
                    gameState.approvedWinnersCount >=
                    gameState.maxWinners
                ) {

                    return;

                }


                const claim = {

                    cardId:
                        cardId,

                    markedIndices:
                        Array.isArray(
                            data.markedIndices
                        )
                            ? [
                                ...data.markedIndices
                            ]
                            : [],

                    winningPattern:
                        Array.isArray(
                            data.winningPattern
                        )
                            ? [
                                ...data.winningPattern
                            ]
                            : [],

                    timestamp:
                        data.timestamp ||
                        Date.now(),

                    playerSocketId:
                        socket.id

                };


                pendingClaims.set(
                    cardId,
                    claim
                );


                io.emit(
                    "winRequested",
                    {

                        cardId:
                            claim.cardId,

                        markedIndices:
                            claim.markedIndices,

                        winningPattern:
                            claim.winningPattern,

                        timestamp:
                            claim.timestamp

                    }
                );

            }
        );


        // =================================================
        // APPROVE DIGITAL WIN
        // =================================================

        socket.on(
            "approveWin",
            async cardId => {

                if (
                    socket.id !==
                    hostSocketId
                ) {

                    return;

                }


                const id =
                    Number(
                        cardId
                    );


                if (
                    !Number.isInteger(
                        id
                    ) ||
                    id <= 0
                ) {

                    return;

                }


                const pendingClaim =
                    pendingClaims.get(
                        id
                    );


                if (
                    !pendingClaim
                ) {

                    return;

                }


                if (
                    gameState.approvedWinnersList.includes(
                        id
                    )
                ) {

                    pendingClaims.delete(
                        id
                    );

                    return;

                }


                if (
                    gameState.approvedWinnersCount >=
                    gameState.maxWinners
                ) {

                    pendingClaims.delete(
                        id
                    );

                    return;

                }


                pendingClaims.delete(
                    id
                );


                gameState.approvedWinnersList.push(
                    id
                );

                gameState.approvedWinnersCount++;


                io.emit(
                    "winApproved",
                    {
                        cardId:
                            id
                    }
                );


                if (
                    gameState.approvedWinnersCount >=
                    gameState.maxWinners
                ) {

                    gameState.status =
                        "ended";


                    gameState.timerEndsAt =
                        null;


                    if (
                        timer
                    ) {

                        clearInterval(
                            timer
                        );

                        timer =
                            null;

                    }


                    pendingClaims.clear();


                    io.emit(
                        "gameEnded",
                        {
                            reason:
                                "winner limit reached"
                        }
                    );

                }


                await saveGameState();


                io.emit(
                    "gameState",
                    gameState
                );

            }
        );


        // =================================================
        // REJECT DIGITAL WIN
        // =================================================

        socket.on(
            "rejectWin",
            cardId => {

                if (
                    socket.id !==
                    hostSocketId
                ) {

                    return;

                }


                const id =
                    Number(
                        cardId
                    );


                if (
                    !Number.isInteger(
                        id
                    ) ||
                    id <= 0
                ) {

                    return;

                }


                const pendingClaim =
                    pendingClaims.get(
                        id
                    );


                const winningPattern =
                    pendingClaim &&
                    Array.isArray(
                        pendingClaim.winningPattern
                    )
                        ? [
                            ...pendingClaim.winningPattern
                        ]
                        : [];


                pendingClaims.delete(
                    id
                );


                io.emit(
                    "winRejected",
                    {

                        cardId:
                            id,

                        winningPattern:
                            winningPattern

                    }
                );

            }
        );


        // =================================================
        // APPROVE PHYSICAL WIN
        // =================================================

        socket.on(
            "approvePhysicalWin",
            async data => {

                if (
                    socket.id !==
                    hostSocketId
                ) {

                    return;

                }


                if (
                    !data
                ) {

                    return;

                }


                const id =
                    Number(
                        data.cardId
                    );


                if (
                    !Number.isInteger(
                        id
                    ) ||
                    id <= 0
                ) {

                    return;

                }


                if (
                    gameState.approvedWinnersList.includes(
                        id
                    )
                ) {

                    return;

                }


                if (
                    gameState.approvedWinnersCount >=
                    gameState.maxWinners
                ) {

                    return;

                }


                gameState.approvedWinnersList.push(
                    id
                );

                gameState.approvedWinnersCount++;


                io.emit(
                    "physicalWinApproved",
                    {

                        cardId:
                            id,

                        winnerCount:
                            gameState.approvedWinnersCount

                    }
                );


                if (
                    gameState.approvedWinnersCount >=
                    gameState.maxWinners
                ) {

                    gameState.status =
                        "ended";


                    gameState.timerEndsAt =
                        null;


                    if (
                        timer
                    ) {

                        clearInterval(
                            timer
                        );

                        timer =
                            null;

                    }


                    pendingClaims.clear();


                    io.emit(
                        "gameEnded",
                        {
                            reason:
                                "winner limit reached"
                        }
                    );

                }


                await saveGameState();


                io.emit(
                    "gameState",
                    gameState
                );

            }
        );


        // =================================================
        // REJECT PHYSICAL WIN
        // =================================================

        socket.on(
            "rejectPhysicalWin",
            data => {

                if (
                    socket.id !==
                    hostSocketId
                ) {

                    return;

                }


                if (
                    !data
                ) {

                    return;

                }


                const cardId =
                    Number(
                        data.cardId
                    );


                if (
                    !Number.isInteger(
                        cardId
                    ) ||
                    cardId <= 0
                ) {

                    return;

                }


                io.emit(
                    "physicalWinRejected",
                    {
                        cardId:
                            cardId
                    }
                );

            }
        );


        // =================================================
        // LOAD PLAYER CARD
        // =================================================

        socket.on(
            "loadCard",
            cardId => {

                const id =
                    Number(
                        cardId
                    );


                if (
                    !Number.isInteger(id) ||
                    id <= 0
                ) {

                    return;

                }


                socket.emit(
                    "cardLoaded",
                    {
                        cardId:
                            id
                    }
                );

            }
        );


        // =================================================
        // PLAYER MARK CARD
        // =================================================

        socket.on(
            "markCard",
            data => {

                if (
                    !data
                ) {

                    return;

                }


                const cardId =
                    Number(
                        data.id
                    );

                const index =
                    Number(
                        data.index
                    );

                const marked =
                    data.marked ===
                    true;


                if (
                    !Number.isInteger(
                        cardId
                    ) ||
                    cardId <= 0
                ) {

                    return;

                }


                if (
                    !Number.isInteger(
                        index
                    ) ||
                    index < 0 ||
                    index > 24
                ) {

                    return;

                }


                console.log(
                    "CARD MARK:",
                    {
                        cardId:
                            cardId,

                        index:
                            index,

                        marked:
                            marked,

                        socketId:
                            socket.id
                    }
                );

            }
        );


        // =================================================
        // GAME STATE SYNC FALLBACK
        // =================================================

        socket.on(
            "requestGameStateSyncFallback",
            () => {

                socket.emit(
                    "gameState",
                    gameState
                );

            }
        );


        // =================================================
        // DISCONNECT
        // =================================================

        socket.on(
            "disconnect",
            () => {

                console.log(
                    "DISCONNECTED:",
                    socket.id
                );


                // -------------------------------------------------
                // REMOVE DISCONNECTED PLAYER CLAIMS
                // -------------------------------------------------

                for (
                    const [
                        cardId,
                        claim
                    ]
                    of pendingClaims.entries()
                ) {

                    if (
                        claim.playerSocketId ===
                        socket.id
                    ) {

                        pendingClaims.delete(
                            cardId
                        );

                    }

                }


                // -------------------------------------------------
                // HOST DISCONNECT
                // -------------------------------------------------

                if (
                    socket.id ===
                    hostSocketId
                ) {

                    console.log(
                        "========== HOST CLOSED/DISCONNECTED =========="
                    );


                    startHostReconnectGrace(
                        socket.id
                    );

                }

            }
        );

    }
);


// =====================================================
// SERVER STARTUP
// =====================================================

const PORT =
    process.env.PORT ||
    3000;


async function startServer() {

    try {

        // -------------------------------------------------
        // Make sure persistent game table exists.
        // -------------------------------------------------

        await ensureGameStateTable();


        // -------------------------------------------------
        // Load questions first.
        // -------------------------------------------------

        await loadQuestionsFromDatabase();


        // -------------------------------------------------
        // Restore game saved before a crash/restart.
        // -------------------------------------------------

        await loadSavedGameState();


        // -------------------------------------------------
        // Start HTTP / Socket.IO server.
        // -------------------------------------------------

        server.listen(
            PORT,
            "0.0.0.0",
            () => {

                console.log(
                    `Safety Bingo running on port ${PORT}`
                );


                // =================================================
                // RESUME ACTIVE GAME
                // =================================================

                if (
                    gameState.status ===
                    "running"
                ) {

                    console.log(
                        "=========================================="
                    );

                    console.log(
                        "RECOVERED GAME IS ACTIVE"
                    );

                    console.log(
                        "POSITION:",
                        gamePosition
                    );

                    console.log(
                        "QUESTION:",
                        gameState.currentQuestionID
                    );

                    console.log(
                        "=========================================="
                    );


                    // -------------------------------------------------
                    // PAUSED GAME
                    // -------------------------------------------------

                    if (
                        gameState.isPaused
                    ) {

                        console.log(
                            "RECOVERED GAME IS PAUSED"
                        );


                        io.emit(
                            "timerUpdate",
                            countdown
                        );


                        return;

                    }


                    // -------------------------------------------------
                    // NO TIMER
                    // -------------------------------------------------

                    if (
                        gameState.noTimer
                    ) {

                        countdown =
                            0;


                        io.emit(
                            "timerUpdate",
                            0
                        );


                        return;

                    }


                    // -------------------------------------------------
                    // TIMER GAME
                    // -------------------------------------------------

                    if (
                        gameState.timerEndsAt
                    ) {

                        countdown =
                            Math.max(
                                0,
                                Math.ceil(
                                    (
                                        Number(
                                            gameState.timerEndsAt
                                        ) -
                                        Date.now()
                                    ) / 1000
                                )
                            );


                        console.log(
                            "RECOVERED TIMER:",
                            countdown
                        );


                        if (
                            countdown <= 0
                        ) {

                            console.log(
                                "RECOVERED TIMER ALREADY EXPIRED"
                            );


                            // Advance to next question.
                            sendNextQuestion();

                        } else {

                            io.emit(
                                "timerUpdate",
                                countdown
                            );


                            startTimer();

                        }

                    }

                }

            }
        );

    } catch (error) {

        console.error(
            "SERVER STARTUP FAILED:",
            error
        );

        process.exit(
            1
        );

    }

}


startServer();
