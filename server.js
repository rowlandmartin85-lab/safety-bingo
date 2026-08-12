"use strict";

// =====================================================
// SAFETY BINGO SERVER
// FULL CONSOLIDATED SERVER.JS
// =====================================================

require("dotenv").config();

const express = require("express");
const http = require("http");
const crypto = require("crypto");
const { Server } = require("socket.io");
const path = require("path");

const { pool, initializeDatabase } = require("./database");

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
app.use(express.static(path.join(__dirname, "public")));

// =====================================================
// HOST SESSION COOKIE
// =====================================================

const HOST_COOKIE_NAME = "safetyBingoHostSession";

function createHostSessionId() {
  return crypto.randomBytes(32).toString("hex");
}

function getCookieValue(req, name) {
  const cookieHeader = req.headers.cookie;

  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(";");

  for (const cookie of cookies) {
    const parts = cookie.trim().split("=");
    const key = parts.shift();
    const value = parts.join("=");

    if (key === name) {
      return decodeURIComponent(value || "");
    }
  }

  return null;
}

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
    throw error;
  }
}

// =====================================================
// PAGE ROUTES
// =====================================================

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/host.html", (req, res) => {
  let hostSession = getCookieValue(req, HOST_COOKIE_NAME);

  if (!hostSession) {
    hostSession = createHostSessionId();

    res.cookie(HOST_COOKIE_NAME, hostSession, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 30,
      path: "/"
    });

    console.log("NEW HOST SESSION CREATED");
  } else {
    console.log("EXISTING HOST SESSION RETURNED");
  }

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

// =====================================================
// ADD QUESTION
// =====================================================

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

    await pool.query(
      `
      INSERT INTO questions (id, category, difficulty, question, answer)
      VALUES($1, $2, $3, $4, $5)
    `,
      [
        nextID,
        newQuestion.category || "General",
        newQuestion.difficulty || "Medium",
        newQuestion.q,
        newQuestion.a
      ]
    );

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

// =====================================================
// DELETE QUESTION
// =====================================================

app.delete("/api/questions/:id", async (req, res) => {
  const id = Number(req.params.id);

  if (!id) {
    return res.status(400).json({
      success: false,
      error: "Invalid question ID"
    });
  }

  try {
    const result = await pool.query(
      `
      DELETE FROM questions
      WHERE id=$1
    `,
      [id]
    );

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
const pendingClaims = new Map();

// =====================================================
// HOST TRACKING
// =====================================================

let hostSocketId = null;
let hostSessionId = null;
let hostDisconnectTimer = null;
const HOST_RECONNECT_GRACE_PERIOD = 10000;

// =====================================================
// PHYSICAL QR CLAIM TRACKING
// =====================================================

const pendingPhysicalClaims = new Map();

// =====================================================
// RESET GAME
// =====================================================

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
  pendingPhysicalClaims.clear();

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

  io.emit("gameReset");
  io.emit("gameState", gameState);
  io.emit("timerUpdate", 0);

  console.log("========== GAME RESET COMPLETE ==========");
}

// =====================================================
// BUILD GAME ORDER
// =====================================================

function buildGameOrder() {
  gameState.gameOrder = [];

  const selectedIds = Array.isArray(gameState.selectedQuestionIds)
    ? gameState.selectedQuestionIds
    : [];

  if (selectedIds.length > 0) {
    selectedIds.forEach(id => {
      const index = safetyQuestionBank.findIndex(
        q => Number(q.id) === Number(id)
      );
      if (index >= 0) {
        gameState.gameOrder.push(index);
      }
    });
  }

  if (gameState.gameOrder.length === 0) {
    for (let i = 0; i < safetyQuestionBank.length; i++) {
      gameState.gameOrder.push(i);
    }
  }

  // Fisher-Yates shuffle
  for (let i = gameState.gameOrder.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [gameState.gameOrder[i], gameState.gameOrder[j]] = [
      gameState.gameOrder[j],
      gameState.gameOrder[i]
    ];
  }

  console.log("GAME ORDER BUILT:", gameState.gameOrder);
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

// =====================================================
// START TIMER
// =====================================================

function startTimer() {
  if (timer) {
    clearInterval(timer);
  }

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
// PHYSICAL QR CLAIM PAGE
// =====================================================

app.get("/physical-claim", (req, res) => {
  const cardId = Number(req.query.card);

  if (!Number.isInteger(cardId) || cardId <= 0) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width,initial-scale=1.0">
        <title>Safety Bingo</title>
      </head>
      <body style="margin:0;min-height:100vh;display:flex;justify-content:center;align-items:center;background:#050914;color:white;font-family:Arial,sans-serif;text-align:center;">
        <div>
          <h1>Invalid Bingo Card</h1>
          <p>This QR code does not contain a valid Card ID.</p>
        </div>
      </body>
      </html>
    `);
  }

  console.log("==========================================");
  console.log("PHYSICAL QR SCAN RECEIVED:", cardId);
  console.log("==========================================");

  if (!hostSocketId) {
    console.warn("PHYSICAL CLAIM REJECTED: NO HOST");
    return res.status(503).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width,initial-scale=1.0">
        <title>Safety Bingo</title>
      </head>
      <body style="margin:0;min-height:100vh;display:flex;justify-content:center;align-items:center;background:#050914;color:white;font-family:Arial,sans-serif;text-align:center;">
        <div>
          <h1 style="color:#FFD700;">HOST NOT AVAILABLE</h1>
          <p>The Bingo host is not currently connected.</p>
          <p>Please notify the host and try again.</p>
        </div>
      </body>
      </html>
    `);
  }

  if (gameState.status !== "running") {
    console.warn("PHYSICAL CLAIM REJECTED: GAME NOT RUNNING");
    return res.status(409).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width,initial-scale=1.0">
        <title>Safety Bingo</title>
      </head>
      <body style="margin:0;min-height:100vh;display:flex;justify-content:center;align-items:center;background:#050914;color:white;font-family:Arial,sans-serif;text-align:center;">
        <div>
          <h1 style="color:#FFD700;">GAME NOT ACTIVE</h1>
          <p>There is no active Bingo game right now.</p>
        </div>
      </body>
      </html>
    `);
  }

  const claim = {
    cardId: cardId,
    timestamp: Date.now(),
    status: "pending"
  };

  pendingPhysicalClaims.set(cardId, claim);
  console.log("PHYSICAL CLAIM STORED:", claim);

  io.to(hostSocketId).emit("physicalWinRequested", {
    cardId: cardId,
    timestamp: claim.timestamp
  });

  console.log("PHYSICAL BINGO CLAIM SENT TO HOST:", cardId);

  return res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width,initial-scale=1.0">
      <title>Safety Bingo</title>
    </head>
    <body style="margin:0;min-height:100vh;display:flex;justify-content:center;align-items:center;background:radial-gradient(circle at top,#0b1b3a,#050914);color:white;font-family:Arial,sans-serif;text-align:center;">
      <div style="width:min(90%,500px);padding:40px 25px;border-radius:20px;background:rgba(17,24,39,.95);border:2px solid rgba(255,215,0,.35);box-shadow:0 20px 45px rgba(0,0,0,.55);">
        <div style="font-size:60px;color:#22c55e;margin-bottom:15px;">✓</div>
        <h1 style="color:#FFD700;margin-bottom:15px;">BINGO CLAIM SENT</h1>
        <p style="font-size:24px;font-weight:bold;">CARD #${cardId}</p>
        <p style="color:#cbd5e1;font-size:18px;line-height:1.5;">Your Bingo claim has been sent to the host.</p>
        <p style="color:#22c55e;font-weight:bold;margin-top:25px;">Please wait while your card is checked.</p>
      </div>
    </body>
    </html>
  `);
});

// =====================================================
// SOCKET CONNECTION
// =====================================================

io.on("connection", socket => {
  console.log("CONNECTED:", socket.id);

  // Parse Cookie from handshake
  const cookieHeader = socket.handshake.headers.cookie || "";
  let socketHostSessionId = null;
  const cookieParts = cookieHeader.split(";");

  for (const cookie of cookieParts) {
    const parts = cookie.trim().split("=");
    const key = parts.shift();
    const value = parts.join("=");

    if (key === HOST_COOKIE_NAME) {
      socketHostSessionId = decodeURIComponent(value || "");
      break;
    }
  }

  socket.hostSessionId = socketHostSessionId;
  console.log(
    "SOCKET HOST SESSION:",
    socket.hostSessionId ? "PRESENT" : "NONE"
  );

  // Send initial state
  socket.emit("gameState", gameState);

  // Re-emit previous questions for cheat sheet
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

  // Host Registration
  socket.on("registerHost", () => {
    console.log("HOST REGISTER REQUEST:", socket.id);

    if (hostDisconnectTimer) {
      clearTimeout(hostDisconnectTimer);
      hostDisconnectTimer = null;
      console.log("HOST RECONNECT - RESET CANCELLED");
    }

    if (!hostSocketId) {
      hostSocketId = socket.id;
      hostSessionId = socket.hostSessionId || null;
      console.log("HOST REGISTERED:", hostSocketId);
      socket.emit("hostRegistered");
      return;
    }

    if (hostSocketId === socket.id) {
      console.log("HOST ALREADY REGISTERED ON SAME SOCKET");
      socket.emit("hostRegistered");
      return;
    }

    if (
      hostSessionId &&
      socket.hostSessionId &&
      hostSessionId === socket.hostSessionId
    ) {
      const oldHostSocketId = hostSocketId;
      console.log("SAME HOST SESSION RETURNED. REPLACING SOCKET:", oldHostSocketId);

      hostSocketId = socket.id;
      hostSessionId = socket.hostSessionId;

      const oldSocket = io.sockets.sockets.get(oldHostSocketId);
      if (oldSocket) {
        oldSocket.emit("hostSessionReplaced");
        oldSocket.disconnect(true);
      }

      socket.emit("hostRegistered");
      return;
    }

    console.warn("AN
