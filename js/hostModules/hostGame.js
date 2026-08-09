// =====================================================
// HOST GAME CONTROLLER - HOSTGAME.JS
// =====================================================

"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const socket = window.socket;

  // Correct HTML IDs
  const startBtn = document.getElementById("startBtn");
  const nextBtn = document.getElementById("nextBtn");
  const previousBtn = document.getElementById("previousBtn");
  const repeatBtn = document.getElementById("repeatBtn");
  const pausePlayBtn = document.getElementById("pausePlayBtn");
  const resetBtn = document.getElementById("resetBtn");

  const timerModeSelect = document.getElementById("timerMode");
  const winLimitSelect = document.getElementById("winLimitMode");

  // Start Game Button
  if (startBtn) {
    startBtn.onclick = (e) => {
      if (e) e.preventDefault();

      const timerVal = timerModeSelect ? timerModeSelect.value : "none";
      const noTimer = timerVal === "none";
      const timerSeconds = noTimer ? 0 : (parseInt(timerVal, 10) || 30);
      const maxWinners = winLimitSelect ? (parseInt(winLimitSelect.value, 10) || 1) : 1;

      console.log("[HostGame] Emitting hostStart:", { timerSeconds, noTimer, maxWinners });

      socket.emit("hostStart", {
        timerSeconds,
        noTimer,
        maxWinners
      });
    };
  }

  // Question Navigation Controls
  if (nextBtn) nextBtn.onclick = () => socket.emit("hostNext");
  if (previousBtn) previousBtn.onclick = () => socket.emit("hostPrevious");
  if (repeatBtn) repeatBtn.onclick = () => socket.emit("hostRepeat");
  if (pausePlayBtn) pausePlayBtn.onclick = () => socket.emit("togglePausePlay");

  // Reset Button
  if (resetBtn) {
    resetBtn.onclick = () => {
      if (confirm("Are you sure you want to reset the current game?")) {
        socket.emit("hostReset");
      }
    };
  }
});
