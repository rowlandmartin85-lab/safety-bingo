// =====================================================
// SAFETY BINGO SERVER - SERVER.JS
// =====================================================

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Serve static assets from root and public (handles both project structures)
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, "public")));

// Express route fallbacks (checks root first, falls back to public)
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"), (err) => {
    if (err) {
      res.sendFile(path.join(__dirname, "public", "index.html"));
    }
  });
});

app.get("/host", (req, res) => {
  res.sendFile(path.join(__dirname, "host.html"), (err) => {
    if (err) {
      res.sendFile(path.join(__dirname, "public", "host.html"));
    }
  });
});

/*
==========================================
GAME STATE MANAGEMENT
==========================================
*/

let gameState = {
  status: "idle", // "idle", "running", "paused"
  currentQuestion: "",
  currentAnswer: "",
  currentIndex: -1,
  calledAnswers: [],
  drawnQuestions: [],
  timerSeconds: 0,
  noTimer: true,
  maxWinners: 1,
  approvedWinnersCount: 0,
  isPaused: false
};

// Default Question Bank (Fallback if no external JSON/database)
const sampleQuestions = [
  { question: "What should you wear on a construction site for head protection?", answer: "Hard Hat" },
  { question: "What device protects against electrical shocks near water?", answer: "GFCI Outlet" },
  { question: "What sign indicates a fire exit route?", answer: "Emergency Exit" },
  { question: "What is the primary equipment to prevent falls from heights?", answer: "Safety Harness" },
  { question: "What type of extinguisher is used for electrical fires?", answer: "Class C Fire Extinguisher" },
  { question: "What should be kept clear at all times in a building?", answer: "Fire Exits" },
  { question: "What standard color represents danger or stop?", answer: "Red" },
  { question: "What standard color represents safety and first aid?", answer: "Green" }
];

let questionsQueue = [...sampleQuestions];

/*
==========================================
SOCKET.IO EVENT HANDLERS
==========================================
*/

io.on("connection", (socket) => {
  console.log(`[Server] New client connected: ${socket.id}`);

  // Instantly send current state to newly connected client/host
  socket.emit("gameState", gameState);

  // 1. HOST START GAME
  socket.on("hostStart", (config) => {
    console.log("[Server] Host starting game with config:", config);
    
    // Reset/Shuffle questions
    questionsQueue = [...sampleQuestions].sort(() => Math.random() - 0.5);
    
    gameState.status = "running";
    gameState.isPaused = false;
    gameState.currentIndex = 0;
    gameState.timerSeconds = config?.timerSeconds || 0;
    gameState.noTimer = config?.noTimer ?? true;
    gameState.maxWinners = config?.maxWinners || 1;
    gameState.approvedWinnersCount = 0;
    gameState.calledAnswers = [];
    gameState.drawnQuestions = [];

    if (questionsQueue.length > 0) {
      const firstQ = questionsQueue[0];
      gameState.currentQuestion = firstQ.question;
      gameState.currentAnswer = firstQ.answer;
      gameState.calledAnswers.push(firstQ.answer);
      gameState.drawnQuestions.push(firstQ.answer);
    }

    io.emit("gameState", gameState);
  });

  // 2. HOST NEXT QUESTION
  socket.on("hostNext", () => {
    if (gameState.status !== "running") return;

    if (gameState.currentIndex < questionsQueue.length - 1) {
      gameState.currentIndex++;
      const q = questionsQueue[gameState.currentIndex];
      gameState.currentQuestion = q.question;
      gameState.currentAnswer = q.answer;

      if (!gameState.calledAnswers.includes(q.answer)) {
        gameState.calledAnswers.push(q.answer);
        gameState.drawnQuestions.push(q.answer);
      }

      console.log(`[Server] Advanced to Question #${gameState.currentIndex + 1}: ${q.answer}`);
      io.emit("gameState", gameState);
    } else {
      console.log("[Server] End of question queue reached.");
    }
  });

  // 3. HOST PREVIOUS QUESTION
  socket.on("hostPrevious", () => {
    if (gameState.status !== "running") return;

    if (gameState.currentIndex > 0) {
      gameState.currentIndex--;
      const q = questionsQueue[gameState.currentIndex];
      gameState.currentQuestion = q.question;
      gameState.currentAnswer = q.answer;

      console.log(`[Server] Returned to Question #${gameState.currentIndex + 1}`);
      io.emit("gameState", gameState);
    }
  });

  // 4. HOST REPEAT QUESTION
  socket.on("hostRepeat", () => {
    console.log("[Server] Repeating current question");
    io.emit("gameState", gameState);
  });

  // 5. TOGGLE PAUSE / PLAY
  socket.on("togglePausePlay", () => {
    gameState.isPaused = !gameState.isPaused;
    console.log(`[Server] Game pause toggled: ${gameState.isPaused}`);
    io.emit("gameState", gameState);
  });

  // 6. HOST RESET GAME
  socket.on("hostReset", () => {
    console.log("[Server] Game reset requested by host");
    gameState = {
      status: "idle",
      currentQuestion: "",
      currentAnswer: "",
      currentIndex: -1,
      calledAnswers: [],
      drawnQuestions: [],
      timerSeconds: 0,
      noTimer: true,
      maxWinners: 1,
      approvedWinnersCount: 0,
      isPaused: false
    };
    io.emit("gameState", gameState);
  });

  // 7. PHYSICAL CARD APPROVAL
  socket.on("approvePhysicalWin", ({ cardId }) => {
    gameState.approvedWinnersCount++;
    console.log(`[Server] Approved Bingo Card #${cardId}. Total Winners: ${gameState.approvedWinnersCount}`);

    io.emit("physicalWinApproved", {
      cardId: cardId,
      winnerNumber: gameState.approvedWinnersCount,
      totalRequired: gameState.maxWinners
    });

    io.emit("gameState", gameState);
  });

  // 8. PHYSICAL CARD REJECTION
  socket.on("rejectPhysicalWin", ({ cardId }) => {
    console.log(`[Server] Rejected Bingo Card #${cardId}`);
    io.emit("physicalWinRejected", { cardId });
  });

  // 9. VERIFY CARD FALLBACK
  socket.on("verifyCard", ({ cardId }) => {
    console.log(`[Server] Card verification requested for Card #${cardId}`);
    
    // Send back matched count based on active called answers
    socket.emit("cardVerificationResult", {
      cardId: cardId,
      isWinner: false,
      matchedCount: gameState.calledAnswers.length
    });
  });

  socket.on("disconnect", () => {
    console.log(`[Server] Client disconnected: ${socket.id}`);
  });
});

/*
==========================================
SERVER START
==========================================
*/

server.listen(PORT, () => {
  console.log(`==========================================`);
  console.log(` SAFETY BINGO SERVER RUNNING ON PORT ${PORT}`);
  console.log(` Access Host Panel: http://localhost:${PORT}/host`);
  console.log(`==========================================`);
});
