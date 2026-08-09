// =====================================================
// SAFETY BINGO HOST MAIN CONTROLLER - HOST.JS
// =====================================================

"use strict";

// Initialize single socket instance immediately on load
if (!window.socket) {
  window.socket = io(window.location.origin, {
    transports: ["websocket", "polling"],
    reconnection: true
  });

  window.socket.on("connect", () => {
    console.log("[Host] Connected with Socket ID:", window.socket.id);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("[Host] DOM Ready");

  // Navigation / Reference Buttons
  const answerKeyBtn = document.getElementById("answerKeyBtn");
  if (answerKeyBtn) answerKeyBtn.onclick = () => window.open("/answerkey.html", "_blank");

  const cheatSheetBtn = document.getElementById("cheatSheetBtn");
  if (cheatSheetBtn) cheatSheetBtn.onclick = () => window.open("/cheatsheet.html", "_blank");

  const questionManagerBtn = document.getElementById("questionManagerBtn");
  if (questionManagerBtn) questionManagerBtn.onclick = () => window.open("/questionManager.html", "_blank");

  // Home Modal System
  const homeBtn = document.getElementById("homeBtn");
  const homeModal = document.getElementById("homeModal");
  const cancelHome = document.getElementById("cancelHome");
  const confirmHome = document.getElementById("confirmHome");

  if (homeBtn && homeModal) {
    homeBtn.onclick = () => {
      homeModal.style.display = "flex";
      homeModal.classList.add("show");
    };
  }

  if (cancelHome && homeModal) {
    cancelHome.onclick = () => {
      homeModal.style.display = "none";
      homeModal.classList.remove("show");
    };
  }

  if (confirmHome) {
    confirmHome.onclick = () => {
      if (window.socket) window.socket.emit("hostReset");
      window.location.href = "/index.html";
    };
  }
});
