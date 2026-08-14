"use strict";

/*
=========================================================
HOST AUDIT SYSTEM
=========================================================

AUDIT COLORS

GREEN  = PLAYER MARKED + HOST CALLED
RED    = PLAYER MARKED + HOST DID NOT CALL
YELLOW = HOST CALLED + PLAYER DID NOT MARK
CLEAR  = HOST DID NOT CALL + PLAYER DID NOT MARK

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

    if (digitalAuditInitialized) {

        console.log(
            "HOST AUDIT SOCKET ALREADY INITIALIZED"
        );

        return;
    }

    if (!window.hostSocket) {

        console.warn(
            "CANNOT INITIALIZE AUDIT SOCKET - SOCKET MISSING"
        );

        digitalAuditInitialized = false;

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
                Number(activeAuditData.cardId) === cardId
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
                Number(activeAuditData.cardId) === cardId
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
        "AUDIT DIGITAL CARD #" +
        cardId;


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
        "AUDIT PHYSICAL CARD #" +
        cardId;


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
// GET AUDIT LIST
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
// NORMALIZE VALUE
// =========================================================

function normalizeAuditValue(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";
    }


    if (
        typeof value === "object"
    ) {

        return "";
    }


    return String(value)
        .trim()
        .replace(/\s+/g, " ")
        .toLowerCase();
}


// =========================================================
// NORMALIZE QUESTION ID
// =========================================================

function normalizeQuestionId(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {

        return "";
    }


    const stringValue =
        String(value)
            .trim()
            .toLowerCase();


    /*
    Numeric IDs should compare consistently.

    Example:

        5
        "5"
        "05"

    all become:

        "5"
    */

    if (
        /^\d+$/.test(
            stringValue
        )
    ) {

        return String(
            Number(stringValue)
        );
    }


    return stringValue;
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
// GET CELL QUESTION ID
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
            normalizeQuestionId(value);


        if (normalized) {

            return normalized;
        }
    }


    return "";
}


// =========================================================
// GET CELL ANSWER
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
// EXTRACT QUESTION ID FROM ANY OBJECT
// =========================================================

function extractQuestionIdFromItem(item) {

    if (
        item === null ||
        item === undefined
    ) {

        return "";
    }


    if (
        typeof item !== "object"
    ) {

        return normalizeQuestionId(
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
        item.id,
        item.key

    ];


    for (
        const value of possibleIds
    ) {

        const normalized =
            normalizeQuestionId(value);


        if (normalized) {

            return normalized;
        }
    }


    return "";
}


// =========================================================
// EXTRACT ANSWER FROM ANY OBJECT
// =========================================================

function extractAnswerFromItem(item) {

    if (
        item === null ||
        item === undefined
    ) {

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
        item.correctAnswer,
        item.value,
        item.text,
        item.label,
        item.questionText

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
// ADD CALLED ITEM
// =========================================================

function addCalledItem(
    ids,
    answers,
    item
) {

    if (
        item === null ||
        item === undefined
    ) {

        return;
    }


    const id =
        extractQuestionIdFromItem(
            item
        );


    const answer =
        extractAnswerFromItem(
            item
        );


    if (id) {

        ids.add(id);
    }


    if (answer) {

        answers.add(answer);
    }
}


// =========================================================
// ADD COLLECTION
// =========================================================

function addCalledCollection(
    ids,
    answers,
    source
) {

    if (!source) {
        return;
    }


    /*
    Array
    */

    if (Array.isArray(source)) {

        source.forEach(
            function(item) {

                addCalledItem(
                    ids,
                    answers,
                    item
                );

            }
        );

        return;
    }


    /*
    Set
    */

    if (source instanceof Set) {

        source.forEach(
            function(item) {

                addCalledItem(
                    ids,
                    answers,
                    item
                );

            }
        );

        return;
    }


    /*
    Object map

    Example:

        {
            "12": true,
            "13": true
        }
    */

    if (
        typeof source === "object"
    ) {

        Object.keys(source)
            .forEach(
                function(key) {

                    const value =
                        source[key];


                    /*
                    If the key itself looks like
                    a question ID, keep it.
                    */

                    const keyId =
                        normalizeQuestionId(
                            key
                        );


                    if (
                        keyId
                    ) {

                        if (
                            value === true ||
                            value === 1 ||
                            value === "1" ||
                            value === "true"
                        ) {

                            ids.add(
                                keyId
                            );
                        }
                    }


                    /*
                    Also inspect the value.
                    */

                    addCalledItem(
                        ids,
                        answers,
                        value
                    );

                }
            );
    }
}


// =========================================================
// GET CALLED STATE
// =========================================================

function getCalledState() {

    const state =
        getHostState();


    const ids =
        new Set();


    const answers =
        new Set();


    /*
    =====================================================
    QUESTION ID SOURCES
    =====================================================
    */

    const idSources = [

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


    idSources.forEach(
        function(source) {

            addCalledCollection(
                ids,
                answers,
                source
            );

        }
    );


    /*
    =====================================================
    CALLED ANSWER SOURCES
    =====================================================
    */

    const answerSources = [

        state.calledAnswers,
        state.readAnswers,

        window.calledAnswers,
        window.readAnswers

    ];


    answerSources.forEach(
        function(source) {

            addCalledCollection(
                ids,
                answers,
                source
            );

        }
    );


    /*
    =====================================================
    GENERIC CALLED QUESTION SOURCES
    =====================================================
    */

    const genericSources = [

        state.called,
        state.calledQuestions,
        state.calledItems,
        state.readQuestions,

        window.called,
        window.calledQuestions,
        window.calledItems,
        window.readQuestions

    ];


    genericSources.forEach(
        function(source) {

            addCalledCollection(
                ids,
                answers,
                source
            );

        }
    );


    /*
    =====================================================
    IMPORTANT:
    LOOK AT SERVER GAME STATE TOO
    =====================================================

    This handles applications where the host state
    contains the server's called-question history
    under slightly different names.
    */

    const serverSources = [

        state.calledQuestion,
        state.currentQuestion,
        state.currentAnswer,
        state.currentQuestionData,
        state.questionHistory,
        state.calledHistory

    ];


    serverSources.forEach(
        function(source) {

            addCalledCollection(
                ids,
                answers,
                source
            );

        }
    );


    /*
    =====================================================
    DEBUG
    =====================================================
    */

    console.log(
        "AUDIT CALLED STATE:",
        {
            ids: [...ids],
            answers: [...answers]
        }
    );


    return {
        ids,
        answers
    };
}


// =========================================================
// WAS CELL CALLED?
// =========================================================

function wasCellCalled(
    cell,
    calledState
) {

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
    QUESTION ID
    =====================================================
    */

    const questionId =
        getCellQuestionId(cell);


    if (
        questionId &&
        calledState.ids.has(questionId)
    ) {

        return true;
    }


    /*
    =====================================================
    ANSWER
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
    ALTERNATE IDs
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
            normalizeQuestionId(value);


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


    const possibleSources = [

        activeAuditData.markedIndices,
        activeAuditData.markedindices,
        activeAuditData.marked,
        activeAuditData.selectedIndices,
        activeAuditData.selectedCells,
        activeAuditData.marks,
        activeAuditData.markedCells

    ];


    let foundValidSource =
        false;


    const result =
        new Set();


    for (
        const source of possibleSources
    ) {

        if (!Array.isArray(source)) {
            continue;
        }


        foundValidSource =
            true;


        source.forEach(
            function(value) {

                let index = null;


                if (
                    typeof value === "number"
                ) {

                    index =
                        value;

                }
                else if (
                    typeof value === "string" &&
                    /^\d+$/.test(
                        value.trim()
                    )
                ) {

                    index =
                        Number(value);

                }
                else if (
                    value &&
                    typeof value === "object"
                ) {

                    index =
                        value.index ??
                        value.cellIndex ??
                        value.position;
                }


                if (
                    index !== null &&
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
        );


        /*
        The first actual markedIndices-style
        array is authoritative.
        */

        if (
            source === activeAuditData.markedIndices ||
            source === activeAuditData.markedindices
        ) {

            break;
        }
    }


    if (foundValidSource) {

        return result;
    }


    return new Set();
}


// =========================================================
// IS CELL MARKED?
// =========================================================

function isCellMarked(
    cell,
    index
) {

    const markedIndices =
        getMarkedIndices();


    /*
    =====================================================
    CLAIM DATA HAS PRIORITY
    =====================================================
    */

    if (
        markedIndices.has(index)
    ) {

        return true;
    }


    /*
    If the claim explicitly supplied markedIndices,
    don't infer marks from generated card state.
    */

    if (
        activeAuditData &&
        (
            Array.isArray(
                activeAuditData.markedIndices
            ) ||
            Array.isArray(
                activeAuditData.markedindices
            )
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
    Preserve the COMPLETE claim.
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
        "CALLED IDS:",
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
    RENDER
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


            const answer =
                getCellAnswer(cell);


            const questionId =
                getCellQuestionId(cell);


            /*
            =================================================
            FREE SPACE
            =================================================
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
            =================================================
            CALLED
            =================================================
            */

            const called =
                free
                    ? true
                    : wasCellCalled(
                        cell,
                        calledState
                    );


            /*
            =================================================
            MARKED
            =================================================
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
            =================================================
            DISPLAY TEXT
            =================================================
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


            /*
            =================================================
            DIGITAL AUDIT
            =================================================
            */

            else {

                /*
                GREEN
                */

                if (
                    free ||
                    (
                        marked &&
                        called
                    )
                ) {

                    box.classList.add(
                        "correct"
                    );

                    if (free) {

                        box.classList.add(
                            "free"
                        );
                    }
                }


                /*
                RED
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
                */

                else {

                    box.classList.add(
                        "clear"
                    );
                }
            }


            /*
            =================================================
            DEBUG ATTRIBUTES
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
                        isPhysicalAuditMode,
                    color:
                        free
                            ? "GREEN"
                            : marked && called
                                ? "GREEN"
                                : marked && !called
                                    ? "RED"
                                    : !marked && called
                                        ? "YELLOW"
                                        : "CLEAR"
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
// APPROVE
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


    removeAuditButton(
        cardId
    );


    closeAuditOverlay();
}


// =========================================================
// REJECT
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


    removeAuditButton(
        cardId
    );


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


    const buttons =
        list.querySelectorAll(
            '[data-card="' +
            numericCardId +
            '"]'
        );


    buttons.forEach(
        function(button) {

            button.remove();

        }
    );
}


// =========================================================
// CLOSE OVERLAY
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
// CLEAR REQUESTS
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
// DEBUG EXPORTS
// =========================================================

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
            ...getCalledState().ids
        ];

    };


window.getHostCalledAnswers =
    function() {

        return [
            ...getCalledState().answers
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
