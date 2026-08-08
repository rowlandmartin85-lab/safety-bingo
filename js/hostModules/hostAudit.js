"use strict";

console.log("HOST AUDIT MODULE LOADED");

let activeAuditCard = null;
let activeAuditData = null;
let isPhysicalAuditMode = false;
let digitalAuditInitialized = false;

// =====================================================
// INITIALIZE & SOCKET SETUP
// =====================================================

function initializeHostAudit() {
    console.log("INITIALIZING HOST AUDITOR");
    waitForHostSocket();
}

function waitForHostSocket() {
    if (!window.hostSocket) {
        console.log("WAITING FOR HOST SOCKET...");
        setTimeout(waitForHostSocket, 500);
        return;
    }

    console.log("HOST AUDITOR CONNECTED TO SOCKET");
    setupDigitalAuditSocket();
}

function setupDigitalAuditSocket() {
    if (digitalAuditInitialized) {
        console.log("DIGITAL AUDIT SOCKET ALREADY INITIALIZED");
        return;
    }

    digitalAuditInitialized = true;

    // Listen for incoming Bingo win requests from digital players
    window.hostSocket.on("winRequested", function(data) {
        console.log("========== WIN REQUEST RECEIVED ==========", data);

        if (!data) {
            console.warn("WIN REQUEST DATA MISSING");
            return;
        }

        createAuditButton(data);
    });

    console.log("DIGITAL AUDIT SOCKET LISTENER READY");
}

// =====================================================
// CREATE / REFRESH AUDIT BUTTON IN WINNER LIST
// =====================================================

function createAuditButton(data) {
    const list = document.getElementById("auditWinnerList") || document.getElementById("winList");
    if (!list) {
        console.error("Missing auditWinnerList / winList container in HTML");
        return;
    }

    const cardId = Number(data.cardId);
    if (!cardId) {
        console.error("Invalid audit card ID:", data);
        return;
    }

    // Remove existing button for this card if re-submitted
    const existing = list.querySelector('[data-card="' + cardId + '"]');
    if (existing) {
        console.log("Replacing previous audit button for card:", cardId);
        existing.remove();
    }

    const button = document.createElement("button");
    button.className = "audit-list-button";
    button.dataset.card = cardId;
    button.type = "button";
    button.textContent = "AUDIT DIGITAL CARD #" + cardId;

    button.onclick = function() {
        openAuditOverlay(data, false); // false = Digital Card
    };

    list.appendChild(button);
    console.log("AUDIT BUTTON CREATED FOR DIGITAL CARD:", cardId);
}

// =====================================================
// OPEN AUDIT OVERLAY (DIGITAL OR PHYSICAL)
// =====================================================

/**
 * Opens the audit modal.
 * @param {Object|number} cardDataOrId - Win request object OR card ID number/string
 * @param {boolean} isPhysical - Pass true if auditing a physical paper card
 */
function openAuditOverlay(cardDataOrId, isPhysical = false) {
    if (typeof window.generateCard !== "function") {
        console.error("Card generator function 'window.generateCard' is missing");
        return;
    }

    isPhysicalAuditMode = Boolean(isPhysical);
    let cardId = null;

    if (typeof cardDataOrId === "object" && cardDataOrId !== null) {
        activeAuditData = cardDataOrId;
        cardId = Number(cardDataOrId.cardId);
    } else {
        cardId = Number(cardDataOrId);
        activeAuditData = { cardId: cardId };
    }

    if (!cardId) {
        console.error("Invalid card ID provided for audit:", cardDataOrId);
        return;
    }

    activeAuditCard = window.generateCard(cardId);

    if (!activeAuditCard) {
        console.error("Unable to generate audit card for ID:", cardId);
        return;
    }

    const overlay = document.getElementById("auditOverlay") || document.getElementById("cardCheckerOverlay");
    if (overlay) {
        overlay.style.display = "flex";
        overlay.classList.remove("hidden");
        overlay.classList.add("show");
    }

    const title = document.getElementById("auditTitle") || document.getElementById("checkerTitle");
    if (title) {
        title.textContent = (isPhysicalAuditMode ? "PHYSICAL PAPER AUDIT" : "DIGITAL AUDIT") + " - CARD #" + cardId;
    }

    renderAuditGrid();
}

// =====================================================
// RENDER CARD GRID MATRIX WITH EXACT CSS COLORS
// =====================================================

function renderAuditGrid() {
    const grid = document.getElementById("auditCardDisplay") || document.getElementById("cardCheckerDisplay");
    if (!grid) {
        console.error("Missing auditCardDisplay/cardCheckerDisplay element");
        return;
    }

    if (!activeAuditCard) return;

    grid.innerHTML = "";
    const auditData = activeAuditData || {};

    const markedIndices = Array.isArray(auditData.markedIndices) ? auditData.markedIndices : [];

    // Extract host called answers/questions
    let calledAnswers = [];
    if (window.hostState && Array.isArray(window.hostState.calledAnswers)) {
        calledAnswers = window.hostState.calledAnswers;
    } else if (Array.isArray(window.calledAnswers)) {
        calledAnswers = window.calledAnswers;
    } else if (window.hostState && Array.isArray(window.hostState.readQuestionIds)) {
        calledAnswers = window.hostState.readQuestionIds;
    }

    const normalizedCalled = calledAnswers.map(ans => String(ans).trim().toLowerCase());

    const cellsToRender = activeAuditCard.grid || activeAuditCard.cells || [];

    cellsToRender.forEach(function(cell, index) {
        const box = document.createElement("div");
        box.className = "audit-cell";
        box.textContent = cell.text || cell.questionText || "";

        const cellTextNorm = String(cell.text || cell.questionText || "").trim().toLowerCase();
        const isFree = cell.isFreeSpace || cell.isFree || cellTextNorm === "free" || cellTextNorm === "free space";
        const called = normalizedCalled.includes(cellTextNorm) || (cell.questionId && normalizedCalled.includes(String(cell.questionId).toLowerCase()));
        const marked = markedIndices.includes(index) || cell.isMarked || cell.selected;

        // --- 1. FREE SPACE (GREEN) ---
        if (isFree) {
            box.classList.add("free", "correct");
        } 
        // --- 2. PHYSICAL PAPER CARD AUDIT LOGIC ---
        else if (isPhysicalAuditMode) {
            if (called) {
                // GREEN: Host read this question (Host verifies player stamped paper card)
                box.classList.add("correct");
            } else {
                // CLEAR: Question not read yet
                box.classList.add("clear");
            }
        } 
        // --- 3. DIGITAL CARD AUDIT LOGIC ---
        else {
            if (marked && called) {
                // GREEN: Player marked it and question was read
                box.classList.add("correct");
            } else if (marked && !called) {
                // RED: Player marked it, but question was NOT read yet
                box.classList.add("wrong");
            } else if (!marked && called) {
                // YELLOW: Question was read, but player missed marking it
                box.classList.add("missed");
            } else {
                // CLEAR: Unmarked and question not read yet
                box.classList.add("clear");
            }
        }

        grid.appendChild(box);
    });
}

// =====================================================
// MANUAL CARD AUDIT LOOKUP (FOR PHYSICAL OR MANUAL DIGITAL)
// =====================================================

function checkManualCardNumber() {
    const input = document.getElementById("cardLookupInput") || document.getElementById("checkCardInput");
    if (!input) {
        console.error("Missing card lookup input field");
        return;
    }

    const cardId = Number(input.value.trim());
    if (!cardId) {
        alert("Please enter a valid Card Number.");
        return;
    }

    const typeSelect = document.getElementById("cardTypeSelect");
    const isPhysical = typeSelect ? (typeSelect.value === "physical") : true;

    openAuditOverlay(cardId, isPhysical);
}

// =====================================================
// APPROVE & REJECT ACTIONS
// =====================================================

function approveAuditWinner() {
    if (!activeAuditCard && !activeAuditData) return;

    const cardId = Number((activeAuditCard && activeAuditCard.id) || (activeAuditData && activeAuditData.cardId));

    console.log("APPROVING WIN FOR CARD:", cardId);

    if (window.hostSocket && cardId && !isPhysicalAuditMode) {
        window.hostSocket.emit("approveWin", cardId);
    }

    removeAuditButton(cardId);
    closeAuditOverlay();
}

function rejectAuditWinner() {
    if (!activeAuditCard && !activeAuditData) return;

    const cardId = Number((activeAuditCard && activeAuditCard.id) || (activeAuditData && activeAuditData.cardId));

    console.log("REJECTING WIN FOR CARD:", cardId);

    if (window.hostSocket && cardId && !isPhysicalAuditMode) {
        window.hostSocket.emit("rejectWin", cardId);
    }

    removeAuditButton(cardId);
    closeAuditOverlay();
}

// =====================================================
// CLEANUP & HELPERS
// =====================================================

function removeAuditButton(cardId) {
    const list = document.getElementById("auditWinnerList") || document.getElementById("winList");
    if (!list) return;

    const numericId = Number(cardId);
    const button = list.querySelector('[data-card="' + numericId + '"]');
    if (button) {
        button.remove();
        console.log("REMOVED AUDIT BUTTON FOR CARD:", numericId);
    }
}

function closeAuditOverlay() {
    activeAuditCard = null;
    activeAuditData = null;
    isPhysicalAuditMode = false;

    const overlays = document.querySelectorAll(".audit-overlay, .checker-overlay, #auditOverlay, #cardCheckerOverlay");
    overlays.forEach(function(overlay) {
        overlay.style.display = "none";
        overlay.classList.add("hidden");
        overlay.classList.remove("show");
    });
}

function clearDigitalAuditRequests() {
    const list = document.getElementById("auditWinnerList") || document.getElementById("winList");
    if (list) list.innerHTML = "";
    closeAuditOverlay();
}

// =====================================================
// EVENT DELEGATION
// =====================================================

document.addEventListener("DOMContentLoaded", function() {
    document.addEventListener("click", function(e) {
        if (!e.target) return;
        const id = e.target.id || "";
        const classList = e.target.classList;

        if (id === "approvePhysicalWin" || id === "approveDigitalWin" || id === "approveWinBtn" || classList.contains("approveBtn")) {
            approveAuditWinner();
        } else if (id === "rejectPhysicalWin" || id === "rejectDigitalWin" || id === "rejectWinBtn" || classList.contains("rejectBtn")) {
            rejectAuditWinner();
        } else if (id === "closeAuditOverlay" || id === "closeCheckerOverlay" || classList.contains("closeAuditBtn")) {
            closeAuditOverlay();
        } else if (id === "checkCardBtn" || id === "runLookupBtn") {
            checkManualCardNumber();
        }
    });
});

// Self-initialize
initializeHostAudit();

// Global exports
window.initializeHostAudit = initializeHostAudit;
window.openAuditOverlay = openAuditOverlay;
window.checkManualCardNumber = checkManualCardNumber;
window.approveDigitalWinner = approveAuditWinner;
window.rejectDigitalWinner = rejectAuditWinner;
window.approveAuditWinner = approveAuditWinner;
window.rejectAuditWinner = rejectAuditWinner;
window.closeDigitalAudit = closeAuditOverlay;
window.closeAuditOverlay = closeAuditOverlay;
window.clearDigitalAuditRequests = clearDigitalAuditRequests;

console.log("HOST AUDIT MODULE READY");
