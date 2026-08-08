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

    // Listen for incoming Bingo requests from players
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
// CREATE / REFRESH AUDIT BUTTON
// =====================================================

function createAuditButton(data) {
    const list = document.getElementById("auditWinnerList");
    if (!list) {
        console.error("Missing auditWinnerList container in HTML");
        return;
    }

    const cardId = Number(data.cardId);
    if (!cardId) {
        console.error("Invalid audit card ID:", data);
        return;
    }

    // FIX: Remove existing button for this card if present, so a re-submitted Bingo is never blocked!
    const existing = list.querySelector('[data-card="' + cardId + '"]');
    if (existing) {
        console.log("Replacing previous audit button for card:", cardId);
        existing.remove();
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
    console.log("AUDIT BUTTON CREATED FOR CARD:", cardId);
}

// =====================================================
// OPEN DIGITAL AUDIT OVERLAY
// =====================================================

function openDigitalAudit(data) {
    if (typeof window.generateCard !== "function") {
        console.error("Card generator function 'window.generateCard' is missing");
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
        console.error("Unable to generate audit card for ID:", cardId);
        return;
    }

    const overlay = document.getElementById("auditOverlay");
    if (overlay) {
        overlay.style.display = "flex";
        overlay.classList.remove("hidden");
    }

    const title = document.getElementById("auditTitle");
    if (title) {
        title.textContent = "DIGITAL AUDIT CARD #" + cardId;
    }

    renderDigitalAuditCard();
}

// =====================================================
// RENDER CARD GRID MATRIX
// =====================================================

function renderDigitalAuditCard() {
    const grid = document.getElementById("auditCardDisplay");
    if (!grid) {
        console.error("Missing auditCardDisplay element");
        return;
    }

    if (!digitalAuditCard) return;

    grid.innerHTML = "";
    const auditData = digitalAuditData || {};

    let markedIndices = Array.isArray(auditData.markedIndices) ? auditData.markedIndices : [];

    let calledAnswers = [];
    if (window.hostState && Array.isArray(window.hostState.calledAnswers)) {
        calledAnswers = window.hostState.calledAnswers;
    } else if (Array.isArray(window.calledAnswers)) {
        calledAnswers = window.calledAnswers;
    }

    const normalizedCalled = calledAnswers.map(ans => String(ans).trim().toLowerCase());

    digitalAuditCard.grid.forEach(function(cell, index) {
        const box = document.createElement("div");
        box.className = "audit-cell";
        box.textContent = cell.text || "";

        const cellTextNorm = String(cell.text || "").trim().toLowerCase();
        const isFree = cell.isFreeSpace || cellTextNorm === "free" || cellTextNorm === "free space";
        const called = normalizedCalled.includes(cellTextNorm);
        const marked = markedIndices.includes(index);

        if (isFree) {
            box.classList.add("audit-correct");
        } else if (marked && called) {
            box.classList.add("audit-correct");
        } else if (marked && !called) {
            box.classList.add("audit-wrong");
        } else if (!marked && called) {
            box.classList.add("audit-missed");
        } else {
            box.classList.add("audit-neutral");
        }

        grid.appendChild(box);
    });
}

// =====================================================
// APPROVE & REJECT ACTIONS
// =====================================================

function approveDigitalWinner() {
    if (!digitalAuditCard && !digitalAuditData) return;

    const cardId = Number((digitalAuditCard && digitalAuditCard.id) || (digitalAuditData && digitalAuditData.cardId));

    console.log("APPROVING DIGITAL WIN FOR CARD:", cardId);

    if (window.hostSocket && cardId) {
        window.hostSocket.emit("approveWin", cardId);
    }

    removeAuditButton(cardId);
    closeDigitalAudit();
}

function rejectDigitalWinner() {
    if (!digitalAuditCard && !digitalAuditData) return;

    const cardId = Number((digitalAuditCard && digitalAuditCard.id) || (digitalAuditData && digitalAuditData.cardId));

    console.log("REJECTING DIGITAL WIN FOR CARD:", cardId);

    if (window.hostSocket && cardId) {
        window.hostSocket.emit("rejectWin", cardId);
    }

    removeAuditButton(cardId);
    closeDigitalAudit();
}

// =====================================================
// CLEANUP & HELPERS
// =====================================================

function removeAuditButton(cardId) {
    const list = document.getElementById("auditWinnerList");
    if (!list) return;

    const numericId = Number(cardId);
    const button = list.querySelector('[data-card="' + numericId + '"]');
    if (button) {
        button.remove();
        console.log("REMOVED AUDIT BUTTON FOR CARD:", numericId);
    }
}

function closeDigitalAudit() {
    digitalAuditCard = null;
    digitalAuditData = null;

    const overlay = document.getElementById("auditOverlay");
    if (overlay) {
        overlay.style.display = "none";
        overlay.classList.add("hidden");
    }
}

function clearDigitalAuditRequests() {
    const list = document.getElementById("auditWinnerList");
    if (list) list.innerHTML = "";
    closeDigitalAudit();
}

// =====================================================
// EVENT DELEGATION
// =====================================================

document.addEventListener("DOMContentLoaded", function() {
    document.addEventListener("click", function(e) {
        if (!e.target) return;
        const id = e.target.id || "";
        const classList = e.target.classList;

        if (id === "approvePhysicalWin" || id === "approveDigitalWin" || classList.contains("approveBtn")) {
            approveDigitalWinner();
        } else if (id === "rejectPhysicalWin" || id === "rejectDigitalWin" || classList.contains("rejectBtn")) {
            rejectDigitalWinner();
        } else if (id === "closeAuditOverlay" || id === "closeCheckerOverlay" || classList.contains("closeAuditBtn")) {
            closeDigitalAudit();
        }
    });
});

initializeHostAudit();

window.initializeHostAudit = initializeHostAudit;
window.approveDigitalWinner = approveDigitalWinner;
window.rejectDigitalWinner = rejectDigitalWinner;
window.closeDigitalAudit = closeDigitalAudit;
window.clearDigitalAuditRequests = clearDigitalAuditRequests;

console.log("HOST DIGITAL AUDIT MODULE READY");
