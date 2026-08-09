/*
==========================================
SAFETY BINGO HOST CARD CHECKER
UNIFIED VERSION
==========================================
*/

"use strict";

console.log("HOST CHECKER MODULE LOADED");

let checkerCard = null;
let currentCardID = null;
let calledAnswers = [];

// Helper function to safely get DOM elements
function getUI() {
  return {
    checkerCardID: document.getElementById("checkerCardID"),
    checkCardBtn: document.getElementById("checkCardBtn"),
    checkedCardNumber: document.getElementById("checkedCardNumber"),
    cardCheckerDisplay: document.getElementById("cardCheckerDisplay"),
    auditOverlay: document.getElementById("auditOverlay"),
    auditTitle: document.getElementById("auditTitle"),
    auditGrid: document.getElementById("auditCardDisplay"),
    approveBtn: document.getElementById("approvePhysicalWin"),
    rejectBtn: document.getElementById("rejectPhysicalWin")
  };
}

/*
==========================================
INITIALIZE CHECKER
==========================================
*/

function initializeHostChecker() {
  console.log("INITIALIZING HOST CHECKER");
  const ui = getUI();

  if (ui.checkCardBtn) {
    ui.checkCardBtn.onclick = checkPhysicalCard;
  }

  if (ui.approveBtn) {
    ui.approveBtn.onclick = approvePhysicalBingo;
  }

  if (ui.rejectBtn) {
    ui.rejectBtn.onclick = rejectPhysicalBingo;
  }

  if (ui.checkerCardID) {
    ui.checkerCardID.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        checkPhysicalCard();
      }
    });
  }

  setupCheckerSocket();
  hideCheckerOverlay();

  console.log("HOST CHECKER READY");
}

/*
==========================================
SOCKET EVENTS
==========================================
*/

function setupCheckerSocket() {
  const socket = window.socket || window.hostSocket;
  if (!socket) return;

  socket.on("gameState", (state) => {
    if (!state) return;
    calledAnswers = state.calledAnswers || state.drawnQuestions || state.history || [];
  });

  socket.on("physicalWinApproved", (data) => {
    console.log("PHYSICAL APPROVAL RECEIVED", data);
    const ui = getUI();
    if (ui.auditTitle) {
      ui.auditTitle.textContent = `WINNER ${data.winnerNumber || 1} APPROVED`;
    }
  });
}

/*
==========================================
CHECK PHYSICAL CARD
==========================================
*/

function checkPhysicalCard() {
  const ui = getUI();
  const input = ui.checkerCardID;

  if (!input) {
    console.error("checkerCardID input element not found.");
    return;
  }

  const cardID = Number(input.value.trim());

  if (!cardID || isNaN(cardID)) {
    alert("Please enter a valid Card ID.");
    input.focus();
    return;
  }

  // Support whichever generator function exists
  const cardGeneratorFunc = window.generateBingoCard || window.generateCard;

  if (typeof cardGeneratorFunc !== "function") {
    console.error("Card Generator function missing from cardGenerator.js.");
    alert("Card Generator library unavailable.");
    return;
  }

  checkerCard = cardGeneratorFunc(cardID);

  if (!checkerCard) {
    alert("Unable to generate card #" + cardID);
    return;
  }

  // Ensure card has an ID property
  if (!checkerCard.id) checkerCard.id = cardID;

  currentCardID = cardID;

  openCheckerOverlay();
  renderCheckerCard();
}

/*
==========================================
OPEN / HIDE OVERLAY
==========================================
*/

function openCheckerOverlay() {
  const ui = getUI();
  if (!ui.auditOverlay) return;

  ui.auditOverlay.style.display = "flex";

  if (ui.auditTitle) {
    ui.auditTitle.textContent = "PHYSICAL CARD AUDIT #" + currentCardID;
  }
}

function hideCheckerOverlay() {
  const ui = getUI();
  if (!ui.auditOverlay) return;
  ui.auditOverlay.style.display = "none";
}

/*
==========================================
RENDER CHECKER CARD
==========================================
*/

function renderCheckerCard() {
  const ui = getUI();
  if (!ui.auditGrid) {
    console.error("auditCardDisplay/auditGrid element not found.");
    return;
  }

  ui.auditGrid.innerHTML = "";

  // Fallback state sync
  if (window.hostState && Array.isArray(window.hostState.calledAnswers)) {
    calledAnswers = window.hostState.calledAnswers;
  }

  const normalizedCalled = calledAnswers.map((ans) => String(ans).trim().toLowerCase());
  
  // Extract cells array whether nested in grid or flat in cells
  let cellsToRender = [];
  if (Array.isArray(checkerCard.grid)) {
    cellsToRender = checkerCard.grid.flat();
  } else if (Array.isArray(checkerCard.cells)) {
    cellsToRender = checkerCard.cells;
  }

  // Build grid container style inline to ensure standard 5x5 layout
  ui.auditGrid.style.display = "grid";
  ui.auditGrid.style.gridTemplateColumns = "repeat(5, 1fr)";
  ui.auditGrid.style.gap = "6px";
  ui.auditGrid.style.marginTop = "15px";

  cellsToRender.forEach((cell) => {
    const box = document.createElement("div");
    const rawText = cell.text || cell.questionText || cell.question || cell;
    const textStr = String(rawText || "");
    
    box.textContent = textStr;
    box.style.padding = "10px 5px";
    box.style.textAlign = "center";
    box.style.fontSize = "12px";
    box.style.borderRadius = "4px";
    box.style.fontWeight = "bold";

    const cellTextNorm = textStr.trim().toLowerCase();
    const isFree = cell.isFreeSpace || cell.isFree || cellTextNorm === "free" || cellTextNorm === "free space";
    
    const wasCalled = normalizedCalled.includes(cellTextNorm) ||
                      (cell.questionId && normalizedCalled.includes(String(cell.questionId).toLowerCase()));

    if (isFree || wasCalled) {
      box.style.background = "#00ffcc";
      box.style.color = "#000000";
    } else {
      box.style.background = "#2a2a2a";
      box.style.color = "#ffffff";
    }

    ui.auditGrid.appendChild(box);
  });
}

/*
==========================================
APPROVE / REJECT BINGO
==========================================
*/

function approvePhysicalBingo() {
  if (!checkerCard) {
    console.warn("No checker card loaded");
    return;
  }

  const socket = window.socket || window.hostSocket;
  console.log("PHYSICAL BINGO APPROVED:", checkerCard.id);

  if (socket) {
    socket.emit("approvePhysicalWin", {
      cardId: checkerCard.id
    });
  }

  closeCheckerOverlay();
}

function rejectPhysicalBingo() {
  if (!checkerCard) return;

  const socket = window.socket || window.hostSocket;
  console.log("REJECTING PHYSICAL CARD:", checkerCard.id);

  if (socket) {
    socket.emit("rejectPhysicalWin", {
      cardId: checkerCard.id
    });
  }

  closeCheckerOverlay();
}

/*
==========================================
CLOSE / RESET CHECKER
==========================================
*/

function closeCheckerOverlay() {
  hideCheckerOverlay();
  const ui = getUI();

  if (ui.auditGrid) {
    ui.auditGrid.innerHTML = "";
  }

  if (ui.auditTitle) {
    ui.auditTitle.textContent = "CARD AUDIT";
  }

  if (ui.checkerCardID) {
    ui.checkerCardID.value = "";
    ui.checkerCardID.focus();
  }

  checkerCard = null;
  currentCardID = null;
}

/*
==========================================
SCAN HANDOFF & INITIALIZATION
==========================================
*/

window.receiveScannedCard = function(cardID) {
  const ui = getUI();
  if (ui.checkerCardID) {
    ui.checkerCardID.value = cardID;
  }
  checkPhysicalCard();
};

document.addEventListener("DOMContentLoaded", () => {
  initializeHostChecker();
});

// Exports for global access
window.initializeHostChecker = initializeHostChecker;
window.checkPhysicalCard = checkPhysicalCard;
window.approvePhysicalBingo = approvePhysicalBingo;
window.rejectPhysicalBingo = rejectPhysicalBingo;
window.closeCheckerOverlay = closeCheckerOverlay;
