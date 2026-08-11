"use strict";

// =====================================================
// SAFETY BINGO SERVER
// FULL CONSOLIDATED SERVER.JS
// HOST RECONNECT / HOME RESET FIX
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

        safetyQuestionBank =
            result.rows.map(item => ({
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

    if (
        !newQuestion ||
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
            VALUES
            ($1,$2,$3,$4,$5)
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

        // Refresh in-memory question bank.
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

    const id =
        Number(req.params.id);

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
            `, [id]);

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

});

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

let timer = null;

let countdown = 30;

let gamePosition = -1;

const pendingClaims =
    new Map();

// =====================================================
// HOST TRACKING
// =====================================================

let hostSocketId = null;

let hostDisconnectTimer = null;

const HOST_RECONNECT_GRACE_PERIOD = 3000;

// =====================================================
// HOST OWNERSHIP HELPERS
// =====================================================

function isHostSocket(socket) {

    return (
        socket &&
        socket.id === hostSocketId
    );

}

function hostSocketStillExists() {

    if (!hostSocketId) {
        return false;
    }

    return io.sockets.sockets.has(
        hostSocketId
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

    // Stop timer.

    if (timer) {

        clearInterval(timer);

        timer = null;

    }

    countdown = 30;

    // Clear claims.

    pendingClaims.clear();

    // Reset game state.

    gameState =
        createFreshGameState();

    gamePosition = -1;

    // Tell clients.

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

    // If the host selected specific questions,
    // use those questions.

    if (
        Array.isArray(
            gameState.selectedQuestionIds
        ) &&
        gameState.selectedQuestionIds.length > 0
    ) {

        for (
            let i = 0;
            i < safetyQuestionBank.length;
            i++
        ) {

            if (
                gameState.selectedQuestionIds.includes(
                    Number(
                        safetyQuestionBank[i].id
                    )
                )
            ) {

                gameState.gameOrder.push(i);

            }

        }

    }

    // Otherwise use all questions.

    if (
        gameState.gameOrder.length === 0
    ) {

        for (
            let i = 0;
            i < safetyQuestionBank.length;
            i++
        ) {

            gameState.gameOrder.push(i);

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

    // Cheat sheet.

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

    // Game state.

    io.emit(
        "gameState",
        gameState
    );

    // Timer.

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
// SOCKET CONNECTION
// =====================================================

io.on(
    "connection",
    socket => {

        console.log(
            "CONNECTED:",
            socket.id
        );

        // ==========================================
        // SEND CURRENT STATE
        // ==========================================

        socket.emit(
            "gameState",
            gameState
        );

        // ==========================================
        // SEND PREVIOUS QUESTIONS
        // ==========================================

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

        // ==========================================
        // REGISTER HOST
        // ==========================================

        socket.on(
            "registerHost",
            () => {

                console.log(
                    "=========================================="
                );

                console.log(
                    "HOST REGISTER REQUEST:",
                    socket.id
                );

                console.log(
                    "CURRENT HOST:",
                    hostSocketId
                );

                // Cancel pending disconnect reset.

                if (
                    hostDisconnectTimer
                ) {

                    clearTimeout(
                        hostDisconnectTimer
                    );

                    hostDisconnectTimer =
                        null;

                    console.log(
                        "HOST RECONNECT TIMER CANCELLED"
                    );

                }

                /*
                IMPORTANT FIX:

                We no longer reject a new host simply
                because hostSocketId contains an old
                socket ID.

                If the previous socket no longer exists,
                the new socket automatically becomes host.

                If another socket is still technically
                connected, the newest host takes control.

                This prevents:

                "Another host is already registered."

                when returning from HOME.
                */

                const oldHostId =
                    hostSocketId;

                if (
                    oldHostId &&
                    oldHostId !== socket.id
                ) {

                    const oldHostSocket =
                        io.sockets.sockets.get(
                            oldHostId
                        );

                    if (oldHostSocket) {

                        console.log(
                            "REPLACING OLD HOST:",
                            oldHostId,
                            "WITH:",
                            socket.id
                        );

                        oldHostSocket.emit(
                            "hostReplaced",
                            {
                                reason:
                                    "A new host session was started."
                            }
                        );

                    } else {

                        console.log(
                            "OLD HOST SOCKET NO LONGER EXISTS:",
                            oldHostId
                        );

                    }

                }

                hostSocketId =
                    socket.id;

                console.log(
                    "HOST REGISTERED:",
                    hostSocketId
                );

                console.log(
                    "=========================================="
                );

                socket.emit(
                    "hostRegistered",
                    {
                        success:
                            true
                    }
                );

            }
        );

        // ==========================================
        // HOST REPLACED
        // ==========================================

        socket.on(
            "hostLeaveGame",
            () => {

                if (
                    !isHostSocket(socket)
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
                    "host explicitly left game"
                );

                socket.emit(
                    "hostLeftConfirmed"
                );

            }
        );

        // ==========================================
        // TIMER SETTINGS
        // ==========================================

        socket.on(
            "setTimerSettings",
            data => {

                if (
                    !isHostSocket(socket)
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
                    Number.isFinite(seconds)
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

        // ==========================================
        // WINNER SETTINGS
        // ==========================================

        socket.on(
            "setWinnerSettings",
            data => {

                if (
                    !isHostSocket(socket)
                ) {

                    return;

                }

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

        // ==========================================
        // START GAME
        // ==========================================

        socket.on(
            "hostStart",
            async data => {

                if (
                    !isHostSocket(socket)
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

                    /*
                    Store selected question IDs
                    from the host.
                    */

                    if (
                        data &&
                        Array.isArray(
                            data.selectedQuestionIds
                        )
                    ) {

                        gameState.selectedQuestionIds =
                            [
                                ...new Set(
                                    data.selectedQuestionIds
                                        .map(Number)
                                        .filter(
                                            id =>
                                                Number.isInteger(id) &&
                                                id > 0
                                        )
                                )
                            ];

                    } else {

                        gameState.selectedQuestionIds =
                            [];

                    }

                    buildGameOrder();

                    if (
                        gameState.gameOrder.length === 0
                    ) {

                        gameState.status =
                            "idle";

                        socket.emit(
                            "gameStartError",
                            {
                                error:
                                    "No questions are available."
                            }
                        );

                        return;

                    }

                    gamePosition =
                        -1;

                    sendNextQuestion();

                } catch (error) {

                    console.error(
                        "START GAME ERROR:",
                        error
                    );

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

        // ==========================================
        // NEXT QUESTION
        // ==========================================

        socket.on(
            "hostNext",
            () => {

                if (
                    !isHostSocket(socket)
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

        // ==========================================
        // PREVIOUS QUESTION
        // ==========================================

        socket.on(
            "hostPrevious",
            () => {

                if (
                    !isHostSocket(socket)
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

                if (timer) {

                    clearInterval(timer);

                    timer = null;

                }

                gameState.isPaused =
                    false;

                io.emit(
                    "gameState",
                    gameState
                );

            }
        );

        // ==========================================
        // REPEAT QUESTION
        // ==========================================

        socket.on(
            "hostRepeat",
            () => {

                if (
                    !isHostSocket(socket)
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

        // ==========================================
        // PAUSE / RESUME
        // ==========================================

        socket.on(
            "togglePausePlay",
            () => {

                if (
                    !isHostSocket(socket)
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

        // ==========================================
        // HOST RESET BUTTON
        // ==========================================

        socket.on(
            "hostReset",
            () => {

                if (
                    !isHostSocket(socket)
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

        // ==========================================
        // LEGACY RESET
        // ==========================================

        socket.on(
            "resetGame",
            () => {

                if (
                    !isHostSocket(socket)
                ) {

                    return;

                }

                resetGame(
                    "legacy resetGame event"
                );

            }
        );

        // ==========================================
        // HOST LEFT GAME
        // ==========================================

        socket.on(
            "hostLeftGame",
            () => {

                if (
                    !isHostSocket(socket)
                ) {

                    return;

                }

                console.log(
                    "HOST LEFT GAME EVENT RECEIVED:",
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
                    "hostLeftGame event"
                );

            }
        );

        // ==========================================
        // DIGITAL CLAIM WIN
        // ==========================================

        socket.on(
            "claimWin",
            data => {

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

        // ==========================================
        // APPROVE DIGITAL WIN
        // ==========================================

        socket.on(
            "approveWin",
            cardId => {

                if (
                    !isHostSocket(socket)
                ) {

                    return;

                }

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

                    gameState.status =
                        "ended";

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

        // ==========================================
        // REJECT DIGITAL WIN
        // ==========================================

        socket.on(
            "rejectWin",
            cardId => {

                if (
                    !isHostSocket(socket)
                ) {

                    return;

                }

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

        // ==========================================
        // APPROVE PHYSICAL WIN
        // ==========================================

        socket.on(
            "approvePhysicalWin",
            data => {

                if (
                    !isHostSocket(socket)
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

        // ==========================================
        // REJECT PHYSICAL WIN
        // ==========================================

        socket.on(
            "rejectPhysicalWin",
            data => {

                if (
                    !isHostSocket(socket)
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

                io.emit(
                    "physicalWinRejected",
                    {
                        cardId
                    }
                );

            }
        );

        // ==========================================
        // LOAD PLAYER CARD
        // ==========================================

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

        // ==========================================
        // PLAYER MARK CARD
        // ==========================================

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
                        cardId,
                        index,
                        marked,
                        socketId:
                            socket.id
                    }
                );

            }
        );

        // ==========================================
        // GAME STATE SYNC
        // ==========================================

        socket.on(
            "requestGameStateSyncFallback",
            () => {

                socket.emit(
                    "gameState",
                    gameState
                );

            }
        );

        // ==========================================
        // DISCONNECT
        // ==========================================

        socket.on(
            "disconnect",
            reason => {

                console.log(
                    "DISCONNECTED:",
                    socket.id,
                    reason
                );

                // Remove player claims.

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

                // ==================================
                // HOST DISCONNECT
                // ==================================

                if (
                    socket.id ===
                    hostSocketId
                ) {

                    console.log(
                        "========== HOST DISCONNECTED =========="
                    );

                    /*
                    Do NOT immediately destroy the game.

                    Give the host a short window to reconnect.
                    */

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
                                    null &&
                                    !hostSocketStillExists()
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
    process.env.PORT || 3000;

async function startServer() {

    try {

        await initializeDatabase();

        if (
            process.env.MIGRATE_QUESTIONS ===
            "true"
        ) {

            require("./migrateQuestions");

        }

        await loadQuestionsFromDatabase();

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
                    "HOST RECONNECT FIX ACTIVE"
                );

                console.log(
                    "=========================================="
                );

            }
        );

    } catch (error) {

        console.error(
            "SERVER STARTUP FAILED:",
            error
        );

        process.exit(1);

    }

}

startServer();
