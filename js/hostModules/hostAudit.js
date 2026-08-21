"use strict";

/*
=========================================================
DIGITAL HOST AUDIT SYSTEM
=========================================================

GREEN  = PLAYER MARKED + HOST CALLED
RED    = PLAYER MARKED + HOST DID NOT CALL
YELLOW = HOST CALLED + PLAYER DID NOT MARK
CLEAR  = HOST DID NOT CALL + PLAYER DID NOT MARK

FREE SPACE = GREEN

Rejecting a Bingo claim does NOT disable the player.
=========================================================
*/

console.log("=================================================");
console.log("HOST AUDIT: MODULE LOADING");
console.log("=================================================");


// =========================================================
// STATE
// =========================================================

let activeAuditCard = null;
let activeAuditData = null;
let isPhysicalAuditMode = false;

let auditSocketInitialized = false;

const auditCalledQuestionIds = new Set();
const auditCalledAnswers = new Set();


// =========================================================
// INITIALIZATION
// =========================================================

function initializeHostAudit() {

    console.log("HOST AUDIT: INITIALIZING");

    waitForHostSocket();
}


function waitForHostSocket() {

    if (!window.hostSocket) {

        console.log(
            "HOST AUDIT: waiting for window.hostSocket..."
        );

        setTimeout(
            waitForHostSocket,
            500
        );

        return;
    }

    console.log(
        "HOST AUDIT: host socket found"
    );

    setupDigitalAuditSocket();
}


// =========================================================
// SOCKET SETUP
// =========================================================

function setupDigitalAuditSocket() {

    if (auditSocketInitialized) {
        return;
    }

    const socket = window.hostSocket;

    if (!socket) {

        console.error(
            "HOST AUDIT: host socket missing"
        );

        return;
    }

    auditSocketInitialized = true;


    // -----------------------------------------------------
    // DIGITAL BINGO REQUEST
    // -----------------------------------------------------

    socket.on(
        "winRequested",
        function(data) {

            console.log(
                "HOST AUDIT: DIGITAL BINGO REQUEST",
                data
            );

            if (data) {
                createAuditButton(data);
            }
        }
    );


    // -----------------------------------------------------
    // PHYSICAL BINGO REQUEST
    // -----------------------------------------------------

    socket.on(
        "physicalWinRequested",
        function(data) {

            console.log(
                "HOST AUDIT: PHYSICAL BINGO REQUEST",
                data
            );

            if (data) {
                createPhysicalAuditButton(data);
            }
        }
    );


    // -----------------------------------------------------
    // APPROVED
    // -----------------------------------------------------

    socket.on(
        "winApproved",
        function(data) {

            console.log(
                "HOST AUDIT: DIGITAL WIN APPROVED",
                data
            );

            finishAuditRequest(data);
        }
    );


    socket.on(
        "physicalWinApproved",
        function(data) {

            console.log(
                "HOST AUDIT: PHYSICAL WIN APPROVED",
                data
            );

            finishAuditRequest(data);
        }
    );


    // -----------------------------------------------------
    // REJECTED
    // -----------------------------------------------------

    socket.on(
        "winRejected",
        function(data) {

            console.log(
                "HOST AUDIT: DIGITAL WIN REJECTED",
                data
            );

            finishAuditRequest(data);
        }
    );


    socket.on(
        "physicalWinRejected",
        function(data) {

            console.log(
                "HOST AUDIT: PHYSICAL WIN REJECTED",
                data
            );

            finishAuditRequest(data);
        }
    );


    // -----------------------------------------------------
    // POSSIBLE QUESTION EVENTS
    // -----------------------------------------------------

    const questionEvents = [

        "questionCalled",
        "questionRead",
        "questionSelected",
        "questionAnnounced",

        "calledQuestion",
        "readQuestion",
        "called",

        "questionCalledByHost",

        "currentQuestion",
        "questionStarted",

        "showQuestion",
        "displayQuestion",
        "nextQuestion"

    ];


    questionEvents.forEach(
        function(eventName) {

            socket.on(
                eventName,
                function(data) {

                    console.log(
                        "HOST AUDIT: QUESTION EVENT",
                        eventName,
                        data
                    );

                    rememberCalledQuestion(
                        data
                    );
                }
            );
        }
    );


    // -----------------------------------------------------
    // CATCH-ALL
    // -----------------------------------------------------

    if (
        typeof socket.onAny === "function"
    ) {

        socket.onAny(
            function(eventName, ...args) {

                if (
                    eventName === "winRequested" ||
                    eventName === "winApproved" ||
                    eventName === "winRejected" ||
                    eventName === "physicalWinRequested" ||
                    eventName === "physicalWinApproved" ||
                    eventName === "physicalWinRejected"
                ) {
                    return;
                }


                console.log(
                    "[HOST AUDIT SOCKET EVENT]",
                    eventName,
                    args
                );


                if (
                    args.length > 0
                ) {

                    inspectPossibleCalledQuestion(
                        eventName,
                        args[0]
                    );
                }
            }
        );
    }


    console.log(
        "HOST AUDIT: SOCKET LISTENERS READY"
    );
}


// =========================================================
// NORMALIZATION
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


function normalizeQuestionId(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return "";
    }

    const text =
        String(value)
            .trim()
            .toLowerCase();

    if (
        /^\d+$/.test(text)
    ) {

        return String(
            Number(text)
        );
    }

    return text;
}


// =========================================================
// QUESTION ID EXTRACTION
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


    const ids = [

        item.questionId,
        item.questionID,
        item.question_id,

        item.questionKey,
        item.questionNumber,
        item.questionIndex,

        item.id,
        item.key,
        item.number,

        item.question?.questionId,
        item.question?.questionID,
        item.question?.id,

        item.questionData?.questionId,
        item.questionData?.questionID,
        item.questionData?.id

    ];


    for (
        const value of ids
    ) {

        const normalized =
            normalizeQuestionId(
                value
            );

        if (normalized) {
            return normalized;
        }
    }


    return "";
}


// =========================================================
// ANSWER EXTRACTION
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


    const values = [

        item.answer,
        item.answerText,
        item.correctAnswer,

        item.value,
        item.text,
        item.label,

        item.questionAnswer,

        item.question?.answer,
        item.question?.answerText,
        item.question?.correctAnswer,

        item.questionData?.answer,
        item.questionData?.answerText,
        item.questionData?.correctAnswer

    ];


    for (
        const value of values
    ) {

        const normalized =
            normalizeAuditValue(
                value
            );

        if (normalized) {
            return normalized;
        }
    }


    return "";
}


// =========================================================
// REMEMBER CALLED QUESTION
// =========================================================

function rememberCalledQuestion(data) {

    if (
        data === null ||
        data === undefined
    ) {
        return;
    }


    // -----------------------------------------------------
    // ARRAY
    // -----------------------------------------------------

    if (
        Array.isArray(data)
    ) {

        data.forEach(
            function(item) {

                rememberCalledQuestion(
                    item
                );
            }
        );

        return;
    }


    // -----------------------------------------------------
    // OBJECT
    // -----------------------------------------------------

    if (
        typeof data === "object"
    ) {

        const id =
            extractQuestionIdFromItem(
                data
            );


        const answer =
            extractAnswerFromItem(
                data
            );


        if (id) {

            auditCalledQuestionIds.add(
                id
            );

            console.log(
                "HOST AUDIT: CALLED QUESTION ID:",
                id
            );
        }


        if (answer) {

            auditCalledAnswers.add(
                answer
            );

            console.log(
                "HOST AUDIT: CALLED ANSWER:",
                answer
            );
        }


        const nestedObjects = [

            data.question,
            data.questionData,
            data.currentQuestion,
            data.item,
            data.cell,
            data.data

        ];


        nestedObjects.forEach(
            function(item) {

                if (
                    item &&
                    item !== data
                ) {

                    rememberCalledQuestion(
                        item
                    );
                }
            }
        );


        /*
        Some host implementations send:

        {
            question: "...",
            answer: "...",
            id: ...
        }

        The textual question itself is not treated as
        an answer unless it is actually supplied through
        the answer fields above.
        */

        return;
    }


    // -----------------------------------------------------
    // PRIMITIVE
    // -----------------------------------------------------

    const normalized =
        normalizeQuestionId(
            data
        );


    if (normalized) {

        auditCalledQuestionIds.add(
            normalized
        );

        console.log(
            "HOST AUDIT: CALLED QUESTION ID:",
            normalized
        );
    }
}


// =========================================================
// CATCH-ALL QUESTION INSPECTION
// =========================================================

function inspectPossibleCalledQuestion(
    eventName,
    data
) {

    const name =
        String(
            eventName || ""
        )
            .toLowerCase();


    const looksLikeCalledEvent =

        name.includes("question") ||
        name.includes("called") ||
        name.includes("read") ||
        name.includes("announ") ||
        name.includes("selected");


    if (
        looksLikeCalledEvent
    ) {

        rememberCalledQuestion(
            data
        );
    }
}


// =========================================================
// CARD ID
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
            Number(
                String(data).trim()
            );

        return Number.isFinite(number)
            ? number
            : 0;
    }


    if (
        typeof data !== "object"
    ) {
        return 0;
    }


    const ids = [

        data.cardId,
        data.cardID,

        data.playerCardId,
        data.playerCardID,

        data.cardNumber,
        data.cardNo,

        data.playerCard,

        data.id

    ];


    for (
        const value of ids
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
// AUDIT LIST
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
// CREATE DIGITAL AUDIT BUTTON
// =========================================================

function createAuditButton(data) {

    const list =
        getAuditListElement();


    if (!list) {

        console.error(
            "HOST AUDIT: auditWinnerList NOT FOUND"
        );

        return;
    }


    const cardId =
        getCardIdFromData(
            data
        );


    if (
        !Number.isInteger(cardId) ||
        cardId <= 0
    ) {

        console.error(
            "HOST AUDIT: invalid digital card ID",
            data
        );

        return;
    }


    removeAuditButton(
        cardId
    );


    const button =
        document.createElement(
            "button"
        );


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


    list.appendChild(
        button
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
            "HOST AUDIT: auditWinnerList NOT FOUND"
        );

        return;
    }


    const cardId =
        getCardIdFromData(
            data
        );


    if (
        !Number.isInteger(cardId) ||
        cardId <= 0
    ) {

        console.error(
            "HOST AUDIT: invalid physical card ID",
            data
        );

        return;
    }


    removeAuditButton(
        cardId
    );


    const button =
        document.createElement(
            "button"
        );


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


    list.appendChild(
        button
    );
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


    if (
        Array.isArray(
            activeAuditCard.squares
        )
    ) {
        return activeAuditCard.squares;
    }


    /*
    Some generators return the array directly.
    */

    if (
        Array.isArray(
            activeAuditCard
        )
    ) {
        return activeAuditCard;
    }


    return [];
}


// =========================================================
// MARKED INDICES
// =========================================================

function getMarkedIndices() {

    const result =
        new Set();


    if (!activeAuditData) {
        return result;
    }


    const sources = [

        activeAuditData.markedIndices,
        activeAuditData.markedindices,

        activeAuditData.selectedIndices,

        activeAuditData.markedCells,
        activeAuditData.selectedCells,

        activeAuditData.marks

    ];


    for (
        const source of sources
    ) {

        if (
            !Array.isArray(source)
        ) {
            continue;
        }


        source.forEach(
            function(value) {

                let index = null;


                if (
                    typeof value === "number"
                ) {

                    index = value;

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
        );


        if (
            source === activeAuditData.markedIndices ||
            source === activeAuditData.markedindices
        ) {

            break;
        }
    }


    return result;
}


// =========================================================
// IS MARKED
// =========================================================

function isCellMarked(
    cell,
    index
) {

    const markedIndices =
        getMarkedIndices();


    if (
        markedIndices.has(index)
    ) {
        return true;
    }


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


    return (

        cell.isMarked === true ||
        cell.marked === true ||
        cell.selected === true ||
        cell.checked === true

    );
}


// =========================================================
// WAS CALLED?
// =========================================================

function wasCellCalled(cell) {

    if (!cell) {
        return false;
    }


    if (
        cell.isFreeSpace === true ||
        cell.isFree === true ||
        cell.free === true
    ) {

        return true;
    }


    const answer =
        extractAnswerFromItem(
            cell
        );


    if (
        answer === "free" ||
        answer === "free space"
    ) {

        return true;
    }


    const questionId =
        extractQuestionIdFromItem(
            cell
        );


    if (
        questionId &&
        auditCalledQuestionIds.has(
            questionId
        )
    ) {

        return true;
    }


    if (
        answer &&
        auditCalledAnswers.has(
            answer
        )
    ) {

        return true;
    }


    return false;
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
            "HOST AUDIT: window.generateCard() NOT FOUND"
        );

        return;
    }


    isPhysicalAuditMode =
        Boolean(isPhysical);


    /*
    Preserve the original Bingo claim.
    */

    if (
        cardDataOrId &&
        typeof cardDataOrId === "object"
    ) {

        try {

            activeAuditData = {
                ...cardDataOrId
            };

        }
        catch (error) {

            activeAuditData =
                cardDataOrId;
        }

    }
    else {

        activeAuditData = {

            cardId:
                Number(
                    cardDataOrId
                )
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
            "HOST AUDIT: invalid card",
            activeAuditData
        );

        return;
    }


    activeAuditData.cardId =
        cardId;


    /*
    Generate the same deterministic card.
    */

    try {

        activeAuditCard =
            window.generateCard(
                cardId
            );

    }
    catch (error) {

        console.error(
            "HOST AUDIT: generateCard failed",
            error
        );

        return;
    }


    if (!activeAuditCard) {

        console.error(
            "HOST AUDIT: generateCard returned nothing"
        );

        return;
    }


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


    const checkedNumber =
        document.getElementById(
            "checkedCardNumber"
        );


    if (checkedNumber) {

        checkedNumber.textContent =
            "CARD #" +
            cardId;
    }


    renderAuditGrid();
}


// =========================================================
// RENDER
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
            "HOST AUDIT: audit grid not found"
        );

        return;
    }


    if (!activeAuditCard) {

        console.error(
            "HOST AUDIT: no active audit card"
        );

        return;
    }


    grid.innerHTML = "";


    const cells =
        getAuditCardCells();


    if (
        cells.length === 0
    ) {

        console.error(
            "HOST AUDIT: card has no cells",
            activeAuditCard
        );

        return;
    }


    const markedIndices =
        getMarkedIndices();


    console.log(
        "================================================="
    );

    console.log(
        "HOST AUDIT RENDER"
    );

    console.log(
        "CALLED QUESTION IDS:",
        [...auditCalledQuestionIds]
    );

    console.log(
        "CALLED ANSWERS:",
        [...auditCalledAnswers]
    );

    console.log(
        "PLAYER MARKED:",
        [...markedIndices]
    );

    console.log(
        "================================================="
    );


    cells.forEach(
        function(cell, index) {

            const box =
                document.createElement(
                    "div"
                );


            box.className =
                "audit-cell";


            const questionId =
                extractQuestionIdFromItem(
                    cell
                );


            const answer =
                extractAnswerFromItem(
                    cell
                );


            const free =

                index === 12 ||

                Boolean(
                    cell &&
                    (
                        cell.isFreeSpace === true ||
                        cell.isFree === true ||
                        cell.free === true
                    )
                ) ||

                answer === "free" ||
                answer === "free space";


            const called =
                free
                    ? true
                    : wasCellCalled(
                        cell
                    );


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


            box.textContent =
                cell?.answer ??
                cell?.answerText ??
                cell?.value ??
                cell?.text ??
                cell?.questionText ??
                cell?.label ??
                "";


            let color;


            if (free) {

                color = "green";

                box.classList.add(
                    "correct",
                    "free"
                );

            }
            else if (isPhysicalAuditMode) {

                if (called) {

                    color = "green";

                    box.classList.add(
                        "correct"
                    );

                }
                else {

                    color = "clear";

                    box.classList.add(
                        "clear"
                    );
                }

            }
            else if (
                marked &&
                called
            ) {

                color = "green";

                box.classList.add(
                    "correct"
                );

            }
            else if (
                marked &&
                !called
            ) {

                color = "red";

                box.classList.add(
                    "wrong"
                );

            }
            else if (
                !marked &&
                called
            ) {

                color = "yellow";

                box.classList.add(
                    "missed"
                );

            }
            else {

                color = "clear";

                box.classList.add(
                    "clear"
                );
            }


            box.dataset.index =
                String(index);

            box.dataset.questionId =
                questionId;

            box.dataset.called =
                String(called);

            box.dataset.marked =
                String(marked);

            box.dataset.free =
                String(free);

            box.dataset.auditColor =
                color;


            console.log(
                "HOST AUDIT CELL",
                {
                    index,
                    questionId,
                    answer,
                    marked,
                    called,
                    free,
                    color
                }
            );


            grid.appendChild(
                box
            );
        }
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
            "HOST AUDIT: approve - invalid card"
        );

        return;
    }


    if (!window.hostSocket) {

        console.error(
            "HOST AUDIT: socket unavailable"
        );

        return;
    }


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
            "HOST AUDIT: reject - invalid card"
        );

        return;
    }


    if (!window.hostSocket) {

        console.error(
            "HOST AUDIT: socket unavailable"
        );

        return;
    }


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


    /*
    IMPORTANT:
    Rejecting a Bingo claim does NOT disable the player.
    */

    removeAuditButton(
        cardId
    );

    closeAuditOverlay();


    console.log(
        "HOST AUDIT: CLAIM REJECTED - PLAYER REMAINS ACTIVE",
        cardId
    );
}


// =========================================================
// FINISH REQUEST
// =========================================================

function finishAuditRequest(data) {

    const cardId =
        getCardIdFromData(
            data
        );


    if (!cardId) {
        return;
    }


    removeAuditButton(
        cardId
    );


    if (
        activeAuditData &&
        Number(
            activeAuditData.cardId
        ) === cardId
    ) {

        closeAuditOverlay();
    }
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


    list
        .querySelectorAll(
            '[data-card="' +
            numericCardId +
            '"]'
        )
        .forEach(
            function(button) {
                button.remove();
            }
        );
}


// =========================================================
// CLOSE
// =========================================================

function closeAuditOverlay() {

    activeAuditCard = null;
    activeAuditData = null;
    isPhysicalAuditMode = false;


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

function getManualCardInput() {

    /*
    YOUR CURRENT HTML USES:

        checkerCardID

    Keep the older IDs too for compatibility.
    */

    return (
        document.getElementById(
            "checkerCardID"
        ) ||
        document.getElementById(
            "cardLookupInput"
        ) ||
        document.getElementById(
            "checkCardInput"
        )
    );
}


function checkManualCardNumber() {

    const input =
        getManualCardInput();


    if (!input) {

        console.error(
            "HOST AUDIT: card lookup input missing"
        );

        console.error(
            "HOST AUDIT: expected #checkerCardID"
        );

        return;
    }


    const raw =
        String(
            input.value ?? ""
        ).trim();


    const cardId =
        Number(raw);


    if (
        !raw ||
        !Number.isInteger(cardId) ||
        cardId <= 0
    ) {

        alert(
            "Please enter a valid Card Number."
        );

        return;
    }


    /*
    Your current HTML does not contain a card type
    selector, so digital is the default.
    */

    const typeSelect =
        document.getElementById(
            "cardTypeSelect"
        );


    const physical =
        typeSelect
            ? typeSelect.value === "physical"
            : false;


    console.log(
        "HOST AUDIT: MANUAL CARD LOOKUP",
        {
            cardId,
            physical
        }
    );


    openAuditOverlay(
        cardId,
        physical
    );
}


// =========================================================
// CLEAR AUDIT REQUESTS
// =========================================================

function clearDigitalAuditRequests() {

    const list =
        getAuditListElement();


    if (list) {
        list.innerHTML = "";
    }


    closeAuditOverlay();
}


// =========================================================
// CLEAR CALLED HISTORY
// =========================================================

function clearAuditCalledHistory() {

    auditCalledQuestionIds.clear();
    auditCalledAnswers.clear();


    console.log(
        "HOST AUDIT: CALLED QUESTION HISTORY CLEARED"
    );


    if (activeAuditCard) {
        renderAuditGrid();
    }
}


// =========================================================
// BUTTON HANDLER
// =========================================================

document.addEventListener(
    "click",
    function(event) {

        const target =
            event.target;


        if (!target) {
            return;
        }


        const id =
            target.id || "";


        const classes =
            target.classList;


        // -------------------------------------------------
        // CHECK CARD
        // -------------------------------------------------

        if (
            id === "checkCardBtn" ||
            id === "runLookupBtn"
        ) {

            event.preventDefault();

            checkManualCardNumber();

            return;
        }


        // -------------------------------------------------
        // APPROVE
        // -------------------------------------------------

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

            event.preventDefault();

            approveAuditWinner();

            return;
        }


        // -------------------------------------------------
        // REJECT
        // -------------------------------------------------

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

            event.preventDefault();

            rejectAuditWinner();

            return;
        }


        // -------------------------------------------------
        // CLOSE
        // -------------------------------------------------

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

            event.preventDefault();

            closeAuditOverlay();

            return;
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

window.clearAuditCalledHistory =
    clearAuditCalledHistory;

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
            isPhysicalAuditMode,

            calledQuestionIds:
                [
                    ...auditCalledQuestionIds
                ],

            calledAnswers:
                [
                    ...auditCalledAnswers
                ]
        };
    };


window.getHostCalledQuestionIds =
    function() {

        return [
            ...auditCalledQuestionIds
        ];
    };


window.getHostCalledAnswers =
    function() {

        return [
            ...auditCalledAnswers
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
    "================================================="
);

console.log(
    "HOST AUDIT: MODULE READY"
);

console.log(
    "================================================="
);
