"use strict";

// =====================================================
// SAFETY BINGO - HOST PHYSICAL CARD CHECKER
// =====================================================
// Handles:
// 1. Manual Card ID entry
// 2. Physical QR claims
// 3. Physical card audit
// 4. Approve / Reject
// 5. Host socket communication
//
// DIGITAL AUDIT:  audit.js
// PHYSICAL AUDIT: hostChecker.js
// QR ENDPOINT:    /physical-claim?card=27
// =====================================================

console.log("HOST CHECKER MODULE LOADED");

// =====================================================
// CHECKER STATE
// =====================================================

let checkerCard = null;
let currentCardID = null;
let calledAnswers = [];

// =====================================================
// INITIALIZE CHECKER
// =====================================================

function initializeHostChecker() {
  console.log("INITIALIZING HOST CHECKER");

  if (!window.hostUI) {
    console.error("HOST CHECKER: hostUI not available.");
    return;
  }

  // Check Card Button
  if (hostUI.checkCardBtn) {
    if (hostUI.checkCardBtn.dataset.checkerReady !== "true") {
      hostUI.checkCardBtn.dataset.checkerReady = "true";
      hostUI.checkCardBtn.addEventListener("click", checkPhysicalCard);
    }
  }

  // Close Audit
  if (hostUI.closeAuditBtn) {
    if (hostUI.closeAuditBtn.dataset.checkerReady !== "true") {
      hostUI.closeAuditBtn.dataset.checkerReady = "true";
      hostUI.closeAuditBtn.addEventListener("click", closeCheckerOverlay);
    }
  }

  // Approve
  if (hostUI.approveBtn) {
    if (hostUI.approveBtn.dataset.checkerReady !== "true") {
      hostUI.approveBtn.dataset.checkerReady = "true";
      hostUI.approveBtn.addEventListener("click", approvePhysicalBingo);
    }
  }

  // Reject
  if (hostUI.rejectBtn) {
    if (hostUI.rejectBtn.dataset.checkerReady !== "true") {
      hostUI.rejectBtn.dataset.checkerReady = "true";
      hostUI.rejectBtn.addEventListener("click", rejectPhysicalBingo);
    }
  }

  // Socket setup
  if (window.hostSocket) {
    setupCheckerSocket();
  }

  // Enter Key Listener
  if (hostUI.checkerCardID) {
    if (hostUI.checkerCardID.dataset.enterReady !== "true") {
      hostUI.checkerCardID.dataset.enterReady = "true";
      hostUI.checkerCardID.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
          event.preventDefault();
          checkPhysicalCard();
        }
      });
    }
  }

  hideCheckerOverlay();
  console.log("HOST CHECKER READY");
}

// =====================================================
// SOCKET EVENTS
// =====================================================

function setupCheckerSocket() {
  if (!window.hostSocket) {
    console.error("HOST CHECKER: hostSocket unavailable.");
    return;
  }

  console.log("HOST CHECKER SOCKET LISTENERS READY");

  // Game State
  window.hostSocket.on("gameState", function (state) {
    if (!state) return;

    calledAnswers = Array.isArray(state.calledAnswers)
      ? state.calledAnswers
      : [];

    window.hostState = state;
  });

  // Physical QR Claim
  window.hostSocket.on("physicalWinRequested", function (data) {
    console.log("==========================================");
    console.log("PHYSICAL BINGO CLAIM RECEIVED:", data);
    console.log("==========================================");

    if (!data) return;

    const cardID = Number(data.cardId);

    if (!Number.isInteger(cardID) || cardID <= 0) {
      console.error("INVALID PHYSICAL CLAIM CARD ID:", data.cardId);
      return;
    }

    if (hostUI.checkerCardID) {
      hostUI.checkerCardID.value = cardID;
    }

    checkPhysicalCard();
  });

  // Physical Win Approved
  window.hostSocket.on("physicalWinApproved", function (data) {
    console.log("PHYSICAL APPROVAL RECEIVED:", data);

    if (!data) return;

    if (hostUI.auditTitle) {
      const winnerNumber = data.winnerNumber || data.winnerCount || 1;
      const totalRequired = data.totalRequired || 1;

      hostUI.auditTitle.textContent =
        "WINNER " + winnerNumber + " OF " + totalRequired + " APPROVED";
    }
  });

  // Physical Win Rejected
  window.hostSocket.on("physicalWinRejected", function (data) {
    console.log("PHYSICAL REJECTION RECEIVED:", data);
  });
}

// =====================================================
// CHECK PHYSICAL CARD
// =====================================================

function checkPhysicalCard() {
  if (!window.hostUI) {
    console.error("HOST CHECKER: hostUI unavailable.");
    return;
  }

  const input = hostUI.checkerCardID;

  if (!input) {
    console.error("checkerCardID input element not found.");
    return;
  }

  const rawValue = String(input.value).trim();
  const cardID = Number(rawValue);

  if (!Number.isInteger(cardID) || cardID <= 0) {
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
    alert("Unable to generate card #" + cardID);
    return;
  }

  currentCardID = cardID;
  console.log("PHYSICAL CARD LOADED:", cardID);

  openCheckerOverlay();
  renderCheckerCard();
}

// =====================================================
// OPEN PHYSICAL AUDIT
// =====================================================

function openCheckerOverlay() {
  if (!hostUI.auditOverlay) {
    console.error("auditOverlay element not found.");
    return;
  }

  hostUI.auditOverlay.style.display = "flex";
  hostUI.auditOverlay.classList.add("show");

  if (hostUI.auditTitle) {
    hostUI.auditTitle.textContent = "PHYSICAL CARD AUDIT #" + currentCardID;
  }
}

// =====================================================
// RENDER PHYSICAL CARD
// =====================================================

function renderCheckerCard() {
  if (!hostUI.auditGrid) {
    console.error("auditGrid element not found.");
    return;
  }

  if (!checkerCard) {
    console.error("No checker card available.");
    return;
  }

  hostUI.auditGrid.innerHTML = "";

  if (window.hostState && Array.isArray(window.hostState.calledAnswers)) {
    calledAnswers = window.hostState.calledAnswers;
  } else if (Array.isArray(window.calledAnswers)) {
    calledAnswers = window.calledAnswers;
  }

  const normalizedCalled = calledAnswers.map(function (answer) {
    return String(answer).trim().toLowerCase();
  });

  const cellsToRender = checkerCard.grid || checkerCard.cells || [];

  cellsToRender.forEach(function (cell, index) {
    const box = document.createElement("div");
    box.className = "audit-cell";

    const cellText = cell && (cell.text || cell.questionText || "");
    box.textContent = cellText;

    const cellTextNorm = String(cellText).trim().toLowerCase();

    const isFree =
      Boolean(cell && (cell.isFreeSpace || cell.isFree)) ||
      cellTextNorm === "free" ||
      cellTextNorm === "free space";

    const wasCalled =
      normalizedCalled.includes(cellTextNorm) ||
      (cell &&
        cell.questionId &&
        normalizedCalled.includes(String(cell.questionId).trim().toLowerCase()));

    if (isFree) {
      box.classList.add("free", "correct");
    } else if (wasCalled) {
