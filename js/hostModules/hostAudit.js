"use strict";

/*
=========================================================
HOST DIGITAL + PHYSICAL AUDIT SYSTEM
=========================================================

COLOR RULES

GREEN  = PLAYER MARKED + HOST CALLED
RED    = PLAYER MARKED + HOST DID NOT CALL
YELLOW = HOST CALLED + PLAYER DID NOT MARK
CLEAR  = HOST DID NOT CALL + PLAYER DID NOT MARK

FREE SPACE = GREEN

IMPORTANT
---------
Digital and Physical audits are COMPLETELY INDEPENDENT.

A digital audit must NEVER remove, disable, finish,
reject, approve, or otherwise interfere with a physical
audit having the same card number.

A physical audit must NEVER interfere with a digital audit.

Rejecting a Bingo claim does NOT disable the player.
The player remains active.

=========================================================
*/

console.log("=================================================");
console.log("HOST DIGITAL + PHYSICAL AUDIT MODULE LOADED");
console.log("=================================================");


// =========================================================
// STATE
// =========================================================

let activeAuditCard = null;
let activeAuditData = null;
let isPhysicalAuditMode = false;

let auditSocketInitialized = false;


/*
=========================================================
CALLED QUESTION HISTORY
=========================================================

These belong to the GAME, not to an individual audit.

They therefore remain shared between digital and physical
audits.

Both audit systems use the exact same host-called history.
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
                "digital"
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
                "physical"
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
                "digital"
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
                "physical"
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
                Ignore audit-result events.

                IMPORTANT:

                These are deliberately ignored here because
                their handlers above already know whether the
                event is digital or physical.
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
    // OBJECT
    // -----------------------------------------------------

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


        /*
        If a digital or physical audit is currently open,
        update its display immediately.
        */

        if (activeAuditCard) {

            renderAuditGrid();
        }


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
            "HOST AUDIT: CALLED QUESTION ID ADDED:",
            normalized
        );
    }


    if (activeAuditCard) {

        renderAuditGrid();
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


    /*
    IMPORTANT:

    ONLY remove an existing DIGITAL audit for this card.

    We no longer remove physical audits with the same
    card number.
    */

    removeAuditButton(
        cardId,
        "digital"
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


    /*
    Unique key.

    Digital #25 and Physical #25 are different requests.
    */

    button.dataset.auditKey =
        makeAuditKey(
            cardId,
            "digital"
        );


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


    /*
    IMPORTANT:

    ONLY remove an existing PHYSICAL audit for this card.

    A physical Card #25 must not remove digital Card #25.
    */

    removeAuditButton(
        cardId,
        "physical"
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
        makeAuditKey(
            cardId,
            "physical"
        );


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


    console.log(
        "HOST AUDIT: PHYSICAL BUTTON CREATED:",
        cardId
    );
}


// =========================================================
// MAKE UNIQUE AUDIT KEY
// =========================================================

function makeAuditKey(
    cardId,
    auditType
) {

    const normalizedType =
        auditType === "physical"
            ? "physical"
            : "digital";


    return (
        normalizedType +
        "-" +
        String(cardId)
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
        markedIndices is authoritative when present.
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


    /*
    IMPORTANT:

    This only changes which audit is currently being
    VIEWED.

    It does NOT affect the other audit type.
    */

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
    Remember audit type in the active data.
    */

    activeAuditData.auditType =
        isPhysicalAuditMode
            ? "physical"
            : "digital";


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

            Physical cards don't have digital player
            marking data, so physical remains false.
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


            box.dataset.auditType =
                isPhysicalAuditMode
                    ? "physical"
                    : "digital";


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


    const auditType =
        isPhysicalAuditMode
            ? "physical"
            : "digital";


    console.log(
        "HOST AUDIT: APPROVING",
        {
            cardId,
            auditType
        }
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
    IMPORTANT:

    Remove ONLY the audit that was approved.

    A physical audit with the same card number remains.
    */

    removeAuditButton(
        cardId,
        auditType
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
            ? "physical"
            : "digital";


    console.log(
        "HOST AUDIT: REJECTING",
        {
            cardId,
            auditType
        }
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

    Also, ONLY remove the audit that was rejected.

    If Physical Card #25 exists, it stays active.
    */

    removeAuditButton(
        cardId,
        auditType
    );


    closeAuditOverlay();


    console.log(
        "HOST AUDIT: CLAIM REJECTED - PLAYER REMAINS ACTIVE",
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
    auditType
) {

    const cardId =
        getCardIdFromData(
            data
        );


    if (!cardId) {

        console.warn(
            "HOST AUDIT: finish request - invalid card",
            data
        );

        return;
    }


    /*
    Normalize the type from the event.

    This is VERY important.

    A digital "winApproved" can ONLY finish digital.

    A physical "physicalWinApproved" can ONLY finish
    physical.
    */

    const normalizedType =
        auditType === "physical"
            ? "physical"
            : "digital";


    console.log(
        "HOST AUDIT: FINISHING REQUEST",
        {
            cardId,
            auditType: normalizedType
        }
    );


    /*
    Remove ONLY this audit type.
    */

    removeAuditButton(
        cardId,
        normalizedType
    );


    /*
    Close the overlay ONLY if the currently displayed
    audit is the same card AND the same type.

    This prevents a digital completion from closing
    a physical audit that the host may be viewing.
    */

    if (
        activeAuditData &&
        Number(
            activeAuditData.cardId
        ) === cardId &&
        (
            activeAuditData.auditType ===
            normalizedType
        )
    ) {

        closeAuditOverlay();
    }
}


// =========================================================
// REMOVE AUDIT BUTTON
// =========================================================

function removeAuditButton(
    cardId,
    auditType
) {

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
    If a type was not supplied, preserve backwards
    compatibility by removing only matching card buttons.

    HOWEVER, all internal calls now provide the type.
    */

    if (
        auditType !== "digital" &&
        auditType !== "physical"
    ) {

        console.warn(
            "HOST AUDIT: removeAuditButton called without audit type",
            cardId
        );

        return;
    }


    const normalizedType =
        auditType;


    const buttons =
        list.querySelectorAll(
            '[data-card="' +
            numericCardId +
            '"]'
        );


    buttons.forEach(
        function(button) {

            /*
            ONLY remove the requested type.
            */

            if (
                button.dataset.auditType ===
                normalizedType
            ) {

                button.remove();
            }

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
// CLEAR DIGITAL AUDIT REQUESTS
// =========================================================

function clearDigitalAuditRequests() {

    const list =
        getAuditListElement();


    if (!list) {

        return;
    }


    /*
    IMPORTANT:

    Do NOT use:

        list.innerHTML = "";

    because that would also delete physical audits.

    Remove DIGITAL buttons only.
    */

    const digitalButtons =
        list.querySelectorAll(
            '[data-audit-type="digital"]'
        );


    digitalButtons.forEach(
        function(button) {

            button.remove();

        }
    );


    /*
    Only close the overlay if the currently displayed
    audit is digital.

    A physical audit remains untouched.
    */

    if (
        !isPhysicalAuditMode
    ) {

        closeAuditOverlay();
    }


    console.log(
        "HOST AUDIT: DIGITAL AUDIT REQUESTS CLEARED"
    );
}


// =========================================================
// CLEAR PHYSICAL AUDIT REQUESTS
// =========================================================

function clearPhysicalAuditRequests() {

    const list =
        getAuditListElement();


    if (!list) {

        return;
    }


    const physicalButtons =
        list.querySelectorAll(
            '[data-audit-type="physical"]'
        );


    physicalButtons.forEach(
        function(button) {

            button.remove();

        }
    );


    /*
    Only close the overlay if the currently displayed
    audit is physical.
    */

    if (
        isPhysicalAuditMode
    ) {

        closeAuditOverlay();
    }


    console.log(
        "HOST AUDIT: PHYSICAL AUDIT REQUESTS CLEARED"
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

window.clearPhysicalAuditRequests =
    clearPhysicalAuditRequests;

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

            activeAuditType:
                isPhysicalAuditMode
                    ? "physical"
                    : "digital",

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
// DEBUG - SHOW CURRENT AUDIT REQUESTS
// =========================================================

window.getHostAuditRequests =
    function() {

        const list =
            getAuditListElement();


        if (!list) {

            return [];
        }


        const buttons =
            list.querySelectorAll(
                "[data-audit-type]"
            );


        return [
            ...buttons
        ].map(
            function(button) {

                return {

                    cardId:
                        Number(
                            button.dataset.card
                        ),

                    auditType:
                        button.dataset.auditType,

                    auditKey:
                        button.dataset.auditKey,

                    text:
                        button.textContent

                };

            }
        );

    };


// =========================================================
// START
// =========================================================

initializeHostAudit();


console.log(
    "================================================="
);

console.log(
    "HOST DIGITAL + PHYSICAL AUDIT MODULE READY"
);

console.log(
    "DIGITAL AND PHYSICAL AUDITS ARE ISOLATED"
);

console.log(
    "================================================="
);
