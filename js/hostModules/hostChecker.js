"use strict";

/*
=========================================================
DIGITAL HOST AUDIT SYSTEM
=========================================================

IMPORTANT
---------
DIGITAL AND PHYSICAL AUDITS ARE COMPLETELY INDEPENDENT.

A digital audit for Card #25 must NEVER interfere with
a physical audit for Card #25.

DIGITAL:
    digital:25

PHYSICAL:
    physical:25

Both may exist at the same time.

COLOR RULES

GREEN  = PLAYER MARKED + HOST CALLED
RED    = PLAYER MARKED + HOST DID NOT CALL
YELLOW = HOST CALLED + PLAYER DID NOT MARK
CLEAR  = HOST DID NOT CALL + PLAYER DID NOT MARK

FREE SPACE = GREEN

Rejecting a Bingo claim does NOT disable the player.

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
=========================================================
IMPORTANT

Digital audit state is kept separate from physical
checker state.

The physical checker has its own:

    checkerCard
    currentCardID
    calledAnswers

The digital audit has its own:

    activeAuditCard
    activeAuditData
    isPhysicalAuditMode

Neither system should clear the other's state.
=========================================================
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
    DIGITAL BINGO REQUEST
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

    IMPORTANT:

    We DO NOT control the physical checker here.

    The physical checker module owns physicalWinRequested.

    This prevents the digital module from creating,
    removing, or replacing physical audit controls.
    =====================================================
    */


    /*
    =====================================================
    DIGITAL APPROVED
    =====================================================
    */

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


    /*
    =====================================================
    DIGITAL REJECTED
    =====================================================
    */

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


    /*
    =====================================================
    QUESTION / READ EVENTS
    =====================================================
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
                NEVER inspect audit approval/rejection
                events as question events.
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
// AUDIT REQUEST KEY
// =========================================================

/*
=========================================================
THIS IS THE IMPORTANT FIX.

Previously:

    Card #25

was treated as the entire identity.

Now:

    digital + 25
    physical + 25

are two completely different requests.
=========================================================
*/

function getAuditRequestKey(
    cardId,
    auditType
) {

    const type =
        auditType === "physical"
            ? "physical"
            : "digital";


    return (
        type +
        ":" +
        String(
            Number(cardId)
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


    /*
    ONLY remove an existing DIGITAL request.

    DO NOT remove a physical request with the same
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


    button.dataset.auditKey =
        getAuditRequestKey(
            cardId,
            "digital"
        );


    button.textContent =
        "AUDIT DIGITAL CARD #" +
        cardId;


    button.addEventListener(
        "click",
        function(event) {

            event.preventDefault();

            event.stopPropagation();

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
// PHYSICAL AUDIT BUTTON
// =========================================================

/*
=========================================================
This function is retained for compatibility if another
part of your application calls it.

It is now completely type-safe.

If your physical checker creates its own physical button,
this function will NOT interfere with it.
=========================================================
*/

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
        getAuditRequestKey(
            cardId,
            "physical"
        );


    button.textContent =
        "AUDIT PHYSICAL CARD #" +
        cardId;


    button.addEventListener(
        "click",
        function(event) {

            event.preventDefault();

            event.stopPropagation();

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


    /*
    IMPORTANT:

    This function is for the digital audit.

    Physical checker normally uses its own:

        checkPhysicalCard()
        openCheckerOverlay()
        renderCheckerCard()

    Therefore we do not let a digital request
    automatically replace physical checker state.
    */

    isPhysicalAuditMode =
        Boolean(
            isPhysical
        );


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

                color =
                    "green";

                box.classList.add(
                    "correct",
                    "free"
                );

            }
            else if (isPhysicalAuditMode) {

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

                color =
                    "yellow";

                box.classList.add(
                    "missed"
                );

            }
            else {

                color =
                    "clear";

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


            grid.appendChild(
                box
            );

        }
    );
}


// =========================================================
// APPROVE DIGITAL AUDIT
// =========================================================

function approveAuditWinner() {

    /*
    Never approve a physical claim from the digital
    audit module.
    */

    if (isPhysicalAuditMode) {

        console.warn(
            "HOST AUDIT: physical approval belongs to the physical checker."
        );

        return;
    }


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
        "HOST AUDIT: APPROVING DIGITAL CARD",
        cardId
    );


    window.hostSocket.emit(
        "approveWin",
        cardId
    );


    removeAuditButton(
        cardId,
        "digital"
    );


    closeDigitalAuditOverlayOnly();
}


// =========================================================
// REJECT DIGITAL AUDIT
// =========================================================

function rejectAuditWinner() {

    /*
    Never reject a physical claim from the digital
    audit module.
    */

    if (isPhysicalAuditMode) {

        console.warn(
            "HOST AUDIT: physical rejection belongs to the physical checker."
        );

        return;
    }


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
        "HOST AUDIT: REJECTING DIGITAL CARD",
        cardId
    );


    window.hostSocket.emit(
        "rejectWin",
        cardId
    );


    /*
    IMPORTANT:

    Rejecting digital Bingo does NOT disable the player.
    */

    removeAuditButton(
        cardId,
        "digital"
    );


    closeDigitalAuditOverlayOnly();


    console.log(
        "HOST AUDIT: DIGITAL CLAIM REJECTED - PLAYER REMAINS ACTIVE",
        cardId
    );
}


// =========================================================
// FINISH REQUEST
// =========================================================

function finishAuditRequest(
    data,
    auditType = "digital"
) {

    const cardId =
        getCardIdFromData(
            data
        );


    if (!cardId) {

        return;
    }


    /*
    ONLY touch the request belonging to THIS audit type.
    */

    removeAuditButton(
        cardId,
        auditType
    );


    /*
    CRITICAL FIX:

    A digital event can ONLY close a digital audit.

    It can NEVER close the physical checker.
    */

    if (
        auditType === "digital" &&
        activeAuditData &&
        !isPhysicalAuditMode &&
        Number(
            activeAuditData.cardId
        ) === cardId
    ) {

        closeDigitalAuditOverlayOnly();
    }
}


// =========================================================
// REMOVE AUDIT BUTTON
// =========================================================

function removeAuditButton(
    cardId,
    auditType = "digital"
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


    const type =
        auditType === "physical"
            ? "physical"
            : "digital";


    /*
    =====================================================
    CRITICAL FIX

    OLD:

        [data-card="25"]

    That removed BOTH digital and physical Card #25.

    NEW:

        [data-card="25"][data-audit-type="digital"]

    or

        [data-card="25"][data-audit-type="physical"]
    =====================================================
    */

    const buttons =
        list.querySelectorAll(
            '[data-card="' +
            numericCardId +
            '"]' +
            '[data-audit-type="' +
            type +
            '"]'
        );


    buttons.forEach(
        function(button) {

            button.remove();

        }
    );
}


// =========================================================
// CLOSE DIGITAL OVERLAY ONLY
// =========================================================

function closeDigitalAuditOverlayOnly() {

    /*
    Save references before clearing state.
    */

    const activeData =
        activeAuditData;


    activeAuditCard =
        null;

    activeAuditData =
        null;

    isPhysicalAuditMode =
        false;


    /*
    IMPORTANT:

    Only hide the audit overlay if it is actually being
    used by the digital audit.

    If the physical checker currently owns it, leave it
    alone.
    */

    if (activeData) {

        /*
        If physical checker state exists, don't destroy it.
        */

        if (
            window.checkerCard ||
            window.currentCardID
        ) {

            console.log(
                "HOST AUDIT: physical checker appears active - leaving overlay alone"
            );

            return;
        }
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
            "none";

        overlay.classList.add(
            "hidden"
        );

        overlay.classList.remove(
            "show"
        );
    }
}


// =========================================================
// DIGITAL CLOSE
// =========================================================

function closeAuditOverlay() {

    /*
    This function remains available for compatibility,
    but it is now DIGITAL ONLY.

    It does NOT clear physical checker variables.
    */

    closeDigitalAuditOverlayOnly();
}


// =========================================================
// MANUAL DIGITAL CARD LOOKUP
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
            "HOST AUDIT: digital card lookup input missing"
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


    openAuditOverlay(
        cardId,
        false
    );
}


// =========================================================
// CLEAR DIGITAL AUDIT REQUESTS
// =========================================================

function clearDigitalAuditRequests() {

    const list =
        getAuditListElement();


    if (list) {

        /*
        ONLY remove digital requests.

        Physical requests remain.
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
    }


    closeDigitalAuditOverlayOnly();
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


    if (
        activeAuditCard &&
        !isPhysicalAuditMode
    ) {

        renderAuditGrid();
    }
}


// =========================================================
// NOTE:
//
// I AM INTENTIONALLY NOT INSTALLING THE OLD
// DOCUMENT-LEVEL APPROVE/REJECT/CLOSE HANDLER.
//
// That handler was another source of interference with
// the physical checker.
//
// Digital buttons already have their own click handlers.
// The physical checker already has hostUI button handlers.
//
// Therefore they should NOT compete at document level.
// =========================================================


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
    closeDigitalAuditOverlayOnly;

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
    "DIGITAL / PHYSICAL AUDITS ARE ISOLATED"
);

console.log(
    "================================================="
);
