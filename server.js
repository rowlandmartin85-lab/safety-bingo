"use strict";

// =====================================================
// SAFETY BINGO SERVER
// FULL CONSOLIDATED SERVER.JS
// =====================================================

require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");

const {
    pool,
    initializeDatabase
} = require("./database");

initializeDatabase();

if (
    process.env.MIGRATE_QUESTIONS ===
    "true"
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

/*
=======================================================
SERVE PROJECT ROOT FILES
=======================================================
*/

app.use(
    express.static(
        __dirname
    )
);


/*
=======================================================
SERVE PUBLIC DIRECTORY
=======================================================
*/

app.use(
    express.static(
        path.join(
            __dirname,
            "public"
        )
    )
);


/*
=======================================================
EXPLICIT STYLE.CSS ROUTE

This prevents the browser from receiving HTML
when it requests /style.css.

The browser requires:
Content-Type: text/css
=======================================================
*/

app.get(
    "/style.css",
    (req, res) => {

        const cssPath =
            path.join(
                __dirname,
                "style.css"
            );


        console.log(
            "STYLE.CSS REQUEST:",
            cssPath
        );


        if (
            !fs.existsSync(
                cssPath
            )
        ) {

            console.error(
                "STYLE.CSS NOT FOUND:",
                cssPath
            );


            /*
            ------------------------------------------------
            If style.css is inside public instead,
            check that location too.
            ------------------------------------------------
            */

            const publicCssPath =
                path.join(
                    __dirname,
                    "public",
                    "style.css"
                );


            if (
                fs.existsSync(
                    publicCssPath
                )
            ) {

                console.log(
                    "STYLE.CSS FOUND IN PUBLIC:",
                    publicCssPath
                );


                return res
                    .status(200)
                    .type("text/css")
                    .sendFile(
                        publicCssPath
                    );

            }


            return res
                .status(404)
                .type("text/plain")
                .send(
                    "style.css not found"
                );

        }


        res
            .status(200)
            .type("text/css")
            .sendFile(
                cssPath
            );

    }
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
                (id, category, difficulty, question, answer)
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
            () => {

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


                resetGame(
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

function resetGame(
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
        normalizedIds.length ===
        0
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

function sendNextQuestion() {

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

        gameState.isPaused =
            false;

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


    // -------------------------------------------------
    // TIMER
    // -------------------------------------------------

    if (
        !gameState.noTimer
    ) {

        countdown =
            gameState.timerSeconds;

        io.emit(
            "timerUpdate",
            countdown
        );

        startTimer();

    } else {

        countdown =
            0;

        io.emit(
            "timerUpdate",
            0
        );

    }

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
            () => {

                if (
                    gameState.isPaused
                ) {

                    return;

                }


                countdown--;


                io.emit(
                    "timerUpdate",
                    countdown
                );


                if (
                    countdown <=
                    0
                ) {

                    sendNextQuestion();

                }

            },
            1000
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


                    return;

                }


                // =================================================
                // DIFFERENT HOST TAKING OVER
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


                    resetGame(
                        "new host connected"
                    );


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


                    sendNextQuestion();

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


                sendNextQuestion();

            }
        );


        // =================================================
        // PREVIOUS QUESTION
        // =================================================

        socket.on(
            "hostPrevious",
            () => {

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

                    io.emit(
                        "timerUpdate",
                        countdown
                    );

                    startTimer();

                } else {

                    countdown =
                        0;

                    io.emit(
                        "timerUpdate",
                        0
                    );

                }


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


                gameState.isPaused =
                    !gameState.isPaused;


                console.log(
                    "PAUSE:",
                    gameState.isPaused
                );


                if (
                    gameState.isPaused
                ) {

                    if (
                        timer
                    ) {

                        clearInterval(
                            timer
                        );

                        timer =
                            null;

                    }

                } else if (
                    !gameState.noTimer
                ) {

                    countdown =
                        Math.max(
                            countdown,
                            1
                        );

                    startTimer();

                }


                io.emit(
                    "gameState",
                    gameState
                );

            }
        );


        // =================================================
        // HOST RESET BUTTON
        // =================================================

        socket.on(
            "hostReset",
            () => {

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


                resetGame(
                    "host reset button"
                );

            }
        );


        // =================================================
        // LEGACY RESET EVENT
        // =================================================

        socket.on(
            "resetGame",
            () => {

                if (
                    socket.id !==
                    hostSocketId
                ) {

                    return;

                }


                resetGame(
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


loadQuestionsFromDatabase()
    .then(
        () => {

            server.listen(
                PORT,
                "0.0.0.0",
                () => {

                    console.log(
                        `Safety Bingo running on port ${PORT}`
                    );

                    console.log(
                        "SERVER DIRECTORY:",
                        __dirname
                    );

                    console.log(
                        "ROOT STYLE.CSS:",
                        fs.existsSync(
                            path.join(
                                __dirname,
                                "style.css"
                            )
                        )
                    );

                    console.log(
                        "PUBLIC STYLE.CSS:",
                        fs.existsSync(
                            path.join(
                                __dirname,
                                "public",
                                "style.css"
                            )
                        );

                    );

                }
            );

        }
    )
    .catch(
        error => {

            console.error(
                "SERVER STARTUP FAILED:",
                error
            );

            process.exit(
                1
            );

        }
    );
