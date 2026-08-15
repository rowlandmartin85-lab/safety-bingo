/*
==========================================
SAFETY BINGO HOST CARD CHECKER
COMPLETE REBUILD
==========================================
*/

"use strict";

console.log("HOST CHECKER MODULE LOADED");

/*
==========================================
CHECKER STATE
==========================================
*/

let checkerCard = null;
let currentCardID = null;
let calledAnswers = [];

/*
==========================================
INITIALIZE CHECKER
==========================================
*/

function initializeHostChecker() {
    console.log("INITIALIZING HOST CHECKER");

    if (!window.hostUI) {
        console.error("hostUI not available.");
        return;
    }

    if (hostUI.checkCardBtn) {
        hostUI.checkCardBtn.addEventListener("click", checkPhysicalCard);
    }

    if (hostUI.closeAuditBtn) {
        hostUI.closeAuditBtn.addEventListener("click", closeCheckerOverlay);
    }

    if (hostUI.approveBtn) {
        hostUI.approveBtn.addEventListener("click", approvePhysicalBingo);
    }

    if (hostUI.rejectBtn) {
        hostUI.rejectBtn.addEventListener("click", rejectPhysicalBingo);
    }

    if (window.hostSocket) {
        setupCheckerSocket();
    }

    hideCheckerOverlay();

    console.log("HOST CHECKER READY");
}

/*
==========================================
SOCKET EVENTS
==========================================
*/

function setupCheckerSocket() {
    if (!window.hostSocket) return;

    window.hostSocket.on("gameState", state => {
        if (!state) return;
        calledAnswers = state.calledAnswers || [];
    });

    window.hostSocket.on("physicalWinApproved", data => {
        console.log("PHYSICAL APPROVAL RECEIVED", data);

        if (hostUI.auditTitle) {
            hostUI.auditTitle.textContent =
                "WINNER " + data.winnerNumber + " OF " + data.totalRequired + " APPROVED";
        }
    });
}

/*
==========================================
CHECK PHYSICAL CARD
==========================================
*/

function checkPhysicalCard() {
    const input = hostUI.checkerCardID;

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
        alert("Unable to generate card #" + cardID);
        return;
    }

    currentCardID = cardID;

    openCheckerOverlay();
    renderCheckerCard();
}

/*
==========================================
OPEN OVERLAY
==========================================
*/

function openCheckerOverlay() {
    if (!hostUI.auditOverlay) return;

    hostUI.auditOverlay.style.display = "flex";

    if (hostUI.auditTitle) {
        hostUI.auditTitle.textContent = "PHYSICAL CARD AUDIT #" + currentCardID;
    }
}

/*
==========================================
RENDER CHECKER CARD (FIXED COLOR LOGIC)
==========================================
*/

function renderCheckerCard() {
    if (!hostUI.auditGrid) {
        console.error("auditCardDisplay/auditGrid element not found.");
        return;
    }

    hostUI.auditGrid.innerHTML = "";

    // Sync called answers from window state if socket update hasn't fired
    if (window.hostState && Array.isArray(window.hostState.calledAnswers)) {
        calledAnswers = window.hostState.calledAnswers;
    } else if (Array.isArray(window.calledAnswers)) {
        calledAnswers = window.calledAnswers;
    }

    const normalizedCalled = calledAnswers.map(ans => String(ans).trim().toLowerCase());
    const cellsToRender = checkerCard.grid || checkerCard.cells || [];

    cellsToRender.forEach((cell, index) => {
        const box = document.createElement("div");
        box.className = "audit-cell";
        box.textContent = cell.text || cell.questionText || "";

        const cellTextNorm = String(cell.text || cell.questionText || "").trim().toLowerCase();
        const isFree = cell.isFreeSpace || cell.isFree || cellTextNorm === "free" || cellTextNorm === "free space";
        
        const wasCalled = normalizedCalled.includes(cellTextNorm) || 
                          (cell.questionId && normalizedCalled.includes(String(cell.questionId).toLowerCase()));

        /*
        ==========================================
        1. FREE SPACE (GREEN)
        ==========================================
        */
        if (isFree) {
            box.classList.add("free", "correct");
        }
        /*
        ==========================================
        2. QUESTION WAS CALLED BY HOST (GREEN)
        Allows host to visually verify paper stamps
        ==========================================
        */
        else if (wasCalled) {
            box.classList.add("correct");
        }
        /*
        ==========================================
        3. QUESTION NOT CALLED YET (CLEAR)
        Uncalled questions stay neutral transparent
        ==========================================
        */
        else {
            box.classList.add("clear");
        }

        hostUI.auditGrid.appendChild(box);
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

    console.log("PHYSICAL BINGO APPROVED:", checkerCard.id);

    if (window.hostSocket) {
        window.hostSocket.emit("approvePhysicalWin", {
            cardId: checkerCard.id
        });
    }

    closeCheckerOverlay();
}

function rejectPhysicalBingo() {
    if (!checkerCard) return;

    console.log("REJECTING PHYSICAL CARD:", checkerCard.id);

    if (window.hostSocket) {
        window.hostSocket.emit("rejectPhysicalWin", {
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

    if (hostUI.auditGrid) {
        hostUI.auditGrid.innerHTML = "";
    }

    if (hostUI.auditTitle) {
        hostUI.auditTitle.textContent = "CARD AUDIT";
    }

    if (hostUI.checkerCardID) {
        hostUI.checkerCardID.value = "";
        hostUI.checkerCardID.focus();
    }

    checkerCard = null;
    currentCardID = null;
}

function hideCheckerOverlay() {
    if (!hostUI.auditOverlay) return;
    hostUI.auditOverlay.style.display = "none";
}

/*
==========================================
SCAN HANDOFF & ENTER KEY HANDLER
==========================================
*/

window.receiveScannedCard = function(cardID) {
    console.log("SCANNED CARD:", cardID);

    if (hostUI.checkerCardID) {
        hostUI.checkerCardID.value = cardID;
    }

    checkPhysicalCard();
};

document.addEventListener("DOMContentLoaded", () => {
    // Self initialization on DOM ready
    if (window.hostUI) {
        initializeHostChecker();
    }

    if (hostUI && hostUI.checkerCardID) {
        hostUI.checkerCardID.addEventListener("keydown", event => {
            if (event.key === "Enter") {
                event.preventDefault();
                checkPhysicalCard();
            }
        });
    }
});

// Exports for global access
window.initializeHostChecker = initializeHostChecker;
window.checkPhysicalCard = checkPhysicalCard;
window.approvePhysicalBingo = approvePhysicalBingo;
window.rejectPhysicalBingo = rejectPhysicalBingo;
window.closeCheckerOverlay = closeCheckerOverlay;
