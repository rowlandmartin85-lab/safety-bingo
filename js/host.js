// =====================================================
// SAFETY BINGO HOST MAIN CONTROLLER - HOST.JS
// =====================================================

"use strict";

console.log("HOST MAIN LOADER START");

// Single Global Socket
function initializeHostSocket() {
  if (window.socket) return; // Prevent duplicate socket creation

  console.log("INITIALIZING HOST SOCKET CONNECTION...");

  window.socket = io(window.location.origin, {
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 10
  });

  window.socket.on("connect", () => {
    console.log("Host socket connected with ID:", window.socket.id);
  });

  window.socket.on("gameReset", () => {
    console.log("GAME WAS RESET BY SERVER");
    if (typeof resetHostUI === "function") {
      resetHostUI();
    }
  });
}

// MAIN DOM LOAD
document.addEventListener("DOMContentLoaded", () => {
  console.log("HOST DOM READY");

  // 1. Initialize Single Socket First
  initializeHostSocket();

  // 2. Initialize optional sub-modules safely if present
  if (typeof initializeHostUI === "function") initializeHostUI();
  if (typeof initializeHostPrinter === "function") initializeHostPrinter();
  if (typeof initializeHostChecker === "function") initializeHostChecker();
  if (typeof initializeHostAudit === "function") initializeHostAudit();

  // 3. Modals and Reference Buttons
  initializeHostReferenceButtons();
  initializeHomeButton();

  console.log("SAFETY BINGO HOST READY");
});

// REFERENCE BUTTONS
function initializeHostReferenceButtons() {
  const answerKeyBtn = document.getElementById("answerKeyBtn");
  if (answerKeyBtn) {
    answerKeyBtn.onclick = () => window.open("/answerkey.html", "_blank");
  }

  const cheatSheetBtn = document.getElementById("cheatSheetBtn");
  if (cheatSheetBtn) {
    cheatSheetBtn.onclick = () => window.open("/cheatsheet.html", "_blank");
  }

  const questionManagerBtn = document.getElementById("questionManagerBtn");
  if (questionManagerBtn) {
    questionManagerBtn.onclick = () => window.open("/questionManager.html", "_blank");
  }
}

// HOME BUTTON & MODAL
function initializeHomeButton() {
  const homeBtn = document.getElementById("homeBtn");
  const homeModal = document.getElementById("homeModal");
  const cancelHome = document.getElementById("cancelHome");
  const confirmHome = document.getElementById("confirmHome");
  const resetAndHome = document.getElementById("resetAndHome");

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
      window.location.href = "/index.html";
    };
  }

  if (resetAndHome) {
    resetAndHome.onclick = () => {
      if (window.socket) {
        window.socket.emit("hostReset"); // Aligned with server event
      }
      window.location.href = "/index.html";
    };
  }
}
