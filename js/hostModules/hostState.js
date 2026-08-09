// =====================================================
// HOST STATE SYNC - HOSTSTATE.JS
// =====================================================

"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const socket = window.socket;

  const questionBox = document.getElementById("questionBox");
  const answerBox = document.getElementById("answerBox");

  const startBtn = document.getElementById("startBtn");
  const pausePlayBtn = document.getElementById("pausePlayBtn");
  const nextBtn = document.getElementById("nextBtn");
  const previousBtn = document.getElementById("previousBtn");
  const repeatBtn = document.getElementById("repeatBtn");
  const resetBtn = document.getElementById("resetBtn");

  socket.on("gameState", (state) => {
    if (!state) return;
    console.log("[HostState] Received state:", state);

    // IDLE / NOT STARTED
    if (state.status === "idle" || !state.status) {
      if (questionBox) questionBox.textContent = "Waiting for game to start...";
      if (answerBox) answerBox.textContent = "";

      if (startBtn) startBtn.style.display = "inline-block";
      if (pausePlayBtn) pausePlayBtn.style.display = "none";
      if (nextBtn) nextBtn.style.display = "none";
      if (previousBtn) previousBtn.style.display = "none";
      if (repeatBtn) repeatBtn.style.display = "none";
      if (resetBtn) resetBtn.style.display = "none";
      return;
    }

    // GAME ACTIVE / RUNNING
    if (questionBox) {
      questionBox.textContent = state.currentQuestion || "No active question";
    }

    if (answerBox) {
      answerBox.textContent = state.currentAnswer ? `Answer: ${state.currentAnswer}` : "";
    }

    // Toggle button visibility based on game state
    if (startBtn) startBtn.style.display = "none";
    if (pausePlayBtn) {
      pausePlayBtn.style.display = "inline-block";
      pausePlayBtn.textContent = state.isPaused ? "RESUME" : "PAUSE";
    }
    if (nextBtn) nextBtn.style.display = "inline-block";
    if (previousBtn) previousBtn.style.display = "inline-block";
    if (repeatBtn) repeatBtn.style.display = "inline-block";
    if (resetBtn) resetBtn.style.display = "inline-block";
  });
});
