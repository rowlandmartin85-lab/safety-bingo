"use strict";

console.log("HOST DIGITAL AUDIT MODULE LOADED");

let activeAuditCard = null;
let activeAuditData = null;
let isPhysicalAuditMode = false;
let auditSocketInitialized = false;

const auditCalledQuestionIds = new Set();
const auditCalledAnswers = new Set();

function initializeHostAudit() {
    console.log("HOST AUDIT: INITIALIZING");
    waitForHostSocket();
}

function waitForHostSocket() {
    if (!window.hostSocket) {
        setTimeout(waitForHostSocket, 500);
        return;
    }
    console.log("HOST AUDIT: host socket found");
    setupDigitalAuditSocket();
}

function setupDigitalAuditSocket() {
    if (auditSocketInitialized) return;
    const socket = window.hostSocket;
    if (!socket) return;
    
    auditSocketInitialized = true;

    socket.on("winRequested", data => {
        if (data) createAuditButton(data);
    });

    socket.on("physicalWinRequested", data => {
        if (data) createPhysicalAuditButton(data);
    });

    socket.on("winApproved", finishAuditRequest);
    socket.on("physicalWinApproved", finishAuditRequest);
    socket.on("winRejected", finishAuditRequest);
    socket.on("physicalWinRejected", finishAuditRequest);

    const questionEvents = [
        "questionCalled", "questionRead", "questionSelected", "questionAnnounced",
        "calledQuestion", "readQuestion", "called", "questionCalledByHost",
        "currentQuestion", "questionStarted"
    ];

    questionEvents.forEach(eventName => {
        socket.on(eventName, rememberCalledQuestion);
    });

    if (typeof socket.onAny === "function") {
        socket.onAny((eventName, ...args) => {
            const skip = ["winRequested", "winApproved", "winRejected", "physicalWinRequested", "physicalWinApproved", "physicalWinRejected"];
            if (!skip.includes(eventName) && args.length > 0) {
                inspectPossibleCalledQuestion(eventName, args[0]);
            }
        });
    }

    console.log("HOST AUDIT: SOCKET LISTENERS READY");
}

function rememberCalledQuestion(data) {
    if (data == null) return;

    if (typeof data === "object" && !Array.isArray(data)) {
        const id = extractQuestionIdFromItem(data);
        const answer = extractAnswerFromItem(data);

        if (id) auditCalledQuestionIds.add(id);
        if (answer) auditCalledAnswers.add(answer);

        [data.question, data.questionData, data.currentQuestion, data.item, data.cell, data.data].forEach(item => {
            if (item && typeof item === "object") rememberCalledQuestion(item);
        });
        return;
    }

    const normalized = normalizeQuestionId(data);
    if (normalized) auditCalledQuestionIds.add(normalized);
}

function inspectPossibleCalledQuestion(eventName, data) {
    const name = String(eventName || "").toLowerCase();
    const looksLikeCalled = name.includes("question") || name.includes("called") || name.includes("read") || name.includes("announ") || name.includes("selected");
    if (looksLikeCalled) rememberCalledQuestion(data);
}

function getCardIdFromData(data) {
    if (data == null) return 0;
    if (typeof data === "number" || typeof data === "string") {
        const num = Number(data);
        return Number.isFinite(num) ? num : 0;
    }
    if (typeof data !== "object") return 0;

    const ids = [data.cardId, data.cardID, data.playerCardId, data.playerCardID, data.id, data.card, data.cardNumber, data.cardNo, data.playerCard];
    for (const value of ids) {
        if (value == null || value === "") continue;
        const num = Number(value);
        if (Number.isFinite(num) && num > 0) return num;
    }
    return 0;
}

function createAuditButton(data) {
    const list = getAuditListElement();
    if (!list) return;

    const cardId = getCardIdFromData(data);
    if (!Number.isInteger(cardId) || cardId <= 0) return;

    removeAuditButton(cardId);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "audit-list-button";
    button.dataset.card = String(cardId);
    button.dataset.auditType = "digital";
    button.textContent = `AUDIT DIGITAL CARD #${cardId}`;
    button.addEventListener("click", () => openAuditOverlay(data, false));

    list.appendChild(button);
}

function createPhysicalAuditButton(data) {
    const list = getAuditListElement();
    if (!list) return;

    const cardId = getCardIdFromData(data);
    if (!Number.isInteger(cardId) || cardId <= 0) return;

    removeAuditButton(cardId);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "audit-list-button";
    button.dataset.card = String(cardId);
    button.dataset.auditType = "physical";
    button.textContent = `AUDIT PHYSICAL CARD #${cardId}`;
    button.addEventListener("click", () => openAuditOverlay(data, true));

    list.appendChild(button);
}

function getAuditListElement() {
    return document.getElementById("auditWinnerList") || document.getElementById("winList");
}

function normalizeAuditValue(value) {
    if (value == null || typeof value === "object") return "";
    return String(value).trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeQuestionId(value) {
    if (value == null || value === "") return "";
    const str = String(value).trim().toLowerCase();
    return /^\d+$/.test(str) ? String(Number(str)) : str;
}

function extractQuestionIdFromItem(item) {
    if (item == null || typeof item !== "object") return normalizeQuestionId(item);
    
    const ids = [item.questionId, item.questionID, item.question_id, item.questionKey, item.questionNumber, item.questionIndex, item.id, item.key, item.number];
    for (const value of ids) {
        const normalized = normalizeQuestionId(value);
        if (normalized) return normalized;
    }
    return "";
}

function extractAnswerFromItem(item) {
    if (item == null || typeof item !== "object") return normalizeAuditValue(item);

    const values = [item.answer, item.answerText, item.correctAnswer, item.value, item.text, item.label, item.questionText, item.questionAnswer];
    for (const value of values) {
        const normalized = normalizeAuditValue(value);
        if (normalized) return normalized;
    }
    return "";
}

function getAuditCardCells() {
    if (!activeAuditCard) return [];
    return activeAuditCard.grid || activeAuditCard.cells || activeAuditCard.squares || [];
}

function getMarkedIndices() {
    const result = new Set();
    if (!activeAuditData) return result;

    const sources = [
        activeAuditData.markedIndices, activeAuditData.markedindices, activeAuditData.selectedIndices,
        activeAuditData.markedCells, activeAuditData.selectedCells, activeAuditData.marks
    ];

    for (const source of sources) {
        if (!Array.isArray(source)) continue;

        source.forEach(value => {
            let index = null;
            if (typeof value === "number") index = value;
            else if (typeof value === "string" && /^\d+$/.test(value.trim())) index = Number(value);
            else if (value && typeof value === "object") index = value.index ?? value.cellIndex ?? value.position;

            const num = Number(index);
            if (Number.isInteger(num) && num >= 0 && num < 25) result.add(num);
        });

        if (source === activeAuditData.markedIndices || source === activeAuditData.markedindices) break;
    }
    return result;
}

function isCellMarked(cell, index) {
    const markedIndices = getMarkedIndices();
    if (markedIndices.has(index)) return true;
    
    if (activeAuditData && (Array.isArray(activeAuditData.markedIndices) || Array.isArray(activeAuditData.markedindices))) {
        return false;
    }
    if (!cell) return false;

    return cell.isMarked === true || cell.marked === true || cell.selected === true || cell.checked === true;
}

function wasCellCalled(cell) {
    if (!cell) return false;

    const isFree = cell.isFreeSpace === true || cell.isFree === true || cell.free === true;
    const answer = normalizeAuditValue(cell.answer ?? cell.answerText ?? cell.value ?? cell.text ?? cell.label);
    if (isFree || answer === "free" || answer === "free space") return true;

    const questionId = extractQuestionIdFromItem(cell);
    if (questionId && auditCalledQuestionIds.has(questionId)) return true;
    if (answer && auditCalledAnswers.has(answer)) return true;

    return false;
}

function openAuditOverlay(cardDataOrId, isPhysical = false) {
    if (typeof window.generateCard !== "function") return;

    isPhysicalAuditMode = Boolean(isPhysical);
    activeAuditData = (cardDataOrId && typeof cardDataOrId === "object") ? { ...cardDataOrId } : { cardId: Number(cardDataOrId) };

    const cardId = getCardIdFromData(activeAuditData);
    if (!Number.isInteger(cardId) || cardId <= 0) return;

    activeAuditData.cardId = cardId;

    try {
        activeAuditCard = window.generateCard(cardId);
    } catch (error) {
        console.error("HOST AUDIT: generateCard failed", error);
        return;
    }

    if (!activeAuditCard) return;

    const overlay = document.getElementById("auditOverlay") || document.getElementById("cardCheckerOverlay");
    if (overlay) {
        overlay.style.display = "flex";
        overlay.classList.remove("hidden");
        overlay.classList.add("show");
    }

    const title = document.getElementById("auditTitle") || document.getElementById("checkerTitle");
    if (title) {
        title.textContent = `${isPhysicalAuditMode ? "PHYSICAL PAPER AUDIT" : "DIGITAL AUDIT"} - CARD #${cardId}`;
    }

    renderAuditGrid();
}

function renderAuditGrid() {
    const grid = document.getElementById("auditCardDisplay") || document.getElementById("cardCheckerDisplay");
    if (!grid || !activeAuditCard) return;

    grid.innerHTML = "";
    const cells = getAuditCardCells();
    if (cells.length === 0) return;

    cells.forEach((cell, index) => {
        const box = document.createElement("div");
        box.className = "audit-cell";

        const questionId = extractQuestionIdFromItem(cell);
        const answer = extractAnswerFromItem(cell);

        const isFree = index === 12 || cell?.isFreeSpace === true || cell?.isFree === true || cell?.free === true || answer === "free" || answer === "free space";
        const called = isFree ? true : wasCellCalled(cell);
        const marked = isPhysicalAuditMode ? false : (isFree ? true : isCellMarked(cell, index));

        box.textContent = cell?.answer ?? cell?.answerText ?? cell?.value ?? cell?.text ?? cell?.questionText ?? cell?.label ?? "";

        let color;
        if (isFree) {
            color = "green";
            box.classList.add("correct", "free");
        } else if (isPhysicalAuditMode) {
            if (called) {
                color = "green";
                box.classList.add("correct");
            } else {
                color = "clear";
                box.classList.add("clear");
            }
        } else if (marked && called) {
            color = "green";
            box.classList.add("correct");
        } else if (marked && !called) {
            color = "red";
            box.classList.add("wrong");
        } else if (!marked && called) {
            color = "yellow";
            box.classList.add("missed");
        } else {
            color = "clear";
            box.classList.add("clear");
        }

        box.dataset.index = String(index);
        box.dataset.questionId = questionId;
        box.dataset.called = String(called);
        box.dataset.marked = String(marked);
        box.dataset.free = String(isFree);
        box.dataset.auditColor = color;

        grid.appendChild(box);
    });
}

function approveAuditWinner() {
    const cardId = getCardIdFromData(activeAuditData);
    if (!cardId || !window.hostSocket) return;

    if (isPhysicalAuditMode) {
        window.hostSocket.emit("approvePhysicalWin", { cardId });
    } else {
        window.hostSocket.emit("approveWin", cardId);
    }

    removeAuditButton(cardId);
    closeAuditOverlay();
}

function rejectAuditWinner() {
    const cardId = getCardIdFromData(activeAuditData);
    if (!cardId || !window.hostSocket) return;

    if (isPhysicalAuditMode) {
        window.hostSocket.emit("rejectPhysicalWin", { cardId });
    } else {
        window.hostSocket.emit("rejectWin", cardId);
    }

    removeAuditButton(cardId);
    closeAuditOverlay();
}

function finishAuditRequest(data) {
    const cardId = getCardIdFromData(data);
    if (!cardId) return;

    removeAuditButton(cardId);
    if (activeAuditData && Number(activeAuditData.cardId) === cardId) {
        closeAuditOverlay();
    }
}

function removeAuditButton(cardId) {
    const list = getAuditListElement();
    if (!list) return;

    const numericCardId = Number(cardId);
    if (!Number.isFinite(numericCardId)) return;

    const buttons = list.querySelectorAll(`[data-card="${numericCardId}"]`);
    buttons.forEach(button => button.remove());
}

function closeAuditOverlay() {
    activeAuditCard = null;
    activeAuditData = null;
    isPhysicalAuditMode = false;

    const overlays = document.querySelectorAll(".audit-overlay, .checker-overlay, #auditOverlay, #cardCheckerOverlay");
    overlays.forEach(overlay => {
        overlay.style.display = "none";
        overlay.classList.add("hidden");
        overlay.classList.remove("show");
    });
}

function checkManualCardNumber() {
    const input = document.getElementById("cardLookupInput") || document.getElementById("checkCardInput");
    if (!input) return;

    const cardId = Number(String(input.value).trim());
    if (!Number.isInteger(cardId) || cardId <= 0) {
        alert("Please enter a valid Card Number.");
        return;
    }

    const typeSelect = document.getElementById("cardTypeSelect");
    const physical = typeSelect ? typeSelect.value === "physical" : false;

    openAuditOverlay(cardId, physical);
}

function clearDigitalAuditRequests() {
    const list = getAuditListElement();
    if (list) list.innerHTML = "";
    closeAuditOverlay();
}

function clearAuditCalledHistory() {
    auditCalledQuestionIds.clear();
    auditCalledAnswers.clear();
    if (activeAuditCard) renderAuditGrid();
}

document.addEventListener("click", event => {
    const target = event.target;
    if (!target) return;

    const id = target.id || "";
    const classes = target.classList;

    if (id === "approvePhysicalWin" || id === "approveDigitalWin" || id === "approveWinBtn" || classes?.contains("approveBtn")) {
        approveAuditWinner();
        return;
    }

    if (id === "rejectPhysicalWin" || id === "rejectDigitalWin" || id === "rejectWinBtn" || classes?.contains("rejectBtn")) {
        rejectAuditWinner();
        return;
    }

    if (id === "closeAuditOverlay" || id === "closeCheckerOverlay" || classes?.contains("closeAuditBtn")) {
        closeAuditOverlay();
        return;
    }

    if (id === "checkCardBtn" || id === "runLookupBtn") {
        checkManualCardNumber();
    }
});

window.initializeHostAudit = initializeHostAudit;
window.openAuditOverlay = openAuditOverlay;
window.checkManualCardNumber = checkManualCardNumber;
window.approveAuditWinner = approveAuditWinner;
window.rejectAuditWinner = rejectAuditWinner;
window.approveDigitalWinner = approveAuditWinner;
window.rejectDigitalWinner = rejectAuditWinner;
window.closeAuditOverlay = closeAuditOverlay;
window.closeDigitalAudit = closeAuditOverlay;
window.clearDigitalAuditRequests = clearDigitalAuditRequests;
window.clearAuditCalledHistory = clearAuditCalledHistory;
window.renderAuditGrid = renderAuditGrid;

window.getHostAuditData = () => ({
    activeAuditCard,
    activeAuditData,
    isPhysicalAuditMode,
    calledQuestionIds: [...auditCalledQuestionIds],
    calledAnswers: [...auditCalledAnswers]
});

window.getHostCalledQuestionIds = () => [...auditCalledQuestionIds];
window.getHostCalledAnswers = () => [...auditCalledAnswers];
window.getHostAuditMarkedIndices = () => [...getMarkedIndices()];

initializeHostAudit();
console.log("HOST DIGITAL AUDIT MODULE READY");
