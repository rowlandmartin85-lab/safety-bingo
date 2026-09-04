"use strict";

require("dotenv").config();

const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const { pool, initializeDatabase } = require("./database");

const PORT = Number(process.env.PORT) || 3000;
const HOST_RECONNECT_GRACE_MS = 60 * 1000;
const DEFAULT_TIMER_SECONDS = 30;

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(express.json());
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, "public")));

// -----------------------------------------------------------------------------
// Application state
// -----------------------------------------------------------------------------

let safetyQuestionBank = [];
let displayMuted = false;

let gameState = createFreshGameState();

let timer = null;
let countdown = DEFAULT_TIMER_SECONDS;
let gamePosition = -1;

let hostSocketId = null;
let hostReconnectTimer = null;
let hostReconnectPending = false;

const pendingClaims = new Map();

// -----------------------------------------------------------------------------
// Database
// -----------------------------------------------------------------------------

async function loadQuestionsFromDatabase() {
  try {
    const result = await pool.query(
      "SELECT * FROM questions ORDER BY id ASC"
    );

    safetyQuestionBank = result.rows.map((item) => ({
      id: Number(item.id),
      category: item.category,
      difficulty: item.difficulty,
      q: item.question,
      a: item.answer,
    }));

    console.log(
      `Loaded ${safetyQuestionBank.length} questions from database`
    );
  } catch (error) {
    console.error("DATABASE QUESTION LOAD ERROR:", error);
    throw error;
  }
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

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

    timerSeconds: DEFAULT_TIMER_SECONDS,
    noTimer: false,
    isPaused: false,

    maxWinners: 1,
    approvedWinnersCount: 0,
    approvedWinnersList: [],

    displayMuted,
  };
}

function getGameState() {
  return {
    ...gameState,
    displayMuted,
  };
}

function broadcastGameState(extra = {}) {
  io.emit("gameState", {
    ...getGameState(),
    ...extra,
  });
}

function sendMuteState(socket = null) {
  const target = socket || io;

  target.emit("displayMuteChanged", {
    muted: displayMuted,
  });
}

function sendCurrentState(socket = null) {
  const target = socket || io;

  sendMuteState(socket);
  target.emit("gameState", getGameState());
}

function isHost(socket) {
  return socket.id === hostSocketId;
}

function normalizePositiveInteger(value) {
  const number = Number(value);

  return Number.isInteger(number) && number > 0
    ? number
    : null;
}

function clearGameTimer() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function emitTimer() {
  io.emit("timerUpdate", countdown);
}

function resetQuestionState() {
  gameState.currentQuestionIndex = -1;
  gameState.currentQuestion = "";
  gameState.currentAnswer = "";
  gameState.currentQuestionID = null;
  gameState.currentQuestionNumber = null;
  gameState.currentCategory = "";
  gameState.currentDifficulty = "";
}

function emitQuestion(question, index) {
  const questionNumber = index + 1;

  io.emit("cheatSheetQuestion", {
    number: questionNumber,
    id: question.id,
    category: question.category,
    difficulty: question.difficulty,
    question: question.q,
    answer: question.a,
  });
}

function sendQuestionToSocket(socket, question, index) {
  socket.emit("cheatSheetQuestion", {
    number: index + 1,
    id: question.id,
    category: question.category,
    difficulty: question.difficulty,
    question: question.q,
    answer: question.a,
  });
}

function clearPendingClaimsForSocket(socketId) {
  for (const [cardId, claim] of pendingClaims.entries()) {
    if (claim.playerSocketId === socketId) {
      pendingClaims.delete(cardId);
    }
  }
}

// -----------------------------------------------------------------------------
// Host reconnection handling
// -----------------------------------------------------------------------------

function cancelHostReconnectGrace() {
  if (hostReconnectTimer) {
    clearTimeout(hostReconnectTimer);
    hostReconnectTimer = null;
  }

  hostReconnectPending = false;

  console.log("HOST RECONNECTION GRACE PERIOD CANCELLED");
}

function startHostReconnectGrace(disconnectedHostSocketId) {
  if (hostReconnectTimer) {
    clearTimeout(hostReconnectTimer);
  }

  hostReconnectPending = true;

  console.log("==========================================");
  console.log("HOST DISCONNECTED");
  console.log("STARTING 60 SECOND RECONNECTION GRACE PERIOD");
  console.log("DISCONNECTED HOST SOCKET:", disconnectedHostSocketId);
  console.log("GAME WILL REMAIN ACTIVE DURING GRACE PERIOD");
  console.log("==========================================");

  hostReconnectTimer = setTimeout(() => {
    hostReconnectTimer = null;

    if (!hostReconnectPending) {
      return;
    }

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

// -----------------------------------------------------------------------------
// Game management
// -----------------------------------------------------------------------------

function resetGame(reason = "unknown") {
  console.log("==========================================");
  console.log("RESETTING GAME:", reason);
  console.log("==========================================");

  clearGameTimer();

  countdown = DEFAULT_TIMER_SECONDS;
  gamePosition = -1;

  pendingClaims.clear();

  gameState = createFreshGameState();

  io.emit("gameReset");
  broadcastGameState();
  io.emit("timerUpdate", 0);

  // Mute state intentionally survives a game reset.
  sendMuteState();

  console.log("========== GAME RESET COMPLETE ==========");
}

function buildGameOrder(selectedQuestionIds = []) {
  const normalizedIds = [
    ...new Set(
      selectedQuestionIds
        .map(Number)
        .filter((id) => Number.isInteger(id) && id > 0)
    ),
  ];

  let availableIndices;

  if (normalizedIds.length === 0) {
    availableIndices = safetyQuestionBank.map((_, index) => index);
  } else {
    const selectedSet = new Set(normalizedIds);

    availableIndices = safetyQuestionBank
      .map((question, index) =>
        selectedSet.has(question.id) ? index : null
      )
      .filter((index) => index !== null);
  }

  // Fisher-Yates shuffle.
  for (let i = availableIndices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));

    [availableIndices[i], availableIndices[j]] = [
      availableIndices[j],
      availableIndices[i],
    ];
  }

  gameState.gameOrder = availableIndices;

  console.log(
    "GAME ORDER BUILT:",
    gameState.gameOrder.length,
    "QUESTIONS"
  );
}

function startQuestionTimer() {
  clearGameTimer();

  if (gameState.noTimer) {
    countdown = 0;
    emitTimer();
    return;
  }

  countdown = gameState.timerSeconds;
  emitTimer();

  timer = setInterval(() => {
    if (gameState.isPaused) {
      return;
    }

    countdown -= 1;
    emitTimer();

    if (countdown <= 0) {
      sendNextQuestion();
    }
  }, 1000);
}

function applyQuestion(question, index) {
  gameState.currentQuestionIndex = index;
  gameState.currentQuestionID = question.id;
  gameState.currentQuestion = question.q;
  gameState.currentAnswer = question.a;
  gameState.currentCategory = question.category;
  gameState.currentDifficulty = question.difficulty;
  gameState.currentQuestionNumber = index + 1;
  gameState.isPaused = false;
  gameState.displayMuted = displayMuted;

  gameState.askedIndices.push(index);

  if (!gameState.calledAnswers.includes(question.a)) {
    gameState.calledAnswers.push(question.a);
  }
}

function sendNextQuestion() {
  clearGameTimer();

  gamePosition += 1;

  if (gamePosition >= gameState.gameOrder.length) {
    gameState.status = "ended";
    resetQuestionState();
    gameState.isPaused = false;

    broadcastGameState();

    io.emit("gameEnded", {
      reason: "questions exhausted",
    });

    return;
  }

  const index = gameState.gameOrder[gamePosition];
  const question = safetyQuestionBank[index];

  if (!question) {
    console.error("QUESTION NOT FOUND:", index);
    return;
  }

  console.log("SENDING QUESTION:", question);

  applyQuestion(question, index);

  emitQuestion(question, index);

  broadcastGameState({
    repeatQuestion: false,
  });

  startQuestionTimer();
}

function sendPreviousQuestion() {
  if (gamePosition <= 0) {
    return;
  }

  clearGameTimer();

  gamePosition -= 1;

  const index = gameState.gameOrder[gamePosition];
  const question = safetyQuestionBank[index];

  if (!question) {
    console.error("QUESTION NOT FOUND:", index);
    return;
  }

  gameState.currentQuestionIndex = index;
  gameState.currentQuestionID = question.id;
  gameState.currentQuestion = question.q;
  gameState.currentAnswer = question.a;
  gameState.currentCategory = question.category;
  gameState.currentDifficulty = question.difficulty;
  gameState.currentQuestionNumber = index + 1;
  gameState.displayMuted = displayMuted;
  gameState.isPaused = false;

  emitQuestion(question, index);

  broadcastGameState({
    repeatQuestion: false,
  });

  startQuestionTimer();
}

function endGameForWinnerLimit() {
  gameState.status = "ended";

  clearGameTimer();
  pendingClaims.clear();

  io.emit("gameEnded", {
    reason: "winner limit reached",
  });

  broadcastGameState();
}

function approveWinner(cardId) {
  if (gameState.approvedWinnersList.includes(cardId)) {
    return false;
  }

  if (
    gameState.approvedWinnersCount >=
    gameState.maxWinners
  ) {
    return false;
  }

  gameState.approvedWinnersList.push(cardId);
  gameState.approvedWinnersCount += 1;

  return true;
}

// -----------------------------------------------------------------------------
// HTTP routes
// -----------------------------------------------------------------------------

const routes = [
  ["/", "index.html"],
  ["/host.html", "host.html"],
  ["/player.html", "player.html"],
  ["/display.html", "display.html"],
  ["/questionManager.html", "questionManager.html"],
  ["/cheatsheet.html", "cheatsheet.html"],
  ["/answerkey.html", "answerkey.html"],
];

for (const [route, file] of routes) {
  app.get(route, (req, res) => {
    res.sendFile(path.join(__dirname, file));
  });
}

app.get("/api/questions", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM questions ORDER BY id ASC"
    );

    res.json(result.rows);
  } catch (error) {
    console.error("LOAD QUESTIONS ERROR:", error);

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.post("/api/questions/add", async (req, res) => {
  const newQuestion = req.body || {};

  if (!newQuestion.q || !newQuestion.a) {
    return res.status(400).json({
      success: false,
      error: "Question and answer required",
    });
  }

  try {
    const idResult = await pool.query(
      "SELECT MAX(id) AS maxid FROM questions"
    );

    const nextId =
      Number(idResult.rows[0].maxid || 0) + 1;

    await pool.query(
      `
        INSERT INTO questions
          (id, category, difficulty, question, answer)
        VALUES
          ($1, $2, $3, $4, $5)
      `,
      [
        nextId,
        newQuestion.category || "General",
        newQuestion.difficulty || "Medium",
        newQuestion.q,
        newQuestion.a,
      ]
    );

    console.log("QUESTION ADDED:", nextId);

    res.json({
      success: true,
      id: nextId,
    });
  } catch (error) {
    console.error("ADD QUESTION ERROR:", error);

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.delete("/api/questions/:id", async (req, res) => {
  const id = normalizePositiveInteger(req.params.id);

  if (!id) {
    return res.status(400).json({
      success: false,
      error: "Invalid question ID",
    });
  }

  try {
    const result = await pool.query(
      "DELETE FROM questions WHERE id = $1",
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: "Question not found",
      });
    }

    console.log("QUESTION REMOVED:", id);

    res.json({
      success: true,
    });
  } catch (error) {
    console.error("DELETE ERROR:", error);

    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// -----------------------------------------------------------------------------
// Socket.IO
// -----------------------------------------------------------------------------

io.on("connection", (socket) => {
  console.log("CONNECTED:", socket.id);

  // Immediately synchronize the new client.
  sendCurrentState(socket);

  // Send all previously asked questions to the new client.
  for (const index of gameState.askedIndices) {
    const question = safetyQuestionBank[index];

    if (question) {
      sendQuestionToSocket(socket, question, index);
    }
  }

  // ---------------------------------------------------------------------------
  // Display mute
  // ---------------------------------------------------------------------------

  socket.on("setDisplayMute", (data) => {
    if (!isHost(socket)) {
      console.warn(
        "DISPLAY MUTE REJECTED FROM NON-HOST:",
        socket.id
      );
      return;
    }

    if (!data) {
      return;
    }

    displayMuted = data.muted === true;
    gameState.displayMuted = displayMuted;

    console.log(
      "DISPLAY AUDIO MUTE:",
      displayMuted ? "MUTED" : "UNMUTED"
    );

    sendMuteState();
    broadcastGameState();
  });

  // ---------------------------------------------------------------------------
  // Host registration
  // ---------------------------------------------------------------------------

  socket.on("registerHost", () => {
    console.log("HOST REGISTER REQUEST:", socket.id);

    if (hostReconnectPending) {
      console.log(
        "HOST RECONNECTING DURING GRACE PERIOD:",
        socket.id
      );

      cancelHostReconnectGrace();

      hostSocketId = socket.id;

      console.log("HOST RECONNECTED:", hostSocketId);

      socket.emit("hostRegistered");
      sendCurrentState(socket);

      return;
    }

    if (!hostSocketId) {
      hostSocketId = socket.id;

      console.log("HOST REGISTERED:", hostSocketId);

      socket.emit("hostRegistered");
      sendCurrentState(socket);

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
      sendCurrentState(socket);

      return;
    }

    socket.emit("hostRegistered");
    sendCurrentState(socket);
  });

  // ---------------------------------------------------------------------------
  // Timer settings
  // ---------------------------------------------------------------------------

  socket.on("setTimerSettings", (data) => {
    if (!isHost(socket) || !data) {
      return;
    }

    const noTimer = data.noTimer === true;

    let seconds = Number(data.seconds);

    if (noTimer) {
      seconds = 0;
    } else if (!Number.isFinite(seconds) || seconds < 1) {
      seconds = DEFAULT_TIMER_SECONDS;
    }

    gameState.timerSeconds = seconds;
    gameState.noTimer = noTimer;

    console.log("TIMER SETTINGS:", {
      seconds: gameState.timerSeconds,
      noTimer: gameState.noTimer,
    });

    broadcastGameState();

    io.emit("timerSettingsUpdated", {
      seconds: gameState.timerSeconds,
      noTimer: gameState.noTimer,
    });
  });

  // ---------------------------------------------------------------------------
  // Winner settings
  // ---------------------------------------------------------------------------

  socket.on("setWinnerSettings", (data) => {
    if (!isHost(socket) || !data) {
      return;
    }

    let maxWinners = Number(data.maxWinners);

    if (!Number.isInteger(maxWinners) || maxWinners < 1) {
      maxWinners = 1;
    }

    gameState.maxWinners = maxWinners;

    console.log("MAX WINNERS:", maxWinners);

    broadcastGameState();
  });

  // ---------------------------------------------------------------------------
  // Start game
  // ---------------------------------------------------------------------------

  socket.on("hostStart", async (data) => {
    if (!isHost(socket)) {
      console.warn("HOST START REJECTED:", socket.id);
      return;
    }

    if (gameState.status === "running") {
      return;
    }

    try {
      await loadQuestionsFromDatabase();

      let selectedQuestionIds = [];

      if (Array.isArray(data?.selectedQuestionIds)) {
        selectedQuestionIds = data.selectedQuestionIds
          .map(Number)
          .filter(
            (id) => Number.isInteger(id) && id > 0
          );
      }

      selectedQuestionIds = [
        ...new Set(selectedQuestionIds),
      ];

      const availableQuestionIds = new Set(
        safetyQuestionBank.map((question) => question.id)
      );

      selectedQuestionIds =
        selectedQuestionIds.filter((id) =>
          availableQuestionIds.has(id)
        );

      if (safetyQuestionBank.length === 0) {
        socket.emit("gameStartError", {
          error: "There are no questions in the database.",
        });

        return;
      }

      gameState.selectedQuestionIds = selectedQuestionIds;

      gameState.status = "running";
      gameState.askedIndices = [];
      gameState.calledAnswers = [];
      gameState.approvedWinnersCount = 0;
      gameState.approvedWinnersList = [];
      gameState.isPaused = false;
      gameState.displayMuted = displayMuted;

      resetQuestionState();
      pendingClaims.clear();

      buildGameOrder(gameState.selectedQuestionIds);

      if (gameState.gameOrder.length === 0) {
        gameState.status = "idle";

        socket.emit("gameStartError", {
          error:
            "None of the selected questions exist in the database.",
        });

        return;
      }

      gamePosition = -1;

      console.log("==========================================");
      console.log("GAME STARTED");
      console.log(
        "SELECTED IDS:",
        gameState.selectedQuestionIds
      );
      console.log(
        "QUESTIONS IN GAME:",
        gameState.gameOrder.length
      );
      console.log("==========================================");

      sendNextQuestion();
    } catch (error) {
      console.error("START GAME ERROR:", error);

      gameState.status = "idle";

      socket.emit("gameStartError", {
        error: "Unable to start game.",
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  socket.on("hostNext", () => {
    if (!isHost(socket) || gameState.status !== "running") {
      return;
    }

    sendNextQuestion();
  });

  socket.on("hostPrevious", () => {
    if (!isHost(socket) || gameState.status !== "running") {
      return;
    }

    sendPreviousQuestion();
  });

  socket.on("hostRepeat", () => {
    if (!isHost(socket) || gameState.status !== "running") {
      return;
    }

    broadcastGameState({
      repeatQuestion: true,
    });
  });

  // ---------------------------------------------------------------------------
  // Pause / play
  // ---------------------------------------------------------------------------

  socket.on("togglePausePlay", () => {
    if (!isHost(socket) || gameState.status !== "running") {
      return;
    }

    gameState.isPaused = !gameState.isPaused;

    console.log("PAUSE:", gameState.isPaused);

    if (gameState.isPaused) {
      clearGameTimer();
    } else if (!gameState.noTimer) {
      countdown = Math.max(countdown, 1);
      startQuestionTimer();
    }

    broadcastGameState();
  });

  // ---------------------------------------------------------------------------
  // Reset
  // ---------------------------------------------------------------------------

  socket.on("hostReset", () => {
    if (!isHost(socket)) {
      return;
    }

    console.log("HOST RESET BUTTON:", socket.id);

    resetGame("host reset button");
  });

  // Legacy compatibility.
  socket.on("resetGame", () => {
    if (!isHost(socket)) {
      return;
    }

    resetGame("legacy resetGame event");
  });

  // ---------------------------------------------------------------------------
  // Host leaves
  // ---------------------------------------------------------------------------

  socket.on("hostLeftGame", () => {
    if (!isHost(socket)) {
      return;
    }

    console.log("========== HOST LEFT GAME ==========");

    startHostReconnectGrace(socket.id);
  });

  // ---------------------------------------------------------------------------
  // Player claims
  // ---------------------------------------------------------------------------

  socket.on("claimWin", (data) => {
    if (!data || gameState.status !== "running") {
      return;
    }

    const cardId = normalizePositiveInteger(data.cardId);

    if (!cardId) {
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

      markedIndices: Array.isArray(data.markedIndices)
        ? [...data.markedIndices]
        : [],

      winningPattern: Array.isArray(data.winningPattern)
        ? [...data.winningPattern]
        : [],

      timestamp: data.timestamp || Date.now(),
      playerSocketId: socket.id,
    };

    pendingClaims.set(cardId, claim);

    io.emit("winRequested", {
      cardId: claim.cardId,
      markedIndices: claim.markedIndices,
      winningPattern: claim.winningPattern,
      timestamp: claim.timestamp,
    });
  });

  // ---------------------------------------------------------------------------
  // Approve / reject player win
  // ---------------------------------------------------------------------------

  socket.on("approveWin", (cardId) => {
    if (!isHost(socket)) {
      return;
    }

    const id = normalizePositiveInteger(cardId);

    if (!id) {
      return;
    }

    const pendingClaim = pendingClaims.get(id);

    if (!pendingClaim) {
      return;
    }

    pendingClaims.delete(id);

    if (!approveWinner(id)) {
      return;
    }

    io.emit("winApproved", {
      cardId: id,
    });

    if (
      gameState.approvedWinnersCount >=
      gameState.maxWinners
    ) {
      endGameForWinnerLimit();
      return;
    }

    broadcastGameState();
  });

  socket.on("rejectWin", (cardId) => {
    if (!isHost(socket)) {
      return;
    }

    const id = normalizePositiveInteger(cardId);

    if (!id) {
      return;
    }

    const pendingClaim = pendingClaims.get(id);

    const winningPattern = Array.isArray(
      pendingClaim?.winningPattern
    )
      ? [...pendingClaim.winningPattern]
      : [];

    pendingClaims.delete(id);

    io.emit("winRejected", {
      cardId: id,
      winningPattern,
    });
  });

  // ---------------------------------------------------------------------------
  // Physical wins
  // ---------------------------------------------------------------------------

  socket.on("approvePhysicalWin", (data) => {
    if (!isHost(socket) || !data) {
      return;
    }

    const cardId = normalizePositiveInteger(data.cardId);

    if (!cardId || !approveWinner(cardId)) {
      return;
    }

    io.emit("physicalWinApproved", {
      cardId,
      winnerCount: gameState.approvedWinnersCount,
    });

    if (
      gameState.approvedWinnersCount >=
      gameState.maxWinners
    ) {
      endGameForWinnerLimit();
      return;
    }

    broadcastGameState();
  });

  socket.on("rejectPhysicalWin", (data) => {
    if (!isHost(socket) || !data) {
      return;
    }

    const cardId = normalizePositiveInteger(data.cardId);

    if (!cardId) {
      return;
    }

    io.emit("physicalWinRejected", {
      cardId,
    });
  });

  // ---------------------------------------------------------------------------
  // Card events
  // ---------------------------------------------------------------------------

  socket.on("loadCard", (cardId) => {
    const id = normalizePositiveInteger(cardId);

    if (!id) {
      return;
    }

    socket.emit("cardLoaded", {
      cardId: id,
    });
  });

  socket.on("markCard", (data) => {
    if (!data) {
      return;
    }

    const cardId = normalizePositiveInteger(data.id);
    const index = Number(data.index);
    const marked = data.marked === true;

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

    console.log("CARD MARK:", {
      cardId,
      index,
      marked,
      socketId: socket.id,
    });
  });

  // ---------------------------------------------------------------------------
  // State sync
  // ---------------------------------------------------------------------------

  socket.on("requestGameStateSyncFallback", () => {
    sendCurrentState(socket);
  });

  // ---------------------------------------------------------------------------
  // Disconnect
  // ---------------------------------------------------------------------------

  socket.on("disconnect", () => {
    console.log("DISCONNECTED:", socket.id);

    clearPendingClaimsForSocket(socket.id);

    if (socket.id === hostSocketId) {
      console.log(
        "========== HOST CLOSED/DISCONNECTED =========="
      );

      startHostReconnectGrace(socket.id);
    }
  });
});

// -----------------------------------------------------------------------------
// Startup
// -----------------------------------------------------------------------------

async function startServer() {
  try {
    await initializeDatabase();

    if (process.env.MIGRATE_QUESTIONS === "true") {
      require("./migrateQuestions");
    }

    await loadQuestionsFromDatabase();

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Safety Bingo running on port ${PORT}`);
    });
  } catch (error) {
    console.error("SERVER STARTUP FAILED:", error);
    process.exit(1);
  }
}

startServer();
