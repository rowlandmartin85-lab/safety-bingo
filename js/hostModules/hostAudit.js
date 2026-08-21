"use strict";

/*
=========================================================
HOST DIGITAL + PHYSICAL AUDIT SYSTEM
=========================================================

DIGITAL COLOR RULES

GREEN  = PLAYER MARKED + HOST CALLED
RED    = PLAYER MARKED + HOST DID NOT CALL
YELLOW = HOST CALLED + PLAYER DID NOT MARK
CLEAR  = HOST DID NOT CALL + PLAYER DID NOT MARK

FREE SPACE = GREEN

PHYSICAL

GREEN = HOST CALLED
CLEAR = HOST DID NOT CALL

IMPORTANT
---------
Digital and Physical audits are COMPLETELY INDEPENDENT.

Digital Card #25 must NEVER remove Physical Card #25.
Physical Card #25 must NEVER remove Digital Card #25.

Rejecting a Bingo claim does NOT disable the player.

=========================================================
*/

console.log("=================================================");
console.log("HOST AUDIT: CORRECTED MODULE LOADING");
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
                "================================================="
            );

            console.log(
                "HOST AUDIT: DIGITAL BINGO REQUEST"
            );

            console.log(
                "HOST AUDIT: DIGITAL REQUEST DATA:",
                data
            );

            console.log(
                "================================================="
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
    // QUESTION / HOST CALL EVENTS
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

                /*
                Do not process Bingo-result events twice.
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
        item.question?.question_id,
        item.question?.id,
        item.question?.key,
        item.question?.number,

        item.questionData?.questionId,
        item.questionData?.questionID,
        item.questionData?.question_id,
        item.questionData?.id,
        item.questionData?.key,
        item.questionData?.number,

        item.currentQuestion?.questionId,
        item.currentQuestion?.questionID,
        item.currentQuestion?.id

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

        item.questionText,

        item.question?.answer,
        item.question?.answerText,
        item.question?.correctAnswer,
        item.question?.value,
        item.question?.text,
        item.question?.label,

        item.questionData?.answer,
        item.questionData?.answerText,
        item.questionData?.correctAnswer,
        item.questionData?.value,
        item.questionData?.text,
        item.questionData?.label

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


        /*
        The nested calls above refresh the grid.
        Return here to avoid unnecessary duplicate work.
        */

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
                    item !== data &&
                    typeof item === "object"
                ) {

                    rememberCalledQuestion(
                        item
                    );
                }
            }
        );


        /*
        CRITICAL FIX:

        If an audit is currently open, immediately repaint
        the audit after the host calls a question.
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

        data.card,

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
// AUDIT KEY
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
            "HOST AUDIT: INVALID DIGITAL CARD ID",
            data
        );

        return;
    }


    /*
    CRITICAL:

    Only remove an existing DIGITAL request.

    Physical Card #25 is untouched.
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
        "HOST AUDIT: DIGITAL BUTTON CREATED",
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
            "HOST AUDIT: INVALID PHYSICAL CARD ID",
            data
        );

        return;
    }


    /*
    Only remove an existing PHYSICAL request.

    Digital Card #25 is untouched.
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
        "HOST AUDIT: PHYSICAL BUTTON CREATED",
        cardId
    );
}


// =========================================================
// CARD CELLS
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
    Some generators return the cells directly.
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


    /*
    Standard claim formats.
    */

    const sources = [

        activeAuditData.markedIndices,
        activeAuditData.markedindices,

        activeAuditData.selectedIndices,

        activeAuditData.markedCells,
        activeAuditData.selectedCells,

        activeAuditData.marks,

        activeAuditData.marked,
        activeAuditData.selected,

        activeAuditData.checkedIndices,

        activeAuditData.card?.markedIndices,
        activeAuditData.card?.selectedIndices,

        activeAuditData.cardData?.markedIndices,
        activeAuditData.cardData?.selectedIndices

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
                        Number(
                            value.trim()
                        );
                }


                else if (
                    value &&
                    typeof value === "object"
                ) {

                    index =
                        value.index ??
                        value.cellIndex ??
                        value.position ??
                        value.cell ??
                        value.squareIndex;
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
        If markedIndices exists, it is authoritative.
        */

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


    /*
    If the claim contains an authoritative markedIndices
    array, do not fall back to the generated card's state.
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


    /*
    Cell-level marking fallback.

    This helps if the digital Bingo claim sends the marks
    directly on each cell rather than as markedIndices.
    */

    return (

        cell.isMarked === true ||
        cell.marked === true ||
        cell.selected === true ||
        cell.checked === true ||
        cell.isSelected === true ||
        cell.playerMarked === true

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
        extractAnswerFromItem(
            cell
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
    Preserve the entire Bingo claim.

    This is essential for digital marks.
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
            "HOST AUDIT: INVALID CARD",
            activeAuditData
        );

        return;
    }


    activeAuditData.cardId =
        cardId;


    activeAuditData.auditType =
        isPhysicalAuditMode
            ? "physical"
            : "digital";


    /*
    Debug the exact digital claim.

    This is especially important for diagnosing
    player-mark data.
    */

    if (!isPhysicalAuditMode) {

        console.log(
            "================================================="
        );

        console.log(
            "HOST AUDIT: DIGITAL CLAIM DATA"
        );

        console.log(
            activeAuditData
        );

        console.log(
            "HOST AUDIT: MARKED INDICES FOUND",
            getMarkedIndices()
        );

        console.log(
            "================================================="
        );
    }


    /*
    Generate the deterministic card.
    */

    try {

        activeAuditCard =
            window.generateCard(
                cardId
            );

    }
    catch (error) {

        console.error(
            "HOST AUDIT: generateCard FAILED",
            error
        );

        return;
    }


    if (!activeAuditCard) {

        console.error(
            "HOST AUDIT: generateCard RETURNED NOTHING"
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
            "HOST AUDIT: AUDIT GRID NOT FOUND"
        );

        return;
    }


    if (!activeAuditCard) {

        console.error(
            "HOST AUDIT: NO ACTIVE AUDIT CARD"
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
            "HOST AUDIT: CARD HAS NO CELLS",
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
        [
            ...auditCalledQuestionIds
        ]
    );

    console.log(
        "CALLED ANSWERS:",
        [
            ...auditCalledAnswers
        ]
    );

    console.log(
        "PLAYER MARKED INDICES:",
        [
            ...markedIndices
        ]
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

            Standard 5x5 Bingo free space is index 12.
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

            Physical cards do not have player digital marks.
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
            CELL TEXT
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
            COLOR LOGIC
            =================================================
            */

            let color;


            // -------------------------------------------------
            // FREE
            // -------------------------------------------------

            if (free) {

                color =
                    "green";

                box.classList.add(
                    "correct",
                    "free"
                );
            }


            // -------------------------------------------------
            // PHYSICAL
            // -------------------------------------------------

            else if (
                isPhysicalAuditMode
            ) {

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


            // -------------------------------------------------
            // DIGITAL: MARKED + CALLED
            // -------------------------------------------------

            else if (
                marked &&
                called
            ) {

                color =
                    "green";

                box.classList.add(
                    "correct"
                );
            }


            // -------------------------------------------------
            // DIGITAL: MARKED + NOT CALLED
            // -------------------------------------------------

            else if (
                marked &&
                !called
            ) {

                color =
                    "red";

                box.classList.add(
                    "wrong"
                );
            }


            // -------------------------------------------------
            // DIGITAL: NOT MARKED + CALLED
            // -------------------------------------------------

            else if (
                !marked &&
                called
            ) {

                color =
                    "yellow";

                box.classList.add(
                    "missed"
                );
            }


            // -------------------------------------------------
            // DIGITAL: NOT MARKED + NOT CALLED
            // -------------------------------------------------

            else {

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
            "HOST AUDIT: APPROVE - INVALID CARD"
        );

        return;
    }


    if (!window.hostSocket) {

        console.error(
            "HOST AUDIT: SOCKET UNAVAILABLE"
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
    Remove ONLY the audit that was approved.
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
            "HOST AUDIT: REJECT - INVALID CARD"
        );

        return;
    }


    if (!window.hostSocket) {

        console.error(
            "HOST AUDIT: SOCKET UNAVAILABLE"
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

    Rejecting the Bingo claim does NOT disable
    the player.

    We only remove the audit request.
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
            "HOST AUDIT: FINISH - INVALID CARD",
            data
        );

        return;
    }


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
    ONLY remove the correct audit type.
    */

    removeAuditButton(
        cardId,
        normalizedType
    );


    /*
    ONLY close the currently open audit if BOTH
    card number AND audit type match.
    */

    if (
        activeAuditData &&
        Number(
            activeAuditData.cardId
        ) === cardId &&
        activeAuditData.auditType ===
            normalizedType
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
    NEVER remove a request without an explicit type.

    This is deliberate. It prevents digital/physical
    cross-contamination.
    */

    if (
        auditType !== "digital" &&
        auditType !== "physical"
    ) {

        console.error(
            "HOST AUDIT: REFUSING TO REMOVE AUDIT WITHOUT TYPE",
            {
                cardId,
                auditType
            }
        );

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

            if (
                button.dataset.auditType ===
                auditType
            ) {

                button.remove();
            }
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
// MANUAL CARD INPUT
// =========================================================

function getManualCardInput() {

    /*
    Current HTML:
        #checkerCardID

    Older HTML:
        #cardLookupInput
        #checkCardInput
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
            "HOST AUDIT: CARD LOOKUP INPUT MISSING"
        );

        console.error(
            "HOST AUDIT: EXPECTED #checkerCardID"
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
// CLEAR DIGITAL REQUESTS ONLY
// =========================================================

function clearDigitalAuditRequests() {

    const list =
        getAuditListElement();


    if (!list) {

        return;
    }


    /*
    CRITICAL:

    Never use list.innerHTML = "" here.

    That would destroy physical requests too.
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
    Only close a DIGITAL overlay.

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
// CLEAR PHYSICAL REQUESTS ONLY
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
    Only close a PHYSICAL overlay.
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


        // -------------------------------------------------
        // MANUAL CHECK
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
                ],

            markedIndices:
                [
                    ...getMarkedIndices()
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
// DEBUG - CURRENT REQUESTS
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
// DEBUG - DIGITAL CLAIM
// =========================================================

window.getHostDigitalAuditClaim =
    function() {

        if (
            !activeAuditData ||
            isPhysicalAuditMode
        ) {

            return null;
        }


        return {

            cardId:
                activeAuditData.cardId,

            auditType:
                activeAuditData.auditType,

            markedIndices:
                [
                    ...getMarkedIndices()
                ],

            data:
                activeAuditData
        };
    };


// =========================================================
// START
// =========================================================

initializeHostAudit();


console.log(
    "================================================="
);

console.log(
    "HOST AUDIT: CORRECTED MODULE READY"
);

console.log(
    "DIGITAL + PHYSICAL AUDITS ARE ISOLATED"
);

console.log(
    "REJECTED PLAYERS REMAIN ACTIVE"
);

console.log(
    "================================================="
);
