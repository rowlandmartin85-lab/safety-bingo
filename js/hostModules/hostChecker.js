/**
 * Safety Bingo Host Card Checker
 * Validates physical bingo cards against called answers
 */

"use strict";

console.log("HOST CHECKER MODULE LOADED");

// ==========================================
// STATE
// ==========================================

let checkerCard = null;
let currentCardID = null;
let calledAnswers = [];

// ==========================================
// INITIALIZATION
// ==========================================

function initializeHostChecker() {
  console.log("INITIALIZING HOST CHECKER");

  if (!window.hostUI) {
    console.error("hostUI not available.");
    return;
  }

  const { checkCardBtn, closeAuditBtn, approveBtn, rejectBtn, checkerCardID } = window.hostUI;

  checkCardBtn?.addEventListener("click", checkPhysicalCard);
  closeAuditBtn?.addEventListener("click", closeCheckerOverlay);
  approveBtn?.addEventListener("click", approvePhysicalBingo);
  rejectBtn?.addEventListener("click", rejectPhysicalBingo);
  checkerCardID?.addEventListener("keydown", handleEnterKey);

  if (window.hostSocket) setupCheckerSocket();

  hideCheckerOverlay();
  console.log("HOST CHECKER READY");
}

function setupCheckerSocket() {
  if (!window.hostSocket) return;

  window.hostSocket
    .on("gameState", (state) => {
      calledAnswers = state?.calledAnswers || [];
    })
    .on("physicalWinApproved", (data) => {
      console.log("PHYSICAL APPROVAL RECEIVED", data);
      if (window.hostUI?.auditTitle) {
        window.hostUI.auditTitle.textContent = 
          `WINNER ${data.winnerNumber} OF ${data.totalRequired} APPROVED`;
      }
    });
}

// ==========================================
// CARD CHECKING
// ==========================================

function checkPhysicalCard() {
  const input = window.hostUI?.checkerCardID;
  if (!input) {
    console.error("checkerCardID input element not found.");
    return;
  }

  const cardID = Number(input.value.trim());
  if (!cardID) {
    alert("Please enter a valid Card ID.");
    input.focus();
    return;
  }

  if (typeof window.generateCard !== "function") {
    console.error("generateCard() missing.");
    alert("Card Generator unavailable.");
    return;
  }

  checkerCard = window.generateCard(cardID);
  if (!checkerCard) {
    alert(`Unable to generate card #${cardID}`);
    return;
  }

  currentCardID = cardID;
  syncCalledAnswers();
  openCheckerOverlay();
  renderCheckerCard();
}

function syncCalledAnswers() {
  const state = window.hostState;
  calledAnswers = state?.calledAnswers ?? window.calledAnswers ?? [];
}

// ==========================================
// OVERLAY MANAGEMENT
// ==========================================

function openCheckerOverlay() {
  if (!window.hostUI?.auditOverlay) return;
  
  window.hostUI.auditOverlay.style.display = "flex";
  if (window.hostUI.auditTitle) {
    window.hostUI.auditTitle.textContent = `PHYSICAL CARD AUDIT #${currentCardID}`;
  }
}

function hideCheckerOverlay() {
  window.hostUI?.auditOverlay && (window.hostUI.auditOverlay.style.display = "none");
}

function closeCheckerOverlay() {
  hideCheckerOverlay();

  const { auditGrid, auditTitle, checkerCardID } = window.hostUI || {};
  
  if (auditGrid) auditGrid.innerHTML = "";
  if (auditTitle) auditTitle.textContent = "CARD AUDIT";
  if (checkerCardID) {
    checkerCardID.value = "";
    checkerCardID.focus();
  }

  checkerCard = null;
  currentCardID = null;
}

// ==========================================
// RENDERING
// ==========================================

function renderCheckerCard() {
  const grid = window.hostUI?.auditGrid;
  if (!grid) {
    console.error("auditGrid element not found.");
    return;
  }

  grid.innerHTML = "";

  const normalizedCalled = calledAnswers.map((ans) => 
    String(ans).trim().toLowerCase()
  );

  const cells = checkerCard?.grid ?? checkerCard?.cells ?? [];

  cells.forEach((cell) => {
    const box = document.createElement("div");
    box.className = "audit-cell";

    const text = cell.text ?? cell.questionText ?? "";
    box.textContent = text;

    const normalizedText = String(text).trim().toLowerCase();
    const isFree = cell.isFreeSpace || cell.isFree || 
                   ["free", "free space"].includes(normalizedText);
    const wasCalled = normalizedCalled.includes(normalizedText) ||
                      (cell.questionId && normalizedCalled.includes(String(cell.questionId).toLowerCase()));

    box.classList.add(isFree ? "free" : wasCalled ? "correct" : "clear");
    if (isFree) box.classList.add("correct");

    grid.appendChild(box);
  });
}

// ==========================================
// APPROVAL ACTIONS
// ==========================================

function approvePhysicalBingo() {
  if (!checkerCard) {
    console.warn("No checker card loaded");
    return;
  }

  console.log("PHYSICAL BINGO APPROVED:", checkerCard.id);
  window.hostSocket?.emit("approvePhysicalWin", { cardId: checkerCard.id });
  closeCheckerOverlay();
}

function rejectPhysicalBingo() {
  if (!checkerCard) return;

  console.log("REJECTING PHYSICAL CARD:", checkerCard.id);
  window.hostSocket?.emit("rejectPhysicalWin", { cardId: checkerCard.id });
  closeCheckerOverlay();
}

// ==========================================
// EVENT HANDLERS
// ==========================================

function handleEnterKey(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    checkPhysicalCard();
  }
}

function receiveScannedCard(cardID) {
  console.log("SCANNED CARD:", cardID);
  if (window.hostUI?.checkerCardID) {
    window.hostUI.checkerCardID.value = cardID;
  }
  checkPhysicalCard();
}

// ==========================================
// BOOTSTRAP
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
  if (window.hostUI) initializeHostChecker();
});

// ==========================================
// EXPORTS
// ==========================================

Object.assign(window, {
  initializeHostChecker,
  checkPhysicalCard,
  approvePhysicalBingo,
  rejectPhysicalBingo,
  closeCheckerOverlay,
  receiveScannedCard,
});
