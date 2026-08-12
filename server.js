```javascript
/*
=====================================================
SAFETY BINGO SERVER
=====================================================
*/

"use strict";

require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const {
    pool,
    initializeDatabase
} = require("./database");


/*
=====================================================
DATABASE STARTUP
=====================================================
*/

initializeDatabase();

if (
    process.env.MIGRATE_QUESTIONS === "true"
) {

    require("./migrateQuestions");

}


/*
=====================================================
EXPRESS
=====================================================
*/

const app = express();

app.use(
    express.json()
);


/*
=====================================================
HTTP SERVER
=====================================================
*/

const server =
    http.createServer(app);


/*
=====================================================
SOCKET.IO
=====================================================
*/

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


/*
=====================================================
STATIC FILES
=====================================================
*/

app.use(
    express.static(__dirname)
);

app.use(
    express.static(
        path.join(
            __dirname,
            "public"
        )
    )
);


/*
=====================================================
PUBLIC WEBSITE URL
=====================================================

This is the public Render address for the game.

QR codes and claim links should use this URL.
=====================================================
*/

const PUBLIC_URL =
    (
        process.env.PUBLIC_URL ||
        "https://safety-bingo.onrender.com"
    ).replace(
        /\/$/,
        ""
    );


console.log(
    "PUBLIC GAME URL:",
    PUBLIC_URL
);


/*
=====================================================
QUESTION BANK
=====================================================
*/

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
                        item.id,

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


/*
=====================================================
PAGE ROUTES
=====================================================
*/

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
    "/index.html",
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


/*
=====================================================
HEALTH CHECK
=====================================================
*/

app.get(
    "/health",
    (req, res) => {

        res.json({
            success: true,
            status: "online",
            service: "Safety Bingo",
            publicUrl: PUBLIC_URL
        });

    }
);


/*
=====================================================
PHYSICAL CLAIM URL INFORMATION
=====================================================

Useful for testing.

Example:

/physical-claim?card=25
=====================================================
*/

app.get(
    "/physical-claim-info",
    (req, res) => {

        const cardId =
            Number(
                req.query.card
            );


        if (
            !Number.isInteger(cardId) ||
            cardId <= 0
        ) {

            return res.status(400).json({
                success: false,
                error: "Invalid card ID"
            });

        }


        const claimUrl =
            `${PUBLIC_URL}/physical-claim?card=${encodeURIComponent(cardId)}`;


        res.json({
            success: true,
            cardId: cardId,
            claimUrl: claimUrl
        });

    }
);


/*
=====================================================
QUESTION API
=====================================================
*/

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


            res.status(500).json({
                success: false,
                error:
                    error.message
            });

        }

    }
);


/*
=====================================================
ADD QUESTION
=====================================================
*/

app.post(
    "/api/questions/add",
    async (req, res) => {

        const newQuestion =
            req.body || {};


        if (
            !newQuestion.q ||
            !newQuestion.a
        ) {

            return res.status(400).json({
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


            await pool.query(
                `
                    INSERT INTO questions
                    (
                        id,
                        category,
                        difficulty,
                        question,
                        answer
                    )
                    VALUES
                    (
                        $1,
                        $2,
                        $3,
                        $4,
                        $5
                    )
                `,
                [
                    nextID,

                    newQuestion.category ||
                        "General",

                    newQuestion.difficulty ||
                        "Medium",

                    newQuestion.q,

                    newQuestion.a
                ]
            );


            await loadQuestionsFromDatabase();


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


            res.status(500).json({
                success: false,
                error:
                    error.message
            });

        }

    }
);


/*
=====================================================
DELETE QUESTION
=====================================================
*/

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

            return res.status(400).json({
                success: false,
                error:
                    "Invalid question ID"
            });

        }


        try {

            const result =
                await pool.query(
                    `
                        DELETE FROM questions
                        WHERE id=$1
                    `,
                    [
                        id
                    ]
                );


            if (
                result.rowCount === 0
            ) {

                return res.status(404).json({
                    success: false,
                    error:
                        "Question not found"
                });

            }


            await loadQuestionsFromDatabase();


            res.json({
                success: true
            });


        } catch (error) {

            console.error(
                "DELETE QUESTION ERROR:",
                error
            );


            res.status(500).json({
                success: false,
                error:
                    error.message
            });

        }

    }
);


/*
=====================================================
GAME STATE
=====================================================
*/

let gameState =
    createInitialGameState();


function createInitialGameState() {

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
            [],

        selectedQuestionIds:
            []

    };

}


/*
=====================================================
SERVER VARIABLES
=====================================================
*/

let timer =
    null;

let countdown =
    30;

let gamePosition =
    -1;


/*
=====================================================
CLAIM STORAGE
=====================================================
*/

const pendingClaims =
    new Map();

const pendingPhysicalClaims =
    new Map();


/*
=====================================================
HOST TRACKING
=====================================================
*/

let hostSocketId =
    null;

let hostDisconnectTimer =
    null;

const HOST_RECONNECT_GRACE_PERIOD =
    5000;


/*
=====================================================
STOP TIMER
=====================================================
*/

function stopTimer() {

    if (timer) {

        clearInterval(
            timer
        );

        timer =
            null;

    }

}


/*
=====================================================
RESET GAME
=====================================================
*/

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


    stopTimer();


    countdown =
        30;


    pendingClaims.clear();


    pendingPhysicalClaims.clear();


    gameState =
        createInitialGameState();


    gamePosition =
        -1;


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
        "GAME RESET COMPLETE"
    );

}


/*
=====================================================
BUILD GAME ORDER
=====================================================
*/

function buildGameOrder() {

    gameState.gameOrder =
        [];


    const selectedIds =
        Array.isArray(
            gameState.selectedQuestionIds
        )
            ? gameState.selectedQuestionIds
            : [];


    /*
    -----------------------------------------------
    SELECTED QUESTIONS
    -----------------------------------------------
    */

    if (
        selectedIds.length > 0
    ) {

        for (
            const id
            of selectedIds
        ) {

            const index =
                safetyQuestionBank.findIndex(
                    question =>
                        Number(
                            question.id
                        ) ===
                        Number(id)
                );


            if (
                index >= 0
            ) {

                gameState.gameOrder.push(
                    index
                );

            }

        }

    }


    /*
    -----------------------------------------------
    FALLBACK TO ALL QUESTIONS
    -----------------------------------------------
    */

    if (
        gameState.gameOrder.length === 0
    ) {

        for (
            let i = 0;
            i < safetyQuestionBank.length;
            i++
        ) {

            gameState.gameOrder.push(
                i
            );

        }

    }


    /*
    -----------------------------------------------
    SHUFFLE
    -----------------------------------------------
    */

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
        "GAME ORDER:",
        gameState.gameOrder
    );

}


/*
=====================================================
SEND QUESTION AT POSITION
=====================================================
*/

function sendQuestionAtPosition(
    position
) {

    stopTimer();


    if (
        position < 0 ||
        position >=
            gameState.gameOrder.length
    ) {

        return false;

    }


    gamePosition =
        position;


    const index =
        gameState.gameOrder[
            gamePosition
        ];


    const question =
        safetyQuestionBank[
            index
        ];


    if (!question) {

        console.error(
            "QUESTION NOT FOUND:",
            index
        );

        return false;

    }


    gameState.currentQuestionIndex =
        index;


    if (
        !gameState.askedIndices.includes(
            index
        )
    ) {

        gameState.askedIndices.push(
            index
        );

    }


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
            item =>
                Number(item.id) ===
                Number(question.id)
        ) + 1;


    gameState.isPaused =
        false;


    if (
        !gameState.calledAnswers.includes(
            question.a
        )
    ) {

        gameState.calledAnswers.push(
            question.a
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
        gameState
    );


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

        io.emit(
            "timerUpdate",
            0
        );

    }


    return true;

}


/*
=====================================================
SEND NEXT QUESTION
=====================================================
*/

function sendNextQuestion() {

    const nextPosition =
        gamePosition + 1;


    if (
        nextPosition >=
        gameState.gameOrder.length
    ) {

        stopTimer();


        gameState.status =
            "ended";


        gameState.currentQuestion =
            "";


        gameState.currentAnswer =
            "";


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


    sendQuestionAtPosition(
        nextPosition
    );

}


/*
=====================================================
START TIMER
=====================================================
*/

function startTimer() {

    stopTimer();


    timer =
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


                countdown--;


                io.emit(
                    "timerUpdate",
                    countdown
                );


                if (
                    countdown <= 0
                ) {

                    sendNextQuestion();

                }

            },
            1000
        );

}


/*
=====================================================
PHYSICAL CLAIM PAGE
=====================================================
*/

app.get(
    "/physical-claim",
    (req, res) => {

        const cardId =
            Number(
                req.query.card
            );


        /*
        ---------------------------------------------
        VALID CARD
        ---------------------------------------------
        */

        if (
            !Number.isInteger(cardId) ||
            cardId <= 0
        ) {

            return res.status(400).send(`
                <!DOCTYPE html>

                <html>

                <head>

                    <meta
                        name="viewport"
                        content="width=device-width,initial-scale=1"
                    >

                    <title>
                        Safety Bingo
                    </title>

                </head>

                <body style="
                    margin:0;
                    min-height:100vh;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    background:#050914;
                    color:white;
                    font-family:Arial,sans-serif;
                    text-align:center;
                ">

                    <div style="
                        width:90%;
                        max-width:500px;
                        padding:35px;
                        background:#111827;
                        border:2px solid #ef4444;
                        border-radius:20px;
                    ">

                        <h1 style="
                            color:#FFD700;
                        ">
                            INVALID BINGO CARD
                        </h1>

                        <p>
                            The Bingo card number is invalid.
                        </p>

                    </div>

                </body>

                </html>
            `);

        }


        /*
        ---------------------------------------------
        HOST CHECK
        ---------------------------------------------
        */

        if (
            !hostSocketId
        ) {

            return res.status(503).send(`
                <!DOCTYPE html>

                <html>

                <head>

                    <meta
                        name="viewport"
                        content="width=device-width,initial-scale=1"
                    >

                    <title>
                        Safety Bingo
                    </title>

                </head>

                <body style="
                    margin:0;
                    min-height:100vh;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    background:#050914;
                    color:white;
                    font-family:Arial,sans-serif;
                    text-align:center;
                ">

                    <div style="
                        width:90%;
                        max-width:500px;
                        padding:35px;
                        background:#111827;
                        border:2px solid #ef4444;
                        border-radius:20px;
                    ">

                        <h1 style="
                            color:#FFD700;
                        ">
                            HOST NOT AVAILABLE
                        </h1>

                        <p>
                            The Bingo host is not currently connected.
                        </p>

                        <p>
                            Please wait for the host to start the game.
                        </p>

                    </div>

                </body>

                </html>
            `);

        }


        /*
        ---------------------------------------------
        GAME CHECK
        ---------------------------------------------
        */

        if (
            gameState.status !==
            "running"
        ) {

            return res.status(409).send(`
                <!DOCTYPE html>

                <html>

                <head>

                    <meta
                        name="viewport"
                        content="width=device-width,initial-scale=1"
                    >

                    <title>
                        Safety Bingo
                    </title>

                </head>

                <body style="
                    margin:0;
                    min-height:100vh;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    background:#050914;
                    color:white;
                    font-family:Arial,sans-serif;
                    text-align:center;
                ">

                    <div style="
                        width:90%;
                        max-width:500px;
                        padding:35px;
                        background:#111827;
                        border:2px solid #FFD700;
                        border-radius:20px;
                    ">

                        <h1 style="
                            color:#FFD700;
                        ">
                            GAME NOT ACTIVE
                        </h1>

                        <p>
                            There is no active Safety Bingo game.
                        </p>

                    </div>

                </body>

                </html>
            `);

        }


        /*
        ---------------------------------------------
        EXISTING CLAIM
        ---------------------------------------------
        */

        const existing =
            pendingPhysicalClaims.get(
                cardId
            );


        if (
            existing &&
            existing.status === "pending"
        ) {

            return res.send(`
                <!DOCTYPE html>

                <html>

                <head>

                    <meta
                        name="viewport"
                        content="width=device-width,initial-scale=1"
                    >

                    <title>
                        Safety Bingo
                    </title>

                </head>

                <body style="
                    margin:0;
                    min-height:100vh;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    background:#050914;
                    color:white;
                    font-family:Arial,sans-serif;
                    text-align:center;
                ">

                    <div style="
                        width:90%;
                        max-width:500px;
                        padding:35px;
                        background:#111827;
                        border:2px solid #FFD700;
                        border-radius:20px;
                    ">

                        <h1 style="
                            color:#FFD700;
                        ">
                            CLAIM ALREADY SENT
                        </h1>

                        <h2>
                            CARD #${cardId}
                        </h2>

                        <p>
                            Your Bingo claim is already
                            waiting for the host.
                        </p>

                    </div>

                </body>

                </html>
            `);

        }


        /*
        ---------------------------------------------
        CREATE CLAIM
        ---------------------------------------------
        */

        const claim = {

            cardId:
                cardId,

            timestamp:
                Date.now(),

            status:
                "pending"

        };


        pendingPhysicalClaims.set(
            cardId,
            claim
        );


        /*
        ---------------------------------------------
        SEND CLAIM TO HOST
        ---------------------------------------------
        */

        io.to(
            hostSocketId
        ).emit(
            "physicalWinRequested",
            {
                cardId:
                    cardId,

                timestamp:
                    claim.timestamp
            }
        );


        /*
        ---------------------------------------------
        SEND MOBILE RESULT PAGE
        ---------------------------------------------
        */

        return res.send(`
            <!DOCTYPE html>

            <html>

            <head>

                <meta
                    name="viewport"
                    content="width=device-width,initial-scale=1"
                >

                <meta
                    name="theme-color"
                    content="#050914"
                >

                <title>
                    Safety Bingo
                </title>

            </head>

            <body style="
                margin:0;
                min-height:100vh;
                display:flex;
                align-items:center;
                justify-content:center;
                background:#050914;
                color:white;
                font-family:Arial,sans-serif;
                text-align:center;
            ">

                <div style="
                    width:90%;
                    max-width:500px;
                    padding:35px;
                    background:#111827;
                    border:2px solid #22c55e;
                    border-radius:20px;
                    box-shadow:0 20px 50px rgba(0,0,0,.5);
                ">

                    <div style="
                        font-size:60px;
                        color:#22c55e;
                        margin-bottom:10px;
                    ">
                        ✓
                    </div>

                    <h1 style="
                        color:#FFD700;
                    ">
                        BINGO CLAIM SENT
                    </h1>

                    <h2>
                        CARD #${cardId}
                    </h2>

                    <p>
                        Your Bingo claim has been
                        sent to the host.
                    </p>

                    <p style="
                        color:#22c55e;
                        font-weight:bold;
                    ">
                        Please wait while your
                        physical card is checked.
                    </p>

                </div>

            </body>

            </html>
        `);

    }
);


/*
=====================================================
SOCKET CONNECTION
=====================================================
*/

io.on(
    "connection",
    socket => {

        console.log(
            "CONNECTED:",
            socket.id
        );


        /*
        =============================================
        SEND CURRENT GAME STATE
        =============================================
        */

        socket.emit(
            "gameState",
            gameState
        );


        /*
        =============================================
        SEND PREVIOUS QUESTIONS
        =============================================
        */

        for (
            const index
            of gameState.askedIndices
        ) {

            const question =
                safetyQuestionBank[
                    index
                ];


            if (!question) {
                continue;
            }


            socket.emit(
                "cheatSheetQuestion",
                {
                    number:
                        safetyQuestionBank.findIndex(
                            item =>
                                Number(item.id) ===
                                Number(question.id)
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


        /*
        =============================================
        REGISTER HOST
        =============================================
        */

        socket.on(
            "registerHost",
            () => {

                console.log(
                    "HOST REGISTER REQUEST:",
                    socket.id
                );


                if (
                    hostDisconnectTimer
                ) {

                    clearTimeout(
                        hostDisconnectTimer
                    );

                    hostDisconnectTimer =
                        null;

                }


                if (
                    hostSocketId &&
                    hostSocketId !==
                    socket.id
                ) {

                    console.warn(
                        "HOST REGISTRATION REJECTED:",
                        socket.id,
                        "CURRENT HOST:",
                        hostSocketId
                    );


                    socket.emit(
                        "hostRegistrationRejected",
                        {
                            reason:
                                "Another host is already connected."
                        }
                    );


                    return;

                }


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

            }
        );


        /*
        =============================================
        SET TIMER
        =============================================
        */

        socket.on(
            "setTimerSettings",
            data => {

                if (
                    socket.id !==
                    hostSocketId
                ) {
                    return;
                }


                if (!data) {
                    return;
                }


                const seconds =
                    Number(
                        data.seconds
                    );


                gameState.timerSeconds =
                    Number.isFinite(
                        seconds
                    ) &&
                    seconds > 0
                        ? seconds
                        : 30;


                gameState.noTimer =
                    data.noTimer === true;


                io.emit(
                    "gameState",
                    gameState
                );

            }
        );


        /*
        =============================================
        SET WINNER LIMIT
        =============================================
        */

        socket.on(
            "setWinnerSettings",
            data => {

                if (
                    socket.id !==
                    hostSocketId
                ) {
                    return;
                }


                if (!data) {
                    return;
                }


                const maxWinners =
                    Number(
                        data.maxWinners
                    );


                gameState.maxWinners =
                    Number.isInteger(
                        maxWinners
                    ) &&
                    maxWinners > 0
                        ? maxWinners
                        : 1;


                io.emit(
                    "gameState",
                    gameState
                );

            }
        );


        /*
        =============================================
        START GAME
        =============================================
        */

        socket.on(
            "hostStart",
            async data => {

                if (
                    socket.id !==
                    hostSocketId
                ) {

                    socket.emit(
                        "gameStartError",
                        {
                            error:
                                "This socket is not the registered host."
                        }
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


                    if (
                        safetyQuestionBank.length ===
                        0
                    ) {

                        throw new Error(
                            "No questions are available."
                        );

                    }


                    stopTimer();


                    pendingClaims.clear();


                    pendingPhysicalClaims.clear();


                    /*
                    ---------------------------------
                    SAVE SETTINGS BEFORE RESET
                    ---------------------------------
                    */

                    const previousTimerSeconds =
                        gameState.timerSeconds;


                    const previousNoTimer =
                        gameState.noTimer;


                    const previousMaxWinners =
                        gameState.maxWinners;


                    /*
                    ---------------------------------
                    CREATE NEW GAME STATE
                    ---------------------------------
                    */

                    gameState =
                        createInitialGameState();


                    gameState.status =
                        "running";


                    /*
                    ---------------------------------
                    RESTORE SETTINGS
                    ---------------------------------
                    */

                    gameState.timerSeconds =
                        Number.isFinite(
                            Number(
                                data &&
                                data.timerSeconds
                            )
                        ) &&
                        Number(
                            data.timerSeconds
                        ) > 0
                            ? Number(
                                data.timerSeconds
                            )
                            : previousTimerSeconds;


                    gameState.noTimer =
                        data &&
                        typeof data.noTimer === "boolean"
                            ? data.noTimer
                            : previousNoTimer;


                    gameState.maxWinners =
                        Number.isInteger(
                            Number(
                                data &&
                                data.maxWinners
                            )
                        ) &&
                        Number(
                            data &&
                            data.maxWinners
                        ) > 0
                            ? Number(
                                data.maxWinners
                            )
                            : previousMaxWinners;


                    /*
                    ---------------------------------
                    SELECTED QUESTIONS
                    ---------------------------------
                    */

                    const selectedIds =
                        data &&
                        Array.isArray(
                            data.selectedQuestionIds
                        )
                            ? data.selectedQuestionIds
                                .map(Number)
                                .filter(
                                    id =>
                                        Number.isInteger(id) &&
                                        id > 0
                                )
                            : [];


                    gameState.selectedQuestionIds =
                        [
                            ...new Set(
                                selectedIds
                            )
                        ];


                    /*
                    ---------------------------------
                    BUILD GAME
                    ---------------------------------
                    */

                    buildGameOrder();


                    gamePosition =
                        -1;


                    /*
                    ---------------------------------
                    START FIRST QUESTION
                    ---------------------------------
                    */

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
                                error.message ||
                                "Unable to start game."
                        }
                    );

                }

            }
        );


        /*
        =============================================
        NEXT QUESTION
        =============================================
        */

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


        /*
        =============================================
        PREVIOUS QUESTION
        =============================================
        */

        socket.on(
            "hostPrevious",
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


                if (
                    gamePosition <= 0
                ) {
                    return;
                }


                sendQuestionAtPosition(
                    gamePosition - 1
                );

            }
        );


        /*
        =============================================
        REPEAT
        =============================================
        */

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


        /*
        =============================================
        PAUSE / PLAY
        =============================================
        */

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


                if (
                    gameState.isPaused
                ) {

                    stopTimer();

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


        /*
        =============================================
        RESET
        =============================================
        */

        socket.on(
            "hostReset",
            () => {

                if (
                    socket.id !==
                    hostSocketId
                ) {
                    return;
                }


                resetGame(
                    "host reset button"
                );

            }
        );


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
                    "resetGame event"
                );

            }
        );


        /*
        =============================================
        HOST LEFT GAME
        =============================================
        */

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
                    "HOST LEFT GAME:",
                    socket.id
                );


                hostSocketId =
                    null;


                if (
                    hostDisconnectTimer
                ) {

                    clearTimeout(
                        hostDisconnectTimer
                    );

                    hostDisconnectTimer =
                        null;

                }


                resetGame(
                    "hostLeftGame"
                );

            }
        );


        /*
        =============================================
        DIGITAL CLAIM
        =============================================
        */

        socket.on(
            "claimWin",
            data => {

                if (!data) {
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


                const cardId =
                    Number(
                        data.cardId
                    );


                if (
                    !Number.isInteger(cardId) ||
                    cardId <= 0
                ) {
                    return;
                }


                if (
                    pendingClaims.has(
                        cardId
                    )
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


                if (
                    hostSocketId
                ) {

                    io.to(
                        hostSocketId
                    ).emit(
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

            }
        );


        /*
        =============================================
        APPROVE DIGITAL WIN
        =============================================
        */

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
                    !Number.isInteger(id) ||
                    id <= 0
                ) {
                    return;
                }


                const claim =
                    pendingClaims.get(
                        id
                    );


                if (!claim) {
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


                if (
                    !gameState.approvedWinnersList.includes(
                        id
                    )
                ) {

                    gameState.approvedWinnersList.push(
                        id
                    );

                    gameState.approvedWinnersCount++;

                }


                io.emit(
                    "winApproved",
                    {
                        cardId:
                            id
                    }
                );


                checkWinnerLimit();

            }
        );


        /*
        =============================================
        REJECT DIGITAL WIN
        =============================================
        */

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
                    !Number.isInteger(id)
                ) {
                    return;
                }


                const claim =
                    pendingClaims.get(
                        id
                    );


                pendingClaims.delete(
                    id
                );


                io.emit(
                    "winRejected",
                    {
                        cardId:
                            id,

                        winningPattern:
                            claim &&
                            Array.isArray(
                                claim.winningPattern
                            )
                                ? claim.winningPattern
                                : []
                    }
                );

            }
        );


        /*
        =============================================
        APPROVE PHYSICAL WIN
        =============================================
        */

        socket.on(
            "approvePhysicalWin",
            data => {

                if (
                    socket.id !==
                    hostSocketId
                ) {
                    return;
                }


                if (!data) {
                    return;
                }


                const id =
                    Number(
                        data.cardId
                    );


                if (
                    !Number.isInteger(id) ||
                    id <= 0
                ) {
                    return;
                }


                const claim =
                    pendingPhysicalClaims.get(
                        id
                    );


                if (!claim) {

                    console.warn(
                        "NO PHYSICAL CLAIM:",
                        id
                    );

                    return;

                }


                pendingPhysicalClaims.delete(
                    id
                );


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


                const winnerNumber =
                    gameState.approvedWinnersCount;


                io.emit(
                    "physicalWinApproved",
                    {
                        cardId:
                            id,

                        winnerCount:
                            winnerNumber,

                        winnerNumber:
                            winnerNumber,

                        totalRequired:
                            gameState.maxWinners
                    }
                );


                checkWinnerLimit();

            }
        );


        /*
        =============================================
        REJECT PHYSICAL WIN
        =============================================
        */

        socket.on(
            "rejectPhysicalWin",
            data => {

                if (
                    socket.id !==
                    hostSocketId
                ) {
                    return;
                }


                if (!data) {
                    return;
                }


                const id =
                    Number(
                        data.cardId
                    );


                if (
                    !Number.isInteger(id)
                ) {
                    return;
                }


                pendingPhysicalClaims.delete(
                    id
                );


                io.emit(
                    "physicalWinRejected",
                    {
                        cardId:
                            id
                    }
                );

            }
        );


        /*
        =============================================
        LOAD CARD
        =============================================
        */

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


        /*
        =============================================
        MARK CARD
        =============================================
        */

        socket.on(
            "markCard",
            data => {

                if (!data) {
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


                if (
                    !Number.isInteger(cardId) ||
                    cardId <= 0
                ) {
                    return;
                }


                if (
                    !Number.isInteger(index) ||
                    index < 0 ||
                    index > 24
                ) {
                    return;
                }

            }
        );


        /*
        =============================================
        STATE SYNC
        =============================================
        */

        socket.on(
            "requestGameStateSyncFallback",
            () => {

                socket.emit(
                    "gameState",
                    gameState
                );

            }
        );


        /*
        =============================================
        DISCONNECT
        =============================================
        */

        socket.on(
            "disconnect",
            reason => {

                console.log(
                    "DISCONNECTED:",
                    socket.id,
                    reason
                );


                /*
                -----------------------------------------
                REMOVE PLAYER CLAIMS
                -----------------------------------------
                */

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


                /*
                -----------------------------------------
                HOST DISCONNECT
                -----------------------------------------
                */

                if (
                    socket.id ===
                    hostSocketId
                ) {

                    console.log(
                        "HOST DISCONNECTED"
                    );


                    hostSocketId =
                        null;


                    if (
                        hostDisconnectTimer
                    ) {

                        clearTimeout(
                            hostDisconnectTimer
                        );

                    }


                    hostDisconnectTimer =
                        setTimeout(
                            () => {

                                hostDisconnectTimer =
                                    null;


                                if (
                                    hostSocketId ===
                                    null
                                ) {

                                    resetGame(
                                        "host disconnected"
                                    );

                                }

                            },
                            HOST_RECONNECT_GRACE_PERIOD
                        );

                }

            }
        );

    }
);


/*
=====================================================
WINNER LIMIT
=====================================================
*/

function checkWinnerLimit() {

    if (
        gameState.approvedWinnersCount <
        gameState.maxWinners
    ) {

        io.emit(
            "gameState",
            gameState
        );

        return;

    }


    gameState.status =
        "ended";


    stopTimer();


    pendingClaims.clear();


    pendingPhysicalClaims.clear();


    io.emit(
        "gameEnded",
        {
            reason:
                "winner limit reached"
        }
    );


    io.emit(
        "gameState",
        gameState
    );

}


/*
=====================================================
START SERVER
=====================================================
*/

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
                        "=========================================="
                    );

                    console.log(
                        `Safety Bingo running on port ${PORT}`
                    );

                    console.log(
                        `Public URL: ${PUBLIC_URL}`
                    );

                    console.log(
                        "=========================================="
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
```
