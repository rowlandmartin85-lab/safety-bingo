"use strict";

/*
=========================================================
HOST AUDIT SYSTEM
=========================================================

DIGITAL AUDIT COLORS:

GREEN  = player marked it AND host called it
RED    = player marked it BUT host did not call it
YELLOW = host called it BUT player did not mark it
CLEAR  = host has not called it AND player did not mark it

FREE SPACE = GREEN

IMPORTANT:
Rejecting a Bingo claim does NOT disable the player's card.
The player remains active and can continue playing.
=========================================================
*/

console.log("HOST AUDIT MODULE LOADED");

let activeAuditCard = null;
let activeAuditData = null;
let isPhysicalAuditMode = false;
let digitalAuditInitialized = false;


// =========================================================
// INITIALIZATION
// =========================================================

function initializeHostAudit() {

    console.log("INITIALIZING HOST AUDIT");

    waitForHostSocket();
}


function waitForHostSocket() {

    if (!window.hostSocket) {

        console.log("WAITING FOR HOST SOCKET...");

        setTimeout(
            waitForHostSocket,
            500
        );

        return;
    }

    console.log("HOST SOCKET FOUND");

    setupDigitalAuditSocket();
}


// =========================================================
// SOCKET SETUP
// =========================================================

function setupDigitalAuditSocket() {

    if (digitalAuditInitialized) {

        console.log(
            "HOST AUDIT SOCKET ALREADY INITIALIZED"
        );

        return;
    }

    digitalAuditInitialized = true;


    // ---------------------------------------------------------
    // DIGITAL WIN REQUEST
    // ---------------------------------------------------------

    window.hostSocket.on(
        "winRequested",
        function(data) {

            console.log(
                "========== WIN REQUEST ==========",
                data
            );

            if (!data) {
                return;
            }

            createAuditButton(data);
        }
    );


    // ---------------------------------------------------------
    // DIGITAL WIN APPROVED
    // ---------------------------------------------------------

    window.hostSocket.on(
        "winApproved",
        function(data) {

            console.log(
                "WIN APPROVED:",
                data
            );

            const cardId =
                getCardIdFromData(data);

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
        }
    );


    // ---------------------------------------------------------
    // DIGITAL WIN REJECTED
    // ---------------------------------------------------------

    window.hostSocket.on(
        "winRejected",
        function(data) {

            console.log(
                "WIN REJECTED:",
                data
            );

            const cardId =
                getCardIdFromData(data);

            if (!cardId) {
                return;
            }

            /*
            IMPORTANT:

            We remove the audit request.

            We DO NOT disable the player's card.
            We DO NOT remove the player.
            We DO NOT mark the card inactive.
            We DO NOT block future Bingo claims.
            */

            removeAuditButton(cardId);

            closeAuditOverlay();

            console.log(
                "BINGO CLAIM REJECTED - PLAYER MAY CONTINUE PLAYING:",
                cardId
            );
        }
    );


    // ---------------------------------------------------------
    // PHYSICAL WIN REQUEST
    // ---------------------------------------------------------

    window.hostSocket.on(
        "physicalWinRequested",
        function(data) {

            console.log(
                "PHYSICAL WIN REQUEST:",
                data
            );

            if (!data) {
                return;
            }

            createPhysicalAuditButton(data);
        }
    );


    // ---------------------------------------------------------
    // PHYSICAL APPROVED
    // ---------------------------------------------------------

    window.hostSocket.on(
        "physicalWinApproved",
        function(data) {

            const cardId =
                getCardIdFromData(data);

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
        }
    );


    // ---------------------------------------------------------
    // PHYSICAL REJECTED
    // ---------------------------------------------------------

    window.hostSocket.on(
        "physicalWinRejected",
        function(data) {

            const cardId =
                getCardIdFromData(data);

            if (!cardId) {
                return;
            }

            removeAuditButton(cardId);

            closeAuditOverlay();
        }
    );


    console.log(
        "HOST AUDIT SOCKET LISTENERS READY"
    );
}


// =========================================================
// CARD ID HELPER
// =========================================================

function getCardIdFromData(data) {

    if (
        data === null ||
        data === undefined
    ) {
        return 0;
    }

    if (
        typeof data === "number" ||
        typeof data === "string"
    ) {
        return Number(data);
    }

    return Number(
        data.cardId ??
        data.id ??
        data.card ??
        0
    );
}


// =========================================================
// CREATE DIGITAL AUDIT BUTTON
// =========================================================

function createAuditButton(data) {

    const list =
        document.getElementById("auditWinnerList") ||
        document.getElementById("winList");

    if (!list) {

        console.error(
            "AUDIT LIST ELEMENT NOT FOUND"
        );

        return;
    }

    const cardId =
        getCardIdFromData(data);

    if (!Number.isInteger(cardId) || cardId <= 0) {

        console.error(
            "INVALID DIGITAL CARD ID:",
            data
        );

        return;
    }


    // Remove old request for same card

    const existing =
        list.querySelector(
            '[data-card="' + cardId + '"]'
        );

    if (existing) {
        existing.remove();
    }


    const button =
        document.createElement("button");

    button.type = "button";

    button.className =
        "audit-list-button";

    button.dataset.card =
        String(cardId);

    button.dataset.auditType =
        "digital";

    button.textContent =
        "AUDIT DIGITAL CARD #" + cardId;


    button.addEventListener(
        "click",
        function() {

            openAuditOverlay(
                data,
                false
            );

        }
    );


    list.appendChild(button);

    console.log(
        "DIGITAL AUDIT BUTTON CREATED:",
        cardId
    );
}


// =========================================================
// CREATE PHYSICAL AUDIT BUTTON
// =========================================================

function createPhysicalAuditButton(data) {

    const list =
        document.getElementById("auditWinnerList") ||
        document.getElementById("winList");

    if (!list) {
        return;
    }

    const cardId =
        getCardIdFromData(data);

    if (!Number.isInteger(cardId) || cardId <= 0) {

        console.error(
            "INVALID PHYSICAL CARD ID:",
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

    button.type = "button";

    button.className =
        "audit-list-button";

    button.dataset.card =
        String(cardId);

    button.dataset.auditType =
        "physical";

    button.textContent =
        "AUDIT PHYSICAL CARD #" + cardId;


    button.addEventListener(
        "click",
        function() {

            openAuditOverlay(
                data,
                true
            );

        }
    );


    list.appendChild(button);
}


// =========================================================
// NORMALIZE
// =========================================================

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


// =========================================================
// GET QUESTION ID FROM CELL
// =========================================================

function getCellQuestionId(cell) {

    if (!cell) {
        return "";
    }

    return normalizeAuditValue(
        cell.questionId ??
        cell.questionID ??
        cell.question_id ??
        cell.id ??
        ""
    );
}


// =========================================================
// GET CELL ANSWER/TEXT
// =========================================================

function getCellAnswer(cell) {

    if (!cell) {
        return "";
    }

    return normalizeAuditValue(
        cell.answer ??
        cell.answerText ??
        cell.value ??
        cell.text ??
        cell.questionText ??
        cell.label ??
        ""
    );
}


// =========================================================
// GET HOST STATE
// =========================================================

function getHostState() {

    if (
        window.hostState &&
        typeof window.hostState === "object"
    ) {

        return window.hostState;
    }

    return {};
}


// =========================================================
// GET CALLED QUESTION IDS
// =========================================================

function getCalledQuestionIds() {

    const state =
        getHostState();

    const sources = [
        state.readQuestionIds,
        state.calledQuestionIds,
        state.calledIds,
        window.readQuestionIds,
        window.calledQuestionIds
    ];


    for (const source of sources) {

        if (Array.isArray(source)) {

            return new Set(
                source.map(
                    normalizeAuditValue
                )
            );
        }
    }


    return new Set();
}


// =========================================================
// GET CALLED ANSWERS
// =========================================================

function getCalledAnswers() {

    const state =
        getHostState();

    const sources = [
        state.calledAnswers,
        state.calledQuestions,
        window.calledAnswers
    ];


    for (const source of sources) {

        if (Array.isArray(source)) {

            return new Set(
                source.map(
                    normalizeAuditValue
                )
            );
        }
    }


    return new Set();
}


// =========================================================
// DETERMINE IF CELL WAS CALLED
// =========================================================

function wasCellCalled(cell) {

    if (!cell) {
        return false;
    }


    // FREE SPACE

    const answer =
        getCellAnswer(cell);

    if (
        answer === "free" ||
        answer === "free space"
    ) {

        return true;
    }


    const questionId =
        getCellQuestionId(cell);

    const calledQuestionIds =
        getCalledQuestionIds();


    /*
    QUESTION ID IS THE MOST RELIABLE MATCH.

    This fixes the major problem where the old
    audit compared a question ID to an answer.
    */

    if (
        questionId &&
        calledQuestionIds.has(questionId)
    ) {

        return true;
    }


    // -------------------------------------------------------
    // FALLBACK TO ANSWER TEXT
    // -------------------------------------------------------

    const calledAnswers =
        getCalledAnswers();

    if (
        answer &&
        calledAnswers.has(answer)
    ) {

        return true;
    }


    /*
    Some generators store the actual question ID
    in another property.
    */

    const alternateIds = [
        cell.question,
        cell.questionNumber,
        cell.questionIndex,
        cell.questionKey
    ];


    for (const value of alternateIds) {

        const normalized =
            normalizeAuditValue(value);

        if (
            normalized &&
            calledQuestionIds.has(normalized)
        ) {

            return true;
        }
    }


    return false;
}


// =========================================================
// GET MARKED INDICES
// =========================================================

function getMarkedIndices() {

    if (!activeAuditData) {
        return new Set();
    }


    const possibleSources = [
        activeAuditData.markedIndices,
        activeAuditData.marked,
        activeAuditData.selectedIndices,
        activeAuditData.selectedCells,
        activeAuditData.marks
    ];


    for (const source of possibleSources) {

        if (!Array.isArray(source)) {
            continue;
        }


        const result =
            new Set();


        source.forEach(
            function(value) {

                /*
                Normal index format:
                [0, 1, 2, 5]
                */

                if (
                    typeof value === "number" ||
                    /^\d+$/.test(String(value))
                ) {

                    result.add(
                        Number(value)
                    );

                    return;
                }


                /*
                If the player sends objects,
                try to find their index.
                */

                if (
                    value &&
                    typeof value === "object"
                ) {

                    const index =
                        value.index ??
                        value.cellIndex;

                    if (
                        index !== undefined
                    ) {

                        result.add(
                            Number(index)
                        );
                    }
                }

            }
        );


        return result;
    }


    return new Set();
}


// =========================================================
// CHECK WHETHER CELL IS MARKED
// =========================================================

function isCellMarked(cell, index) {

    const markedIndices =
        getMarkedIndices();


    if (
        markedIndices.has(index)
    ) {

        return true;
    }


    if (!cell) {
        return false;
    }


    return Boolean(
        cell.isMarked ||
        cell.marked ||
        cell.selected ||
        cell.checked
    );
}


// =========================================================
// OPEN AUDIT
// =========================================================

function openAuditOverlay(
    cardDataOrId,
    isPhysical = false
) {

    if (
        typeof window.generateCard !==
        "function"
    ) {

        console.error(
            "window.generateCard IS NOT AVAILABLE"
        );

        return;
    }


    isPhysicalAuditMode =
        Boolean(isPhysical);


    if (
        cardDataOrId &&
        typeof cardDataOrId === "object"
    ) {

        /*
        Copy the entire win request.

        DO NOT throw away markedIndices,
        question IDs, marks, etc.
        */

        activeAuditData = {
            ...cardDataOrId
        };

    }
    else {

        activeAuditData = {
            cardId:
                Number(cardDataOrId)
        };
    }


    const cardId =
        getCardIdFromData(
            activeAuditData
        );


    if (!Number.isInteger(cardId) || cardId <= 0) {

        console.error(
            "INVALID AUDIT CARD:",
            activeAuditData
        );

        return;
    }


    activeAuditData.cardId =
        cardId;


    activeAuditCard =
        window.generateCard(cardId);


    if (!activeAuditCard) {

        console.error(
            "CARD GENERATION FAILED:",
            cardId
        );

        return;
    }


    if (!activeAuditCard.id) {
        activeAuditCard.id = cardId;
    }


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
    }


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


    renderAuditGrid();
}


// =========================================================
// RENDER AUDIT GRID
// =========================================================

function renderAuditGrid() {

    const grid =
        document.getElementById("auditCardDisplay") ||
        document.getElementById("cardCheckerDisplay");


    if (!grid) {

        console.error(
            "AUDIT GRID NOT FOUND"
        );

        return;
    }


    if (!activeAuditCard) {
        return;
    }


    grid.innerHTML = "";


    const cells =
        Array.isArray(activeAuditCard.grid)
            ? activeAuditCard.grid
            : Array.isArray(activeAuditCard.cells)
                ? activeAuditCard.cells
                : [];


    const calledIds =
        getCalledQuestionIds();

    const calledAnswers =
        getCalledAnswers();

    const markedIndices =
        getMarkedIndices();


    console.log(
        "========== AUDIT DEBUG =========="
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
        "CALLED QUESTION IDS:",
        [...calledIds]
    );

    console.log(
        "CALLED ANSWERS:",
        [...calledAnswers]
    );

    console.log(
        "MARKED INDICES:",
        [...markedIndices]
    );


    cells.forEach(
        function(cell, index) {

            const box =
                document.createElement("div");


            box.className =
                "audit-cell";


            const answer =
                getCellAnswer(cell);


            const questionId =
                getCellQuestionId(cell);


            const free =
                Boolean(
                    cell &&
                    (
                        cell.isFreeSpace ||
                        cell.isFree ||
                        cell.free
                    )
                ) ||
                answer === "free" ||
                answer === "free space";


            const called =
                wasCellCalled(cell);


            const marked =
                isPhysicalAuditMode
                    ? false
                    : isCellMarked(
                        cell,
                        index
                    );


            /*
            Display the actual card answer/text.
            */

            box.textContent =
                (
                    cell &&
                    (
                        cell.answer ??
                        cell.value ??
                        cell.text ??
                        cell.questionText ??
                        cell.label ??
                        ""
                    )
                );


            // =================================================
            // PHYSICAL
            // =================================================

            if (isPhysicalAuditMode) {

                if (free) {

                    box.classList.add(
                        "free",
                        "correct"
                    );

                }
                else if (called) {

                    box.classList.add(
                        "correct"
                    );

                }
                else {

                    box.classList.add(
                        "clear"
                    );
                }

            }


            // =================================================
            // DIGITAL
            // =================================================

            else {

                if (free) {

                    box.classList.add(
                        "free",
                        "correct"
                    );

                }

                /*
                GREEN
                Player marked + host called
                */

                else if (
                    marked &&
                    called
                ) {

                    box.classList.add(
                        "correct"
                    );
                }

                /*
                RED
                Player marked + host did NOT call
                */

                else if (
                    marked &&
                    !called
                ) {

                    box.classList.add(
                        "wrong"
                    );
                }

                /*
                YELLOW
                Host called + player did NOT mark
                */

                else if (
                    !marked &&
                    called
                ) {

                    box.classList.add(
                        "missed"
                    );
                }

                /*
                CLEAR
                Neither called nor marked
                */

                else {

                    box.classList.add(
                        "clear"
                    );
                }
            }


            // =================================================
            // DEBUG
            // =================================================

            console.log(
                "AUDIT CELL",
                {
                    index,
                    questionId,
                    answer,
                    called,
                    marked,
                    free
                }
            );


            grid.appendChild(box);
        }
    );


    console.log(
        "========== AUDIT COMPLETE =========="
    );
}


// =========================================================
// APPROVE WIN
// =========================================================

function approveAuditWinner() {

    const cardId =
        getCardIdFromData(
            activeAuditData
        );


    if (!cardId) {
        return;
    }


    if (!window.hostSocket) {

        console.error(
            "HOST SOCKET NOT AVAILABLE"
        );

        return;
    }


    console.log(
        "APPROVING WIN:",
        cardId
    );


    if (isPhysicalAuditMode) {

        window.hostSocket.emit(
            "approvePhysicalWin",
            {
                cardId
            }
        );

    }
    else {

        window.hostSocket.emit(
            "approveWin",
            cardId
        );
    }


    removeAuditButton(cardId);

    closeAuditOverlay();
}


// =========================================================
// REJECT WIN
// =========================================================

function rejectAuditWinner() {

    const cardId =
        getCardIdFromData(
            activeAuditData
        );


    if (!cardId) {
        return;
    }


    if (!window.hostSocket) {

        console.error(
            "HOST SOCKET NOT AVAILABLE"
        );

        return;
    }


    console.log(
        "REJECTING BINGO CLAIM:",
        cardId
    );


    /*
    CRITICAL:

    This only rejects the Bingo CLAIM.

    It must NOT:
    - disable the card
    - remove the player
    - lock the player
    - mark the card inactive
    - end the player's game
    */


    if (isPhysicalAuditMode) {

        window.hostSocket.emit(
            "rejectPhysicalWin",
            {
                cardId
            }
        );

    }
    else {

        window.hostSocket.emit(
            "rejectWin",
            cardId
        );
    }


    removeAuditButton(cardId);

    closeAuditOverlay();


    console.log(
        "BINGO REJECTED - PLAYER REMAINS ACTIVE:",
        cardId
    );
}


// =========================================================
// REMOVE AUDIT BUTTON
// =========================================================

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


    const button =
        list.querySelector(
            '[data-card="' +
            Number(cardId) +
            '"]'
        );


    if (button) {
        button.remove();
    }
}


// =========================================================
// CLOSE
// =========================================================

function closeAuditOverlay() {

    activeAuditCard =
        null;

    activeAuditData =
        null;

    isPhysicalAuditMode =
        false;


    const overlays =
        document.querySelectorAll(
            ".audit-overlay," +
            ".checker-overlay," +
            "#auditOverlay," +
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


// =========================================================
// MANUAL LOOKUP
// =========================================================

function checkManualCardNumber() {

    const input =
        document.getElementById(
            "cardLookupInput"
        ) ||
        document.getElementById(
            "checkCardInput"
        );


    if (!input) {
        return;
    }


    const cardId =
        Number(
            input.value.trim()
        );


    if (!Number.isInteger(cardId) || cardId <= 0) {

        alert(
            "Please enter a valid Card Number."
        );

        return;
    }


    const typeSelect =
        document.getElementById(
            "cardTypeSelect"
        );


    const physical =
        typeSelect
            ? typeSelect.value === "physical"
            : true;


    openAuditOverlay(
        cardId,
        physical
    );
}


// =========================================================
// REMOVE ALL REQUESTS
// =========================================================

function clearDigitalAuditRequests() {

    const list =
        document.getElementById(
            "auditWinnerList"
        ) ||
        document.getElementById(
            "winList"
        );


    if (list) {
        list.innerHTML = "";
    }


    closeAuditOverlay();
}


// =========================================================
// BUTTON EVENTS
// =========================================================

document.addEventListener(
    "click",
    function(e) {

        if (!e.target) {
            return;
        }


        const id =
            e.target.id || "";


        const classes =
            e.target.classList;


        if (
            id === "approvePhysicalWin" ||
            id === "approveDigitalWin" ||
            id === "approveWinBtn" ||
            (
                classes &&
                classes.contains("approveBtn")
            )
        ) {

            approveAuditWinner();

            return;
        }


        if (
            id === "rejectPhysicalWin" ||
            id === "rejectDigitalWin" ||
            id === "rejectWinBtn" ||
            (
                classes &&
                classes.contains("rejectBtn")
            )
        ) {

            rejectAuditWinner();

            return;
        }


        if (
            id === "closeAuditOverlay" ||
            id === "closeCheckerOverlay" ||
            (
                classes &&
                classes.contains("closeAuditBtn")
            )
        ) {

            closeAuditOverlay();

            return;
        }


        if (
            id === "checkCardBtn" ||
            id === "runLookupBtn"
        ) {

            checkManualCardNumber();
        }
    }
);


// =========================================================
// GLOBAL EXPORTS
// =========================================================

window.initializeHostAudit =
    initializeHostAudit;

window.openAuditOverlay =
    openAuditOverlay;

window.checkManualCardNumber =
    checkManualCardNumber;

window.approveAuditWinner =
    approveAuditWinner;

window.rejectAuditWinner =
    rejectAuditWinner;

window.approveDigitalWinner =
    approveAuditWinner;

window.rejectDigitalWinner =
    rejectAuditWinner;

window.closeAuditOverlay =
    closeAuditOverlay;

window.closeDigitalAudit =
    closeAuditOverlay;

window.clearDigitalAuditRequests =
    clearDigitalAuditRequests;

window.renderAuditGrid =
    renderAuditGrid;


// =========================================================
// START
// =========================================================

initializeHostAudit();

console.log(
    "HOST AUDIT MODULE READY"
);
