"use strict";

// =====================================================
// SAFETY BINGO SERVER
// FULL CONSOLIDATED SERVER.JS
// HOST EXIT / GAME RESET FIX INCLUDED
// =====================================================

require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const { pool, initializeDatabase } = require("./database");

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
app.use(express.static(path.join(__dirname, "public")));

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

        process.exit(1);
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

// =====================================================
// QUESTION API
// =====================================================

app.get("/api/questions", async (req, res) => {

    try {

        const result = await pool.query(`
            SELECT *
            FROM questions
            ORDER BY id ASC
        `);

        res.json(result.rows);

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

});

app.post("/api/questions/add", async (req, res) => {

    const newQuestion = req.body;

    if (!newQuestion.q || !newQuestion.a) {

        return res.status(400).json({
            success: false,
            error: "Question and answer required"
        });

    }

    try {

        const idResult = await pool.query(`
            SELECT MAX(id) AS maxid
            FROM questions
        `);

        const nextID =
            Number(idResult.rows[0].maxid || 0) + 1;

        await pool.query(`
            INSERT INTO questions
            (id, category, difficulty, question, answer)
            VALUES($1, $2, $3, $4, $5)
        `, [
            nextID,
            newQuestion.category || "General",
            newQuestion.difficulty || "Medium",
            newQuestion.q,
            newQuestion.a
        ]);

        console.log(
            "QUESTION ADDED:",
            nextID
        );

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

});

app.delete("/api/questions/:id", async (req, res) => {

    const id =
        Number(req.params.id);

    if (!id) {

        return res.status(400).json({
            success: false,
            error: "Invalid question ID"
        });

    }

    try {

        const result = await pool.query(`
            DELETE FROM questions
            WHERE id=$1
        `, [id]);

        if (result.rowCount === 0) {

            return res.status(404).json({
                success: false,
                error: "Question not found"
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

        res.status(500).json({
            success: false,
            error: error.message
        });

    }

});

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

    approvedWinnersList: []
};

// =====================================================
// SERVER VARIABLES
// =====================================================

let timer = null;

let countdown = 30;

let gamePosition = -1;

// Track the active host connection
let activeHostSocketId = null;

// Track pending digital claims
const pendingClaims = new Map();

// =====================================================
// CREATE A BRAND NEW GAME STATE
// =====================================================

function createInitialGameState() {

    return {
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

        approvedWinnersList: []
    };

}

// =====================================================
// RESET ENTIRE GAME
// =====================================================

function resetEntireGame(reason = "unknown") {

    console.log(
        "================================================="
    );

    console.log(
        "RESETTING ENTIRE GAME"
    );

    console.log(
        "RESET REASON:",
        reason
    );

    console.log(
        "================================================="
    );

    // Stop server timer
    clearInterval(timer);

    timer = null;

    // Reset countdown
    countdown = 30;

    // Clear pending digital Bingo claims
    pendingClaims.clear();

    // Reset game position
    gamePosition = -1;

    // Completely replace game state
    gameState = createInitialGameState();

    console.log(
        "GAME STATE RESET TO IDLE"
    );

    // Tell every connected device
    io.emit(
        "gameReset"
    );

    // Send clean game state
    io.emit(
        "gameState",
        gameState
    );

    // Reset display timers
    io.emit(
        "timerUpdate",
        0
    );

    // Tell display/other clients they are waiting
    io.emit(
        "gameEnded",
        {
            reason: "host left game"
        }
    );

    console.log(
        "RESET BROADCAST TO ALL CLIENTS"
    );

    console.log(
        "================================================="
    );

}

// =====================================================
// QUESTION ENGINE
// =====================================================

function buildGameOrder() {

    gameState.gameOrder = [];

    for (
        let i = 0;
        i < safetyQuestionBank.length;
        i++
    ) {

        gameState.gameOrder.push(i);

    }

    for (
        let i = gameState.gameOrder.length - 1;
        i > 0;
        i--
    ) {

        const j =
            Math.floor(
                Math.random() * (i + 1)
            );

        [
            gameState.gameOrder[i],
            gameState.gameOrder[j]
        ] = [
            gameState.gameOrder[j],
            gameState.gameOrder[i]
        ];

    }

}

// =====================================================
// SEND NEXT QUESTION
// =====================================================

function sendNextQuestion() {

    clearInterval(timer);

    timer = null;

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
        safetyQuestionBank[index];

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
            q => q.id === question.id
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

    // Cheat sheet
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

    // Main game state
    io.emit(
        "gameState",
        gameState
    );

    // Timer
    if (!gameState.noTimer) {

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

}

// =====================================================
// SERVER TIMER
// =====================================================

function startTimer() {

    clearInterval(timer);

    timer =
        setInterval(() => {

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

                clearInterval(timer);

                timer = null;

                sendNextQuestion();

            }

        }, 1000);

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
        // Immediately send current state
        // -------------------------------------------------

        socket.emit(
            "gameState",
            gameState
        );

        // -------------------------------------------------
        // Send previous questions to new connections
        // -------------------------------------------------

        gameState.askedIndices.forEach(
            index => {

                const question =
                    safetyQuestionBank[index];

                if (!question) {
                    return;
                }

                socket.emit(
                    "cheatSheetQuestion",
                    {
                        number:
                            safetyQuestionBank.findIndex(
                                q => q.id === question.id
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
                    "HOST REGISTERED:",
                    socket.id
                );

                /*
                If another host was already connected,
                the new host becomes the active host.
                */

                activeHostSocketId =
                    socket.id;

                socket.isHost =
                    true;

                console.log(
                    "ACTIVE HOST SOCKET:",
                    activeHostSocketId
                );

            }
        );

        // =================================================
        // HOST LEFT GAME
        // =================================================

        socket.on(
            "hostLeftGame",
            () => {

                console.log(
                    "HOST LEFT GAME:",
                    socket.id
                );

                /*
                Only the registered host is allowed
                to perform the global host-exit reset.
                */

                if (
                    socket.id ===
                    activeHostSocketId
                ) {

                    activeHostSocketId =
                        null;

                    resetEntireGame(
                        "hostLeftGame"
                    );

                }

            }
        );

        // =================================================
        // RESET GAME
        // =================================================

        /*
        Supports the resetGame event sent by
        your hostState.js.
        */

        socket.on(
            "resetGame",
            () => {

                console.log(
                    "RESET GAME EVENT RECEIVED:",
                    socket.id
                );

                /*
                A registered host may reset
                the entire game.
                */

                if (
                    socket.id ===
                    activeHostSocketId ||
                    socket.isHost
                ) {

                    resetEntireGame(
                        "resetGame"
                    );

                } else {

                    console.warn(
                        "UNREGISTERED SOCKET ATTEMPTED RESET:",
                        socket.id
                    );

                }

            }
        );

        // =================================================
        // TIMER SETTINGS
        // =================================================

        socket.on(
            "setTimerSettings",
            data => {

                if (!data) {
                    return;
                }

                gameState.timerSeconds =
                    Number(
                        data.seconds
                    ) || 30;

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
                    "timerSettingsUpdated",
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

                if (!data) {
                    return;
                }

                gameState.maxWinners =
                    Number(
                        data.maxWinners
                    ) || 1;

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
            async () => {

                if (
                    gameState.status ===
                    "running"
                ) {

                    return;

                }

                try {

                    await loadQuestionsFromDatabase();

                    pendingClaims.clear();

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

                    buildGameOrder();

                    gamePosition =
                        -1;

                    sendNextQuestion();

                } catch (error) {

                    console.error(
                        "START GAME ERROR:",
                        error
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
                    gameState.status !==
                    "running" ||
                    gamePosition <= 0
                ) {

                    return;

                }

                gamePosition--;

                const index =
                    gameState.gameOrder[
                        gamePosition
                    ];

                const question =
                    safetyQuestionBank[index];

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
                        q => q.id === question.id
                    ) + 1;

                clearInterval(timer);

                timer = null;

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
        );

        // =================================================
        // REPEAT QUESTION
        // =================================================

        socket.on(
            "hostRepeat",
            () => {

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

                    clearInterval(timer);

                    timer = null;

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
        // HOST RESET BUTTON
        // =================================================

        socket.on(
            "hostReset",
            () => {

                console.log(
                    "HOST RESET BUTTON PRESSED"
                );

                if (
                    socket.id ===
                    activeHostSocketId ||
                    socket.isHost
                ) {

                    resetEntireGame(
                        "hostReset"
                    );

                }

            }
        );

        // =================================================
        // DIGITAL CLAIM WIN
        // =================================================

        socket.on(
            "claimWin",
            data => {

                console.log(
                    "========== BINGO CLAIM RECEIVED ==========",
                    data
                );

                if (!data) {
                    return;
                }

                const cardId =
                    Number(data.cardId);

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

                console.log(
                    "WIN REQUEST SENT TO HOST:",
                    cardId
                );

            }
        );

        // =================================================
        // APPROVE DIGITAL WIN
        // =================================================

        socket.on(
            "approveWin",
            cardId => {

                const id =
                    Number(cardId);

                if (!id) {
                    return;
                }

                const pendingClaim =
                    pendingClaims.get(id);

                if (!pendingClaim) {
                    return;
                }

                if (
                    gameState.approvedWinnersList.includes(
                        id
                    )
                ) {

                    pendingClaims.delete(id);

                    return;

                }

                if (
                    gameState.approvedWinnersCount >=
                    gameState.maxWinners
                ) {

                    pendingClaims.delete(id);

                    return;

                }

                pendingClaims.delete(id);

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

                if (
                    gameState.approvedWinnersCount >=
                    gameState.maxWinners
                ) {

                    gameState.status =
                        "ended";

                    clearInterval(timer);

                    timer = null;

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

                const id =
                    Number(cardId);

                if (!id) {
                    return;
                }

                const pendingClaim =
                    pendingClaims.get(id);

                const winningPattern =
                    pendingClaim &&
                    Array.isArray(
                        pendingClaim.winningPattern
                    )
                        ? [
                            ...pendingClaim.winningPattern
                        ]
                        : [];

                const removed =
                    pendingClaims.delete(id);

                console.log(
                    "DIGITAL WIN REJECTED:",
                    id,
                    "REMOVED:",
                    removed
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

                if (!data) {
                    return;
                }

                const id =
                    Number(data.cardId);

                if (!id) {
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

                console.log(
                    "PHYSICAL WIN APPROVED:",
                    id
                );

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

                    clearInterval(timer);

                    timer = null;

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

                if (!data) {
                    return;
                }

                const cardId =
                    Number(data.cardId);

                if (!cardId) {
                    return;
                }

                console.log(
                    "PHYSICAL WIN REJECTED:",
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
                    Number(cardId);

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
                    Number(data.id);

                const index =
                    Number(data.index);

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

                socket.emit(
                    "timerUpdate",
                    gameState.status === "running"
                        ? countdown
                        : 0
                );

            }
        );

        // =================================================
        // DISCONNECT
        // =================================================

        socket.on(
            "disconnect",
            reason => {

                console.log(
                    "DISCONNECTED:",
                    socket.id,
                    reason
                );

                // -----------------------------------------
                // Remove player claims belonging to socket
                // -----------------------------------------

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
                            "REMOVED CLAIM FROM DISCONNECTED PLAYER:",
                            cardId
                        );

                    }

                }

                // -----------------------------------------
                // HOST DISCONNECTED
                // -----------------------------------------

                if (
                    socket.id ===
                    activeHostSocketId
                ) {

                    console.log(
                        "================================================="
                    );

                    console.log(
                        "ACTIVE HOST CONNECTION LOST"
                    );

                    console.log(
                        "RESETTING GAME FOR ALL CLIENTS"
                    );

                    console.log(
                        "================================================="
                    );

                    activeHostSocketId =
                        null;

                    resetEntireGame(
                        "host socket disconnected"
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
    process.env.PORT || 3000;

loadQuestionsFromDatabase()
    .then(() => {

        server.listen(
            PORT,
            "0.0.0.0",
            () => {

                console.log(
                    `Safety Bingo running on port ${PORT}`
                );

            }
        );

    })
    .catch(error => {

        console.error(
            "SERVER STARTUP FAILED:",
            error
        );

        process.exit(1);

    });
