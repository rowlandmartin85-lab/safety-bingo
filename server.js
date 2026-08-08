"use strict";

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

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, "public")));

// =====================================================
// PERSISTENT GAME STATE
// (Stored in server memory — survives tab closes & host exits)
// =====================================================
let gameState = {
  status: "idle",             // "idle" | "running" | "paused"
  currentQuestion: "",
  calledAnswers: [],          // Tracks all answers/calls made so far
  loadedCards: {},            // { socketId: cardId }
  markedCards: {},            // { cardId: [ array of marked cell indices ] }
  pendingClaims: [],          // Pending Bingo claims waiting for host approval
  approvedWinners: []         // Cards that have won
};

// Helper function to reset state
function resetGameState() {
  gameState = {
    status: "idle",
    currentQuestion: "",
    calledAnswers: [],
    loadedCards: {},
    markedCards: {},
    pendingClaims: [],
    approvedWinners: []
  };
}

// =====================================================
// SOCKET.IO EVENTS
// =====================================================
io.on("connection", (socket) => {
  console.log(`[CONNECTED] Client connected: ${socket.id}`);

  // ---------------------------------------------------
  // 1. HOST REGISTRATION & RE-SYNC
  // ---------------------------------------------------
  socket.on("registerHost", () => {
    socket.isHost = true;
    console.log(`[HOST] Host registered on socket: ${socket.id}`);

    // Send the current active game state to the host UI
    socket.emit("gameState", gameState);
    socket.emit("syncPendingClaims", gameState.pendingClaims);
  });

  // ---------------------------------------------------
  // 2. PLAYER INITIALIZATION & SYNC
  // ---------------------------------------------------
  // Handles requestGameStateSyncFallback emitted by player.js
  socket.on("requestGameStateSyncFallback", () => {
    socket.emit("gameState", gameState);
  });

  // Handles loadCard emitted by player.js
  socket.on("loadCard", (cardId) => {
    const numCardId = Number(cardId);
    if (!numCardId) return;

    gameState.loadedCards[socket.id] = numCardId;
    
    if (!gameState.markedCards[numCardId]) {
      gameState.markedCards[numCardId] = [];
    }

    console.log(`[CARD LOADED] Socket ${socket.id} loaded Card #${numCardId}`);
    
    // Confirm load to client and broadcast state
    socket.emit("cardLoaded", { cardId: numCardId });
    socket.emit("gameState", gameState);
  });

  // ---------------------------------------------------
  // 3. PLAYER MARKING CELLS
  // ---------------------------------------------------
  socket.on("markCard", (data) => {
    if (!data || !data.id) return;

    const cardId = Number(data.id);
    const index = Number(data.index);

    if (!gameState.markedCards[cardId]) {
      gameState.markedCards[cardId] = [];
    }

    if (data.marked) {
      if (!gameState.markedCards[cardId].includes(index)) {
        gameState.markedCards[cardId].push(index);
      }
    } else {
      gameState.markedCards[cardId] = gameState.markedCards[cardId].filter(
        (i) => i !== index
      );
    }

    // Sync marked cells back to host so host can see live player boards
    io.emit("playerMarkUpdate", {
      cardId: cardId,
      markedIndices: gameState.markedCards[cardId]
    });
  });

  // ---------------------------------------------------
  // 4. BINGO CLAIMS & AUDITING
  // ---------------------------------------------------
  socket.on("claimWin", (claimData) => {
    console.log("[BINGO CLAIM RECEIVED]:", claimData);

    if (!claimData || !claimData.cardId) return;

    // Check if claim is already pending
    const existingIndex = gameState.pendingClaims.findIndex(
      (c) => Number(c.cardId) === Number(claimData.cardId)
    );

    if (existingIndex === -1) {
      gameState.pendingClaims.push(claimData);
    } else {
      gameState.pendingClaims[existingIndex] = claimData;
    }

    // Forward claim to host for verification
    io.emit("hostAuditClaim", claimData);
  });

  socket.on("approveWin", (data) => {
    if (!data || !data.cardId) return;
    const cardId = Number(data.cardId);

    console.log(`[WIN APPROVED] Card #${cardId}`);

    if (!gameState.approvedWinners.includes(cardId)) {
      gameState.approvedWinners.push(cardId);
    }

    // Remove from pending
    gameState.pendingClaims = gameState.pendingClaims.filter(
      (c) => Number(c.cardId) !== cardId
    );

    // Notify all players that this card won
    io.emit("winApproved", { cardId: cardId });
  });

  socket.on("rejectWin", (data) => {
    if (!data || !data.cardId) return;
    const cardId = Number(data.cardId);

    console.log(`[WIN REJECTED] Card #${cardId}`);

    // Remove from pending
    gameState.pendingClaims = gameState.pendingClaims.filter(
      (c) => Number(c.cardId) !== cardId
    );

    // Notify specific card player that claim was rejected
    io.emit("winRejected", {
      cardId: cardId,
      winningPattern: data.winningPattern || []
    });
  });

  // ---------------------------------------------------
  // 5. HOST CONTROL ACTIONS
  // ---------------------------------------------------
  socket.on("hostCallQuestion", (data) => {
    gameState.status = "running";
    gameState.currentQuestion = data.question || "";

    if (data.answer && !gameState.calledAnswers.includes(data.answer)) {
      gameState.calledAnswers.push(data.answer);
    }

    // Broadcast updated question and called answers to everyone
    io.emit("gameState", gameState);
  });

  socket.on("hostNextQuestion", (data) => {
    gameState.status = "running";
    if (data && data.question) {
      gameState.currentQuestion = data.question;
    }
    if (data && data.answer && !gameState.calledAnswers.includes(data.answer)) {
      gameState.calledAnswers.push(data.answer);
    }

    io.emit("gameState", gameState);
  });

  // ---------------------------------------------------
  // 6. EXPLICIT GAME RESET
  // ---------------------------------------------------
  // ONLY reset when host explicitly triggers it via button click
  socket.on("hostResetGame", () => {
    console.log("[RESET] Host manually triggered game reset.");
    resetGameState();
    io.emit("gameReset");
  });

  // ---------------------------------------------------
  // 7. DISCONNECT HANDLER (SAFE - DOES NOT RESET STATE)
  // ---------------------------------------------------
  socket.on("disconnect", () => {
    console.log(`[DISCONNECTED] Client disconnected: ${socket.id}`);
    delete gameState.loadedCards[socket.id];

    // IMPORTANT: Game state remains intact!
    // We intentionally DO NOT call resetGameState() or emit("gameReset") here.
  });
});

// Start Server
server.listen(PORT, () => {
  console.log(`=================================`);
  console.log(`Safety Bingo Server running on port ${PORT}`);
  console.log(`=================================`);
});
