"use strict";

/*
=========================================================
DIGITAL HOST AUDIT SYSTEM
=========================================================

COLOR RULES

GREEN  = PLAYER MARKED + HOST CALLED
RED    = PLAYER MARKED + HOST DID NOT CALL
YELLOW = HOST CALLED + PLAYER DID NOT MARK
CLEAR  = HOST DID NOT CALL + PLAYER DID NOT MARK

FREE SPACE = GREEN

IMPORTANT
---------
Rejecting a Bingo claim does NOT disable the player.
The player remains active.

=========================================================
*/

console.log("=================================================");
console.log("HOST DIGITAL AUDIT MODULE LOADED");
console.log("=================================================");


// =========================================================
// STATE
// =========================================================

let activeAuditCard = null;
let activeAuditData = null;
let isPhysicalAuditMode = false;

let auditSocketInitialized = false;


/*
IMPORTANT:

This is the authoritative list maintained by THIS
audit module.

When the host reads/calls a question, its ID should
be added here.

When the host calls a question, its answer is also
stored here.

The audit then compares each player's card against
these sets.
*/

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

        console.log(
            "HOST AUDIT: socket already initialized"
        );

        return;
    }

    const socket =
        window.hostSocket;


    if (!socket) {

        console.error(
            "HOST AUDIT: host socket missing"
        );

        return;
    }


    auditSocketInitialized = true;


    /*
    =====================================================
    BINGO REQUEST
    =====================================================
    */

    socket.on(
        "winRequested",
        function(data) {

            console.log(
                "HOST AUDIT: DIGITAL BINGO REQUEST",
                data
            );

            if (!data) {
                return;
            }

            createAuditButton(data);
        }
    );


    /*
    =====================================================
    PHYSICAL BINGO REQUEST
    =====================================================
    */

    socket.on(
        "physicalWinRequested",
        function(data) {

            console.log(
                "HOST AUDIT: PHYSICAL BINGO REQUEST",
                data
            );

            if (!data) {
                return;
            }

            createPhysicalAuditButton(data);
        }
    );


    /*
    =====================================================
    APPROVED
    =====================================================
    */

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


    /*
    =====================================================
    REJECTED
    =====================================================
    */

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


    /*
    =====================================================
    QUESTION / READ EVENTS
    =====================================================

    We listen for several likely event names.

    IMPORTANT:
    If your actual host game uses a different event,
    the diagnostic catch-all below will reveal it.
    */


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
        "questionStarted"

    ];


    questionEvents.forEach(
        function(eventName) {

            socket.on(
                eventName,
                function(data) {

                    console.log(
                        "================================================="
                    );

                    console.log(
                        "HOST AUDIT: QUESTION EVENT:",
                        eventName
                    );

                    console.log(
                        "HOST AUDIT: QUESTION DATA:",
                        data
                    );

                    console.log(
                        "================================================="
                    );

                    rememberCalledQuestion(
                        data
                    );

                }
            );

        }
    );


    /*
    =====================================================
    CATCH ALL SOCKET EVENTS
    =====================================================

    Socket.IO supports catch-all listeners on clients.
    This is extremely useful here because we need to
    discover the ACTUAL event your host page emits.
    */


    if (
        typeof socket.onAny === "function"
    ) {

        socket.onAny(
            function(eventName, ...args) {

                console.log(
                    "[HOST AUDIT SOCKET EVENT]",
                    eventName,
                    args
                );

                /*
                Ignore our already handled audit events.
                */

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


                /*
                Store possible question/read data.

                We deliberately do not depend ONLY on event
                names anymore.
                */

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
// REMEMBER CALLED QUESTION
// =========================================================

function rememberCalledQuestion(data) {

    if (
        data === null ||
        data === undefined
    ) {

        return;
    }


    /*
    -----------------------------------------------------
    OBJECT
    -----------------------------------------------------
    */

    if (
        typeof data === "object" &&
        !Array.isArray(data)
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
                "HOST AUDIT: CALLED QUESTION ID ADDED:",
                id
            );
        }


        if (answer) {

            auditCalledAnswers.add(
                answer
            );

            console.log(
                "HOST AUDIT: CALLED ANSWER ADDED:",
                answer
            );
        }


        /*
        Some applications wrap the actual question.
        */

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
                    typeof item === "object"
                ) {

                    rememberCalledQuestion(
                        item
                    );
                }

            }
        );


        return;
    }


    /*
    -----------------------------------------------------
    PRIMITIVE
    -----------------------------------------------------
    */

    const normalized =
        normalizeQuestionId(
            data
        );


    if (normalized) {

        auditCalledQuestionIds.add(
            normalized
        );

        console.log(
            "HOST AUDIT: CALLED QUESTION ID ADDED:",
            normalized
        );
    }
}


// =========================================================
// INSPECT POSSIBLE CALLED QUESTION
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


    /*
    If the event name strongly indicates that the
    host has called/read/selected a question, record it.
    */

    const looksLikeCalledEvent =

        name.includes("question") ||
        name.includes("called") ||
        name.includes("read") ||
        name.includes("announ") ||
        name.includes("selected");


    if (
        looksLikeCalledEvent
    ) {

        console.log(
            "HOST AUDIT: POSSIBLE CALLED QUESTION:",
            eventName,
            data
        );

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


    const ids = [

        data.cardId,
        data.cardID,

        data.playerCardId,
        data.playerCardID,

        data.id,

        data.card,

        data.cardNumber,
        data.cardNo,

        data.playerCard

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


    console.log(
        "HOST AUDIT: DIGITAL BUTTON CREATED:",
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
// NORMALIZE
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


    const valueString =
        String(value)
            .trim()
            .toLowerCase();


    /*
    Numeric IDs:

    5
    "5"
    "05"

    all become:

    "5"
    */

    if (
        /^\d+$/.test(
            valueString
        )
    ) {

        return String(
            Number(valueString)
        );
    }


    return valueString;
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

        item.number

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

        item.questionText,

        item.questionAnswer

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


        /*
        If markedIndices specifically exists,
        use it as authoritative.
        */

        if (
            source ===
                activeAuditData.markedIndices ||
            source ===
                activeAuditData.markedindices
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


    /*
    If the Bingo claim contains markedIndices,
    those are authoritative.
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


    /*
    FREE SPACE
    */

    if (
        cell.isFreeSpace === true ||
        cell.isFree === true ||
        cell.free === true
    ) {

        return true;
    }


    const answer =
        normalizeAuditValue(
            cell.answer ??
            cell.answerText ??
            cell.value ??
            cell.text ??
            cell.label
        );


    if (
        answer === "free" ||
        answer === "free space"
    ) {

        return true;
    }


    /*
    QUESTION ID
    */

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


    /*
    ANSWER
    */

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
        Boolean(
            isPhysical
        );


    /*
    Preserve entire Bingo claim.
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
    Generate the SAME card.
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


    /*
    Overlay
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
    Title
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


    grid.innerHTML =
        "";


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


            /*
            FREE SPACE
            */

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


            /*
            CALLED
            */

            const called =
                free
                    ? true
                    : wasCellCalled(
                        cell
                    );


            /*
            MARKED
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
            TEXT
            */

            box.textContent =
                cell?.answer ??
                cell?.answerText ??
                cell?.value ??
                cell?.text ??
                cell?.questionText ??
                cell?.label ??
                "";


            /*
            =================================================
            COLOR
            =================================================
            */

            let color;


            if (free) {

                /*
                FREE SPACE = GREEN
                */

                color =
                    "green";

                box.classList.add(
                    "correct",
                    "free"
                );

            }
            else if (isPhysicalAuditMode) {

                /*
                PHYSICAL AUDIT

                Host called = green
                Host didn't call = clear
                */

                if (called) {

                    color =
                        "green";

                    box.classList.add(
                        "correct"
                    );

                }
                else {

                    color =
                        "clear";

                    box.classList.add(
                        "clear"
                    );
                }

            }
            else if (
                marked &&
                called
            ) {

                /*
                GREEN

                Player marked it.
                Host called it.
                */

                color =
                    "green";

                box.classList.add(
                    "correct"
                );

            }
            else if (
                marked &&
                !called
            ) {

                /*
                RED

                Player marked it.
                Host did NOT call it.
                */

                color =
                    "red";

                box.classList.add(
                    "wrong"
                );

            }
            else if (
                !marked &&
                called
            ) {

                /*
                YELLOW

                Host called it.
                Player did NOT mark it.
                */

                color =
                    "yellow";

                box.classList.add(
                    "missed"
                );

            }
            else {

                /*
                CLEAR

                Host did not call it.
                Player did not mark it.
                */

                color =
                    "clear";

                box.classList.add(
                    "clear"
                );
            }


            /*
            DEBUG DATA
            */

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


            /*
            DEBUG
            */

            console.log(
                "AUDIT CELL",
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


    console.log(
        "HOST AUDIT: APPROVING",
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


    console.log(
        "HOST AUDIT: REJECTING",
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


    /*
    IMPORTANT:

    Rejecting the Bingo does NOT disable the player.
    We only remove the audit request.
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
// REMOVE BUTTON
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

        console.error(
            "HOST AUDIT: card lookup input missing"
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
            : false;


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

        list.innerHTML =
            "";
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


        /*
        APPROVE
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
        REJECT
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
        CLOSE
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
        MANUAL CHECK
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
    "HOST DIGITAL AUDIT MODULE READY"
);

console.log(
    "================================================="
);
