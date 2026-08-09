// =====================================================
// HOST CONTROLLER - HOSTGAME.JS
// =====================================================

"use strict";

(function () {
  const socket = window.socket || io();
  window.socket = socket;

  const btnStart = document.getElementById("btnStart");
  const btnNext = document.getElementById("btnNext");
  const btnPrevious = document.getElementById("btnPrevious");
  const btnRepeat = document.getElementById("btnRepeat");
  const btnPausePlay = document.getElementById("btnPausePlay");
  const btnReset = document.getElementById("btnReset");

  const timerSecondsInput = document.getElementById("timerSeconds");
  const noTimerCheckbox = document.getElementById("noTimerCheckbox");
  const winnerLimitInput = document.getElementById("winnerLimitInput");

  if (btnStart) {
    btnStart.onclick = function () {
      const timerSeconds = parseInt(timerSecondsInput?.value, 10) || 30;
      const noTimer = noTimerCheckbox?.checked || false;
      const maxWinners = parseInt(winnerLimitInput?.value, 10) || 1;

      // Atomic single payload emission prevents race conditions
      socket.emit("hostStart", {
        timerSeconds,
        noTimer,
        maxWinners
      });
    };
  }

  if (btnNext) btnNext.onclick = () => socket.emit("hostNext");
  if (btnPrevious) btnPrevious.onclick = () => socket.emit("hostPrevious");
  if (btnRepeat) btnRepeat.onclick = () => socket.emit("hostRepeat");
  if (btnPausePlay) btnPausePlay.onclick = () => socket.emit("togglePausePlay");

  if (btnReset) {
    btnReset.onclick = () => {
      if (confirm("Reset current game?")) {
        socket.emit("hostReset");
      }
    };
  }
})();
