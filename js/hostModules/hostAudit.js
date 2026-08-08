"use strict";

console.log("HOST DIGITAL AUDIT MODULE LOADED");

let digitalAuditCard = null;
let digitalAuditData = null;
let digitalAuditInitialized = false;

// =====================================================
// INITIALIZE
// =====================================================

function initializeHostAudit() {
    console.log("INITIALIZING DIGITAL AUDITOR");
    waitForHostSocket();
}

// =====================================================
// WAIT FOR HOST SOCKET
// =====================================================

function waitForHostSocket() {
    if (!window.hostSocket) {
        console.log("WAITING FOR HOST SOCKET...");
        setTimeout(waitForHostSocket, 500);
        return;
    }

    console.log("DIGITAL AUDITOR CONNECTED");
    setupDigitalAuditSocket();
}

// =====================================================
// SOCKET LISTENER
// =====================================================

function setupDigitalAuditSocket() {
    if (digitalAuditInitialized) {
        console.log("DIGITAL AUDIT SOCKET ALREADY INITIALIZED");
        return;
    }

    digitalAuditInitialized = true;

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
// CREATE AUDIT BUTTON
// =====================================================

function createAuditButton(data) {
    const list = document.getElementById("auditWinnerList");
    if (!list) {
        console.error("Missing auditWinnerList");
        return;
    }

    const cardId = Number(data.cardId);
    if (!cardId) {
        console.error("Invalid audit card ID:", data);
        return;
    }

    const existing = list.querySelector('[data-card="' + cardId + '"]');
    if (existing) {
        console.log("Audit request already exists for card:", cardId);
        return;
    }

    const button = document.createElement("button");
    button.className = "audit-list-button";
    button.dataset.card = cardId;
    button.type = "button";
    button.textContent = "AUDIT CARD #" + cardId;

    button.onclick = function() {
        openDigitalAudit(data);
    };

    list.appendChild(button);
    console.log("AUDIT BUTTON CREATED:", cardId);
}

// =====================================================
// OPEN DIGITAL AUDIT
// =====================================================

function openDigitalAudit(data) {
    if (typeof window.generateCard !== "function") {
        console.error("Card generator missing");
        return;
    }

    const cardId = Number(data.cardId);
    if (!cardId) {
        console.error("Invalid card ID");
        return;
    }

    digitalAuditCard = window.generateCard(cardId);
    digitalAuditData = data;

    if (!digitalAuditCard) {
        console.error("Unable to generate audit card:", cardId);
        return;
    }

    const overlay = document.getElementById("auditOverlay");
    if (overlay) {
        overlay.style.display = "flex";
    }

    const title = document.getElementById("auditTitle");
    if (title) {
        title.textContent = "DIGITAL AUDIT CARD #" + cardId;
    }

    renderDigitalAuditCard();
}

// =====================================================
// RENDER DIGITAL AUDIT CARD
// =====================================================

function renderDigitalAuditCard() {
    const grid = document.getElementById("auditCardDisplay");
    if (!grid) {
        console.error("Missing auditCardDisplay");
        return;
    }

    if (!digitalAuditCard) {
        return;
    }

    grid.innerHTML = "";

    const auditData = digitalAuditData || {};

    // 1. Marked indices sent by player
    let markedIndices = [];
    if (Array.isArray(auditData.markedIndices)) {
        markedIndices = auditData.markedIndices;
    }

    // 2. Global called answers list from host state
    let calledAnswers = [];
    if (window.hostState && Array.isArray(window.hostState.calledAnswers)) {
        calledAnswers = window.hostState.calledAnswers;
    } else if (Array.isArray(window.calledAnswers)) {
        calledAnswers = window.calledAnswers;
    }

    // Clean normalized called answers array
    const normalizedCalled = calledAnswers.map(ans => String(ans).trim().toLowerCase());

    // BUILD AUDIT CARD GRID
    digitalAuditCard.grid.forEach(function(cell, index) {
        const box = document.createElement("div");
        box.className = "audit-cell";
        box.textContent = cell.text || "";

        const cellTextNorm = String(cell.text || "").trim().toLowerCase();

        // Check if Cell is Free Space
        const isFree = cell.isFreeSpace || cellTextNorm === "free" || cellTextNorm === "free space";

        // Check if Answer Was Called by Host
        const called = normalizedCalled.includes(cellTextNorm);

        // Check if Cell Was Marked by Player
        const marked = markedIndices.includes(index);

        // =================================================
        // AUDIT COLOR LOGIC EVALUATION
        // =================================================

        if (isFree) {
            // GREEN: Free Space
            box.classList.add("audit-correct");
        } 
        else if (marked && called) {
            // GREEN: Marked correctly (Player marked a called answer)
            box.classList.add("audit-correct");
        } 
        else if (marked && !called) {
            // RED: Incorrect mark (Player marked an answer that was NOT called)
            box.classList.add("audit-wrong");
        } 
        else if (!marked && called) {
            // YELLOW: Missed answer (Host called it, answer is on card, player did NOT mark it)
            box.classList.add("audit-missed");
        } 
        else {
            // UNMARKED & UNCALLED (Standard neutral state)
            box.classList.add("audit-neutral");
        }

        grid.appendChild(box);
    });
}

// =====================================================
// APPROVE DIGITAL WINNER
// =====================================================

function approveDigitalWinner() {
    if (!digitalAuditCard) {
        console.warn("No digital audit card open");
        return;
    }

    const cardId = Number(digitalAuditCard.id);
    console.log("APPROVING DIGITAL WIN:", cardId);

    if (window.hostSocket) {
        window.hostSocket.emit("approveWin", cardId);
    }

    removeAuditButton(cardId);
    closeDigitalAudit();
}

// =====================================================
// REJECT DIGITAL WINNER
// =====================================================

function rejectDigitalWinner() {
    if (!digitalAuditCard) {
        console.warn("No digital audit card open");
        return;
    }

    const cardId = Number(digitalAuditCard.id);
    console.log("REJECTING DIGITAL WIN:", cardId);

    if (window.hostSocket) {
        window.hostSocket.emit("rejectWin", cardId);
    }

    removeAuditButton(cardId);
    closeDigitalAudit();
}

// =====================================================
// REMOVE AUDIT BUTTON
// =====================================================

function removeAuditButton(cardId) {
    const list = document.getElementById("auditWinnerList");
    if (!list) return;

    const button = list.querySelector('[data-card="' + Number(cardId) + '"]');
    if (button) {
        button.remove();
    }
}

// =====================================================
// CLOSE DIGITAL AUDIT
// =====================================================

function closeDigitalAudit() {
    digitalAuditCard = null;
    digitalAuditData = null;

    const overlay = document.getElementById("auditOverlay");
    if (overlay) {
        overlay.style.display = "none";
    }
}

// =====================================================
// CLEAR ALL AUDIT REQUESTS
// =====================================================

function clearDigitalAuditRequests() {
    const list = document.getElementById("auditWinnerList");
    if (list) {
        list.innerHTML = "";
    }
    closeDigitalAudit();
}

// =====================================================
// BUTTON CONNECTION
// =====================================================

document.addEventListener("DOMContentLoaded", function() {
    const approveButton = document.getElementById("approvePhysicalWin");
    const rejectButton = document.getElementById("rejectPhysicalWin");

    if (approveButton) {
        approveButton.addEventListener("click", approveDigitalWinner);
    }

    if (rejectButton) {
        rejectButton.addEventListener("click", rejectDigitalWinner);
    }
});

// =====================================================
// EXPORTS
// =====================================================

window.initializeHostAudit = initializeHostAudit;
window.approveDigitalWinner = approveDigitalWinner;
window.rejectDigitalWinner = rejectDigitalWinner;
window.closeDigitalAudit = closeDigitalAudit;
window.clearDigitalAuditRequests = clearDigitalAuditRequests;

console.log("HOST DIGITAL AUDIT MODULE READY");
