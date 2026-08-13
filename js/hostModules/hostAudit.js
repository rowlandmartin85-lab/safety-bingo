"use strict";

/*
=========================================================
HOST AUDIT SYSTEM
=========================================================

DIGITAL AUDIT COLORS

GREEN  = player marked it AND host called it
RED    = player marked it BUT host did not call it
YELLOW = host called it BUT player did not mark it
CLEAR  = host has not called it AND player did not mark it

FREE SPACE = GREEN

IMPORTANT
---------
Rejecting a Bingo claim does NOT disable the player's card.

The player remains active and may continue playing.

=========================================================
*/

console.log("HOST AUDIT MODULE LOADED");


// =========================================================
// STATE
// =========================================================

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

    if (
        digitalAuditInitialized &&
        window.hostSocket
    ) {

        console.log(
            "HOST AUDIT SOCKET ALREADY INITIALIZED"
        );

        return;
    }

    digitalAuditInitialized = true;


    // =====================================================
    // DIGITAL WIN REQUEST
    // =====================================================

    window.hostSocket.on(
        "winRequested",
        function(data) {

            console.log(
                "========== DIGITAL WIN REQUEST ==========",
                data
            );

            if (!data) {
                return;
            }

            createAuditButton(data);
        }
    );


    // =====================================================
    // DIGITAL WIN APPROVED
    // =====================================================

    window.hostSocket.on(
        "winApproved",
        function(data) {

            console.log(
                "========== DIGITAL WIN APPROVED ==========",
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


    // =====================================================
    // DIGITAL WIN REJECTED
    // =====================================================

    window.hostSocket.on(
        "winRejected",
        function(data) {

            console.log(
                "========== DIGITAL WIN REJECTED ==========",
                data
            );

            const cardId =
                getCardIdFromData(data);

            if (!cardId) {
                return;
            }

            /*
            =================================================
            IMPORTANT
            =================================================

            Rejecting the Bingo claim ONLY rejects the claim.

            DO NOT:

            - disable the card
            - remove the player
            - lock the player permanently
            - mark the card inactive
            - remove the card
            - prevent future claims

            The player.js code is responsible for unlocking
            the player after receiving winRejected.
            */

            removeAuditButton(cardId);

            if (
                activeAuditData &&
                Number(activeAuditData.cardId) === cardId
            ) {

                closeAuditOverlay();
            }

            console.log(
                "BINGO CLAIM REJECTED - PLAYER REMAINS ACTIVE:",
                cardId
            );
        }
    );


    // =====================================================
    // PHYSICAL WIN REQUEST
    // =====================================================

    window.hostSocket.on(
        "physicalWinRequested",
        function(data) {

            console.log(
                "========== PHYSICAL WIN REQUEST ==========",
                data
            );

            if (!data) {
                return;
            }

            createPhysicalAuditButton(data);
        }
    );


    // =====================================================
    // PHYSICAL WIN APPROVED
    // =====================================================

    window.hostSocket.on(
        "physicalWinApproved",
        function(data) {

            console.log(
                "PHYSICAL WIN APPROVED:",
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
                isPhysicalAuditMode
            ) {

                closeAuditOverlay();
            }
        }
    );


    // =====================================================
    // PHYSICAL WIN REJECTED
    // =====================================================

    window.hostSocket.on(
        "physicalWinRejected",
        function(data) {

            console.log(
                "PHYSICAL WIN REJECTED:",
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
                Number(activeAuditData.cardId) === cardId
            ) {

                closeAuditOverlay();
            }
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

        const number =
            Number(data);

        return Number.isFinite(number)
            ? number
            : 0;
    }


    if (
        typeof data !== "object"
    ) {

        return 0;
    }


    const possibleIds = [
        data.cardId,
        data.cardID,
        data.id,
        data.card,
        data.playerCardId,
        data.playerCardID
    ];


    for (
        const value of possibleIds
    ) {

        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {

            continue;
        }


        const number =
            Number(value);


        if (
            Number.isFinite(number) &&
            number > 0
        ) {

            return number;
        }
    }


    return 0;
}


// =========================================================
// CREATE DIGITAL AUDIT BUTTON
// =========================================================

function createAuditButton(data) {

    const list =
        getAuditListElement();


    if (!list) {

        console.error(
            "AUDIT LIST ELEMENT NOT FOUND"
        );

        return;
    }


    const cardId =
        getCardIdFromData(data);


    if (
        !Number.isInteger(cardId) ||
        cardId <= 0
    ) {

        console.error(
            "INVALID DIGITAL CARD ID:",
            data
        );

        return;
    }


    /*
    Remove an existing request for this card.
    */

    removeAuditButton(cardId);


    const button =
        document.createElement("button");


    button.type =
        "button";


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
        getAuditListElement();


    if (!list) {

        console.error(
            "AUDIT LIST ELEMENT NOT FOUND"
        );

        return;
    }


    const cardId =
        getCardIdFromData(data);


    if (
        !Number.isInteger(cardId) ||
        cardId <= 0
    ) {

        console.error(
            "INVALID PHYSICAL CARD ID:",
            data
        );

        return;
    }


    removeAuditButton(cardId);


    const button =
        document.createElement("button");


    button.type =
        "button";


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


    console.log(
        "PHYSICAL AUDIT BUTTON CREATED:",
        cardId
    );
}


// =========================================================
// GET AUDIT LIST ELEMENT
// =========================================================

function getAuditListElement() {

    return (
        document.getElementById(
            "auditWinnerList"
        ) ||
        document.getElementById(
            "winList"
        )
    );
}


// =========================================================
// NORMALIZE AUDIT VALUE
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


    const possibleIds = [

        cell.questionId,
        cell.questionID,
        cell.question_id,
        cell.questionKey,
        cell.questionNumber,
        cell.questionIndex,
        cell.id

    ];


    for (
        const value of possibleIds
    ) {

        const normalized =
            normalizeAuditValue(value);


        if (normalized) {

            return normalized;
        }
    }


    return "";
}


// =========================================================
// GET CELL ANSWER / TEXT
// =========================================================

function getCellAnswer(cell) {

    if (!cell) {
        return "";
    }


    const possibleValues = [

        cell.answer,
        cell.answerText,
        cell.value,
        cell.text,
        cell.questionText,
        cell.label

    ];


    for (
        const value of possibleValues
    ) {

        const normalized =
            normalizeAuditValue(value);


        if (normalized) {

            return normalized;
        }
    }


    return "";
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
// CONVERT ANY VALUE TO NORMALIZED ARRAY
// =========================================================

function normalizeCollection(source) {

    if (!source) {
        return [];
    }


    if (Array.isArray(source)) {

        return source
            .map(
                normalizeAuditValue
            )
            .filter(Boolean);
    }


    if (source instanceof Set) {

        return [
            ...source
        ]
            .map(
                normalizeAuditValue
            )
            .filter(Boolean);
    }


    return [];
}


// =========================================================
// GET CALLED QUESTION IDS
// =========================================================

function getCalledQuestionIds() {

    const state =
        getHostState();


    /*
    Check the most likely locations first.
    */

    const sources = [

        state.readQuestionIds,
        state.calledQuestionIds,
        state.calledQuestionIDs,
        state.calledIds,
        state.readIds,

        window.readQuestionIds,
        window.calledQuestionIds,
        window.calledQuestionIDs,
        window.calledIds,
        window.readIds

    ];


    const result =
        new Set();


    for (
        const source of sources
    ) {

        const values =
            normalizeCollection(source);


        values.forEach(
            value => {

                result.add(value);

            }
        );
    }


    return result;
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
        state.readAnswers,

        window.calledAnswers,
        window.calledQuestions,
        window.readAnswers

    ];


    const result =
        new Set();


    for (
        const source of sources
    ) {

        const values =
            normalizeCollection(source);


        values.forEach(
            value => {

                result.add(value);

            }
        );
    }


    return result;
}


// =========================================================
// EXTRACT QUESTION ID FROM CALLED OBJECT
// =========================================================

function extractQuestionIdFromCalledItem(item) {

    if (!item) {
        return "";
    }


    if (
        typeof item !== "object"
    ) {

        return normalizeAuditValue(
            item
        );
    }


    const possibleIds = [

        item.questionId,
        item.questionID,
        item.question_id,
        item.questionKey,
        item.questionNumber,
        item.questionIndex,
        item.id

    ];


    for (
        const value of possibleIds
    ) {

        const normalized =
            normalizeAuditValue(value);


        if (normalized) {

            return normalized;
        }
    }


    return "";
}


// =========================================================
// EXTRACT ANSWER FROM CALLED OBJECT
// =========================================================

function extractAnswerFromCalledItem(item) {

    if (!item) {
        return "";
    }


    if (
        typeof item !== "object"
    ) {

        return normalizeAuditValue(
            item
        );
    }


    const possibleValues = [

        item.answer,
        item.answerText,
        item.value,
        item.text,
        item.questionText,
        item.label

    ];


    for (
        const value of possibleValues
    ) {

        const normalized =
            normalizeAuditValue(value);


        if (normalized) {

            return normalized;
        }
    }


    return "";
}


// =========================================================
// ADD CALLED OBJECT COLLECTION
// =========================================================

function addCalledObjectCollection(
    resultIds,
    resultAnswers,
    source
) {

    if (
        !Array.isArray(source)
    ) {

        return;
    }


    source.forEach(
        item => {

            const id =
                extractQuestionIdFromCalledItem(
                    item
                );


            const answer =
                extractAnswerFromCalledItem(
                    item
                );


            if (id) {

                resultIds.add(id);
            }


            if (answer) {

                resultAnswers.add(answer);
            }
        }
    );
}


// =========================================================
// BUILD COMPLETE CALLED STATE
// =========================================================

function getCalledState() {

    const state =
        getHostState();


    const ids =
        getCalledQuestionIds();


    const answers =
        getCalledAnswers();


    /*
    Some applications store called questions as
    objects rather than simple strings.
    */

    const objectSources = [

        state.called,
        state.calledQuestions,
        state.calledItems,
        state.readQuestions,

        window.called,
        window.calledQuestions,
        window.calledItems,
        window.readQuestions

    ];


    objectSources.forEach(
        source => {

            addCalledObjectCollection(
                ids,
                answers,
                source
            );
        }
    );


    return {
        ids,
        answers
    };
}


// =========================================================
// DETERMINE IF CELL WAS CALLED
// =========================================================

function wasCellCalled(cell) {

    if (!cell) {
        return false;
    }


    /*
    =====================================================
    FREE SPACE
    =====================================================
    */

    const answer =
        getCellAnswer(cell);


    if (
        answer === "free" ||
        answer === "free space"
    ) {

        return true;
    }


    if (
        cell.isFreeSpace === true ||
        cell.isFree === true ||
        cell.free === true
    ) {

        return true;
    }


    /*
    =====================================================
    QUESTION ID MATCH
    =====================================================

    Question ID is the preferred match.
    */

    const questionId =
        getCellQuestionId(cell);


    const calledState =
        getCalledState();


    if (
        questionId &&
        calledState.ids.has(questionId)
    ) {

        return true;
    }


    /*
    =====================================================
    ANSWER MATCH FALLBACK
    =====================================================
    */

    if (
        answer &&
        calledState.answers.has(answer)
    ) {

        return true;
    }


    /*
    =====================================================
    CHECK ALTERNATE CELL IDs
    =====================================================
    */

    const alternateIds = [

        cell.question,
        cell.questionNumber,
        cell.questionIndex,
        cell.questionKey,
        cell.questionID,
        cell.questionId

    ];


    for (
        const value of alternateIds
    ) {

        const normalized =
            normalizeAuditValue(value);


        if (
            normalized &&
            calledState.ids.has(normalized)
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


    /*
    =====================================================
    IMPORTANT

    The player's claim sends:

        markedIndices: [...]

    This is the preferred source.

    =====================================================
    */

    const possibleSources = [

        activeAuditData.markedIndices,

        activeAuditData.markedindices,

        activeAuditData.marked,

        activeAuditData.selectedIndices,

        activeAuditData.selectedCells,

        activeAuditData.marks,

        activeAuditData.markedCells

    ];


    for (
        const source of possibleSources
    ) {

        if (
            !Array.isArray(source)
        ) {

            continue;
        }


        const result =
            new Set();


        source.forEach(
            function(value) {

                /*
                -----------------------------------------
                SIMPLE INDEX
                -----------------------------------------
                */

                if (
                    typeof value === "number"
                ) {

                    if (
                        Number.isInteger(value) &&
                        value >= 0 &&
                        value < 25
                    ) {

                        result.add(
                            value
                        );
                    }

                    return;
                }


                /*
                -----------------------------------------
                STRING INDEX
                -----------------------------------------
                */

                if (
                    typeof value === "string" &&
                    /^\d+$/.test(
                        value.trim()
                    )
                ) {

                    const index =
                        Number(value);


                    if (
                        Number.isInteger(index) &&
                        index >= 0 &&
                        index < 25
                    ) {

                        result.add(
                            index
                        );
                    }

                    return;
                }


                /*
                -----------------------------------------
                OBJECT INDEX
                -----------------------------------------
                */

                if (
                    value &&
                    typeof value === "object"
                ) {

                    const index =
                        value.index ??
                        value.cellIndex ??
                        value.position;


                    if (
                        index !== undefined
                    ) {

                        const number =
                            Number(index);


                        if (
                            Number.isInteger(number) &&
                            number >= 0 &&
                            number < 25
                        ) {

                            result.add(
                                number
                            );
                        }
                    }
                }

            }
        );


        /*
        If a valid source was found, use it.
        */

        return result;
    }


    return new Set();
}


// =========================================================
// CHECK WHETHER CELL IS MARKED
// =========================================================

function isCellMarked(
    cell,
    index
) {

    const markedIndices =
        getMarkedIndices();


    /*
    Claim data takes priority.
    */

    if (
        markedIndices.has(index)
    ) {

        return true;
    }


    /*
    If the claim contained markedIndices,
    do NOT infer marks from the generated card.
    This prevents stale generator state from
    producing incorrect audit colors.
    */

    if (
        activeAuditData &&
        Array.isArray(
            activeAuditData.markedIndices
        )
    ) {

        return false;
    }


    if (!cell) {

        return false;
    }


    return Boolean(

        cell.isMarked === true ||
        cell.marked === true ||
        cell.selected === true ||
        cell.checked === true

    );
}


// =========================================================
// OPEN AUDIT OVERLAY
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


    /*
    =====================================================
    PRESERVE COMPLETE CLAIM DATA
    =====================================================

    Do not reduce the incoming object to cardId.

    We need:

    - markedIndices
    - winningPattern
    - cardId
    - question IDs
    - any additional audit information
    */

    if (
        cardDataOrId &&
        typeof cardDataOrId === "object"
    ) {

        try {

            activeAuditData =
                {
                    ...cardDataOrId
                };

        } catch (error) {

            console.error(
                "AUDIT DATA COPY ERROR:",
                error
            );

            activeAuditData =
                cardDataOrId;
        }

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


    if (
        !Number.isInteger(cardId) ||
        cardId <= 0
    ) {

        console.error(
            "INVALID AUDIT CARD:",
            activeAuditData
        );

        return;
    }


    activeAuditData.cardId =
        cardId;


    /*
    =====================================================
    GENERATE CARD
    =====================================================
    */

    try {

        activeAuditCard =
            window.generateCard(
                cardId
            );

    } catch (error) {

        console.error(
            "AUDIT CARD GENERATION ERROR:",
            error
        );

        activeAuditCard =
            null;

        return;
    }


    if (!activeAuditCard) {

        console.error(
            "CARD GENERATION FAILED:",
            cardId
        );

        return;
    }


    if (!activeAuditCard.id) {

        activeAuditCard.id =
            cardId;
    }


    /*
    =====================================================
    SHOW OVERLAY
    =====================================================
    */

    const overlay =
        document.getElementById(
            "auditOverlay"
        ) ||
        document.getElementById(
            "cardCheckerOverlay"
        );


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
    else {

        console.warn(
            "AUDIT OVERLAY ELEMENT NOT FOUND"
        );
    }


    /*
    =====================================================
    TITLE
    =====================================================
    */

    const title =
        document.getElementById(
            "auditTitle"
        ) ||
        document.getElementById(
            "checkerTitle"
        );


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


    /*
    =====================================================
    RENDER
    =====================================================
    */

    renderAuditGrid();
}


// =========================================================
// GET CARD CELLS
// =========================================================

function getAuditCardCells() {

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


    return [];
}


// =========================================================
// RENDER AUDIT GRID
// =========================================================

function renderAuditGrid() {

    const grid =
        document.getElementById(
            "auditCardDisplay"
        ) ||
        document.getElementById(
            "cardCheckerDisplay"
        );


    if (!grid) {

        console.error(
            "AUDIT GRID NOT FOUND"
        );

        return;
    }


    if (!activeAuditCard) {

        console.error(
            "NO ACTIVE AUDIT CARD"
        );

        return;
    }


    /*
    Clear old cells.
    */

    grid.innerHTML =
        "";


    const cells =
        getAuditCardCells();


    if (
        !Array.isArray(cells) ||
        cells.length === 0
    ) {

        console.error(
            "AUDIT CARD HAS NO CELLS:",
            activeAuditCard
        );

        return;
    }


    /*
    =====================================================
    GET AUDIT STATE ONCE
    =====================================================
    */

    const calledState =
        getCalledState();


    const markedIndices =
        getMarkedIndices();


    /*
    =====================================================
    DEBUG
    =====================================================
    */

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
        [...calledState.ids]
    );


    console.log(
        "CALLED ANSWERS:",
        [...calledState.answers]
    );


    console.log(
        "MARKED INDICES:",
        [...markedIndices]
    );


    /*
    =====================================================
    RENDER CELLS
    =====================================================
    */

    cells.forEach(
        function(cell, index) {

            const box =
                document.createElement(
                    "div"
                );


            box.className =
                "audit-cell";


            /*
            ---------------------------------------------
            CELL VALUES
            ---------------------------------------------
            */

            const answer =
                getCellAnswer(cell);


            const questionId =
                getCellQuestionId(cell);


            /*
            ---------------------------------------------
            FREE SPACE
            ---------------------------------------------
            */

            const free =
                Boolean(

                    cell &&
                    (
                        cell.isFreeSpace === true ||
                        cell.isFree === true ||
                        cell.free === true
                    )

                ) ||
                answer === "free" ||
                answer === "free space" ||
                index === 12;


            /*
            ---------------------------------------------
            CALLED
            ---------------------------------------------
            */

            const called =
                free
                    ? true
                    : wasCellCalled(
                        cell
                    );


            /*
            ---------------------------------------------
            MARKED
            ---------------------------------------------
            */

            const marked =
                isPhysicalAuditMode
                    ? false
                    : (
                        free
                            ? true
                            : isCellMarked(
                                cell,
                                index
                            )
                    );


            /*
            ---------------------------------------------
            DISPLAY TEXT
            ---------------------------------------------
            */

            if (cell) {

                box.textContent =
                    cell.answer ??
                    cell.value ??
                    cell.text ??
                    cell.questionText ??
                    cell.label ??
                    "";

            }
            else {

                box.textContent =
                    "";
            }


            /*
            =================================================
            PHYSICAL AUDIT
            =================================================
            */

            if (isPhysicalAuditMode) {

                /*
                FREE = GREEN
                */

                if (free) {

                    box.classList.add(
                        "free",
                        "correct"
                    );

                }

                /*
                HOST CALLED = GREEN

                For physical cards, we don't know what
                the player physically marked, so the
                audit shows whether the host has called
                the space.
                */

                else if (called) {

                    box.classList.add(
                        "correct"
                    );

                }

                /*
                NOT CALLED = CLEAR
                */

                else {

                    box.classList.add(
                        "clear"
                    );
                }

            }


            /*
            =================================================
            DIGITAL AUDIT
            =================================================
            */

            else {

                /*
                ---------------------------------------------
                FREE
                ---------------------------------------------
                */

                if (free) {

                    box.classList.add(
                        "free",
                        "correct"
                    );
                }


                /*
                ---------------------------------------------
                GREEN
                PLAYER MARKED + HOST CALLED
                ---------------------------------------------
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
                ---------------------------------------------
                RED
                PLAYER MARKED + HOST DID NOT CALL
                ---------------------------------------------
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
                ---------------------------------------------
                YELLOW
                HOST CALLED + PLAYER DID NOT MARK
                ---------------------------------------------
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
                ---------------------------------------------
                CLEAR
                ---------------------------------------------
                */

                else {

                    box.classList.add(
                        "clear"
                    );
                }
            }


            /*
            =================================================
            OPTIONAL DEBUG ATTRIBUTES
            =================================================
            */

            box.dataset.index =
                String(index);


            if (questionId) {

                box.dataset.questionId =
                    questionId;
            }


            box.dataset.called =
                String(called);


            box.dataset.marked =
                String(marked);


            box.dataset.free =
                String(free);


            /*
            =================================================
            DEBUG LOG
            =================================================
            */

            console.log(
                "AUDIT CELL",
                {
                    index,
                    questionId,
                    answer,
                    called,
                    marked,
                    free,
                    physical:
                        isPhysicalAuditMode
                }
            );


            grid.appendChild(
                box
            );
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

        console.error(
            "APPROVE FAILED: INVALID CARD ID"
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


    /*
    Remove the request immediately from host UI.
    */

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

        console.error(
            "REJECT FAILED: INVALID CARD ID"
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
        "REJECTING BINGO CLAIM:",
        cardId
    );


    /*
    =====================================================
    CRITICAL PLAYER RULE
    =====================================================

    Rejecting the Bingo claim does NOT:

    - disable player card
    - remove player
    - lock player permanently
    - mark player inactive
    - delete card
    - prevent another Bingo claim

    The server should simply send winRejected back
    to the player.

    player.js then unlocks the player.
    =====================================================
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

        /*
        Keep existing socket protocol:
        rejectWin + cardId
        */

        window.hostSocket.emit(
            "rejectWin",
            cardId
        );
    }


    removeAuditButton(cardId);

    closeAuditOverlay();


    console.log(
        "BINGO CLAIM REJECTED - PLAYER REMAINS ACTIVE:",
        cardId
    );
}


// =========================================================
// REMOVE AUDIT BUTTON
// =========================================================

function removeAuditButton(cardId) {

    const list =
        getAuditListElement();


    if (!list) {
        return;
    }


    const numericCardId =
        Number(cardId);


    if (
        !Number.isFinite(
            numericCardId
        )
    ) {

        return;
    }


    /*
    Remove all matching buttons.

    This handles both digital and physical
    requests if duplicate entries somehow exist.
    */

    const buttons =
        list.querySelectorAll(
            '[data-card="' +
            numericCardId +
            '"]'
        );


    buttons.forEach(
        button => {

            button.remove();

        }
    );
}


// =========================================================
// CLOSE AUDIT OVERLAY
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
// MANUAL CARD LOOKUP
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

        console.error(
            "CARD LOOKUP INPUT NOT FOUND"
        );

        return;
    }


    const cardId =
        Number(
            String(
                input.value
            ).trim()
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


    /*
    Preserve existing behavior.

    If no selector exists, manual lookup
    defaults to physical.
    */

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
// CLEAR ALL AUDIT REQUESTS
// =========================================================

function clearDigitalAuditRequests() {

    const list =
        getAuditListElement();


    if (list) {

        list.innerHTML =
            "";
    }


    closeAuditOverlay();
}


// =========================================================
// BUTTON EVENTS
// =========================================================

document.addEventListener(
    "click",
    function(event) {

        if (!event.target) {
            return;
        }


        const target =
            event.target;


        const id =
            target.id ||
            "";


        const classes =
            target.classList;


        /*
        =====================================================
        APPROVE
        =====================================================
        */

        if (

            id === "approvePhysicalWin" ||
            id === "approveDigitalWin" ||
            id === "approveWinBtn" ||
            (
                classes &&
                classes.contains(
                    "approveBtn"
                )
            )

        ) {

            approveAuditWinner();

            return;
        }


        /*
        =====================================================
        REJECT
        =====================================================
        */

        if (

            id === "rejectPhysicalWin" ||
            id === "rejectDigitalWin" ||
            id === "rejectWinBtn" ||
            (
                classes &&
                classes.contains(
                    "rejectBtn"
                )
            )

        ) {

            rejectAuditWinner();

            return;
        }


        /*
        =====================================================
        CLOSE
        =====================================================
        */

        if (

            id === "closeAuditOverlay" ||
            id === "closeCheckerOverlay" ||
            (
                classes &&
                classes.contains(
                    "closeAuditBtn"
                )
            )

        ) {

            closeAuditOverlay();

            return;
        }


        /*
        =====================================================
        MANUAL LOOKUP
        =====================================================
        */

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


// Useful debugging exports.

window.getHostAuditData =
    function() {

        return {
            activeAuditCard,
            activeAuditData,
            isPhysicalAuditMode
        };

    };


window.getHostCalledQuestionIds =
    function() {

        return [
            ...getCalledQuestionIds()
        ];

    };


window.getHostCalledAnswers =
    function() {

        return [
            ...getCalledAnswers()
        ];

    };


window.getHostAuditMarkedIndices =
    function() {

        return [
            ...getMarkedIndices()
        ];

    };


// =========================================================
// START
// =========================================================

initializeHostAudit();


console.log(
    "HOST AUDIT MODULE READY"
);
