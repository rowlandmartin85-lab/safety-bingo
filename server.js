"use strict";

// =====================================================
// SAFETY BINGO SERVER
// FULL SERVER.JS
// DIGITAL + PHYSICAL CARD SUPPORT
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
            id: Number(item.id),

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
            Number(
                idResult.rows[0].maxid || 0
            ) + 1;

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

});

app.delete("/api/questions/:id", async (req, res) => {

    const id = Number(req.params.id);

    if (
        !Number.isInteger(id) ||
        id <= 0
    ) {

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

});

// =====================================================
// GAME STATE
// =====================================================

function createFreshGameState() {

    return {

        status: "idle",

        currentQuestionIndex: -1,

        currentQuestion: "",

        currentAnswer: "",

        currentQuestionID: null,

        currentQuestionNumber: null,

        currentCategory: "",

        currentDifficulty: "",

        // Existing property used by your application.
        calledAnswers: [],

        // NEW:
        // IDs of questions that have been called.
        calledQuestionIds: [],

        // NEW:
        // Full question text for called questions.
        calledQuestions: [],

        askedIndices: [],

        gameOrder: [],

        selectedQuestionIds: [],

        timerSeconds: 30,

        noTimer: false,

        isPaused: false,

        maxWinners: 1,

        approvedWinnersCount: 0,

        approvedWinnersList: []

    };

}

let gameState = createFreshGameState();

// =====================================================
// SERVER GAME VARIABLES
// =====================================================

let timer = null;

let countdown = 30;

let gamePosition = -1;

const pendingClaims = new Map();

// =====================================================
// HOST TRACKING
// =====================================================

let hostSocketId = null;

// =====================================================
// NORMALIZE TEXT
// =====================================================

function normalizeText(value) {

    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");

}

// =====================================================
// RESET GAME
// =====================================================

function resetGame(reason = "unknown") {

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

        timer = null;

    }

    countdown = 30;

    pendingClaims.clear();

    gameState = createFreshGameState();

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

function buildGameOrder(
    selectedQuestionIds = []
) {

    const normalizedIds = [
        ...new Set(
            selectedQuestionIds
                .map(Number)
                .filter(
                    id =>
                        Number.isInteger(id) &&
                        id > 0
                )
        )
    ];

    let availableIndices;

    if (normalizedIds.length === 0) {

        availableIndices =
            safetyQuestionBank.map(
                (question, index) =>
                    index
            );

    } else {

        const selectedSet =
            new Set(normalizedIds);

        availableIndices =
            safetyQuestionBank
                .map(
                    (question, index) => {

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

    gameState.gameOrder = [
        ...availableIndices
    ];

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
// ADD CALLED QUESTION
// =====================================================

function recordCalledQuestion(question) {

    if (!question) {
        return;
    }

    // -----------------------------------------------
    // ANSWER
    // -----------------------------------------------

    if (
        !gameState.calledAnswers.some(
            answer =>
                normalizeText(answer) ===
                normalizeText(question.a)
        )
    ) {

        gameState.calledAnswers.push(
            question.a
        );

    }

    // -----------------------------------------------
    // QUESTION ID
    // -----------------------------------------------

    const questionID =
        Number(question.id);

    if (
        Number.isInteger(questionID) &&
        !gameState.calledQuestionIds.includes(
            questionID
        )
    ) {

        gameState.calledQuestionIds.push(
            questionID
        );

    }

    // -----------------------------------------------
    // QUESTION TEXT
    // -----------------------------------------------

    const alreadyStored =
        gameState.calledQuestions.some(
            item =>
                Number(item.id) === questionID
        );

    if (!alreadyStored) {

        gameState.calledQuestions.push({

            id: questionID,

            question:
                question.q,

            answer:
                question.a,

            category:
                question.category,

            difficulty:
                question.difficulty

        });

    }

}

// =====================================================
// SEND NEXT QUESTION
// =====================================================

function sendNextQuestion() {

    if (timer) {

        clearInterval(timer);

        timer = null;

    }

    gamePosition++;

    // -------------------------------------------------
    // GAME COMPLETE
    // -------------------------------------------------

    if (
        gamePosition >=
        gameState.gameOrder.length
    ) {

        gameState.status = "ended";

        gameState.currentQuestion = "";

        gameState.currentAnswer = "";

        gameState.isPaused = false;

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
                q.id === question.id
        ) + 1;

    gameState.isPaused = false;

    // -------------------------------------------------
    // RECORD CALLED QUESTION
    // -------------------------------------------------

    recordCalledQuestion(question);

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

    if (!gameState.noTimer) {

        countdown =
            gameState.timerSeconds;

        io.emit(
            "timerUpdate",
            countdown
        );

        startTimer();

    } else {

        countdown = 0;

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
                    safetyQuestionBank[index];

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
                    hostSocketId &&
                    hostSocketId !== socket.id
                ) {

                    console.log(
                        "NEW HOST TAKING OVER:",
                        socket.id
                    );

                    console.log(
                        "OLD HOST:",
                        hostSocketId
                    );

                    resetGame(
                        "new host connected"
                    );

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

                const noTimer =
                    data.noTimer === true;

                let seconds =
                    Number(data.seconds);

                if (noTimer) {

                    seconds = 0;

                } else if (
                    !Number.isFinite(seconds) ||
                    seconds < 1
                ) {

                    seconds = 30;

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

                if (!data) {
                    return;
                }

                let maxWinners =
                    Number(data.maxWinners);

                if (
                    !Number.isInteger(maxWinners) ||
                    maxWinners < 1
                ) {

                    maxWinners = 1;

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

                    let selectedQuestionIds = [];

                    if (
                        data &&
                        Array.isArray(
                            data.selectedQuestionIds
                        )
                    ) {

                        selectedQuestionIds =
                            data.selectedQuestionIds
                                .map(Number)
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
                                availableQuestionIds.has(id)
                        );

                    gameState.selectedQuestionIds =
                        [
                            ...selectedQuestionIds
                        ];

                    if (
                        safetyQuestionBank.length === 0
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

                    // ---------------------------------------------
                    // RESET PER-GAME DATA
                    // ---------------------------------------------

                    pendingClaims.clear();

                    gameState.status =
                        "running";

                    gameState.currentQuestionIndex =
                        -1;

                    gameState.currentQuestion = "";

                    gameState.currentAnswer = "";

                    gameState.currentQuestionID = null;

                    gameState.currentQuestionNumber = null;

                    gameState.currentCategory = "";

                    gameState.currentDifficulty = "";

                    gameState.askedIndices = [];

                    gameState.calledAnswers = [];

                    gameState.calledQuestionIds = [];

                    gameState.calledQuestions = [];

                    gameState.approvedWinnersCount = 0;

                    gameState.approvedWinnersList = [];

                    gameState.isPaused = false;

                    buildGameOrder(
                        gameState.selectedQuestionIds
                    );

                    if (
                        gameState.gameOrder.length === 0
                    ) {

                        gameState.status = "idle";

                        socket.emit(
                            "gameStartError",
                            {
                                error:
                                    "None of the selected questions exist in the database."
                            }
                        );

                        return;

                    }

                    gamePosition = -1;

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

                    gameState.status = "idle";

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
                    socket.id !== hostSocketId
                ) {
                    return;
                }

                if (
                    gameState.status !== "running" ||
                    gamePosition <= 0
                ) {
                    return;
                }

                if (timer) {

                    clearInterval(timer);

                    timer = null;

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
                        q =>
                            q.id ===
                            question.id
                    ) + 1;

                gameState.isPaused = false;

                if (!gameState.noTimer) {

                    countdown =
                        gameState.timerSeconds;

                    io.emit(
                        "timerUpdate",
                        countdown
                    );

                    startTimer();

                } else {

                    countdown = 0;

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
                    socket.id !== hostSocketId
                ) {
                    return;
                }

                if (
                    gameState.status !== "running"
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
                    socket.id !== hostSocketId
                ) {
                    return;
                }

                if (
                    gameState.status !== "running"
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

                        clearInterval(timer);

                        timer = null;

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
        // HOST RESET
        // =================================================

        socket.on(
            "hostReset",
            () => {

                if (
                    socket.id !== hostSocketId
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
        // LEGACY RESET
        // =================================================

        socket.on(
            "resetGame",
            () => {

                if (
                    socket.id !== hostSocketId
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
                    socket.id !== hostSocketId
                ) {
                    return;
                }

                console.log(
                    "========== HOST LEFT GAME =========="
                );

                resetGame(
                    "hostLeftGame event"
                );

                hostSocketId = null;

                console.log(
                    "HOST SLOT RELEASED"
                );

            }
        );

        // =================================================
        // DIGITAL CLAIM
        // =================================================

        socket.on(
            "claimWin",
            data => {

                if (!data) {
                    return;
                }

                const cardId =
                    Number(data.cardId);

                if (
                    !Number.isInteger(cardId) ||
                    cardId <= 0
                ) {
                    return;
                }

                if (
                    gameState.status !== "running"
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
                    socket.id !== hostSocketId
                ) {
                    return;
                }

                const id =
                    Number(cardId);

                if (
                    !Number.isInteger(id) ||
                    id <= 0
                ) {
                    return;
                }

                const pendingClaim =
                    pendingClaims.get(id);

                if (!pendingClaim) {
                    return;
                }

                if (
                    gameState.approvedWinnersList.includes(id)
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

                gameState.approvedWinnersList.push(id);

                gameState.approvedWinnersCount++;

                io.emit(
                    "winApproved",
                    {
                        cardId: id
                    }
                );

                if (
                    gameState.approvedWinnersCount >=
                    gameState.maxWinners
                ) {

                    gameState.status = "ended";

                    if (timer) {

                        clearInterval(timer);

                        timer = null;

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
                    socket.id !== hostSocketId
                ) {
                    return;
                }

                const id =
                    Number(cardId);

                if (
                    !Number.isInteger(id) ||
                    id <= 0
                ) {
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

                pendingClaims.delete(id);

                io.emit(
                    "winRejected",
                    {

                        cardId: id,

                        winningPattern:
                            winningPattern

                    }
                );

            }
        );

        // =================================================
        // PHYSICAL CARD AUDIT
        // =================================================
        //
        // This is NEW.
        //
        // The host can ask the server for the current
        // called-question information for a physical
        // card audit.
        //
        // =================================================

        socket.on(
            "requestPhysicalAudit",
            data => {

                if (
                    socket.id !== hostSocketId
                ) {

                    console.warn(
                        "PHYSICAL AUDIT REJECTED - NOT HOST:",
                        socket.id
                    );

                    return;

                }

                if (!data) {
                    return;
                }

                const cardId =
                    Number(data.cardId);

                if (
                    !Number.isInteger(cardId) ||
                    cardId <= 0
                ) {

                    socket.emit(
                        "physicalAuditError",
                        {
                            cardId,
                            error:
                                "Invalid Card ID."
                        }
                    );

                    return;

                }

                console.log(
                    "PHYSICAL CARD AUDIT REQUEST:",
                    cardId
                );

                socket.emit(
                    "physicalAuditData",
                    {

                        cardId,

                        calledAnswers:
                            [
                                ...gameState.calledAnswers
                            ],

                        calledQuestionIds:
                            [
                                ...gameState.calledQuestionIds
                            ],

                        calledQuestions:
                            gameState.calledQuestions.map(
                                question => ({
                                    ...question
                                })
                            ),

                        gameState: {
                            status:
                                gameState.status,

                            currentQuestionID:
                                gameState.currentQuestionID,

                            currentQuestion:
                                gameState.currentQuestion,

                            currentAnswer:
                                gameState.currentAnswer,

                            calledAnswers:
                                [
                                    ...gameState.calledAnswers
                                ],

                            calledQuestionIds:
                                [
                                    ...gameState.calledQuestionIds
                                ]
                        }

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
                    socket.id !== hostSocketId
                ) {

                    console.warn(
                        "PHYSICAL APPROVAL REJECTED - NOT HOST:",
                        socket.id
                    );

                    return;

                }

                if (!data) {
                    return;
                }

                const id =
                    Number(data.cardId);

                if (
                    !Number.isInteger(id) ||
                    id <= 0
                ) {
                    return;
                }

                if (
                    gameState.approvedWinnersList.includes(id)
                ) {
                    return;
                }

                if (
                    gameState.approvedWinnersCount >=
                    gameState.maxWinners
                ) {
                    return;
                }

                gameState.approvedWinnersList.push(id);

                gameState.approvedWinnersCount++;

                // -------------------------------------------------
                // SEND COMPLETE PHYSICAL APPROVAL INFORMATION
                // -------------------------------------------------

                io.emit(
                    "physicalWinApproved",
                    {

                        cardId: id,

                        winnerNumber:
                            gameState.approvedWinnersCount,

                        winnerCount:
                            gameState.approvedWinnersCount,

                        totalRequired:
                            gameState.maxWinners

                    }
                );

                if (
                    gameState.approvedWinnersCount >=
                    gameState.maxWinners
                ) {

                    gameState.status = "ended";

                    if (timer) {

                        clearInterval(timer);

                        timer = null;

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
                    socket.id !== hostSocketId
                ) {
                    return;
                }

                if (!data) {
                    return;
                }

                const cardId =
                    Number(data.cardId);

                if (
                    !Number.isInteger(cardId) ||
                    cardId <= 0
                ) {
                    return;
                }

                console.log(
                    "PHYSICAL CARD REJECTED:",
                    cardId
                );

                io.emit(
                    "physicalWinRejected",
                    {
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

                if (
                    !Number.isInteger(id) ||
                    id <= 0
                ) {
                    return;
                }

                socket.emit(
                    "cardLoaded",
                    {
                        cardId: id
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

                console.log(
                    "CARD MARK:",
                    {
                        cardId,

                        index,

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

                // ---------------------------------------------
                // REMOVE DIGITAL CLAIMS
                // ---------------------------------------------

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

                // ---------------------------------------------
                // HOST DISCONNECT
                // ---------------------------------------------

                if (
                    socket.id === hostSocketId
                ) {

                    console.log(
                        "========== HOST CLOSED/DISCONNECTED =========="
                    );

                    resetGame(
                        "host disconnected"
                    );

                    hostSocketId = null;

                    console.log(
                        "HOST SLOT RELEASED AFTER DISCONNECT"
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
