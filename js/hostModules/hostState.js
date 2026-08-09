// =====================================================
// HOST STATE DISPLAY - HOSTSTATE.JS
// =====================================================

"use strict";

(function () {
  const socket = window.socket || io();

  const currentQuestionEl = document.getElementById("currentQuestion");
  const currentAnswerEl = document.getElementById("currentAnswer");
  const questionNumberEl = document.getElementById("questionNumber");
  const categoryEl = document.getElementById("category");
  const difficultyEl = document.getElementById("difficulty");
  const timerDisplayEl = document.getElementById("timerDisplay");
  const gameStatusBadgeEl = document.getElementById("gameStatusBadge");

  const btnStart = document.getElementById("btnStart");
  const btnNext = document.getElementById("btnNext");
  const btnPrevious = document.getElementById("btnPrevious");
  const btnRepeat = document.getElementById("btnRepeat");
  const btnPausePlay = document.getElementById("btnPausePlay");

  socket.on("gameState", state => {
    if (!state) return;

    if (state.status === "idle") {
      if (currentQuestionEl) currentQuestionEl.textContent = "Click 'Start Game' to begin.";
      if (currentAnswerEl) currentAnswerEl.textContent = "—";
      if (questionNumberEl) questionNumberEl.textContent = "0";
      if (categoryEl) categoryEl.textContent = "—";
      if (difficultyEl) difficultyEl.textContent = "—";
      if (gameStatusBadgeEl) gameStatusBadgeEl.textContent = "Lobby";

      if (btnStart) btnStart.disabled = false;
      if (btnNext) btnNext.disabled = true;
      if (btnPrevious) btnPrevious.disabled = true;
      if (btnRepeat) btnRepeat.disabled = true;
      if (btnPausePlay) btnPausePlay.disabled = true;
      return;
    }

    if (currentQuestionEl) currentQuestionEl.textContent = state.currentQuestion || "—";
    if (currentAnswerEl) currentAnswerEl.textContent = state.currentAnswer || "—";
    if (questionNumberEl) questionNumberEl.textContent = state.currentQuestionNumber || "0";
    if (categoryEl) categoryEl.textContent = state.currentCategory || "—";
    if (difficultyEl) difficultyEl.textContent = state.currentDifficulty || "—";

    if (gameStatusBadgeEl) {
      gameStatusBadgeEl.textContent = state.status === "ended" ? "Ended" : (state.isPaused ? "Paused" : "Running");
    }

    if (btnStart) btnStart.disabled = state.status === "running";
    if (btnNext) btnNext.disabled = state.status !== "running";
    if (btnPrevious) btnPrevious.disabled = state.status !== "running";
    if (btnRepeat) btnRepeat.disabled = state.status !== "running";
    if (btnPausePlay) {
      btnPausePlay.disabled = state.status !== "running";
      btnPausePlay.textContent = state.isPaused ? "Resume" : "Pause";
    }
  });

  socket.on("timerUpdate", seconds => {
    if (timerDisplayEl) {
      timerDisplayEl.textContent = seconds > 0 ? `${seconds}s` : "0s";
    }
  });
})();
