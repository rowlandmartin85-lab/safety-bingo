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

    // =================================================
    // DIGITAL WIN REQUEST
    // =================================================

    window.hostSocket.on("winRequested", function(data) {

        console.log(
            "========== DIGITAL WIN REQUEST RECEIVED ==========",
            data
        );

        if (!data) {
            console.warn("WIN REQUEST DATA MISSING");
            return;
        }

        createAuditButton(data);
    });

    // =================================================
    // DIGITAL WIN APPROVED
    // =================================================

    window.hostSocket.on("winApproved", function(data) {

        console.log(
            "DIGITAL WIN APPROVED RECEIVED:",
            data
        );

        if (!data) {
            return;
        }

        const cardId = Number(data.cardId);

        if (!cardId) {
            return;
        }

        removeAuditButton(cardId);

        if (
            activeAuditData &&
            Number(activeAuditData.cardId) === cardId &&
            !isPhysicalAuditMode
        ) {
            closeAuditOverlay();
        }
    });

    // =================================================
    // DIGITAL WIN REJECTED
    // =================================================

    window.hostSocket.on("winRejected", function(data) {

        console.log(
            "DIGITAL WIN REJECTED RECEIVED:",
            data
        );

        if (!data) {
            return;
        }

        const cardId = Number(data.cardId);

        if (!cardId) {
            return;
        }

        removeAuditButton(cardId);

        if (
            activeAuditData &&
            Number(activeAuditData.cardId) === cardId &&
            !isPhysicalAuditMode
        ) {
            closeAuditOverlay();
        }
    });

    // =================================================
    // PHYSICAL WIN REQUEST
    // =================================================

    window.hostSocket.on("physicalWinRequested", function(data) {

        console.log(
            "========== PHYSICAL WIN REQUEST RECEIVED ==========",
            data
        );

        if (!data) {
            console.warn(
                "PHYSICAL WIN REQUEST DATA MISSING"
            );

            return;
        }

        createPhysicalAuditButton(data);
    });

    // =================================================
    // PHYSICAL WIN APPROVED
    // =================================================

    window.hostSocket.on("physicalWinApproved", function(data) {

        console.log(
            "PHYSICAL WIN APPROVED RECEIVED:",
            data
        );

        if (!data) {
            return;
        }

        const cardId = Number(data.cardId);

        if (!cardId) {
            return;
        }

        removeAuditButton(cardId);

        if (
            activeAuditData &&
            Number(activeAuditData.cardId) === cardId &&
            isPhysicalAuditMode
        ) {
            closeAuditOverlay();
        }
    });

    // =================================================
    // PHYSICAL WIN REJECTED
    // =================================================

    window.hostSocket.on("physicalWinRejected", function(data) {

        console.log(
            "PHYSICAL WIN REJECTED RECEIVED:",
            data
        );

        if (!data) {
            return;
        }

        const cardId = Number(data.cardId);

        if (!cardId) {
            return;
        }

        removeAuditButton(cardId);

        if (
            activeAuditData &&
            Number(activeAuditData.cardId) === cardId &&
            isPhysicalAuditMode
        ) {
            closeAuditOverlay();
        }
    });

    console.log(
        "HOST AUDIT SOCKET LISTENERS READY"
    );
}

// =====================================================
// CREATE DIGITAL AUDIT BUTTON
// =====================================================

function createAuditButton(data) {

    const list =
        document.getElementById("auditWinnerList") ||
        document.getElementById("winList");

    if (!list) {

        console.error(
            "Missing auditWinnerList / winList container"
        );

        return;
    }

    const cardId = Number(data.cardId);

    if (!Number.isInteger(cardId) || cardId <= 0) {

        console.error(
            "INVALID DIGITAL AUDIT CARD ID:",
            data
        );

        return;
    }

    const existing =
        list.querySelector(
            '[data-card="' + cardId + '"]'
        );

    if (existing) {
        existing.remove();
    }

    const button =
        document.createElement("button");

    button.className =
        "audit-list-button";

    button.dataset.card =
        cardId;

    button.dataset.auditType =
        "digital";

    button.type =
        "button";

    button.textContent =
        "AUDIT DIGITAL CARD #" + cardId;

    button.onclick = function() {

        openAuditOverlay(
            data,
            false
        );

    };

    list.appendChild(button);

    console.log(
        "DIGITAL AUDIT BUTTON CREATED:",
        cardId
    );
}

// =====================================================
// CREATE PHYSICAL AUDIT BUTTON
// =====================================================

function createPhysicalAuditButton(data) {

    const list =
        document.getElementById("auditWinnerList") ||
        document.getElementById("winList");

    if (!list) {

        console.error(
            "Missing auditWinnerList / winList container"
        );

        return;
    }

    const cardId =
        Number(data.cardId);

    if (
        !Number.isInteger(cardId) ||
        cardId <= 0
    ) {

        console.error(
            "INVALID PHYSICAL AUDIT CARD ID:",
            data
        );

        return;
    }

    const existing =
        list.querySelector(
            '[data-card="' + cardId + '"]'
        );

    if (existing) {
        existing.remove();
    }

    const button =
        document.createElement("button");

    button.className =
        "audit-list-button";

    button.dataset.card =
        cardId;

    button.dataset.auditType =
        "physical";

    button.type =
        "button";

    button.textContent =
        "AUDIT PHYSICAL CARD #" + cardId;

    button.onclick = function() {

        openAuditOverlay(
            data,
            true
        );

    };

    list.appendChild(button);

    console.log(
        "PHYSICAL AUDIT BUTTON CREATED:",
        cardId
    );
}

// =====================================================
// OPEN AUDIT OVERLAY
// =====================================================

function openAuditOverlay(
    cardDataOrId,
    isPhysical = false
) {

    if (
        typeof window.generateCard !==
        "function"
    ) {

        console.error(
            "Card generator function 'window.generateCard' is missing"
        );

        return;
    }

    isPhysicalAuditMode =
        Boolean(isPhysical);

    // -------------------------------------------------
    // STORE AUDIT DATA
    // -------------------------------------------------

    if (
        typeof cardDataOrId === "object" &&
        cardDataOrId !== null
    ) {

        activeAuditData = {
            ...cardDataOrId
        };

    } else {

        activeAuditData = {
            cardId:
                Number(cardDataOrId)
        };

    }

    const cardId =
        Number(
            activeAuditData.cardId
        );

    if (
        !Number.isInteger(cardId) ||
        cardId <= 0
    ) {

        console.error(
            "INVALID CARD ID PROVIDED FOR AUDIT:",
            cardDataOrId
        );

        return;
    }

    console.log(
        "OPENING AUDIT:",
        {
            cardId,
            physical:
                isPhysicalAuditMode,
            auditData:
                activeAuditData
        }
    );

    // -------------------------------------------------
    // GENERATE CARD
    // -------------------------------------------------

    activeAuditCard =
        window.generateCard(cardId);

    if (!activeAuditCard) {

        console.error(
            "UNABLE TO GENERATE AUDIT CARD:",
            cardId
        );

        return;
    }

    // Make sure generated card has an ID
    if (!activeAuditCard.id) {
        activeAuditCard.id = cardId;
    }

    // -------------------------------------------------
    // OPEN OVERLAY
    // -------------------------------------------------

    const overlay =
        document.getElementById("auditOverlay") ||
        document.getElementById("cardCheckerOverlay");

    if (overlay) {

        overlay.style.display =
            "flex";

        overlay.classList.remove(
            "hidden"
        );

        overlay.classList.add(
            "show"
        );

    } else {

        console.warn(
            "AUDIT OVERLAY NOT FOUND"
        );

    }

    // -------------------------------------------------
    // TITLE
    // -------------------------------------------------

    const title =
        document.getElementById("auditTitle") ||
        document.getElementById("checkerTitle");

    if (title) {

        title.textContent =
            (
                isPhysicalAuditMode
                    ? "PHYSICAL PAPER AUDIT"
                    : "DIGITAL AUDIT"
            ) +
            " - CARD #" +
            cardId;

    }

    // -------------------------------------------------
    // RENDER
    // -------------------------------------------------

    renderAuditGrid();
}

// =====================================================
// NORMALIZE VALUES
// =====================================================

function normalizeAuditValue(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value)
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();
}

// =====================================================
// GET HOST CALLED ANSWERS
// =====================================================

function getHostCalledAnswers() {

    let calledAnswers = [];

    // -------------------------------------------------
    // PRIMARY SOURCE
    // -------------------------------------------------

    if (
        window.hostState &&
        Array.isArray(
            window.hostState.calledAnswers
        )
    ) {

        calledAnswers =
            window.hostState.calledAnswers;

    }

    // -------------------------------------------------
    // SECONDARY SOURCE
    // -------------------------------------------------

    else if (
        Array.isArray(
            window.calledAnswers
        )
    ) {

        calledAnswers =
            window.calledAnswers;

    }

    // -------------------------------------------------
    // DO NOT USE readQuestionIds HERE
    // -------------------------------------------------
    //
    // readQuestionIds are IDs.
    // calledAnswers are answers.
    //
    // They cannot be compared directly.
    // -------------------------------------------------

    return Array.isArray(calledAnswers)
        ? calledAnswers
        : [];
}

// =====================================================
// RENDER AUDIT GRID
// =====================================================

function renderAuditGrid() {

    const grid =
        document.getElementById("auditCardDisplay") ||
        document.getElementById("cardCheckerDisplay");

    if (!grid) {

        console.error(
            "Missing auditCardDisplay/cardCheckerDisplay element"
        );

        return;
    }

    if (!activeAuditCard) {

        console.error(
            "No active audit card"
        );

        return;
    }

    grid.innerHTML = "";

    // =================================================
    // GET CALLED ANSWERS
    // =================================================

    const calledAnswers =
        getHostCalledAnswers();

    const normalizedCalled =
        new Set(
            calledAnswers.map(
                normalizeAuditValue
            )
        );

    console.log(
        "=========================================="
    );

    console.log(
        "AUDIT RENDER START"
    );

    console.log(
        "PHYSICAL AUDIT:",
        isPhysicalAuditMode
    );

    console.log(
        "CALLED ANSWERS:",
        calledAnswers
    );

    console.log(
        "NORMALIZED CALLED ANSWERS:",
        [...normalizedCalled]
    );

    console.log(
        "ACTIVE CARD:",
        activeAuditCard
    );

    console.log(
        "AUDIT DATA:",
        activeAuditData
    );

    console.log(
        "=========================================="
    );

    // =================================================
    // MARKED INDICES FROM DIGITAL CLAIM
    // =================================================

    const markedIndices =
        activeAuditData &&
        Array.isArray(
            activeAuditData.markedIndices
        )
            ? activeAuditData.markedIndices
                .map(Number)
            : [];

    // =================================================
    // GET CARD CELLS
    // =================================================

    const cellsToRender =
        activeAuditCard.grid ||
        activeAuditCard.cells ||
        [];

    if (
        !Array.isArray(
            cellsToRender
        )
    ) {

        console.error(
            "CARD GRID/CELLS IS NOT AN ARRAY:",
            cellsToRender
        );

        return;
    }

    // =================================================
    // RENDER EACH CELL
    // =================================================

    cellsToRender.forEach(
        function(cell, index) {

            const box =
                document.createElement("div");

            box.className =
                "audit-cell";

            // -------------------------------------------------
            // DETERMINE CARD VALUE
            // -------------------------------------------------
            //
            // Different card generators use different
            // property names. We support all common ones.
            // -------------------------------------------------

            const cardValue =
                cell &&
                (
                    cell.answer ??
                    cell.value ??
                    cell.text ??
                    cell.questionText ??
                    cell.label ??
                    ""
                );

            const cellTextNorm =
                normalizeAuditValue(
                    cardValue
                );

            // -------------------------------------------------
            // DISPLAY VALUE
            // -------------------------------------------------

            box.textContent =
                cardValue || "";

            // -------------------------------------------------
            // FREE SPACE
            // -------------------------------------------------

            const isFree =
                Boolean(
                    cell &&
                    (
                        cell.isFreeSpace ||
                        cell.isFree
                    )
                ) ||
                cellTextNorm === "free" ||
                cellTextNorm === "free space";

            // -------------------------------------------------
            // CALLED CHECK
            // -------------------------------------------------
            //
            // IMPORTANT:
            //
            // We compare the card's ANSWER/value against
            // gameState.calledAnswers.
            //
            // We do NOT compare against readQuestionIds.
            // -------------------------------------------------

            const called =
                isFree
                    ? true
                    : normalizedCalled.has(
                        cellTextNorm
                    );

            // -------------------------------------------------
            // MARKED CHECK
            // -------------------------------------------------

            const marked =
                isPhysicalAuditMode
                    ? false
                    : (
                        markedIndices.includes(
                            index
                        ) ||
                        Boolean(
                            cell &&
                            (
                                cell.isMarked ||
                                cell.selected
                            )
                        )
                    );

            // =================================================
            // DEBUG EACH CELL
            // =================================================

            console.log(
                "AUDIT CELL",
                {
                    index:
                        index,

                    rawCell:
                        cell,

                    cardValue:
                        cardValue,

                    normalizedCardValue:
                        cellTextNorm,

                    called:
                        called,

                    marked:
                        marked,

                    isFree:
                        isFree
                }
            );

            // =================================================
            // PHYSICAL AUDIT
            // =================================================

            if (isPhysicalAuditMode) {

                if (isFree) {

                    box.classList.add(
                        "free",
                        "correct"
                    );

                }
                else if (called) {

                    // Question was called.
                    // Host checks physical card.
                    box.classList.add(
                        "correct"
                    );

                }
                else {

                    // Question has not been called.
                    box.classList.add(
                        "clear"
                    );

                }

            }

            // =================================================
            // DIGITAL AUDIT
            // =================================================

            else {

                // ---------------------------------------------
                // FREE SPACE
                // ---------------------------------------------

                if (isFree) {

                    box.classList.add(
                        "free",
                        "correct"
                    );

                }

                // ---------------------------------------------
                // MARKED + CALLED
                // CORRECT
                // ---------------------------------------------

                else if (
                    marked &&
                    called
                ) {

                    box.classList.add(
                        "correct"
                    );

                }

                // ---------------------------------------------
                // MARKED + NOT CALLED
                // WRONG
                // ---------------------------------------------

                else if (
                    marked &&
                    !called
                ) {

                    box.classList.add(
                        "wrong"
                    );

                }

                // ---------------------------------------------
                // NOT MARKED + CALLED
                // MISSED
                // ---------------------------------------------

                else if (
                    !marked &&
                    called
                ) {

                    box.classList.add(
                        "missed"
                    );

                }

                // ---------------------------------------------
                // NOT MARKED + NOT CALLED
                // CLEAR
                // ---------------------------------------------

                else {

                    box.classList.add(
                        "clear"
                    );

                }

            }

            grid.appendChild(
                box
            );

        }
    );

    console.log(
        "AUDIT GRID RENDER COMPLETE"
    );
}

// =====================================================
// MANUAL CARD AUDIT LOOKUP
// =====================================================

function checkManualCardNumber() {

    const input =
        document.getElementById(
            "cardLookupInput"
        ) ||
        document.getElementById(
            "checkCardInput"
        );

    if (!input) {

        console.error(
            "Missing card lookup input field"
        );

        return;
    }

    const cardId =
        Number(
            input.value.trim()
        );

    if (
        !Number.isInteger(cardId) ||
        cardId <= 0
    ) {

        alert(
            "Please enter a valid Card Number."
        );

        return;
    }

    const typeSelect =
        document.getElementById(
            "cardTypeSelect"
        );

    const isPhysical =
        typeSelect
            ? typeSelect.value === "physical"
            : true;

    openAuditOverlay(
        cardId,
        isPhysical
    );
}

// =====================================================
// APPROVE AUDIT WINNER
// =====================================================

function approveAuditWinner() {

    if (
        !activeAuditCard &&
        !activeAuditData
    ) {
        console.warn(
            "NO ACTIVE AUDIT TO APPROVE"
        );

        return;
    }

    const cardId =
        Number(
            (
                activeAuditCard &&
                activeAuditCard.id
            ) ||
            (
                activeAuditData &&
                activeAuditData.cardId
            )
        );

    if (
        !Number.isInteger(cardId) ||
        cardId <= 0
    ) {

        console.error(
            "INVALID AUDIT CARD ID:",
            cardId
        );

        return;
    }

    if (!window.hostSocket) {

        console.error(
            "HOST SOCKET NOT AVAILABLE"
        );

        return;
    }

    console.log(
        "APPROVING",
        isPhysicalAuditMode
            ? "PHYSICAL"
            : "DIGITAL",
        "WIN:",
        cardId
    );

    // =================================================
    // PHYSICAL
    // =================================================

    if (isPhysicalAuditMode) {

        window.hostSocket.emit(
            "approvePhysicalWin",
            {
                cardId:
                    cardId
            }
        );

    }

    // =================================================
    // DIGITAL
    // =================================================

    else {

        window.hostSocket.emit(
            "approveWin",
            cardId
        );

    }

    // We can close immediately.
    // Server confirmation listeners above will
    // also clean up if necessary.

    removeAuditButton(
        cardId
    );

    closeAuditOverlay();
}

// =====================================================
// REJECT AUDIT WINNER
// =====================================================

function rejectAuditWinner() {

    if (
        !activeAuditCard &&
        !activeAuditData
    ) {
        console.warn(
            "NO ACTIVE AUDIT TO REJECT"
        );

        return;
    }

    const cardId =
        Number(
            (
                activeAuditCard &&
                activeAuditCard.id
            ) ||
            (
                activeAuditData &&
                activeAuditData.cardId
            )
        );

    if (
        !Number.isInteger(cardId) ||
        cardId <= 0
    ) {

        console.error(
            "INVALID AUDIT CARD ID:",
            cardId
        );

        return;
    }

    if (!window.hostSocket) {

        console.error(
            "HOST SOCKET NOT AVAILABLE"
        );

        return;
    }

    console.log(
        "REJECTING",
        isPhysicalAuditMode
            ? "PHYSICAL"
            : "DIGITAL",
        "WIN:",
        cardId
    );

    // =================================================
    // PHYSICAL
    // =================================================

    if (isPhysicalAuditMode) {

        window.hostSocket.emit(
            "rejectPhysicalWin",
            {
                cardId:
                    cardId
            }
        );

    }

    // =================================================
    // DIGITAL
    // =================================================

    else {

        window.hostSocket.emit(
            "rejectWin",
            cardId
        );

    }

    removeAuditButton(
        cardId
    );

    closeAuditOverlay();
}

// =====================================================
// REMOVE AUDIT BUTTON
// =====================================================

function removeAuditButton(cardId) {

    const list =
        document.getElementById(
            "auditWinnerList"
        ) ||
        document.getElementById(
            "winList"
        );

    if (!list) {
        return;
    }

    const numericId =
        Number(cardId);

    const button =
        list.querySelector(
            '[data-card="' +
            numericId +
            '"]'
        );

    if (button) {

        button.remove();

        console.log(
            "REMOVED AUDIT BUTTON:",
            numericId
        );

    }
}

// =====================================================
// CLOSE AUDIT OVERLAY
// =====================================================

function closeAuditOverlay() {

    activeAuditCard =
        null;

    activeAuditData =
        null;

    isPhysicalAuditMode =
        false;

    const overlays =
        document.querySelectorAll(
            ".audit-overlay, " +
            ".checker-overlay, " +
            "#auditOverlay, " +
            "#cardCheckerOverlay"
        );

    overlays.forEach(
        function(overlay) {

            overlay.style.display =
                "none";

            overlay.classList.add(
                "hidden"
            );

            overlay.classList.remove(
                "show"
            );

        }
    );
}

// =====================================================
// CLEAR DIGITAL AUDIT REQUESTS
// =====================================================

function clearDigitalAuditRequests() {

    const list =
        document.getElementById(
            "auditWinnerList"
        ) ||
        document.getElementById(
            "winList"
        );

    if (list) {

        list.innerHTML =
            "";

    }

    closeAuditOverlay();
}

// =====================================================
// EVENT DELEGATION
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    function() {

        document.addEventListener(
            "click",
            function(e) {

                if (!e.target) {
                    return;
                }

                const id =
                    e.target.id ||
                    "";

                const classList =
                    e.target.classList;

                // ---------------------------------------------
                // APPROVE
                // ---------------------------------------------

                if (
                    id === "approvePhysicalWin" ||
                    id === "approveDigitalWin" ||
                    id === "approveWinBtn" ||
                    (
                        classList &&
                        classList.contains(
                            "approveBtn"
                        )
                    )
                ) {

                    approveAuditWinner();

                }

                // ---------------------------------------------
                // REJECT
                // ---------------------------------------------

                else if (
                    id === "rejectPhysicalWin" ||
                    id === "rejectDigitalWin" ||
                    id === "rejectWinBtn" ||
                    (
                        classList &&
                        classList.contains(
                            "rejectBtn"
                        )
                    )
                ) {

                    rejectAuditWinner();

                }

                // ---------------------------------------------
                // CLOSE
                // ---------------------------------------------

                else if (
                    id === "closeAuditOverlay" ||
                    id === "closeCheckerOverlay" ||
                    (
                        classList &&
                        classList.contains(
                            "closeAuditBtn"
                        )
                    )
                ) {

                    closeAuditOverlay();

                }

                // ---------------------------------------------
                // MANUAL LOOKUP
                // ---------------------------------------------

                else if (
                    id === "checkCardBtn" ||
                    id === "runLookupBtn"
                ) {

                    checkManualCardNumber();

                }

            }
        );

    }
);

// =====================================================
// GLOBAL EXPORTS
// =====================================================

window.initializeHostAudit =
    initializeHostAudit;

window.openAuditOverlay =
    openAuditOverlay;

window.checkManualCardNumber =
    checkManualCardNumber;

window.approveDigitalWinner =
    approveAuditWinner;

window.rejectDigitalWinner =
    rejectAuditWinner;

window.approveAuditWinner =
    approveAuditWinner;

window.rejectAuditWinner =
    rejectAuditWinner;

window.closeDigitalAudit =
    closeAuditOverlay;

window.closeAuditOverlay =
    closeAuditOverlay;

window.clearDigitalAuditRequests =
    clearDigitalAuditRequests;

window.renderAuditGrid =
    renderAuditGrid;

// =====================================================
// SELF INITIALIZE
// =====================================================

initializeHostAudit();

console.log(
    "HOST AUDIT MODULE READY"
);
