"use strict";

console.log("HOST AUDIT MODULE LOADED");

let activeAuditCard = null;
let activeAuditData = null;
let isPhysicalAuditMode = false;
let digitalAuditInitialized = false;


// =====================================================
// INITIALIZE
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


// =====================================================
// SOCKET SETUP
// =====================================================

function setupDigitalAuditSocket() {

    if (digitalAuditInitialized) {
        console.log("DIGITAL AUDIT SOCKET ALREADY INITIALIZED");
        return;
    }

    digitalAuditInitialized = true;


    // -------------------------------------------------
    // DIGITAL WIN REQUEST
    // -------------------------------------------------

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


    // -------------------------------------------------
    // DIGITAL WIN APPROVED
    // -------------------------------------------------

    window.hostSocket.on("winApproved", function(data) {

        console.log("DIGITAL WIN APPROVED:", data);

        const cardId = extractCardId(data);

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


    // -------------------------------------------------
    // DIGITAL WIN REJECTED
    // -------------------------------------------------

    window.hostSocket.on("winRejected", function(data) {

        console.log("DIGITAL WIN REJECTED:", data);

        const cardId = extractCardId(data);

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


    // -------------------------------------------------
    // PHYSICAL WIN REQUEST
    // -------------------------------------------------

    window.hostSocket.on("physicalWinRequested", function(data) {

        console.log(
            "========== PHYSICAL WIN REQUEST RECEIVED ==========",
            data
        );

        if (!data) {
            console.warn("PHYSICAL WIN REQUEST DATA MISSING");
            return;
        }

        createPhysicalAuditButton(data);
    });


    // -------------------------------------------------
    // PHYSICAL WIN APPROVED
    // -------------------------------------------------

    window.hostSocket.on("physicalWinApproved", function(data) {

        console.log("PHYSICAL WIN APPROVED:", data);

        const cardId = extractCardId(data);

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


    // -------------------------------------------------
    // PHYSICAL WIN REJECTED
    // -------------------------------------------------

    window.hostSocket.on("physicalWinRejected", function(data) {

        console.log("PHYSICAL WIN REJECTED:", data);

        const cardId = extractCardId(data);

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


    console.log("HOST AUDIT SOCKET LISTENERS READY");
}


// =====================================================
// CARD ID HELPER
// =====================================================

function extractCardId(data) {

    if (data === null || data === undefined) {
        return null;
    }

    if (
        typeof data === "number" ||
        typeof data === "string"
    ) {
        const id = Number(data);

        return Number.isInteger(id) && id > 0
            ? id
            : null;
    }

    if (typeof data === "object") {

        const possibleId =
            data.cardId ??
            data.cardID ??
            data.card ??
            data.id;

        const id = Number(possibleId);

        return Number.isInteger(id) && id > 0
            ? id
            : null;
    }

    return null;
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

    const cardId = extractCardId(data);

    if (!cardId) {
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

    button.className = "audit-list-button";
    button.dataset.card = String(cardId);
    button.dataset.auditType = "digital";
    button.type = "button";

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

    const cardId = extractCardId(data);

    if (!cardId) {
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

    button.className = "audit-list-button";
    button.dataset.card = String(cardId);
    button.dataset.auditType = "physical";
    button.type = "button";

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

function openAuditOverlay(cardDataOrId, isPhysical = false) {

    if (typeof window.generateCard !== "function") {

        console.error(
            "Card generator function 'window.generateCard' is missing"
        );

        return;
    }

    isPhysicalAuditMode = Boolean(isPhysical);


    // -------------------------------------------------
    // SAVE AUDIT DATA
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
            cardId: Number(cardDataOrId)
        };
    }


    const cardId =
        extractCardId(activeAuditData);

    if (!cardId) {

        console.error(
            "INVALID CARD ID PROVIDED:",
            cardDataOrId
        );

        return;
    }


    console.log(
        "========================================"
    );

    console.log(
        "OPENING AUDIT"
    );

    console.log(
        "CARD ID:",
        cardId
    );

    console.log(
        "PHYSICAL:",
        isPhysicalAuditMode
    );

    console.log(
        "AUDIT DATA:",
        activeAuditData
    );

    console.log(
        "========================================"
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

        overlay.style.display = "flex";

        overlay.classList.remove("hidden");

        overlay.classList.add("show");

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
// NORMALIZE
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
// ADD VALUE TO SET
// =====================================================

function addAuditKey(set, value) {

    if (
        value === null ||
        value === undefined
    ) {
        return;
    }

    const normalized =
        normalizeAuditValue(value);

    if (normalized) {
        set.add(normalized);
    }
}


// =====================================================
// GET ALL POSSIBLE VALUES FROM AN OBJECT
// =====================================================

function addObjectKeys(set, obj) {

    if (!obj || typeof obj !== "object") {
        return;
    }


    // -------------------------------------------------
    // QUESTION IDS
    // -------------------------------------------------

    addAuditKey(set, obj.questionId);
    addAuditKey(set, obj.questionID);
    addAuditKey(set, obj.question_id);
    addAuditKey(set, obj.id);


    // -------------------------------------------------
    // ANSWER VALUES
    // -------------------------------------------------

    addAuditKey(set, obj.answer);
    addAuditKey(set, obj.answerText);
    addAuditKey(set, obj.answerValue);
    addAuditKey(set, obj.correctAnswer);


    // -------------------------------------------------
    // QUESTION TEXT
    // -------------------------------------------------

    addAuditKey(set, obj.question);
    addAuditKey(set, obj.questionText);
    addAuditKey(set, obj.text);
    addAuditKey(set, obj.label);
    addAuditKey(set, obj.value);


    // -------------------------------------------------
    // OTHER COMMON FIELDS
    // -------------------------------------------------

    addAuditKey(set, obj.name);
    addAuditKey(set, obj.title);
}


// =====================================================
// GET HOST CALLED VALUES
// =====================================================
//
// This is the important fix.
//
// The host may store:
//   calledAnswers
//   readQuestionIds
//   calledQuestionIds
//   calledQuestions
//
// And those arrays may contain:
//   strings
//   numbers
//   question objects
//
// We put ALL usable identifiers/text into one Set.
// =====================================================

function getHostCalledKeys() {

    const calledKeys = new Set();


    // -------------------------------------------------
    // HOST STATE
    // -------------------------------------------------

    const hostState =
        window.hostState || {};


    // -------------------------------------------------
    // calledAnswers
    // -------------------------------------------------

    if (Array.isArray(hostState.calledAnswers)) {

        hostState.calledAnswers.forEach(function(item) {

            if (
                item &&
                typeof item === "object"
            ) {

                addObjectKeys(
                    calledKeys,
                    item
                );

            } else {

                addAuditKey(
                    calledKeys,
                    item
                );
            }
        });
    }


    // -------------------------------------------------
    // calledQuestions
    // -------------------------------------------------

    if (Array.isArray(hostState.calledQuestions)) {

        hostState.calledQuestions.forEach(function(item) {

            if (
                item &&
                typeof item === "object"
            ) {

                addObjectKeys(
                    calledKeys,
                    item
                );

            } else {

                addAuditKey(
                    calledKeys,
                    item
                );
            }
        });
    }


    // -------------------------------------------------
    // calledQuestionIds
    // -------------------------------------------------

    if (Array.isArray(hostState.calledQuestionIds)) {

        hostState.calledQuestionIds.forEach(function(id) {

            addAuditKey(
                calledKeys,
                id
            );
        });
    }


    // -------------------------------------------------
    // readQuestionIds
    // -------------------------------------------------
    //
    // IMPORTANT:
    // Your original code had this source.
    //
    // We are restoring it because your game may actually
    // use these IDs to identify questions the host read.
    // -------------------------------------------------

    if (Array.isArray(hostState.readQuestionIds)) {

        hostState.readQuestionIds.forEach(function(id) {

            addAuditKey(
                calledKeys,
                id
            );
        });
    }


    // -------------------------------------------------
    // GLOBAL calledAnswers
    // -------------------------------------------------

    if (Array.isArray(window.calledAnswers)) {

        window.calledAnswers.forEach(function(item) {

            if (
                item &&
                typeof item === "object"
            ) {

                addObjectKeys(
                    calledKeys,
                    item
                );

            } else {

                addAuditKey(
                    calledKeys,
                    item
                );
            }
        });
    }


    // -------------------------------------------------
    // GLOBAL READ QUESTION IDS
    // -------------------------------------------------

    if (Array.isArray(window.readQuestionIds)) {

        window.readQuestionIds.forEach(function(id) {

            addAuditKey(
                calledKeys,
                id
            );
        });
    }


    console.log(
        "HOST AUDIT CALLED KEYS:",
        [...calledKeys]
    );

    return calledKeys;
}


// =====================================================
// GET CARD CELL VALUES
// =====================================================

function getCellAuditKeys(cell) {

    const keys = new Set();

    if (!cell) {
        return keys;
    }


    // -------------------------------------------------
    // OBJECT FIELDS
    // -------------------------------------------------

    addObjectKeys(
        keys,
        cell
    );


    // -------------------------------------------------
    // SOME GENERATORS USE question.id
    // -------------------------------------------------

    if (
        cell.question &&
        typeof cell.question === "object"
    ) {

        addObjectKeys(
            keys,
            cell.question
        );
    }


    // -------------------------------------------------
    // SOME GENERATORS USE answerObject
    // -------------------------------------------------

    if (
        cell.answerObject &&
        typeof cell.answerObject === "object"
    ) {

        addObjectKeys(
            keys,
            cell.answerObject
        );
    }


    // -------------------------------------------------
    // SOME GENERATORS USE data
    // -------------------------------------------------

    if (
        cell.data &&
        typeof cell.data === "object"
    ) {

        addObjectKeys(
            keys,
            cell.data
        );
    }


    return keys;
}


// =====================================================
// DETERMINE WHETHER CELL WAS CALLED
// =====================================================

function isCellCalled(cell, calledKeys) {

    if (!cell) {
        return false;
    }


    // -------------------------------------------------
    // FREE SPACE
    // -------------------------------------------------

    const cellKeys =
        getCellAuditKeys(cell);


    // -------------------------------------------------
    // DIRECT MATCH
    // -------------------------------------------------

    for (const key of cellKeys) {

        if (calledKeys.has(key)) {

            return true;
        }
    }


    // -------------------------------------------------
    // QUESTION ID AS NUMBER/STRING
    // -------------------------------------------------

    const possibleIds = [

        cell.questionId,
        cell.questionID,
        cell.question_id,

        cell.id,

        cell.question &&
        typeof cell.question === "object"
            ? cell.question.id
            : null,

        cell.question &&
        typeof cell.question === "object"
            ? cell.question.questionId
            : null
    ];


    for (const id of possibleIds) {

        if (
            id !== null &&
            id !== undefined
        ) {

            const normalizedId =
                normalizeAuditValue(id);

            if (
                normalizedId &&
                calledKeys.has(normalizedId)
            ) {
                return true;
            }
        }
    }


    return false;
}


// =====================================================
// GET MARKED INDICES
// =====================================================
//
// Supports several possible payload names.
// =====================================================

function getMarkedIndices() {

    const result = new Set();

    const data =
        activeAuditData || {};


    const possibleArrays = [

        data.markedIndices,
        data.markedIndexes,
        data.markedCells,
        data.selectedIndices,
        data.selectedIndexes,
        data.selectedCells,
        data.playerMarkedIndices
    ];


    possibleArrays.forEach(function(arr) {

        if (!Array.isArray(arr)) {
            return;
        }

        arr.forEach(function(value) {

            const number =
                Number(value);

            if (
                Number.isInteger(number) &&
                number >= 0
            ) {

                result.add(number);
            }
        });
    });


    return result;
}


// =====================================================
// DETERMINE MARKED STATE
// =====================================================

function isCellMarked(cell, index, markedIndices) {

    if (markedIndices.has(index)) {
        return true;
    }


    // -------------------------------------------------
    // Some systems store 1-based indices.
    // If index 0 isn't found, also check index + 1.
    // -------------------------------------------------

    if (markedIndices.has(index + 1)) {
        return true;
    }


    if (!cell) {
        return false;
    }


    // -------------------------------------------------
    // Direct flags
    // -------------------------------------------------

    if (
        cell.isMarked === true ||
        cell.marked === true ||
        cell.selected === true ||
        cell.isSelected === true
    ) {
        return true;
    }


    return false;
}


// =====================================================
// GET CARD CELLS
// =====================================================

function getAuditCells() {

    if (!activeAuditCard) {
        return [];
    }


    if (
        Array.isArray(
            activeAuditCard.grid
        )
    ) {
        return activeAuditCard.grid;
    }


    if (
        Array.isArray(
            activeAuditCard.cells
        )
    ) {
        return activeAuditCard.cells;
    }


    if (
        Array.isArray(
            activeAuditCard.card
        )
    ) {
        return activeAuditCard.card;
    }


    return [];
}


// =====================================================
// GET CELL DISPLAY TEXT
// =====================================================

function getCellDisplayValue(cell) {

    if (!cell) {
        return "";
    }


    // Prefer answer because that's normally what is
    // physically displayed in the Bingo square.

    return (
        cell.answer ??
        cell.value ??
        cell.text ??
        cell.questionText ??
        cell.label ??
        ""
    );
}


// =====================================================
// FREE SPACE CHECK
// =====================================================

function isFreeCell(cell) {

    if (!cell) {
        return false;
    }

    const value =
        normalizeAuditValue(
            getCellDisplayValue(cell)
        );


    return Boolean(
        cell.isFreeSpace ||
        cell.isFree ||
        cell.free ||
        cell.isFreeCell
    ) ||
    value === "free" ||
    value === "free space";
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
            "Missing auditCardDisplay/cardCheckerDisplay"
        );

        return;
    }


    if (!activeAuditCard) {

        console.error(
            "NO ACTIVE AUDIT CARD"
        );

        return;
    }


    grid.innerHTML = "";


    // =================================================
    // GET HOST CALLED KEYS
    // =================================================

    const calledKeys =
        getHostCalledKeys();


    // =================================================
    // GET MARKED INDICES
    // =================================================

    const markedIndices =
        getMarkedIndices();


    // =================================================
    // GET CELLS
    // =================================================

    const cells =
        getAuditCells();


    console.log(
        "=========================================="
    );

    console.log(
        "AUDIT GRID START"
    );

    console.log(
        "CARD:",
        activeAuditCard
    );

    console.log(
        "AUDIT DATA:",
        activeAuditData
    );

    console.log(
        "PHYSICAL:",
        isPhysicalAuditMode
    );

    console.log(
        "CALLED KEYS:",
        [...calledKeys]
    );

    console.log(
        "MARKED INDICES:",
        [...markedIndices]
    );

    console.log(
        "CELL COUNT:",
        cells.length
    );

    console.log(
        "=========================================="
    );


    // =================================================
    // RENDER CELLS
    // =================================================

    cells.forEach(function(cell, index) {

        const box =
            document.createElement("div");


        box.className =
            "audit-cell";


        // -------------------------------------------------
        // DISPLAY VALUE
        // -------------------------------------------------

        const displayValue =
            getCellDisplayValue(cell);


        box.textContent =
            displayValue || "";


        // -------------------------------------------------
        // FREE
        // -------------------------------------------------

        const free =
            isFreeCell(cell);


        // -------------------------------------------------
        // CALLED
        // -------------------------------------------------

        const called =
            free
                ? true
                : isCellCalled(
                    cell,
                    calledKeys
                );


        // -------------------------------------------------
        // MARKED
        // -------------------------------------------------

        const marked =
            isPhysicalAuditMode
                ? false
                : isCellMarked(
                    cell,
                    index,
                    markedIndices
                );


        // =================================================
        // DEBUG
        // =================================================

        console.log(
            "AUDIT CELL #" + index,
            {
                cell: cell,

                displayValue:
                    displayValue,

                questionId:
                    cell &&
                    cell.questionId,

                answer:
                    cell &&
                    cell.answer,

                questionText:
                    cell &&
                    cell.questionText,

                called:
                    called,

                marked:
                    marked,

                free:
                    free,

                cellKeys:
                    [...getCellAuditKeys(cell)]
            }
        );


        // =================================================
        // PHYSICAL AUDIT
        // =================================================

        if (isPhysicalAuditMode) {

            if (free) {

                box.classList.add(
                    "free",
                    "correct"
                );

            }
            else if (called) {

                // Host called this question.
                // On physical audit the host checks
                // whether the player stamped it.

                box.classList.add(
                    "correct"
                );

            }
            else {

                // Not called yet.

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
            // FREE
            // ---------------------------------------------

            if (free) {

                box.classList.add(
                    "free",
                    "correct"
                );
            }


            // ---------------------------------------------
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
            // CLEAR
            // ---------------------------------------------

            else {

                box.classList.add(
                    "clear"
                );
            }
        }


        // =================================================
        // OPTIONAL DEBUG DATA ON DOM
        // =================================================

        box.dataset.index =
            String(index);

        box.dataset.called =
            called
                ? "true"
                : "false";

        box.dataset.marked =
            marked
                ? "true"
                : "false";


        grid.appendChild(box);
    });


    console.log(
        "AUDIT GRID RENDER COMPLETE"
    );
}


// =====================================================
// MANUAL CARD LOOKUP
// =====================================================

function checkManualCardNumber() {

    const input =
        document.getElementById("cardLookupInput") ||
        document.getElementById("checkCardInput");


    if (!input) {

        console.error(
            "Missing card lookup input field"
        );

        return;
    }


    const cardId =
        Number(
            String(input.value).trim()
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
// GET ACTIVE CARD ID
// =====================================================

function getActiveAuditCardId() {

    if (
        activeAuditCard &&
        activeAuditCard.id
    ) {

        const id =
            Number(
                activeAuditCard.id
            );

        if (
            Number.isInteger(id) &&
            id > 0
        ) {
            return id;
        }
    }


    if (activeAuditData) {

        const id =
            extractCardId(
                activeAuditData
            );

        if (id) {
            return id;
        }
    }


    return null;
}


// =====================================================
// APPROVE
// =====================================================

function approveAuditWinner() {

    const cardId =
        getActiveAuditCardId();


    if (!cardId) {

        console.warn(
            "NO ACTIVE AUDIT TO APPROVE"
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


    if (isPhysicalAuditMode) {

        window.hostSocket.emit(
            "approvePhysicalWin",
            {
                cardId: cardId
            }
        );

    } else {

        window.hostSocket.emit(
            "approveWin",
            cardId
        );
    }


    removeAuditButton(cardId);

    closeAuditOverlay();
}


// =====================================================
// REJECT
// =====================================================

function rejectAuditWinner() {

    const cardId =
        getActiveAuditCardId();


    if (!cardId) {

        console.warn(
            "NO ACTIVE AUDIT TO REJECT"
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


    if (isPhysicalAuditMode) {

        window.hostSocket.emit(
            "rejectPhysicalWin",
            {
                cardId: cardId
            }
        );

    } else {

        window.hostSocket.emit(
            "rejectWin",
            cardId
        );
    }


    removeAuditButton(cardId);

    closeAuditOverlay();
}


// =====================================================
// REMOVE AUDIT BUTTON
// =====================================================

function removeAuditButton(cardId) {

    const list =
        document.getElementById("auditWinnerList") ||
        document.getElementById("winList");


    if (!list) {
        return;
    }


    const numericId =
        Number(cardId);


    const buttons =
        list.querySelectorAll(
            '[data-card="' +
            numericId +
            '"]'
        );


    buttons.forEach(function(button) {

        button.remove();

        console.log(
            "REMOVED AUDIT BUTTON:",
            numericId
        );
    });
}


// =====================================================
// CLOSE AUDIT
// =====================================================

function closeAuditOverlay() {

    activeAuditCard = null;

    activeAuditData = null;

    isPhysicalAuditMode = false;


    const overlays =
        document.querySelectorAll(
            ".audit-overlay, " +
            ".checker-overlay, " +
            "#auditOverlay, " +
            "#cardCheckerOverlay"
        );


    overlays.forEach(function(overlay) {

        overlay.style.display = "none";

        overlay.classList.add("hidden");

        overlay.classList.remove("show");
    });
}


// =====================================================
// CLEAR REQUESTS
// =====================================================

function clearDigitalAuditRequests() {

    const list =
        document.getElementById("auditWinnerList") ||
        document.getElementById("winList");


    if (list) {
        list.innerHTML = "";
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
                    e.target.id || "";


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
                        classList.contains("approveBtn")
                    )
                ) {

                    approveAuditWinner();

                    return;
                }


                // ---------------------------------------------
                // REJECT
                // ---------------------------------------------

                if (
                    id === "rejectPhysicalWin" ||
                    id === "rejectDigitalWin" ||
                    id === "rejectWinBtn" ||
                    (
                        classList &&
                        classList.contains("rejectBtn")
                    )
                ) {

                    rejectAuditWinner();

                    return;
                }


                // ---------------------------------------------
                // CLOSE
                // ---------------------------------------------

                if (
                    id === "closeAuditOverlay" ||
                    id === "closeCheckerOverlay" ||
                    (
                        classList &&
                        classList.contains("closeAuditBtn")
                    )
                ) {

                    closeAuditOverlay();

                    return;
                }


                // ---------------------------------------------
                // MANUAL LOOKUP
                // ---------------------------------------------

                if (
                    id === "checkCardBtn" ||
                    id === "runLookupBtn"
                ) {

                    checkManualCardNumber();

                    return;
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
// START
// =====================================================

initializeHostAudit();

console.log(
    "HOST AUDIT MODULE READY"
);
