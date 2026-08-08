// =====================================================
// SAFETY BINGO SERVER
// FULL CONSOLIDATED SERVER.JS
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

    console.log(`Loaded ${safetyQuestionBank.length} questions from database`);
  } catch (error) {
    console.error("DATABASE QUESTION LOAD ERROR:", error);
    process.exit(1);
  }
}

// =====================================================
// PAGE ROUTES
// =====================================================

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/host.html", (req, res) => {
  res.sendFile(path.join(__dirname, "host.html"));
});

app.get("/player.html", (req, res) => {
  res.sendFile(path.join(__dirname, "player.html"));
});

app.get("/display.html", (req, res) => {
  res.sendFile(path.join(__dirname, "display.html"));
});

app.get("/questionManager.html", (req, res) => {
  res.sendFile(path.join(__dirname, "questionManager.html"));
});

app.get("/cheatsheet.html", (req, res) => {
  res.sendFile(path.join(__dirname, "cheatsheet.html"));
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
    console.error("LOAD QUESTIONS ERROR:", error);
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

    const nextID = Number(idResult.rows[0].maxid || 0) + 1;

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

    console.log("QUESTION ADDED:", nextID);

    res.json({
      success: true,
      id: nextID
    });
  } catch (error) {
    console.error("ADD QUESTION ERROR:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.delete("/api/questions/:id", async (req, res) => {
  const id = Number(req.params.id);

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

    console.log("QUESTION REMOVED:", id);

    res.json({
      success: true
    });
  } catch (error) {
    console.error("DELETE ERROR:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// =====================================================
// GAME STATE & VARIABLES
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

let timer = null;
let countdown = 30;
let gamePosition = -1;

const pendingClaims = new Map();

// =====================================================
// QUESTION ENGINE
// =====================================================

function buildGameOrder() {
  gameState.gameOrder = [];

  for (let i = 0; i < safetyQuestionBank.length; i++) {
    gameState.gameOrder.push(i);
  }

  for (let i = gameState.gameOrder.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [gameState.gameOrder[i], gameState.gameOrder[j]] = [
      gameState.gameOrder[j],
      gameState.gameOrder[i]
    ];
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
  gameState.currentQuestionNumber =
    safetyQuestionBank.findIndex(q => q.id === question.id) + 1;
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
    if (gameState.isPaused) {
      return;
    }

    countdown--;

    io.emit("timerUpdate", countdown);

    if (countdown <= 0) {
      sendNextQuestion();
    }
  }, 1000);
}

// =====================================================
// SOCKET CONNECTION & EVENT HANDLERS
// =====================================================

io.on("connection", socket => {
  console.log("CONNECTED:", socket.id);

  socket.emit("gameState", gameState);

  // Send Previous Questions to new connections
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

  // Timer Settings
  socket.on("setTimerSettings", data => {
    if (!data) return;

    gameState.timerSeconds = Number(data.seconds) || 30;
    gameState.noTimer = data.noTimer === true;

    console.log("TIMER SETTINGS:", {
      seconds: gameState.timerSeconds,
      noTimer: gameState.noTimer
    });

    io.emit("gameState", gameState);
  });

  // Winner Settings
  socket.on("setWinnerSettings", data => {
    if (!data) return;

    gameState.maxWinners = Number(data.maxWinners) || 1;

    console.log("MAX WINNERS:", gameState.maxWinners);

    io.emit("gameState", gameState);
  });

  // Start Game
  socket.on("hostStart", async () => {
    if (gameState.status === "running") return;

    try {
      await loadQuestionsFromDatabase();

      pendingClaims.clear();

      gameState.status = "running";
      gameState.askedIndices = [];
      gameState.calledAnswers = [];
      gameState.approvedWinnersCount = 0;
      gameState.approvedWinnersList = [];

      buildGameOrder();

      gamePosition = -1;

      sendNextQuestion();
    } catch (error) {
      console.error("START GAME ERROR:", error);
    }
  });

  // Next Question
  socket.on("hostNext", () => {
    if (gameState.status !== "running") return;
    sendNextQuestion();
  });

  // Previous Question
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
    gameState.currentQuestionNumber =
      safetyQuestionBank.findIndex(q => q.id === question.id) + 1;

    clearInterval(timer);
    timer = null;

    io.emit("gameState", gameState);
  });

  // Repeat Question
  socket.on("hostRepeat", () => {
    io.emit("gameState", {
      ...gameState,
      repeatQuestion: true
    });
  });

  // Pause / Resume Toggle
  socket.on("togglePausePlay", () => {
    gameState.isPaused = !gameState.isPaused;

    console.log("PAUSE:", gameState.isPaused);

    if (gameState.isPaused) {
      clearInterval(timer);
      timer = null;
    } else if (gameState.status === "running" && !gameState.noTimer) {
      countdown = Math.max(countdown, 1);
      startTimer();
    }

    io.emit("gameState", gameState);
  });

  // Reset Game
  socket.on("hostReset", () => {
    console.log("========== RESETTING GAME ==========");

    clearInterval(timer);
    timer = null;
    countdown = 30;

    pendingClaims.clear();
    console.log("PENDING DIGITAL CLAIMS CLEARED");

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
      approvedWinnersList: []
    };

    gamePosition = -1;

    io.emit("gameReset");
    io.emit("gameState", gameState);
    io.emit("timerUpdate", 0);

    console.log("========== GAME RESET COMPLETE ==========");
  });

  // Digital Claim Win
  socket.on("claimWin", data => {
    console.log("========== BINGO CLAIM RECEIVED ==========", data);

    if (!data) {
      console.warn("BINGO CLAIM REJECTED: NO DATA");
      return;
    }

    const cardId = Number(data.cardId);

    if (!cardId) {
      console.warn("BINGO CLAIM REJECTED: INVALID CARD ID", data);
      return;
    }

    if (gameState.status !== "running") {
      console.warn("BINGO CLAIM REJECTED: GAME NOT RUNNING", cardId);
      return;
    }

    if (gameState.approvedWinnersCount >= gameState.maxWinners) {
      console.log("BINGO CLAIM IGNORED: WINNER LIMIT REACHED", cardId);
      return;
    }

    const claim = {
      cardId: cardId,
      markedIndices: Array.isArray(data.markedIndices) ? [...data.markedIndices] : [],
      winningPattern: Array.isArray(data.winningPattern) ? [...data.winningPattern] : [],
      timestamp: data.timestamp || Date.now(),
      playerSocketId: socket.id
    };

    pendingClaims.set(cardId, claim);

    console.log("DIGITAL CLAIM STORED:", claim);

    io.emit("winRequested", {
      cardId: claim.cardId,
      markedIndices: claim.markedIndices,
      winningPattern: claim.winningPattern,
      timestamp: claim.timestamp
    });

    console.log("WIN REQUEST SENT TO HOST:", cardId);
  });

  // Approve Digital Win
  socket.on("approveWin", cardId => {
    const id = Number(cardId);

    if (!id) {
      console.warn("APPROVE WIN FAILED: INVALID CARD ID", cardId);
      return;
    }

    const pendingClaim = pendingClaims.get(id);

    if (!pendingClaim) {
      console.warn("APPROVE WIN FAILED: NO PENDING CLAIM", id);
      return;
    }

    if (gameState.approvedWinnersList.includes(id)) {
      console.log("CARD ALREADY APPROVED:", id);
      pendingClaims.delete(id);
      return;
    }

    if (gameState.approvedWinnersCount >= gameState.maxWinners) {
      console.log("APPROVAL IGNORED: WINNER LIMIT REACHED", id);
      pendingClaims.delete(id);
      return;
    }

    pendingClaims.delete(id);

    gameState.approvedWinnersList.push(id);
    gameState.approvedWinnersCount++;

    console.log(
      "DIGITAL WIN APPROVED:",
      id,
      "WINNERS:",
      gameState.approvedWinnersCount,
      "/",
      gameState.maxWinners
    );

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

  // Reject Digital Win
  socket.on("rejectWin", cardId => {
    const id = Number(cardId);

    if (!id) {
      console.warn("REJECT WIN FAILED: INVALID CARD ID", cardId);
      return;
    }

    console.log("========== DIGITAL WIN REJECTED ==========", id);

    const removed = pendingClaims.delete(id);

    console.log("PENDING CLAIM REMOVED:", removed, "CARD:", id);

    io.emit("winRejected", { cardId: id });
    console.log("PLAYER MAY CONTINUE PLAYING:", id);
  });

  // Approve Physical Win
  socket.on("approvePhysicalWin", data => {
    if (!data) return;

    const id = Number(data.cardId);

    if (!id || gameState.approvedWinnersList.includes(id)) return;

    if (gameState.approvedWinnersCount >= gameState.maxWinners) return;

    gameState.approvedWinnersList.push(id);
    gameState.approvedWinnersCount++;

    console.log(
      "PHYSICAL WIN APPROVED:",
      id,
      "WINNERS:",
      gameState.approvedWinnersCount,
      "/",
      gameState.maxWinners
    );

    io.emit("physicalWinApproved", {
      cardId: id,
      winnerCount: gameState.approvedWinnersCount
    });

    if (gameState.approvedWinnersCount >= gameState.maxWinners) {
      gameState.status = "ended";

      clearInterval(timer);
      timer = null;

      pendingClaims.clear();

      io.emit("gameEnded", { reason: "winner limit reached" });
    }

    io.emit("gameState", gameState);
  });

  // Reject Physical Win
  socket.on("rejectPhysicalWin", data => {
    if (!data) return;

    const cardId = Number(data.cardId);

    if (!cardId) return;

    console.log("PHYSICAL WIN REJECTED:", cardId);

    io.emit("physicalWinRejected", { cardId: cardId });
  });

  // Load Player Card
  socket.on("loadCard", cardId => {
    const id = Number(cardId);

    if (!id) return;

    console.log("CARD LOADED BY PLAYER:", id, socket.id);

    socket.emit("cardLoaded", { cardId: id });
  });

  // Player Mark Card
  socket.on("markCard", data => {
    if (!data) return;

    const cardId = Number(data.id);
    const index = Number(data.index);
    const marked = data.marked === true;

    if (!cardId) return;

    if (!Number.isInteger(index) || index < 0 || index > 24) return;

    console.log("CARD MARK:", {
      cardId: cardId,
      index: index,
      marked: marked,
      socketId: socket.id
    });
  });

  // Game State Sync Fallback
  socket.on("requestGameStateSyncFallback", () => {
    socket.emit("gameState", gameState);
  });

  // Disconnect
  socket.on("disconnect", () => {
    console.log("DISCONNECTED:", socket.id);

    for (const [cardId, claim] of pendingClaims.entries()) {
      if (claim.playerSocketId === socket.id) {
        pendingClaims.delete(cardId);
        console.log("REMOVED CLAIM FROM DISCONNECTED PLAYER:", cardId);
      }
    }
  });
});

// =====================================================
// SERVER STARTUP
// =====================================================

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
