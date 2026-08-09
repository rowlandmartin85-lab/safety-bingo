console.log("HOST.JS LOADED");

/*
==========================================
SAFETY BINGO HOST MAIN CONTROLLER
==========================================
*/

console.log("HOST MAIN LOADER START");

// =====================================================
// GLOBAL SOCKET INITIALIZATION & RECONNECT LOGIC
// =====================================================
function initializeHostSocket() {
  if (window.hostSocket) return; // Prevent duplicate socket connections

  console.log("INITIALIZING HOST SOCKET CONNECTION...");

  window.hostSocket = io(window.location.origin, {
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 10
  });

  window.hostSocket.on("connect", () => {
    console.log("Host socket connected with ID:", window.hostSocket.id);

    // Register host with server to receive active game state
    window.hostSocket.emit("registerHost");
  });

  // Handle incoming gameState sync (fires on fresh load or reconnect)
  window.hostSocket.on("gameState", (gameState) => {
    console.log("RECEIVED SYNCED GAME STATE:", gameState);

    // Trigger state restoration across sub-modules if they exist
    if (typeof restoreHostGameState === "function") {
      restoreHostGameState(gameState);
    }
  });

  window.hostSocket.on("gameReset", () => {
    console.log("GAME WAS RESET BY SERVER");
    if (typeof resetHostUI === "function") {
      resetHostUI();
    }
  });
}

// =====================================================
// MAIN DOM LOAD INITIALIZATION
// =====================================================
document.addEventListener("DOMContentLoaded", () => {
  console.log("HOST DOM READY");

  // 0. Initialize Socket connection first
  initializeHostSocket();

  // 1. Load UI
  if (typeof initializeHostUI === "function") {
    initializeHostUI();
  } else {
    console.error("HOST UI MISSING");
  }

  // 2. Start Game Module
  if (typeof initializeHostGame === "function") {
    initializeHostGame();
  } else {
    console.error("HOST GAME MISSING");
  }

  // 3. Start Printer
  if (typeof initializeHostPrinter === "function") {
    initializeHostPrinter();
  } else {
    console.warn("HOST PRINTER NOT FOUND");
  }

  // 4. Start Card Checker
  if (typeof initializeHostChecker === "function") {
    initializeHostChecker();
  } else {
    console.warn("HOST CHECKER NOT FOUND");
  }

  // 5. Start Digital Audit
  if (typeof initializeHostAudit === "function") {
    initializeHostAudit();
  } else {
    console.warn("HOST AUDIT NOT FOUND");
  }

  // 6. Navigation and Modal Controls
  initializeHostReferenceButtons();
  initializeHomeButton();

  console.log("SAFETY BINGO HOST READY");
});

// =====================================================
// HOST REFERENCE BUTTONS
// =====================================================
function initializeHostReferenceButtons() {
  console.log("INITIALIZING HOST REFERENCE BUTTONS");

  const answerKeyBtn = document.getElementById("answerKeyBtn");
  if (answerKeyBtn) {
    answerKeyBtn.addEventListener("click", () => {
      window.open("/answerkey.html", "_blank");
    });
  } else {
    console.warn("answerKeyBtn not found");
  }

  const cheatSheetBtn = document.getElementById("cheatSheetBtn");
  if (cheatSheetBtn) {
    cheatSheetBtn.addEventListener("click", () => {
      window.open("/cheatsheet.html", "_blank");
    });
  } else {
    console.warn("cheatSheetBtn not found");
  }

  const questionManagerBtn = document.getElementById("questionManagerBtn");
  if (questionManagerBtn) {
    questionManagerBtn.addEventListener("click", () => {
      window.open("/questionManager.html", "_blank");
    });
  } else {
    console.warn("questionManagerBtn not found");
  }
}

// =====================================================
// HOME BUTTON SYSTEM (EXPLICITLY ENDS & RESETS GAME)
// =====================================================
function initializeHomeButton() {
  console.log("INITIALIZING HOME BUTTON SYSTEM");

  const homeBtn = document.getElementById("homeBtn");
  const homeModal = document.getElementById("homeModal");
  const cancelHome = document.getElementById("cancelHome");
  const confirmHome = document.getElementById("confirmHome");
  const resetAndHome = document.getElementById("resetAndHome");

  if (homeBtn && homeModal) {
    homeBtn.onclick = () => {
      console.log("HOME CLICK RECEIVED");
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

  // Confirm Return to Home (Emits game reset so host game restarts clean next time)
  if (confirmHome) {
    confirmHome.onclick = () => {
      console.log("EMITTING GAME RESET AND NAVIGATING TO INDEX");

      // 1. Send reset signal to socket server
      if (window.hostSocket) {
        window.hostSocket.emit("hostResetGame");
        window.hostSocket.emit("resetGame");
      }

      // 2. Clear local storage / session caches
      localStorage.removeItem("safetyBingoState");
      sessionStorage.clear();

      // 3. Redirect back to index
      window.location.href = "/index.html";
    };
  }

  // Optional secondary explicit reset button handler
  if (resetAndHome) {
    resetAndHome.onclick = () => {
      console.log("HOST EXPLICITLY RESETTING GAME BEFORE LEAVING");
      if (window.hostSocket) {
        window.hostSocket.emit("hostResetGame");
        window.hostSocket.emit("resetGame");
      }

      localStorage.removeItem("safetyBingoState");
      sessionStorage.clear();

      window.location.href = "/index.html";
    };
  }

  console.log("HOME BUTTON SYSTEM READY");
}
