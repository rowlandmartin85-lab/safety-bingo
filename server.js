"use strict";

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

const app = express();
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, "public")));

let safetyQuestionBank = [];

async function loadQuestionsFromDatabase() {
    try {
        const result = await pool.query("SELECT * FROM questions ORDER BY id ASC");
        safetyQuestionBank = result.rows.map(item => ({
            id: Number(item.id),
            category: item.category,
            difficulty: item.difficulty,
            q: item.question,
            a: item.answer
        }));
        console.log(`Loaded ${safetyQuestionBank.length} questions from database`);
    } catch (error) {
        console.error("DATABASE QUESTION LOAD ERROR:", error);
        throw error;
    }
}

const routes = [
    ["/", "index.html"],
    ["/host.html", "host.html"],
    ["/player.html", "player.html"],
    ["/display.html", "display.html"],
    ["/questionManager.html", "questionManager.html"],
    ["/cheatsheet.html", "cheatsheet.html"],
    ["/answerkey.html", "answerkey.html"]
];

routes.forEach(([route, file]) => {
    app.get(route, (req, res) => res.sendFile(path.join(__dirname, file)));
});

app.get("/api/questions", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM questions ORDER BY id ASC");
        res.json(result.rows);
    } catch (error) {
        console.error("LOAD QUESTIONS ERROR:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post("/api/questions/add", async (req, res) => {
    const newQuestion = req.body;
    if (!newQuestion.q || !newQuestion.a) {
        return res.status(400).json({ success: false, error: "Question and answer required" });
    }

    try {
        const idResult = await pool.query("SELECT MAX(id) AS maxid FROM questions");
        const nextID = Number(idResult.rows[0].maxid || 0) + 1;

        await pool.query(
            "INSERT INTO questions (id, category, difficulty, question, answer) VALUES($1, $2, $3, $4, $5)",
            [nextID, newQuestion.category || "General", newQuestion.difficulty || "Medium", newQuestion.q, newQuestion.a]
        );

        console.log("QUESTION ADDED:", nextID);
        res.json({ success: true, id: nextID });
    } catch (error) {
        console.error("ADD QUESTION ERROR:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete("/api/questions/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ success: false, error: "Invalid question ID" });
    }

    try {
        const result = await pool.query("DELETE FROM questions WHERE id=$1", [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, error: "Question not found" });
        }

        console.log("QUESTION REMOVED:", id);
        res.json({ success: true });
    } catch (error) {
        console.error("DELETE ERROR:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

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
        calledAnswers: [],
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
let timer = null;
let countdown = 30;
let gamePosition = -1;
const pendingClaims = new Map();
let hostSocketId = null;
const HOST_RECONNECT_GRACE_MS = 60 * 1000;
let hostReconnectTimer = null;
let hostReconnectPending = false;

function cancelHostReconnectGrace() {
    if (hostReconnectTimer) {
        clearTimeout(hostReconnectTimer);
        hostReconnectTimer = null;
    }
    hostReconnectPending = false;
    console.log("HOST RECONNECTION GRACE PERIOD CANCELLED");
}

function startHostReconnectGrace(disconnectedHostSocketId) {
    if (hostReconnectTimer) clearTimeout(hostReconnectTimer);
    hostReconnectPending = true;

    console.log("==========================================");
    console.log("HOST DISCONNECTED");
    console.log("STARTING 60 SECOND RECONNECTION GRACE PERIOD");
    console.log("DISCONNECTED HOST SOCKET:", disconnectedHostSocketId);
    console.log("GAME WILL REMAIN ACTIVE DURING GRACE PERIOD");
    console.log("==========================================");

    hostReconnectTimer = setTimeout(() => {
        hostReconnectTimer = null;
        if (!hostReconnectPending) return;

        console.log("==========================================");
        console.log("HOST RECONNECTION GRACE PERIOD EXPIRED");
        console.log("RESETTING GAME");
        console.log("==========================================");

        hostReconnectPending = false;
        resetGame("host reconnection grace period expired");
        hostSocketId = null;
        console.log("HOST SLOT RELEASED AFTER 60 SECOND GRACE PERIOD");
    }, HOST_RECONNECT_GRACE_MS);
}

function resetGame(reason = "unknown") {
    console.log("==========================================");
    console.log("RESETTING GAME:", reason);
    console.log("==========================================");

    if (timer) {
        clearInterval(timer);
        timer = null;
    }

    countdown = 30;
    pendingClaims.clear();
    gameState = createFreshGameState();
    gamePosition = -1;

    io.emit("gameReset");
    io.emit("gameState", gameState);
    io.emit("timerUpdate", 0);

    console.log("========== GAME RESET COMPLETE ==========");
}

function buildGameOrder(selectedQuestionIds = []) {
    const normalizedIds = [...new Set(selectedQuestionIds.map(Number).filter(id => Number.isInteger(id) && id > 0))];
    let availableIndices;

    if (normalizedIds.length === 0) {
        availableIndices = safetyQuestionBank.map((_, index) => index);
    } else {
        const selectedSet = new Set(normalizedIds);
        availableIndices = safetyQuestionBank
            .map((q, index) => selectedSet.has(q.id) ? index : null)
            .filter(index => index !== null);
    }

    gameState.gameOrder = [...availableIndices];

    for (let i = gameState.gameOrder.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [gameState.gameOrder[i], gameState.gameOrder[j]] = [gameState.gameOrder[j], gameState.gameOrder[i]];
    }

    console.log("GAME ORDER BUILT:", gameState.gameOrder.length, "QUESTIONS");
}

function sendNextQuestion() {
    if (timer) {
        clearInterval(timer);
        timer = null;
    }

    gamePosition++;
    if (gamePosition >= gameState.gameOrder.length) {
        gameState.status = "ended";
        gameState.currentQuestion = "";
        gameState.currentAnswer = "";
        gameState.isPaused = false;
        io.emit("gameState", gameState);
        io.emit("gameEnded", { reason: "questions exhausted" });
        return;
    }

    const index = gameState.gameOrder[gamePosition];
    const question = safetyQuestionBank[index];

    if (!question) {
        console.error("QUESTION NOT FOUND:", index);
        return;
    }

    console.log("SENDING QUESTION:", question);

    gameState.currentQuestionIndex = index;
    gameState.askedIndices.push(index);
    gameState.currentQuestionID = question.id;
    gameState.currentQuestion = question.q;
    gameState.currentAnswer = question.a;
    gameState.currentCategory = question.category;
    gameState.currentDifficulty = question.difficulty;
    gameState.currentQuestionNumber = safetyQuestionBank.findIndex(q => q.id === question.id) + 1;
    gameState.isPaused = false;

    if (!gameState.calledAnswers.includes(question.a)) {
        gameState.calledAnswers.push(question.a);
    }

    io.emit("cheatSheetQuestion", {
        number: gameState.currentQuestionNumber,
        id: question.id,
        category: question.category,
        difficulty: question.difficulty,
        question: question.q,
        answer: question.a
    });

    io.emit("gameState", { ...gameState, repeatQuestion: false });

    if (!gameState.noTimer) {
        countdown = gameState.timerSeconds;
        io.emit("timerUpdate", countdown);
        startTimer();
    } else {
        countdown = 0;
        io.emit("timerUpdate", 0);
    }
}

function startTimer() {
    if (timer) clearInterval(timer);
    timer = setInterval(() => {
        if (gameState.isPaused) return;
        countdown--;
        io.emit("timerUpdate", countdown);
        if (countdown <= 0) sendNextQuestion();
    }, 1000);
}

io.on("connection", socket => {
    console.log("CONNECTED:", socket.id);
    socket.emit("gameState", gameState);

    gameState.askedIndices.forEach(index => {
        const question = safetyQuestionBank[index];
        if (!question) return;

        socket.emit("cheatSheetQuestion", {
            number: safetyQuestionBank.findIndex(q => q.id === question.id) + 1,
            id: question.id,
            category: question.category,
            difficulty: question.difficulty,
            question: question.q,
            answer: question.a
        });
    });

    socket.on("registerHost", () => {
        console.log("HOST REGISTER REQUEST:", socket.id);

        if (hostReconnectPending) {
            console.log("HOST RECONNECTING DURING GRACE PERIOD:", socket.id);
            cancelHostReconnectGrace();
            hostSocketId = socket.id;
            console.log("HOST RECONNECTED:", hostSocketId);
            socket.emit("hostRegistered");
            socket.emit("gameState", gameState);
            return;
        }

        if (!hostSocketId) {
            hostSocketId = socket.id;
            console.log("HOST REGISTERED:", hostSocketId);
            socket.emit("hostRegistered");
            socket.emit("gameState", gameState);
            return;
        }

        if (hostSocketId !== socket.id) {
            console.log("NEW HOST TAKING OVER:", socket.id);
            console.log("OLD HOST:", hostSocketId);
            cancelHostReconnectGrace();
            resetGame("new host connected");
            hostSocketId = socket.id;
            console.log("NEW HOST REGISTERED:", hostSocketId);
            socket.emit("hostRegistered");
            socket.emit("gameState", gameState);
            return;
        }

        socket.emit("hostRegistered");
        socket.emit("gameState", gameState);
    });

    socket.on("setTimerSettings", data => {
        if (socket.id !== hostSocketId || !data) return;

        const noTimer = data.noTimer === true;
        let seconds = Number(data.seconds);

        if (noTimer) {
            seconds = 0;
        } else if (!Number.isFinite(seconds) || seconds < 1) {
            seconds = 30;
        }

        gameState.timerSeconds = seconds;
        gameState.noTimer = noTimer;
        console.log("TIMER SETTINGS:", { seconds: gameState.timerSeconds, noTimer: gameState.noTimer });
        io.emit("gameState", gameState);
    });

    socket.on("setWinnerSettings", data => {
        if (socket.id !== hostSocketId || !data) return;

        let maxWinners = Number(data.maxWinners);
        if (!Number.isInteger(maxWinners) || maxWinners < 1) maxWinners = 1;

        gameState.maxWinners = maxWinners;
        console.log("MAX WINNERS:", gameState.maxWinners);
        io.emit("gameState", gameState);
    });

    socket.on("hostStart", async data => {
        if (socket.id !== hostSocketId) {
            console.warn("HOST START REJECTED:", socket.id);
            return;
        }

        if (gameState.status === "running") return;

        try {
            await loadQuestionsFromDatabase();

            let selectedQuestionIds = [];
            if (data && Array.isArray(data.selectedQuestionIds)) {
                selectedQuestionIds = data.selectedQuestionIds.map(Number).filter(id => Number.isInteger(id) && id > 0);
            }

            selectedQuestionIds = [...new Set(selectedQuestionIds)];
            const availableQuestionIds = new Set(safetyQuestionBank.map(q => q.id));
            selectedQuestionIds = selectedQuestionIds.filter(id => availableQuestionIds.has(id));

            gameState.selectedQuestionIds = [...selectedQuestionIds];

            if (safetyQuestionBank.length === 0) {
                socket.emit("gameStartError", { error: "There are no questions in the database." });
                return;
            }

            pendingClaims.clear();
            gameState.status = "running";
            gameState.currentQuestionIndex = -1;
            gameState.currentQuestion = "";
            gameState.currentAnswer = "";
            gameState.currentQuestionID = null;
            gameState.currentQuestionNumber = null;
            gameState.currentCategory = "";
            gameState.currentDifficulty = "";
            gameState.askedIndices = [];
            gameState.calledAnswers = [];
            gameState.approvedWinnersCount = 0;
            gameState.approvedWinnersList = [];
            gameState.isPaused = false;

            buildGameOrder(gameState.selectedQuestionIds);

            if (gameState.gameOrder.length === 0) {
                gameState.status = "idle";
                socket.emit("gameStartError", { error: "None of the selected questions exist in the database." });
                return;
            }

            gamePosition = -1;

            console.log("==========================================");
            console.log("GAME STARTED");
            console.log("SELECTED IDS:", gameState.selectedQuestionIds);
            console.log("QUESTIONS IN GAME:", gameState.gameOrder.length);
            console.log("==========================================");

            sendNextQuestion();
        } catch (error) {
            console.error("START GAME ERROR:", error);
            gameState.status = "idle";
            socket.emit("gameStartError", { error: "Unable to start game." });
        }
    });

    socket.on("hostNext", () => {
        if (socket.id !== hostSocketId || gameState.status !== "running") return;
        sendNextQuestion();
    });

    socket.on("hostPrevious", () => {
        if (socket.id !== hostSocketId || gameState.status !== "running" || gamePosition <= 0) return;

        if (timer) {
            clearInterval(timer);
            timer = null;
        }

        gamePosition--;

        const index = gameState.gameOrder[gamePosition];
        const question = safetyQuestionBank[index];
        if (!question) return;

        gameState.currentQuestionIndex = index;
        gameState.currentQuestionID = question.id;
        gameState.currentQuestion = question.q;
        gameState.currentAnswer = question.a;
        gameState.currentCategory = question.category;
        gameState.currentDifficulty = question.difficulty;
        gameState.currentQuestionNumber = safetyQuestionBank.findIndex(q => q.id === question.id) + 1;
        gameState.isPaused = false;

        if (!gameState.noTimer) {
            countdown = gameState.timerSeconds;
            io.emit("timerUpdate", countdown);
            startTimer();
        } else {
            countdown = 0;
            io.emit("timerUpdate", 0);
        }

        io.emit("cheatSheetQuestion", {
            number: gameState.currentQuestionNumber,
            id: question.id,
            category: question.category,
            difficulty: question.difficulty,
            question: question.q,
            answer: question.a
        });

        io.emit("gameState", { ...gameState, repeatQuestion: false });
    });

    socket.on("hostRepeat", () => {
        if (socket.id !== hostSocketId || gameState.status !== "running") return;
        io.emit("gameState", { ...gameState, repeatQuestion: true });
    });

    socket.on("togglePausePlay", () => {
        if (socket.id !== hostSocketId || gameState.status !== "running") return;

        gameState.isPaused = !gameState.isPaused;
        console.log("PAUSE:", gameState.isPaused);

        if (gameState.isPaused) {
            if (timer) {
                clearInterval(timer);
                timer = null;
            }
        } else if (!gameState.noTimer) {
            countdown = Math.max(countdown, 1);
            startTimer();
        }

        io.emit("gameState", gameState);
    });

    socket.on("hostReset", () => {
        if (socket.id !== hostSocketId) return;
        console.log("HOST RESET BUTTON:", socket.id);
        resetGame("host reset button");
    });

    socket.on("resetGame", () => {
        if (socket.id !== hostSocketId) return;
        resetGame("legacy resetGame event");
    });

    socket.on("hostLeftGame", () => {
        if (socket.id !== hostSocketId) return;
        console.log("========== HOST LEFT GAME ==========");
        startHostReconnectGrace(socket.id);
    });

    socket.on("claimWin", data => {
        if (!data) return;

        const cardId = Number(data.cardId);
        if (!Number.isInteger(cardId) || cardId <= 0) return;
        if (gameState.status !== "running") return;
        if (gameState.approvedWinnersCount >= gameState.maxWinners) return;

        const claim = {
            cardId,
            markedIndices: Array.isArray(data.markedIndices) ? [...data.markedIndices] : [],
            winningPattern: Array.isArray(data.winningPattern) ? [...data.winningPattern] : [],
            timestamp: data.timestamp || Date.now(),
            playerSocketId: socket.id
        };

        pendingClaims.set(cardId, claim);
        io.emit("winRequested", {
            cardId: claim.cardId,
            markedIndices: claim.markedIndices,
            winningPattern: claim.winningPattern,
            timestamp: claim.timestamp
        });
    });

    socket.on("approveWin", cardId => {
        if (socket.id !== hostSocketId) return;

        const id = Number(cardId);
        if (!Number.isInteger(id) || id <= 0) return;

        const pendingClaim = pendingClaims.get(id);
        if (!pendingClaim) return;
        if (gameState.approvedWinnersList.includes(id)) {
            pendingClaims.delete(id);
            return;
        }
        if (gameState.approvedWinnersCount >= gameState.maxWinners) {
            pendingClaims.delete(id);
            return;
        }

        pendingClaims.delete(id);
        gameState.approvedWinnersList.push(id);
        gameState.approvedWinnersCount++;

        io.emit("winApproved", { cardId: id });

        if (gameState.approvedWinnersCount >= gameState.maxWinners) {
            gameState.status = "ended";
            if (timer) {
                clearInterval(timer);
                timer = null;
            }
            pendingClaims.clear();
            io.emit("gameEnded", { reason: "winner limit reached" });
        }

        io.emit("gameState", gameState);
    });

    socket.on("rejectWin", cardId => {
        if (socket.id !== hostSocketId) return;

        const id = Number(cardId);
        if (!Number.isInteger(id) || id <= 0) return;

        const pendingClaim = pendingClaims.get(id);
        const winningPattern = pendingClaim && Array.isArray(pendingClaim.winningPattern) ? [...pendingClaim.winningPattern] : [];

        pendingClaims.delete(id);
        io.emit("winRejected", { cardId: id, winningPattern });
    });

    socket.on("approvePhysicalWin", data => {
        if (socket.id !== hostSocketId || !data) return;

        const id = Number(data.cardId);
        if (!Number.isInteger(id) || id <= 0) return;
        if (gameState.approvedWinnersList.includes(id)) return;
        if (gameState.approvedWinnersCount >= gameState.maxWinners) return;

        gameState.approvedWinnersList.push(id);
        gameState.approvedWinnersCount++;

        io.emit("physicalWinApproved", { cardId: id, winnerCount: gameState.approvedWinnersCount });

        if (gameState.approvedWinnersCount >= gameState.maxWinners) {
            gameState.status = "ended";
            if (timer) {
                clearInterval(timer);
                timer = null;
            }
            pendingClaims.clear();
            io.emit("gameEnded", { reason: "winner limit reached" });
        }

        io.emit("gameState", gameState);
    });

    socket.on("rejectPhysicalWin", data => {
        if (socket.id !== hostSocketId || !data) return;

        const cardId = Number(data.cardId);
        if (!Number.isInteger(cardId) || cardId <= 0) return;

        io.emit("physicalWinRejected", { cardId });
    });

    socket.on("loadCard", cardId => {
        const id = Number(cardId);
        if (!Number.isInteger(id) || id <= 0) return;
        socket.emit("cardLoaded", { cardId: id });
    });

    socket.on("markCard", data => {
        if (!data) return;

        const cardId = Number(data.id);
        const index = Number(data.index);
        const marked = data.marked === true;

        if (!Number.isInteger(cardId) || cardId <= 0) return;
        if (!Number.isInteger(index) || index < 0 || index > 24) return;

        console.log("CARD MARK:", { cardId, index, marked, socketId: socket.id });
    });

    socket.on("requestGameStateSyncFallback", () => {
        socket.emit("gameState", gameState);
    });

    socket.on("disconnect", () => {
        console.log("DISCONNECTED:", socket.id);

        for (const [cardId, claim] of pendingClaims.entries()) {
            if (claim.playerSocketId === socket.id) {
                pendingClaims.delete(cardId);
            }
        }

        if (socket.id === hostSocketId) {
            console.log("========== HOST CLOSED/DISCONNECTED ==========");
            startHostReconnectGrace(socket.id);
        }
    });
});

const PORT = process.env.PORT || 3000;

loadQuestionsFromDatabase()
    .then(() => {
        server.listen(PORT, "0.0.0.0", () => {
            console.log(`Safety Bingo running on port ${PORT}`);
        });
    })
    .catch(error => {
        console.error("SERVER STARTUP FAILED:", error);
        process.exit(1);
    });
