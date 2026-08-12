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

const {
    pool,
    initializeDatabase
} = require("./database");

// =====================================================
// DATABASE STARTUP
// =====================================================

initializeDatabase();

if (process.env.MIGRATE_QUESTIONS === "true") {
    require("./migrateQuestions");
}

// =====================================================
// SERVER SETUP
// =====================================================

const app = express();

app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// =====================================================
// STATIC FILES
// =====================================================

app.use(express.static(__dirname));

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);

// =====================================================
// QUESTION DATABASE
// =====================================================

let safetyQuestionBank = [];

async function loadQuestionsFromDatabase() {
    try {
        const result = await pool.query(`
            SELECT *
            FROM questions
            ORDER BY id ASC
        `);

        safetyQuestionBank = result.rows.map(item => ({
            id: item.id,
            category: item.category,
            difficulty: item.difficulty,
            q: item.question,
            a: item.answer
        }));

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

app.get("/", (req, res) => {
    res.sendFile(
        path.join(
            __dirname,
            "index.html"
        )
    );
});

app.get("/index.html", (req, res) => {
    res.sendFile(
        path.join(
            __dirname,
            "index.html"
        )
    );
});

app.get("/host.html", (req, res) => {
    res.sendFile(
        path.join(
            __dirname,
            "host.html"
        )
    );
});

app.get("/player.html", (req, res) => {
    res.sendFile(
        path.join(
            __dirname,
            "player.html"
        )
    );
});

app.get("/display.html", (req, res) => {
    res.sendFile(
        path.join(
            __dirname,
            "display.html"
        )
    );
});

app.get("/questionManager.html", (req, res) => {
    res.sendFile(
        path.join(
            __dirname,
            "questionManager.html"
        )
    );
});

app.get("/cheatsheet.html", (req, res) => {
    res.sendFile(
        path.join(
            __dirname,
            "cheatsheet.html"
        )
    );
});

app.get("/answerkey.html", (req, res) => {
    res.sendFile(
        path.join(
            __dirname,
            "answerkey.html"
        )
    );
});

// =====================================================
// QUESTION API
// =====================================================

app.get(
    "/api/questions",
    async (req, res) => {

        try {

            const result = await pool.query(`
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
                error: error.message
            });

        }
    }
);

// =====================================================
// ADD QUESTION
// =====================================================

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

            await pool.query(`
                INSERT INTO questions
                (
                    id,
                    category,
                    difficulty,
                    question,
                    answer
                )
                VALUES($1,$2,$3,$4,$5)
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

            await loadQuestionsFromDatabase();

            res.json({
                success: true,
                id: nextID
            });

        } catch (error) {

            console.error(
                "ADD QUESTION ERROR:",
                error
            );

            res.status(500).json({
                success: false,
                error: error.message
            });

        }
    }
);

// =====================================================
// DELETE QUESTION
// =====================================================

app.delete(
    "/api/questions/:id",
    async (req, res) => {

        const id =
            Number(
                req.params.id
            );

        if (!Number.isInteger(id) || id <= 0) {

            return res.status(400).json({
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

                return res.status(404).json({
                    success: false,
                    error:
                        "Question not found"
                });

            }

            console.log(
                "QUESTION REMOVED:",
                id
            );

            await loadQuestionsFromDatabase();

            res.json({
                success: true
            });

        } catch (error) {

            console.error(
                "DELETE ERROR:",
                error
            );

            res.status(500).json({
                success: false,
                error: error.message
            });

        }
    }
);

// =====================================================
// GAME STATE
// =====================================================

let gameState = {

    status: "idle",

    currentQuestionIndex: -1,

    currentQuestion: "",

    currentAnswer: "",

    currentQuestionID: null,

    currentQuestionNumber: null,

    currentCategory: "",

    currentDifficulty: "",

    calledAnswers: [],

    askedIndices: [],

    gameOrder: [],

    timerSeconds: 30,

    noTimer: false,

    isPaused: false,

    maxWinners: 1,

    approvedWinnersCount: 0,

    approvedWinnersList: [],

    selectedQuestionIds: []
};

// =====================================================
// SERVER GAME VARIABLES
// =====================================================

let timer = null;

let countdown = 30;

let gamePosition = -1;

// =====================================================
// DIGITAL CLAIMS
// =====================================================

const pendingClaims =
    new Map();

// =====================================================
// PHYSICAL QR CLAIMS
// =====================================================

const pendingPhysicalClaims =
    new Map();

// =====================================================
// HOST TRACKING
// =====================================================

let hostSocketId = null;

let hostDisconnectTimer = null;

const HOST_RECONNECT_GRACE_PERIOD =
    3000;

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

    // Stop timer

    if (timer) {

        clearInterval(
            timer
        );

        timer = null;

    }

    countdown = 30;

    // Clear digital claims

    pendingClaims.clear();

    // Clear physical QR claims

    pendingPhysicalClaims.clear();

    // Reset game state

    gameState = {

        status: "idle",

        currentQuestionIndex: -1,

        currentQuestion: "",

        currentAnswer: "",

        currentQuestionID: null,

        currentQuestionNumber: null,

        currentCategory: "",

        currentDifficulty: "",

        calledAnswers: [],

        askedIndices: [],

        gameOrder: [],

        timerSeconds: 30,

        noTimer: false,

        isPaused: false,

        maxWinners: 1,

        approvedWinnersCount: 0,

        approvedWinnersList: [],

        selectedQuestionIds: []

    };

    gamePosition = -1;

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

function buildGameOrder() {

    gameState.gameOrder = [];

    const selectedIds =
        Array.isArray(
            gameState.selectedQuestionIds
        )
            ? gameState.selectedQuestionIds
            : [];

    // -------------------------------------------------
    // SELECTED QUESTIONS
    // -------------------------------------------------

    if (
        selectedIds.length > 0
    ) {

        selectedIds.forEach(
            id => {

                const index =
                    safetyQuestionBank.findIndex(
                        q =>
                            Number(q.id) ===
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
        );

    }

    // -------------------------------------------------
    // ALL QUESTIONS
    // -------------------------------------------------

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
        gameState.gameOrder
    );
}

// =====================================================
// SEND NEXT QUESTION
// =====================================================

function sendNextQuestion() {

    if (timer) {

        clearInterval(
            timer
        );

        timer = null;

    }

    gamePosition++;

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

        io.emit(
            "gameState",
            gameState
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

    if (!question) {

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
        gameState
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

    }
}

// =====================================================
// START TIMER
// =====================================================

function startTimer() {

    if (timer) {

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
                    countdown <= 0
                ) {

                    sendNextQuestion();

                }

            },
            1000
        );
}

// =====================================================
// PHYSICAL QR CLAIM
// =====================================================
//
// QR code example:
//
// https://safety-bingo.onrender.com/physical-claim?card=27
//
// Scanning the QR:
// 1. Reads Card #27
// 2. Sends claim to registered host
// 3. Host sees physical audit request
// 4. Host checks physical card
// 5. Host approves or rejects
//
// =====================================================

app.get(
    "/physical-claim",
    (req, res) => {

        const cardId =
            Number(
                req.query.card
            );

        // -------------------------------------------------
        // INVALID CARD
        // -------------------------------------------------

        if (
            !Number.isInteger(cardId) ||
            cardId <= 0
        ) {

            return res.status(400).send(`

<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta
        name="viewport"
        content="width=device-width,initial-scale=1.0"
    >
    <title>Safety Bingo</title>
</head>

<body style="
    margin:0;
    min-height:100vh;
    display:flex;
    justify-content:center;
    align-items:center;
    background:#050914;
    color:white;
    font-family:Arial,sans-serif;
    text-align:center;
">

<div>

    <h1>
        Invalid Bingo Card
    </h1>

    <p>
        This QR code does not contain
        a valid Card ID.
    </p>

</div>

</body>
</html>

`);

        }

        console.log(
            "=========================================="
        );

        console.log(
            "PHYSICAL QR SCAN RECEIVED:",
            cardId
        );

        console.log(
            "=========================================="
        );

        // -------------------------------------------------
        // HOST CHECK
        // -------------------------------------------------

        if (
            !hostSocketId
        ) {

            console.warn(
                "PHYSICAL CLAIM REJECTED: NO HOST"
            );

            return res.status(503).send(`

<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta
        name="viewport"
        content="width=device-width,initial-scale=1.0"
    >
    <title>Safety Bingo</title>
</head>

<body style="
    margin:0;
    min-height:100vh;
    display:flex;
    justify-content:center;
    align-items:center;
    background:#050914;
    color:white;
    font-family:Arial,sans-serif;
    text-align:center;
">

<div>

    <h1 style="color:#FFD700;">
        HOST NOT AVAILABLE
    </h1>

    <p>
        The Bingo host is not currently connected.
    </p>

    <p>
        Please notify the host and try again.
    </p>

</div>

</body>
</html>

`);

        }

        // -------------------------------------------------
        // GAME CHECK
        // -------------------------------------------------

        if (
            gameState.status !==
            "running"
        ) {

            console.warn(
                "PHYSICAL CLAIM REJECTED: GAME NOT RUNNING"
            );

            return res.status(409).send(`

<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta
        name="viewport"
        content="width=device-width,initial-scale=1.0"
    >
    <title>Safety Bingo</title>
</head>

<body style="
    margin:0;
    min-height:100vh;
    display:flex;
    justify-content:center;
    align-items:center;
    background:#050914;
    color:white;
    font-family:Arial,sans-serif;
    text-align:center;
">

<div>

    <h1 style="color:#FFD700;">
        GAME NOT ACTIVE
    </h1>

    <p>
        There is no active Bingo game right now.
    </p>

</div>

</body>
</html>

`);

        }

        // -------------------------------------------------
        // EXISTING CLAIM
        // -------------------------------------------------

        const existingClaim =
            pendingPhysicalClaims.get(
                cardId
            );

        if (
            existingClaim &&
            existingClaim.status ===
                "pending"
        ) {

            console.log(
                "PHYSICAL CLAIM ALREADY PENDING:",
                cardId
            );

            return res.send(`

<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta
        name="viewport"
        content="width=device-width,initial-scale=1.0"
    >
    <title>Safety Bingo</title>
</head>

<body style="
    margin:0;
    min-height:100vh;
    display:flex;
    justify-content:center;
    align-items:center;
    background:#050914;
    color:white;
    font-family:Arial,sans-serif;
    text-align:center;
">

<div style="
    width:min(90%,500px);
    padding:40px 25px;
    border-radius:20px;
    background:#111827;
    border:2px solid #FFD700;
">

    <div style="
        font-size:60px;
        color:#f59e0b;
    ">
        !
    </div>

    <h1 style="color:#FFD700;">
        CLAIM ALREADY SENT
    </h1>

    <p style="font-size:22px;font-weight:bold;">
        CARD #${cardId}
    </p>

    <p>
        Your Bingo claim is already waiting
        for the host to check.
    </p>

    <p style="color:#22c55e;font-weight:bold;">
        Please wait for the host.
    </p>

</div>

</body>
</html>

`);

        }

        // -------------------------------------------------
        // STORE CLAIM
        // -------------------------------------------------

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

        console.log(
            "PHYSICAL CLAIM STORED:",
            claim
        );

        // -------------------------------------------------
        // SEND TO HOST
        // -------------------------------------------------

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

        console.log(
            "PHYSICAL BINGO CLAIM SENT TO HOST:",
            cardId
        );

        // -------------------------------------------------
        // PLAYER RESPONSE
        // -------------------------------------------------

        return res.send(`

<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">

    <meta
        name="viewport"
        content="width=device-width,initial-scale=1.0"
    >

    <title>Safety Bingo</title>
</head>

<body style="
    margin:0;
    min-height:100vh;
    display:flex;
    justify-content:center;
    align-items:center;

    background:radial-gradient(
        circle at top,
        #0b1b3a,
        #050914
    );

    color:white;
    font-family:Arial,sans-serif;
    text-align:center;
">

<div style="
    width:min(90%,500px);
    padding:40px 25px;
    border-radius:20px;

    background:rgba(17,24,39,.95);

    border:2px solid rgba(255,215,0,.35);

    box-shadow:
        0 20px 45px rgba(0,0,0,.55);
">

    <div style="
        font-size:60px;
        color:#22c55e;
        margin-bottom:15px;
    ">
        ✓
    </div>

    <h1 style="
        color:#FFD700;
        margin-bottom:15px;
    ">
        BINGO CLAIM SENT
    </h1>

    <p style="
        font-size:24px;
        font-weight:bold;
    ">
        CARD #${cardId}
    </p>

    <p style="
        color:#cbd5e1;
        font-size:18px;
        line-height:1.5;
    ">
        Your Bingo claim has been sent
        to the host.
    </p>

    <p style="
        color:#22c55e;
        font-weight:bold;
        margin-top:25px;
    ">
        Please wait while your physical
        card is checked.
    </p>

</div>

</body>
</html>

`);

    }
);

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
        // SEND CURRENT GAME STATE
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

                if (!question) {
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

                // -------------------------------------------------
                // CANCEL DISCONNECT RESET
                // -------------------------------------------------

                if (
                    hostDisconnectTimer
                ) {

                    clearTimeout(
                        hostDisconnectTimer
                    );

                    hostDisconnectTimer =
                        null;

                    console.log(
                        "HOST RECONNECTED - RESET CANCELLED"
                    );

                }

                // -------------------------------------------------
                // ANOTHER HOST
                // -------------------------------------------------

                if (
                    hostSocketId &&
                    hostSocketId !==
                    socket.id
                ) {

                    console.warn(
                        "ANOTHER HOST IS ALREADY REGISTERED:",
                        hostSocketId
                    );

                    socket.emit(
                        "hostRegistrationRejected",
                        {
                            reason:
                                "Another host is already registered."
                        }
                    );

                    return;

                }

                // -------------------------------------------------
                // REGISTER
                // -------------------------------------------------

                hostSocketId =
                    socket.id;

                console.log(
                    "HOST REGISTERED:",
                    hostSocketId
                );

                socket.emit(
                    "hostRegistered"
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

                if (!data) {
                    return;
                }

                const seconds =
                    Number(
                        data.seconds
                    );

                gameState.timerSeconds =
                    Number.isFinite(seconds) &&
                    seconds > 0
                        ? seconds
                        : 30;

                gameState.noTimer =
                    data.noTimer === true;

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

                if (!data) {
                    return;
                }

                const maxWinners =
                    Number(
                        data.maxWinners
                    );

                gameState.maxWinners =
                    Number.isInteger(maxWinners) &&
                    maxWinners > 0
                        ? maxWinners
                        : 1;

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

                    pendingClaims.clear();

                    pendingPhysicalClaims.clear();

                    gameState.status =
                        "running";

                    gameState.askedIndices =
                        [];

                    gameState.calledAnswers =
                        [];

                    gameState.approvedWinnersCount =
                        0;

                    gameState.approvedWinnersList =
                        [];

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

                    buildGameOrder();

                    gamePosition =
                        -1;

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
                    hostSocketId
                ) {
                    return;
                }

                if (
                    gameState.status !==
                        "running" ||
                    gamePosition <= 0
                ) {
                    return;
                }

                if (timer) {

                    clearInterval(
                        timer
                    );

                    timer = null;

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

                if (!question) {
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

                io.emit(
                    "gameState",
                    gameState
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

                gameState.isPaused =
                    !gameState.isPaused;

                console.log(
                    "PAUSE:",
                    gameState.isPaused
                );

                if (
                    gameState.isPaused
                ) {

                    if (timer) {

                        clearInterval(
                            timer
                        );

                        timer = null;

                    }

                } else if (
                    gameState.status ===
                        "running" &&
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
        // HOST RESET
        // =================================================

        socket.on(
            "hostReset",
            () => {

                if (
                    socket.id !==
                    hostSocketId
                ) {

                    console.warn(
                        "RESET REJECTED - NOT HOST:",
                        socket.id
                    );

                    return;
                }

                resetGame(
                    "host reset button"
                );

            }
        );

        // =================================================
        // LEGACY RESET
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
                    "HOST LEFT GAME EVENT:",
                    socket.id
                );

                resetGame(
                    "hostLeftGame event"
                );

            }
        );

        // =================================================
        // DIGITAL BINGO CLAIM
        // =================================================

        socket.on(
            "claimWin",
            data => {

                console.log(
                    "DIGITAL BINGO CLAIM RECEIVED:",
                    data
                );

                if (!data) {
                    return;
                }

                const cardId =
                    Number(
                        data.cardId
                    );

                if (!cardId) {
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

                if (!id) {
                    return;
                }

                const pendingClaim =
                    pendingClaims.get(
                        id
                    );

                if (!pendingClaim) {
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

                console.log(
                    "DIGITAL WIN APPROVED:",
                    id
                );

                io.emit(
                    "winApproved",
                    {
                        cardId:
                            id
                    }
                );

                io.emit(
                    "gameState",
                    gameState
                );

                if (
                    gameState.approvedWinnersCount >=
                    gameState.maxWinners
                ) {

                    gameState.status =
                        "ended";

                    if (timer) {

                        clearInterval(
                            timer
                        );

                        timer = null;

                    }

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

                if (!id) {
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
        // APPROVE PHYSICAL QR WIN
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

                if (!data) {
                    return;
                }

                const id =
                    Number(
                        data.cardId
                    );

                if (!id) {
                    return;
                }

                const pendingClaim =
                    pendingPhysicalClaims.get(
                        id
                    );

                if (!pendingClaim) {

                    console.warn(
                        "PHYSICAL APPROVAL RECEIVED WITHOUT PENDING CLAIM:",
                        id
                    );

                    return;

                }

                if (
                    gameState.approvedWinnersList.includes(
                        id
                    )
                ) {

                    pendingPhysicalClaims.delete(
                        id
                    );

                    return;

                }

                if (
                    gameState.approvedWinnersCount >=
                    gameState.maxWinners
                ) {

                    pendingPhysicalClaims.delete(
                        id
                    );

                    return;

                }

                pendingPhysicalClaims.delete(
                    id
                );

                gameState.approvedWinnersList.push(
                    id
                );

                gameState.approvedWinnersCount++;

                const winnerNumber =
                    gameState.approvedWinnersCount;

                console.log(
                    "PHYSICAL WIN APPROVED:",
                    id,
                    "WINNER:",
                    winnerNumber
                );

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

                if (
                    gameState.approvedWinnersCount >=
                    gameState.maxWinners
                ) {

                    gameState.status =
                        "ended";

                    if (timer) {

                        clearInterval(
                            timer
                        );

                        timer = null;

                    }

                    pendingClaims.clear();

                    pendingPhysicalClaims.clear();

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
        // REJECT PHYSICAL QR WIN
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

                if (!data) {
                    return;
                }

                const cardId =
                    Number(
                        data.cardId
                    );

                if (!cardId) {
                    return;
                }

                console.log(
                    "PHYSICAL WIN REJECTED:",
                    cardId
                );

                pendingPhysicalClaims.delete(
                    cardId
                );

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

                if (!id) {
                    return;
                }

                console.log(
                    "CARD LOADED BY PLAYER:",
                    id,
                    socket.id
                );

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

                const marked =
                    data.marked === true;

                if (!cardId) {
                    return;
                }

                if (
                    !Number.isInteger(index) ||
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
        // GAME STATE SYNC
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
                // REMOVE DIGITAL CLAIMS BELONGING TO PLAYER
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
                        "========== HOST DISCONNECTED =========="
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

            process.exit(1);

        }
    );
