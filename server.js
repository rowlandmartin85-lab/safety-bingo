"use strict";

// =====================================================
// SAFETY BINGO SERVER
// FULL CONSOLIDATED SERVER.JS
// HOST AUDIT + SERVER-SIDE PLAYER STATE
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
// DATABASE STARTUP
// =====================================================

initializeDatabase();

if (process.env.MIGRATE_QUESTIONS === "true") {
    require("./migrateQuestions");
}

// =====================================================
// QUESTION DATABASE
// =====================================================

let safetyQuestionBank = [];

// =====================================================
// LOAD QUESTIONS
// =====================================================

async function loadQuestionsFromDatabase() {

    try {

        const result =
            await pool.query(`
                SELECT *
                FROM questions
                ORDER BY id ASC
            `);

        safetyQuestionBank =
            result.rows.map(item => ({
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
        path.join(__dirname, "index.html")
    );
});

app.get("/index.html", (req, res) => {

    res.sendFile(
        path.join(__dirname, "index.html")
    );
});

app.get("/host.html", (req, res) => {

    res.sendFile(
        path.join(__dirname, "host.html")
    );
});

app.get("/player.html", (req, res) => {

    res.sendFile(
        path.join(__dirname, "player.html")
    );
});

app.get("/display.html", (req, res) => {

    res.sendFile(
        path.join(__dirname, "display.html")
    );
});

app.get("/questionManager.html", (req, res) => {

    res.sendFile(
        path.join(__dirname, "questionManager.html")
    );
});

app.get("/cheatsheet.html", (req, res) => {

    res.sendFile(
        path.join(__dirname, "cheatsheet.html")
    );
});

app.get("/answerkey.html", (req, res) => {

    res.sendFile(
        path.join(__dirname, "answerkey.html")
    );
});

// =====================================================
// QUESTION API
// =====================================================

app.get("/api/questions", async (req, res) => {

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
});

// =====================================================
// ADD QUESTION
// =====================================================

app.post("/api/questions/add", async (req, res) => {

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

        await loadQuestionsFromDatabase();

        console.log(
            "QUESTION ADDED:",
            nextID
        );

        res.json({
            success:
                true,

            id:
                nextID
        });

    } catch (error) {

        console.error(
            "ADD QUESTION ERROR:",
            error
        );

        res.status(500).json({
            success:
                false,

            error:
                error.message
        });
    }
});

// =====================================================
// DELETE QUESTION
// =====================================================

app.delete("/api/questions/:id", async (req, res) => {

    const id =
        Number(req.params.id);

    if (
        !Number.isInteger(id) ||
        id <= 0
    ) {

        return res.status(400).json({
            success:
                false,

            error:
                "Invalid question ID"
        });
    }

    try {

        const result =
            await pool.query(`
                DELETE FROM questions
                WHERE id=$1
            `, [id]);

        if (
            result.rowCount === 0
        ) {

            return res.status(404).json({
                success:
                    false,

                error:
                    "Question not found"
            });
        }

        await loadQuestionsFromDatabase();

        console.log(
            "QUESTION REMOVED:",
            id
        );

        res.json({
            success:
                true
        });

    } catch (error) {

        console.error(
            "DELETE ERROR:",
            error
        );

        res.status(500).json({
            success:
                false,

            error:
                error.message
        });
    }
});

// =====================================================
// GAME STATE
// =====================================================

let gameState = {

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

// =====================================================
// SERVER GAME VARIABLES
// =====================================================

let timer =
    null;

let countdown =
    30;

let gamePosition =
    -1;

// =====================================================
// DIGITAL CLAIMS
// =====================================================

const pendingClaims =
    new Map();

// =====================================================
// PHYSICAL CLAIMS
// =====================================================

const pendingPhysicalClaims =
    new Map();

// =====================================================
// PLAYER SESSION STATE
// =====================================================

const playerSessions =
    new Map();

// =====================================================
// HOST
// =====================================================

let hostSocketId =
    null;

let hostDisconnectTimer =
    null;

const HOST_RECONNECT_GRACE_PERIOD =
    15000;

// =====================================================
// WINNING PATTERNS
// =====================================================

const winningPatterns = [

    // Rows

    [0, 1, 2, 3, 4],

    [5, 6, 7, 8, 9],

    [10, 11, 12, 13, 14],

    [15, 16, 17, 18, 19],

    [20, 21, 22, 23, 24],

    // Columns

    [0, 5, 10, 15, 20],

    [1, 6, 11, 16, 21],

    [2, 7, 12, 17, 22],

    [3, 8, 13, 18, 23],

    [4, 9, 14, 19, 24],

    // Diagonals

    [0, 6, 12, 18, 24],

    [4, 8, 12, 16, 20]
];

// =====================================================
// UTILITY
// =====================================================

function normalizeIndices(indices) {

    if (!Array.isArray(indices)) {
        return [];
    }

    return [
        ...new Set(
            indices
                .map(Number)
                .filter(
                    index =>
                        Number.isInteger(index) &&
                        index >= 0 &&
                        index <= 24
                )
        )
    ].sort(
        (a, b) => a - b
    );
}

// =====================================================
// COMPARE INDEX ARRAYS
// =====================================================

function sameIndices(a, b) {

    const first =
        normalizeIndices(a);

    const second =
        normalizeIndices(b);

    if (
        first.length !==
        second.length
    ) {
        return false;
    }

    return first.every(
        (value, index) =>
            value === second[index]
    );
}

// =====================================================
// VALID WINNING PATTERN
// =====================================================

function isValidWinningPattern(pattern) {

    const normalized =
        normalizeIndices(pattern);

    if (
        normalized.length !== 5
    ) {
        return false;
    }

    return winningPatterns.some(
        validPattern =>
            sameIndices(
                validPattern,
                normalized
            )
    );
}

// =====================================================
// FIND COMPLETED BINGO
// =====================================================

function findCompletedPattern(markedIndices) {

    const normalized =
        normalizeIndices(
            markedIndices
        );

    return (
        winningPatterns.find(
            pattern =>
                pattern.every(
                    index =>
                        normalized.includes(
                            index
                        )
                )
        ) || null
    );
}

// =====================================================
// SERVER-SIDE PLAYER SESSION
// =====================================================

function getPlayerSession(socketId) {

    return (
        playerSessions.get(
            socketId
        ) || null
    );
}

// =====================================================
// VALIDATE CARD ID
// =====================================================

function isValidCardId(cardId) {

    const id =
        Number(cardId);

    return (
        Number.isInteger(id) &&
        id > 0
    );
}

// =====================================================
// REGISTER / LOAD PLAYER CARD
// =====================================================
//
// IMPORTANT:
//
// This function preserves the player's marks
// when the same card is loaded again.
//
// The center FREE square is automatically marked.
//
// =====================================================

function registerPlayerCard(
    socket,
    cardId
) {

    const id =
        Number(cardId);

    if (
        !isValidCardId(id)
    ) {
        return false;
    }

    const existing =
        playerSessions.get(
            socket.id
        );

    let markedIndices =
        new Set();

    // Preserve existing marks when
    // reloading the SAME card.
    if (
        existing &&
        Number(existing.cardId) === id
    ) {

        markedIndices =
            new Set(
                existing.markedIndices ||
                []
            );
    }

    // FREE center square.
    markedIndices.add(12);

    playerSessions.set(
        socket.id,
        {
            cardId:
                id,

            markedIndices:
                markedIndices,

            loadedAt:
                existing &&
                Number(existing.cardId) === id
                    ? existing.loadedAt
                    : Date.now(),

            lastActivity:
                Date.now()
        }
    );

    return true;
}

// =====================================================
// CARD OWNERSHIP
// =====================================================

function ownsCard(
    socket,
    cardId
) {

    const session =
        getPlayerSession(
            socket.id
        );

    if (!session) {
        return false;
    }

    return (
        Number(session.cardId) ===
        Number(cardId)
    );
}

// =====================================================
// VALIDATE MARK INDEX
// =====================================================

function validMarkIndex(index) {

    return (
        Number.isInteger(index) &&
        index >= 0 &&
        index <= 24
    );
}

// =====================================================
// FREE SPACE
// =====================================================

function isFreeSpace(index) {

    return index === 12;
}

// =====================================================
// MARK PLAYER CELL
// =====================================================

function updatePlayerMark(
    socket,
    data
) {

    if (!data) {

        return {
            success:
                false,

            reason:
                "Missing mark data"
        };
    }

    const cardId =
        Number(
            data.id ??
            data.cardId
        );

    const index =
        Number(data.index);

    const marked =
        data.marked === true;

    if (
        !isValidCardId(cardId)
    ) {

        return {
            success:
                false,

            reason:
                "Invalid card ID"
        };
    }

    if (
        !validMarkIndex(index)
    ) {

        return {
            success:
                false,

            reason:
                "Invalid card index"
        };
    }

    if (
        !ownsCard(
            socket,
            cardId
        )
    ) {

        return {
            success:
                false,

            reason:
                "Card is not registered to this player"
        };
    }

    const session =
        getPlayerSession(
            socket.id
        );

    if (
        isFreeSpace(index)
    ) {

        session.markedIndices.add(12);

        session.lastActivity =
            Date.now();

        return {
            success:
                true,

            index:
                12,

            marked:
                true
        };
    }

    if (
        gameState.approvedWinnersList.includes(
            cardId
        )
    ) {

        return {
            success:
                false,

            reason:
                "Card is already an approved winner"
        };
    }

    if (marked) {

        session.markedIndices.add(
            index
        );

    } else {

        session.markedIndices.delete(
            index
        );
    }

    // FREE space always remains marked.
    session.markedIndices.add(12);

    session.lastActivity =
        Date.now();

    return {
        success:
            true,

        index:
            index,

        marked:
            marked
    };
}

// =====================================================
// DIGITAL CLAIM VALIDATION
// =====================================================

function validateDigitalClaim(
    socket,
    data
) {

    if (!data) {

        return {
            valid:
                false,

            reason:
                "Missing claim data"
        };
    }

    const cardId =
        Number(
            data.cardId ??
            data.id
        );

    if (
        !isValidCardId(cardId)
    ) {

        return {
            valid:
                false,

            reason:
                "Invalid Card ID"
        };
    }

    if (
        gameState.status !==
        "running"
    ) {

        return {
            valid:
                false,

            reason:
                "Game is not running"
        };
    }

    if (
        gameState.approvedWinnersCount >=
        gameState.maxWinners
    ) {

        return {
            valid:
                false,

            reason:
                "Winner limit has already been reached"
        };
    }

    if (
        !ownsCard(
            socket,
            cardId
        )
    ) {

        return {
            valid:
                false,

            reason:
                "Card does not belong to this player session"
        };
    }

    const session =
        getPlayerSession(
            socket.id
        );

    if (!session) {

        return {
            valid:
                false,

            reason:
                "Player session not found"
        };
    }

    const serverMarked =
        normalizeIndices([
            ...session.markedIndices
        ]);

    if (
        !serverMarked.includes(12)
    ) {

        serverMarked.push(12);

        serverMarked.sort(
            (a, b) => a - b
        );
    }

    const submittedMarked =
        normalizeIndices(
            data.markedIndices
        );

    if (
        submittedMarked.length > 0 &&
        !sameIndices(
            submittedMarked,
            serverMarked
        )
    ) {

        return {
            valid:
                false,

            reason:
                "Submitted marked cells do not match server state",

            serverMarkedIndices:
                serverMarked
        };
    }

    const completedPattern =
        findCompletedPattern(
            serverMarked
        );

    if (!completedPattern) {

        return {
            valid:
                false,

            reason:
                "Server could not find a completed Bingo pattern",

            serverMarkedIndices:
                serverMarked
        };
    }

    if (
        !isValidWinningPattern(
            data.winningPattern
        )
    ) {

        return {
            valid:
                false,

            reason:
                "Submitted winning pattern is invalid",

            serverMarkedIndices:
                serverMarked,

            completedPattern:
                completedPattern
        };
    }

    const submittedPattern =
        normalizeIndices(
            data.winningPattern
        );

    if (
        !sameIndices(
            submittedPattern,
            completedPattern
        )
    ) {

        return {
            valid:
                false,

            reason:
                "Submitted Bingo pattern does not match server-completed pattern",

            serverMarkedIndices:
                serverMarked,

            completedPattern:
                completedPattern
        };
    }

    return {
        valid:
            true,

        cardId:
            cardId,

        markedIndices:
            serverMarked,

        winningPattern:
            completedPattern
    };
}

// =====================================================
// SEND PLAYER AUDIT RESULT
// =====================================================

function sendClaimAuditResult(
    socket,
    result
) {

    if (!socket) {
        return;
    }

    socket.emit(
        "bingoClaimAudit",
        result
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

    if (timer) {

        clearInterval(timer);

        timer =
            null;
    }

    countdown =
        30;

    pendingClaims.clear();

    pendingPhysicalClaims.clear();

    playerSessions.clear();

    gameState = {

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
        "========== GAME RESET COMPLETE =========="
    );
}

// =====================================================
// BUILD GAME ORDER
// =====================================================

function buildGameOrder() {

    gameState.gameOrder =
        [];

    const selectedIds =
        Array.isArray(
            gameState.selectedQuestionIds
        )
            ? gameState.selectedQuestionIds
            : [];

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

    // Shuffle.
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

        clearInterval(timer);

        timer =
            null;
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
    }
}

// =====================================================
// START TIMER
// =====================================================

function startTimer() {

    if (timer) {

        clearInterval(timer);
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
// PHYSICAL QR CLAIM PAGE
// =====================================================

app.get(
    "/physical-claim",
    (req, res) => {

        const cardId =
            Number(
                req.query.card
            );

        if (
            !Number.isInteger(cardId) ||
            cardId <= 0
        ) {

            return res.status(400).send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>Safety Bingo</title>
                </head>
                <body>
                    <h2>Invalid Bingo Card</h2>
                    <p>The QR code does not contain a valid card number.</p>
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

        if (!hostSocketId) {

            return res.status(503).send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>Safety Bingo</title>
                </head>
                <body>
                    <h2>Host Not Connected</h2>
                    <p>The Bingo host is not currently connected.</p>
                </body>
                </html>
            `);
        }

        if (
            gameState.status !==
            "running"
        ) {

            return res.status(409).send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>Safety Bingo</title>
                </head>
                <body>
                    <h2>Game Not Running</h2>
                    <p>The Bingo game is not currently running.</p>
                </body>
                </html>
            `);
        }

        if (
            gameState.approvedWinnersCount >=
            gameState.maxWinners
        ) {

            return res.status(409).send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>Safety Bingo</title>
                </head>
                <body>
                    <h2>Winner Limit Reached</h2>
                    <p>The maximum number of winners has already been reached.</p>
                </body>
                </html>
            `);
        }

        const existingClaim =
            pendingPhysicalClaims.get(
                cardId
            );

        if (
            existingClaim &&
            existingClaim.status ===
                "pending"
        ) {

            return res.send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport"
                          content="width=device-width, initial-scale=1.0">
                    <title>Safety Bingo</title>
                </head>
                <body>
                    <h2>Bingo Claim Already Submitted</h2>
                    <p>Card ${cardId} is already waiting for host approval.</p>
                </body>
                </html>
            `);
        }

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

        return res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport"
                      content="width=device-width, initial-scale=1.0">

                <title>Safety Bingo</title>

                <style>

                    body {
                        margin: 0;
                        min-height: 100vh;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: #0b1220;
                        color: white;
                        font-family: Arial, sans-serif;
                        text-align: center;
                    }

                    .box {
                        max-width: 500px;
                        padding: 35px;
                    }

                    h1 {
                        color: #22c55e;
                        margin-bottom: 15px;
                    }

                    .card {
                        font-size: 28px;
                        font-weight: bold;
                        margin: 20px 0;
                    }

                    p {
                        font-size: 18px;
                        line-height: 1.5;
                    }

                </style>

            </head>

            <body>

                <div class="box">

                    <h1>BINGO CLAIM SENT</h1>

                    <div class="card">
                        Card ${cardId}
                    </div>

                    <p>
                        Your Bingo claim has been sent to the host.
                    </p>

                    <p>
                        Please wait for the host to verify your card.
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

        // =================================================
        // INITIAL GAME STATE
        // =================================================

        socket.emit(
            "gameState",
            gameState
        );

        // =================================================
        // PREVIOUS QUESTIONS
        // =================================================

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

                    playerSessions.clear();

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
                        hostSocketId ||
                    gamePosition <= 0
                ) {
                    return;
                }

                if (
                    gameState.status !==
                    "running"
                ) {
                    return;
                }

                if (timer) {

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

                if (
                    gameState.isPaused
                ) {

                    if (timer) {

                        clearInterval(
                            timer
                        );

                        timer =
                            null;
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

                resetGame(
                    "hostLeftGame event"
                );
            }
        );

        // =================================================
        // LOAD PLAYER CARD
        // =================================================
        //
        // ACCEPTS BOTH:
        //
        // socket.emit("loadCard", 123)
        //
        // AND:
        //
        // socket.emit("loadCard", {
        //     cardId: 123
        // })
        //
        // ALSO ACCEPTS:
        //
        // socket.emit("loadCard", {
        //     id: 123
        // })
        //
        // =================================================

        socket.on(
            "loadCard",
            data => {

                let cardId;

                // -------------------------------------------------
                // SIMPLE FORMAT
                // loadCard(123)
                // loadCard("123")
                // -------------------------------------------------

                if (
                    typeof data ===
                        "number" ||
                    typeof data ===
                        "string"
                ) {

                    cardId =
                        Number(data);
                }

                // -------------------------------------------------
                // OBJECT FORMAT
                // loadCard({ cardId: 123 })
                // -------------------------------------------------

                else if (
                    data &&
                    typeof data ===
                        "object"
                ) {

                    cardId =
                        Number(
                            data.cardId ??
                            data.id
                        );
                }

                // -------------------------------------------------
                // INVALID FORMAT
                // -------------------------------------------------

                else {

                    cardId =
                        NaN;
                }

                console.log(
                    "LOAD CARD REQUEST:",
                    {
                        socketId:
                            socket.id,

                        received:
                            data,

                        parsedCardId:
                            cardId
                    }
                );

                if (
                    !isValidCardId(
                        cardId
                    )
                ) {

                    console.warn(
                        "CARD LOAD REJECTED - INVALID CARD ID:",
                        data
                    );

                    socket.emit(
                        "cardLoadError",
                        {
                            cardId:
                                data,

                            error:
                                "Invalid Card ID"
                        }
                    );

                    return;
                }

                // -------------------------------------------------
                // CHECK EXISTING SESSION
                // -------------------------------------------------

                const existing =
                    getPlayerSession(
                        socket.id
                    );

                // -------------------------------------------------
                // PREVENT CHANGING CARDS WHILE CLAIM IS PENDING
                // -------------------------------------------------

                if (
                    existing &&
                    Number(existing.cardId) !==
                        cardId
                ) {

                    const hasPendingClaim =
                        pendingClaims.has(
                            Number(
                                existing.cardId
                            )
                        );

                    if (
                        hasPendingClaim
                    ) {

                        socket.emit(
                            "cardLoadError",
                            {
                                cardId:
                                    cardId,

                                error:
                                    "Cannot change cards while a Bingo claim is pending."
                            }
                        );

                        return;
                    }
                }

                // -------------------------------------------------
                // REGISTER PLAYER CARD
                // -------------------------------------------------

                const registered =
                    registerPlayerCard(
                        socket,
                        cardId
                    );

                if (!registered) {

                    console.error(
                        "CARD REGISTRATION FAILED:",
                        cardId
                    );

                    socket.emit(
                        "cardLoadError",
                        {
                            cardId:
                                cardId,

                            error:
                                "Unable to register Bingo card."
                        }
                    );

                    return;
                }

                const session =
                    getPlayerSession(
                        socket.id
                    );

                console.log(
                    "=========================================="
                );

                console.log(
                    "CARD REGISTERED"
                );

                console.log(
                    "CARD:",
                    cardId
                );

                console.log(
                    "SOCKET:",
                    socket.id
                );

                console.log(
                    "MARKED:",
                    [
                        ...session.markedIndices
                    ]
                );

                console.log(
                    "=========================================="
                );

                // -------------------------------------------------
                // CONFIRM CARD TO PLAYER
                // -------------------------------------------------

                socket.emit(
                    "cardLoaded",
                    {
                        cardId:
                            cardId,

                        markedIndices:
                            normalizeIndices([
                                ...session.markedIndices
                            ])
                    }
                );

                // -------------------------------------------------
                // SEND CURRENT GAME STATE
                // -------------------------------------------------

                socket.emit(
                    "gameState",
                    gameState
                );
            }
        );

        // =================================================
        // PLAYER MARK CARD
        // =================================================

        socket.on(
            "markCard",
            data => {

                const result =
                    updatePlayerMark(
                        socket,
                        data
                    );

                if (
                    !result.success
                ) {

                    console.warn(
                        "CARD MARK REJECTED:",
                        {
                            socketId:
                                socket.id,

                            data:
                                data,

                            reason:
                                result.reason
                        }
                    );

                    socket.emit(
                        "cardMarkRejected",
                        {
                            reason:
                                result.reason
                        }
                    );

                    return;
                }

                const cardId =
                    Number(
                        data.id ??
                        data.cardId
                    );

                console.log(
                    "SERVER CARD MARK:",
                    {
                        socketId:
                            socket.id,

                        cardId:
                            cardId,

                        index:
                            result.index,

                        marked:
                            result.marked
                    }
                );

                socket.emit(
                    "cardMarkConfirmed",
                    {
                        cardId:
                            cardId,

                        index:
                            result.index,

                        marked:
                            result.marked
                    }
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
                    "=========================================="
                );

                console.log(
                    "DIGITAL BINGO CLAIM RECEIVED"
                );

                console.log(
                    "SOCKET:",
                    socket.id
                );

                console.log(
                    "CLAIM:",
                    data
                );

                console.log(
                    "=========================================="
                );

                const validation =
                    validateDigitalClaim(
                        socket,
                        data
                    );

                if (
                    !validation.valid
                ) {

                    console.warn(
                        "DIGITAL CLAIM FAILED SERVER AUDIT:",
                        validation
                    );

                    sendClaimAuditResult(
                        socket,
                        {
                            success:
                                false,

                            approved:
                                false,

                            reason:
                                validation.reason,

                            cardId:
                                Number(
                                    data &&
                                    (
                                        data.cardId ??
                                        data.id
                                    )
                                ),

                            serverMarkedIndices:
                                validation.serverMarkedIndices ||
                                [],

                            serverWinningPattern:
                                validation.completedPattern ||
                                null
                        }
                    );

                    socket.emit(
                        "winRejected",
                        {
                            cardId:
                                Number(
                                    data &&
                                    (
                                        data.cardId ??
                                        data.id
                                    )
                                ),

                            winningPattern:
                                validation.completedPattern ||
                                [],

                            reason:
                                validation.reason
                        }
                    );

                    return;
                }

                const cardId =
                    validation.cardId;

                // =================================================
                // DUPLICATE PENDING CLAIM
                // =================================================

                if (
                    pendingClaims.has(
                        cardId
                    )
                ) {

                    socket.emit(
                        "bingoClaimAudit",
                        {
                            success:
                                false,

                            approved:
                                false,

                            reason:
                                "A Bingo claim for this card is already pending.",

                            cardId:
                                cardId
                        }
                    );

                    return;
                }

                // =================================================
                // ALREADY APPROVED WINNER
                // =================================================

                if (
                    gameState.approvedWinnersList.includes(
                        cardId
                    )
                ) {
                    return;
                }

                const claim = {

                    cardId:
                        cardId,

                    markedIndices:
                        validation.markedIndices,

                    winningPattern:
                        validation.winningPattern,

                    timestamp:
                        Date.now(),

                    playerSocketId:
                        socket.id,

                    auditStatus:
                        "pending"
                };

                pendingClaims.set(
                    cardId,
                    claim
                );

                // =================================================
                // SEND TO HOST
                // =================================================

                if (hostSocketId) {

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
                                claim.timestamp,

                            audit:
                                {
                                    serverValidated:
                                        true,

                                    cardOwnership:
                                        true,

                                    markedCellsMatchServer:
                                        true,

                                    validWinningPattern:
                                        true,

                                    completedPattern:
                                        claim.winningPattern,

                                    playerSocketId:
                                        socket.id
                                }
                        }
                    );
                }

                // =================================================
                // CONFIRM AUDIT TO PLAYER
                // =================================================

                socket.emit(
                    "bingoClaimAudit",
                    {

                        success:
                            true,

                        approved:
                            false,

                        pending:
                            true,

                        cardId:
                            cardId,

                        markedIndices:
                            claim.markedIndices,

                        winningPattern:
                            claim.winningPattern,

                        reason:
                            "Server audit passed. Waiting for host approval."
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
                    Number(cardId);

                if (
                    !isValidCardId(id)
                ) {
                    return;
                }

                const pendingClaim =
                    pendingClaims.get(
                        id
                    );

                if (!pendingClaim) {

                    console.warn(
                        "APPROVE WIN: NO PENDING CLAIM:",
                        id
                    );

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

                const playerSocket =
                    io.sockets.sockets.get(
                        pendingClaim.playerSocketId
                    );

                if (!playerSocket) {

                    pendingClaims.delete(
                        id
                    );

                    console.warn(
                        "APPROVE WIN FAILED: PLAYER DISCONNECTED:",
                        id
                    );

                    return;
                }

                // =================================================
                // FINAL SERVER AUDIT
                // =================================================

                const finalValidation =
                    validateDigitalClaim(
                        playerSocket,
                        {
                            cardId:
                                id,

                            markedIndices:
                                pendingClaim.markedIndices,

                            winningPattern:
                                pendingClaim.winningPattern
                        }
                    );

                if (
                    !finalValidation.valid
                ) {

                    pendingClaims.delete(
                        id
                    );

                    playerSocket.emit(
                        "winRejected",
                        {
                            cardId:
                                id,

                            winningPattern:
                                pendingClaim.winningPattern,

                            reason:
                                "Final server audit failed: " +
                                finalValidation.reason
                        }
                    );

                    console.warn(
                        "FINAL DIGITAL AUDIT FAILED:",
                        finalValidation
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
                            id,

                        winningPattern:
                            pendingClaim.winningPattern
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

                        timer =
                            null;
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
                    Number(cardId);

                if (
                    !isValidCardId(id)
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

                if (
                    pendingClaim &&
                    pendingClaim.playerSocketId
                ) {

                    io.to(
                        pendingClaim.playerSocketId
                    ).emit(
                        "winRejected",
                        {
                            cardId:
                                id,

                            winningPattern:
                                winningPattern,

                            reason:
                                "Host rejected the Bingo claim."
                        }
                    );

                } else {

                    io.emit(
                        "winRejected",
                        {
                            cardId:
                                id,

                            winningPattern:
                                winningPattern,

                            reason:
                                "Host rejected the Bingo claim."
                        }
                    );
                }
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
                        data.cardId ??
                        data.id
                    );

                if (
                    !isValidCardId(id)
                ) {
                    return;
                }

                const pendingClaim =
                    pendingPhysicalClaims.get(
                        id
                    );

                if (!pendingClaim) {

                    console.warn(
                        "PHYSICAL APPROVAL WITHOUT PENDING CLAIM:",
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

                        timer =
                            null;
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
                        data.cardId ??
                        data.id
                    );

                if (
                    !isValidCardId(
                        cardId
                    )
                ) {
                    return;
                }

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

                playerSessions.delete(
                    socket.id
                );

                // Remove pending digital claims
                // belonging to this player.

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

                        console.log(
                            "REMOVED CLAIM FOR DISCONNECTED PLAYER:",
                            cardId
                        );
                    }
                }

                // =================================================
                // HOST DISCONNECTED
                // =================================================

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
                        "=========================================="
                    );

                    console.log(
                        `Safety Bingo running on port ${PORT}`
                    );

                    console.log(
                        "Host Audit: ENABLED"
                    );

                    console.log(
                        "Server-side player state: ENABLED"
                    );

                    console.log(
                        "Server-side Bingo pattern validation: ENABLED"
                    );

                    console.log(
                        "Physical QR audit: ENABLED"
                    );

                    console.log(
                        "Flexible loadCard format: ENABLED"
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

            process.exit(1);
        }
    );
