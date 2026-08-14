"use strict";

/*
=========================================================
SAFETY BINGO - HOST AUDIT SYSTEM
=========================================================

DIGITAL + PHYSICAL AUDITS ARE INDEPENDENT

DIGITAL AUDIT
-------------
GREEN  = Player marked + Host called
RED    = Player marked + Host did not call
YELLOW = Host called + Player did not mark
CLEAR  = Host did not call + Player did not mark

PHYSICAL AUDIT
--------------
GREEN  = Host called
CLEAR  = Host did not call

FREE SPACE
----------
Always GREEN

IMPORTANT
----------
Digital and physical audit requests are completely
independent.

A digital audit MUST NOT:
    - remove a physical audit request
    - close a physical request
    - lock the physical audit system
    - interfere with another card's audit
    - interfere with another audit type

A physical audit MUST NOT:
    - remove a digital audit request
    - close a digital request
    - lock the digital audit system
    - interfere with another card's audit
    - interfere with another audit type

=========================================================
*/

console.log("=================================================");
console.log("HOST AUDIT SYSTEM LOADED");
console.log("DIGITAL + PHYSICAL AUDITS ARE INDEPENDENT");
console.log("=================================================");


// =========================================================
// STATE
// =========================================================

let activeAuditCard = null;
let activeAuditData = null;
let isPhysicalAuditMode = false;

let auditSocketInitialized = false;


// =========================================================
// AUDIT REQUEST TRACKING
// =========================================================

/*
Each audit request gets its own unique key:

digital:12
physical:12
digital:15
physical:15

This prevents one audit type from touching another.
*/

const auditRequests = new Map();


// =========================================================
// CALLED QUESTION HISTORY
// =========================================================

const auditCalledQuestionIds = new Set();
const auditCalledAnswers = new Set();


// =========================================================
// INITIALIZATION
// =========================================================

function initializeHostAudit() {

    console.log("HOST AUDIT: INITIALIZING");

    waitForHostSocket();
}


// =========================================================
// WAIT FOR HOST SOCKET
// =========================================================

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

    const socket = window.hostSocket;


    if (!socket) {

        console.error(
            "HOST AUDIT: host socket missing"
        );

        return;
    }


    auditSocketInitialized = true;


    // =====================================================
    // DIGITAL BINGO REQUEST
    // =====================================================

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


    // =====================================================
    // PHYSICAL BINGO REQUEST
    // =====================================================

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


    // =====================================================
    // DIGITAL APPROVED
    // =====================================================

    socket.on(
        "winApproved",
        function(data) {

            console.log(
                "HOST AUDIT: DIGITAL WIN APPROVED",
                data
            );

            finishAuditRequest(
                data,
                false
            );
        }
    );


    // =====================================================
    // PHYSICAL APPROVED
    // =====================================================

    socket.on(
        "physicalWinApproved",
        function(data) {

            console.log(
                "HOST AUDIT: PHYSICAL WIN APPROVED",
                data
            );

            finishAuditRequest(
                data,
                true
            );
        }
    );


    // =====================================================
    // DIGITAL REJECTED
    // =====================================================

    socket.on(
        "winRejected",
        function(data) {

            console.log(
                "HOST AUDIT: DIGITAL WIN REJECTED",
                data
            );

            finishAuditRequest(
                data,
                false
            );
        }
    );


    // =====================================================
    // PHYSICAL REJECTED
    // =====================================================

    socket.on(
        "physicalWinRejected",
        function(data) {

            console.log(
                "HOST AUDIT: PHYSICAL WIN REJECTED",
                data
            );

            finishAuditRequest(
                data,
                true
            );
        }
    );


    // =====================================================
    // QUESTION / READ EVENTS
    // =====================================================

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


    // =====================================================
    // SOCKET CATCH-ALL
    // =====================================================

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
                Ignore audit events already handled above.
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
// AUDIT REQUEST KEY
// =========================================================

function getAuditRequestKey(
    cardId,
    isPhysical
) {

    const type =
        isPhysical
            ? "physical"
            : "digital";

    return (
        type +
        ":" +
        Number(cardId)
    );
}


// =========================================================
// REMEMBER REQUEST
// =========================================================

function rememberAuditRequest(
    data,
    isPhysical
) {

    const cardId =
        getCardIdFromData(
            data
        );


    if (
        !Number.isInteger(cardId) ||
        cardId <= 0
    ) {

        return;
    }


    const key =
        getAuditRequestKey(
            cardId,
            isPhysical
        );


    auditRequests.set(
        key,
        {
            data,
            cardId,
            isPhysical
        }
    );


    console.log(
        "HOST AUDIT: REQUEST STORED",
        key
    );
}


// =========================================================
// REMOVE REQUEST
// =========================================================

function removeAuditRequest(
    cardId,
    isPhysical
) {

    const key =
        getAuditRequestKey(
            cardId,
            isPhysical
        );


    auditRequests.delete(
        key
    );


    const list =
        getAuditListElement();


    if (!list) {
        return;
    }


    /*
    IMPORTANT:

    We remove ONLY the exact audit type + card.

    Digital #12 will NOT remove Physical #12.
    Physical #12 will NOT remove Digital #12.
    */

    const button =
        list.querySelector(
            '[data-audit-key="' +
            key +
            '"]'
        );


    if (button) {
        button.remove();
    }


    console.log(
        "HOST AUDIT: REQUEST REMOVED",
        key
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
// INSPECT POSSIBLE QUESTION
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


    const key =
        getAuditRequestKey(
            cardId,
            false
        );


    /*
    Replace only an existing DIGITAL request
    for this card.

    A physical request for the same card remains.
    */

    removeAuditRequest(
        cardId,
        false
    );


    rememberAuditRequest(
        data,
        false
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


    button.dataset.auditKey =
        key;


    button.textContent =
        "AUDIT DIGITAL CARD #" +
        cardId;


    button.addEventListener(
        "click",
        function() {

            const request =
                auditRequests.get(
                    key
                );


            openAuditOverlay(
                request
                    ? request.data
                    : data,
                false
            );

        }
    );


    list.appendChild(
        button
    );


    console.log(
        "HOST AUDIT: DIGITAL BUTTON CREATED:",
        key
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


    const key =
        getAuditRequestKey(
            cardId,
            true
        );


    /*
    Replace only an existing PHYSICAL request
    for this card.

    A digital request for the same card remains.
    */

    removeAuditRequest(
        cardId,
        true
    );


    rememberAuditRequest(
        data,
        true
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


    button.dataset.auditKey =
        key;


    button.textContent =
        "AUDIT PHYSICAL CARD #" +
        cardId;


    button.addEventListener(
        "click",
        function() {

            const request =
                auditRequests.get(
                    key
                );


            openAuditOverlay(
                request
                    ? request.data
                    : data,
                true
            );

        }
    );


    list.appendChild(
        button
    );


    console.log(
        "HOST AUDIT: PHYSICAL BUTTON CREATED:",
        key
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
// IS CELL MARKED
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
            "HOST AUDIT: window.generateCard() NOT FOUND"
        );

        return;
    }


    /*
    IMPORTANT:

    This is the ONLY active visual audit.

    Opening a digital audit does NOT delete,
    disable, or modify physical audit requests.

    Opening a physical audit does NOT delete,
    disable, or modify digital audit requests.
    */

    isPhysicalAuditMode =
        Boolean(
            isPhysical
        );


    /*
    Preserve claim data.
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
    Generate the same card.
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
    Overlay.
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
    Title.
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
        "AUDIT TYPE:",
        isPhysicalAuditMode
            ? "PHYSICAL"
            : "DIGITAL"
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

            Physical cards don't have digital marks.
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

                color =
                    "green";

                box.classList.add(
                    "correct",
                    "free"
                );

            }

            else if (
                isPhysicalAuditMode
            ) {

                /*
                PHYSICAL:

                Called = GREEN
                Not called = CLEAR
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
                DIGITAL:

                Marked + Called = GREEN
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
                DIGITAL:

                Marked + Not Called = RED
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
                DIGITAL:

                Not Marked + Called = YELLOW
                */

                color =
                    "yellow";

                box.classList.add(
                    "missed"
                );

            }

            else {

                /*
                DIGITAL:

                Not Marked + Not Called = CLEAR
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


    const auditType =
        isPhysicalAuditMode
            ? "PHYSICAL"
            : "DIGITAL";


    console.log(
        "HOST AUDIT: APPROVING",
        auditType,
        cardId
    );


    /*
    IMPORTANT:

    Only this exact audit request is removed.
    */

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


    removeAuditRequest(
        cardId,
        isPhysicalAuditMode
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


    const auditType =
        isPhysicalAuditMode
            ? "PHYSICAL"
            : "DIGITAL";


    console.log(
        "HOST AUDIT: REJECTING",
        auditType,
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
            {
                cardId
            }
        );
    }


    /*
    IMPORTANT:

    Rejecting this audit does NOT disable the other
    audit system.

    Only remove the exact request being rejected.
    */

    removeAuditRequest(
        cardId,
        isPhysicalAuditMode
    );


    closeAuditOverlay();


    console.log(
        "HOST AUDIT: CLAIM REJECTED - OTHER AUDIT SYSTEMS REMAIN ACTIVE",
        {
            cardId,
            auditType
        }
    );
}


// =========================================================
// FINISH REQUEST
// =========================================================

function finishAuditRequest(
    data,
    isPhysical
) {

    const cardId =
        getCardIdFromData(
            data
        );


    if (!cardId) {
        return;
    }


    /*
    ONLY remove the matching audit type.
    */

    removeAuditRequest(
        cardId,
        Boolean(isPhysical)
    );


    /*
    Close overlay only if the currently displayed
    audit is the SAME type and SAME card.
    */

    if (

        activeAuditData &&

        Number(
            activeAuditData.cardId
        ) === cardId &&

        Boolean(isPhysicalAuditMode) ===
            Boolean(isPhysical)

    ) {

        closeAuditOverlay();
    }
}


// =========================================================
// REMOVE AUDIT BUTTON
// =========================================================

function removeAuditButton(
    cardId,
    isPhysical = false
) {

    removeAuditRequest(
        cardId,
        isPhysical
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


    /*
    Clear the independent request queue.
    */

    auditRequests.clear();


    closeAuditOverlay();
}


// =========================================================
// CLEAR ONLY ONE AUDIT TYPE
// =========================================================

function clearAuditType(
    isPhysical
) {

    const type =
        isPhysical
            ? "physical"
            : "digital";


    for (
        const [key, request]
        of auditRequests.entries()
    ) {

        if (
            request.isPhysical ===
            Boolean(isPhysical)
        ) {

            auditRequests.delete(
                key
            );

            const button =
                document.querySelector(
                    '[data-audit-key="' +
                    key +
                    '"]'
                );


            if (button) {
                button.remove();
            }
        }
    }


    if (
        activeAuditData &&
        Boolean(isPhysicalAuditMode) ===
            Boolean(isPhysical)
    ) {

        closeAuditOverlay();
    }


    console.log(
        "HOST AUDIT: CLEARED AUDIT TYPE:",
        type
    );
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


        // =================================================
        // APPROVE
        // =================================================

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


        // =================================================
        // REJECT
        // =================================================

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


        // =================================================
        // CLOSE
        // =================================================

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


        // =================================================
        // MANUAL CHECK
        // =================================================

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
// CLEAR INDIVIDUAL AUDIT TYPES
// =========================================================

window.clearDigitalAuditType =
    function() {

        clearAuditType(
            false
        );

    };


window.clearPhysicalAuditType =
    function() {

        clearAuditType(
            true
        );

    };


// =========================================================
// DEBUG EXPORTS
// =========================================================

window.getHostAuditData =
    function() {

        return {

            activeAuditCard,

            activeAuditData,

            isPhysicalAuditMode,

            requests:
                [
                    ...auditRequests.entries()
                ],

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


window.getHostAuditRequests =
    function() {

        return [
            ...auditRequests.entries()
        ];

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
    "HOST AUDIT SYSTEM READY"
);

console.log(
    "DIGITAL AUDIT: INDEPENDENT"
);

console.log(
    "PHYSICAL AUDIT: INDEPENDENT"
);

console.log(
    "================================================="
);
