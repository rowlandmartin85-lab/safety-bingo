// =====================================================
// SAFETY BINGO SERVER - SERVER.JS
// =====================================================

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

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, "public")));

let safetyQuestionBank = [];

async function loadQuestionsFromDatabase() {
  try {
    const result = await pool.query(`SELECT * FROM questions ORDER BY id ASC`);
    safetyQuestionBank = result.rows.map(item => ({
      id: item.id,
      category: item.category,
      difficulty: item.difficulty,
      q: item.question,
      a: item.answer
    }));
    console.log(`Loaded ${safetyQuestionBank.length} questions from database`);
  } catch (error) {
    console.error("DATABASE QUESTION LOAD ERROR:", error);
    process.exit(1);
  }
}

// HTTP ROUTES
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/host.html", (req, res) => res.sendFile(path.join(__dirname, "host.html")));
app.get("/player.html", (req, res) => res.sendFile(path.join(__dirname, "player.html")));
app.get("/display.html", (req, res) => res.sendFile(path.join(__dirname, "display.html")));
app.get("/questionManager.html", (req, res) => res.sendFile(path.join(__dirname, "questionManager.html")));
app.get("/cheatsheet.html", (req, res) => res.sendFile(path.join(__dirname, "cheatsheet.html")));

// QUESTION API
app.get("/api/questions", async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM questions ORDER BY id ASC`);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/api/questions/add", async (req, res) => {
  const newQuestion = req.body;
  if (!newQuestion.q || !newQuestion.a) {
    return res.status(400).json({ success: false, error: "Question and answer required" });
  }
  try {
    const idResult = await pool.query(`SELECT MAX(id) AS maxid FROM questions`);
    const nextID = Number(idResult.rows[0].maxid || 0) + 1;
    await pool.query(
      `INSERT INTO questions (id, category, difficulty, question, answer) VALUES($1, $2, $3, $4, $5)`,
      [nextID, newQuestion.category || "General", newQuestion.difficulty || "Medium", newQuestion.q, newQuestion.a]
    );
    res.json({ success: true, id: nextID });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete("/api/questions/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ success: false, error: "Invalid ID" });
  try {
    const result = await pool.query(`DELETE FROM questions WHERE id=$1`, [id]);
    if (result.rowCount === 0) return res.status(404).json({ success: false, error: "Not found" });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// INITIAL STATE FACTORY
function getInitialState() {
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

let gameState = getInitialState();
let timer = null;
let countdown = 30;
let gamePosition = -1;
const pendingClaims = new Map();

function buildGameOrder() {
  gameState.gameOrder = safetyQuestionBank.map((_, i) => i);
  for (let i = gameState.gameOrder.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [gameState.gameOrder[i], gameState.gameOrder[j]] = [gameState.gameOrder[j], gameState.gameOrder[i]];
  }
}

function sendNextQuestion() {
  clearInterval(timer);
  timer = null;
  gamePosition++;

  if (gamePosition >= gameState.gameOrder.length) {
    gameState.status = "ended";
    gameState.currentQuestion = "";
    gameState.currentAnswer = "";
    io.emit("gameState", gameState);
    return;
  }

  const index = gameState.gameOrder[gamePosition];
  const question = safetyQuestionBank[index];
  if (!question) return;

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

  io.emit("gameState", gameState);

  if (!gameState.noTimer) {
    countdown = gameState.timerSeconds;
    io.emit("timerUpdate", countdown);
    startTimer();
  }
}

function startTimer() {
  clearInterval(timer);
  timer = setInterval(() => {
    if (gameState.isPaused) return;
    countdown--;
    io.emit("timerUpdate", countdown);
    if (countdown <= 0) sendNextQuestion();
  }, 1000);
}

function performReset() {
  clearInterval(timer);
  timer = null;
  countdown = 30;
  gamePosition = -1;
  pendingClaims.clear();
  gameState = getInitialState();
  io.emit("gameReset");
  io.emit("gameState", gameState);
  io.emit("timerUpdate", 0);
}

// SOCKET EVENTS
io.on("connection", socket => {
  socket.emit("gameState", gameState);

  // SINGLE-CLICK START ENGINE
  socket.on("hostStart", async (data = {}) => {
    await loadQuestionsFromDatabase();
    clearInterval(timer);
    timer = null;
    gamePosition = -1;
    pendingClaims.clear();

    gameState = getInitialState();
    gameState.timerSeconds = Number(data.timerSeconds) || 30;
    gameState.noTimer = data.noTimer === true;
    gameState.maxWinners = Number(data.maxWinners) || 1;
    gameState.status = "running";

    buildGameOrder();
    sendNextQuestion();
  });

  socket.on("setTimerSettings", data => {
    if (!data) return;
    gameState.timerSeconds = Number(data.seconds) || 30;
    gameState.noTimer = data.noTimer === true;
    io.emit("gameState", gameState);
  });

  socket.on("setWinnerSettings", data => {
    if (!data) return;
    gameState.maxWinners = Number(data.maxWinners) || 1;
    io.emit("gameState", gameState);
  });

  socket.on("hostNext", () => {
    if (gameState.status === "running") sendNextQuestion();
  });

  socket.on("hostPrevious", () => {
    if (gameState.status !== "running" || gamePosition <= 0) return;
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

    clearInterval(timer);
    timer = null;
    io.emit("gameState", gameState);
  });

  socket.on("hostRepeat", () => {
    io.emit("gameState", { ...gameState, repeatQuestion: true });
  });

  socket.on("togglePausePlay", () => {
    gameState.isPaused = !gameState.isPaused;
    if (gameState.isPaused) {
      clearInterval(timer);
      timer = null;
    } else if (gameState.status === "running" && !gameState.noTimer) {
      countdown = Math.max(countdown, 1);
      startTimer();
    }
    io.emit("gameState", gameState);
  });

  socket.on("hostReset", () => {
    performReset();
  });

  socket.on("claimWin", data => {
    if (!data || gameState.status !== "running") return;
    const cardId = Number(data.cardId);
    if (!cardId || gameState.approvedWinnersCount >= gameState.maxWinners) return;

    const claim = {
      cardId,
      markedIndices: Array.isArray(data.markedIndices) ? [...data.markedIndices] : [],
      winningPattern: Array.isArray(data.winningPattern) ? [...data.winningPattern] : [],
      timestamp: data.timestamp || Date.now(),
      playerSocketId: socket.id
    };

    pendingClaims.set(cardId, claim);
    io.emit("winRequested", claim);
  });

  socket.on("approveWin", cardId => {
    const id = Number(cardId);
    if (!id || !pendingClaims.has(id)) return;
    if (gameState.approvedWinnersList.includes(id)) return;

    pendingClaims.delete(id);
    gameState.approvedWinnersList.push(id);
    gameState.approvedWinnersCount++;

    io.emit("winApproved", { cardId: id });
    io.emit("gameState", gameState);

    if (gameState.approvedWinnersCount >= gameState.maxWinners) {
      gameState.status = "ended";
      clearInterval(timer);
      timer = null;
      pendingClaims.clear();
      io.emit("gameEnded", { reason: "winner limit reached" });
      io.emit("gameState", gameState);
    }
  });

  socket.on("rejectWin", cardId => {
    const id = Number(cardId);
    if (!id) return;
    const claim = pendingClaims.get(id);
    const winningPattern = claim ? claim.winningPattern : [];
    pendingClaims.delete(id);
    io.emit("winRejected", { cardId: id, winningPattern });
  });

  socket.on("approvePhysicalWin", data => {
    if (!data) return;
    const id = Number(data.cardId);
    if (!id || gameState.approvedWinnersList.includes(id)) return;

    gameState.approvedWinnersList.push(id);
    gameState.approvedWinnersCount++;
    io.emit("physicalWinApproved", { cardId: id, winnerCount: gameState.approvedWinnersCount });

    if (gameState.approvedWinnersCount >= gameState.maxWinners) {
      gameState.status = "ended";
      clearInterval(timer);
      timer = null;
      pendingClaims.clear();
      io.emit("gameEnded", { reason: "winner limit reached" });
    }
    io.emit("gameState", gameState);
  });

  socket.on("rejectPhysicalWin", data => {
    if (data && data.cardId) {
      io.emit("physicalWinRejected", { cardId: Number(data.cardId) });
    }
  });

  socket.on("loadCard", cardId => {
    if (cardId) socket.emit("cardLoaded", { cardId: Number(cardId) });
  });

  socket.on("requestGameStateSyncFallback", () => {
    socket.emit("gameState", gameState);
  });
});

const PORT = process.env.PORT || 3000;
loadQuestionsFromDatabase().then(() => {
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Safety Bingo running on port ${PORT}`);
  });
});
