"use strict";

/*
=========================================================
SAFETY BINGO - HOST PHYSICAL CARD CHECKER
COMPLETE REBUILD

IMPORTANT:
HTML uses:
    #checkerCardID
    #checkCardBtn
    #auditOverlay
    #auditTitle
    #auditCardDisplay
    #approvePhysicalWin
    #rejectPhysicalWin

This file does NOT depend on hostUI.auditGrid.
=========================================================
*/

console.log("HOST PHYSICAL CARD CHECKER LOADED");


/*
=========================================================
CHECKER STATE
=========================================================
*/

let checkerCard = null;
let currentCardID = null;
let calledAnswers = [];
let calledQuestionIds = [];


/*
=========================================================
ELEMENT HELPERS
=========================================================
*/

function getCheckerElements() {

    return {

        cardID:
            document.getElementById(
                "checkerCardID"
            ),

        checkButton:
            document.getElementById(
                "checkCardBtn"
            ),

        overlay:
            document.getElementById(
                "auditOverlay"
            ),

        title:
            document.getElementById(
                "auditTitle"
            ),

        grid:
            document.getElementById(
                "auditCardDisplay"
            ),

        approve:
            document.getElementById(
                "approvePhysicalWin"
            ),

        reject:
            document.getElementById(
                "rejectPhysicalWin"
            )

    };

}


/*
=========================================================
NORMALIZE TEXT
=========================================================
*/

function normalizeCheckerText(value) {

    return String(
        value === undefined ||
        value === null
            ? ""
            : value
    )
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");

}


/*
=========================================================
GET CURRENT CALLED QUESTIONS
=========================================================
*/

function syncCalledQuestions() {

    calledAnswers = [];
    calledQuestionIds = [];


    /*
    -----------------------------------------------------
    PREFERRED SOURCE:
    window.hostState
    -----------------------------------------------------
    */

    if (
        window.hostState &&
        typeof window.hostState === "object"
    ) {

        if (
            Array.isArray(
                window.hostState.calledAnswers
            )
        ) {

            calledAnswers =
                [
                    ...window.hostState.calledAnswers
                ];

        }


        if (
            Array.isArray(
                window.hostState.calledQuestionIds
            )
        ) {

            calledQuestionIds =
                [
                    ...window.hostState.calledQuestionIds
                ];

        }

    }


    /*
    -----------------------------------------------------
    FALLBACK:
    global window.calledAnswers
    -----------------------------------------------------
    */

    if (
        calledAnswers.length === 0 &&
        Array.isArray(
            window.calledAnswers
        )
    ) {

        calledAnswers =
            [
                ...window.calledAnswers
            ];

    }


    /*
    -----------------------------------------------------
    FALLBACK:
    socket state may have supplied a global state
    -----------------------------------------------------
    */

    if (
        calledAnswers.length === 0 &&
        window.gameState &&
        Array.isArray(
            window.gameState.calledAnswers
        )
    ) {

        calledAnswers =
            [
                ...window.gameState.calledAnswers
            ];

    }


    console.log(
        "PHYSICAL CHECKER CALLED ANSWERS:",
        calledAnswers
    );

    console.log(
        "PHYSICAL CHECKER CALLED QUESTION IDS:",
        calledQuestionIds
    );

}


/*
=========================================================
INITIALIZE
=========================================================
*/

function initializeHostChecker() {

    console.log(
        "INITIALIZING PHYSICAL CARD CHECKER"
    );


    const el =
        getCheckerElements();


    if (!el.cardID) {

        console.error(
            "checkerCardID not found"
        );

    }


    if (!el.checkButton) {

        console.error(
            "checkCardBtn not found"
        );

    }


    if (!el.overlay) {

        console.error(
            "auditOverlay not found"
        );

    }


    if (!el.grid) {

        console.error(
            "auditCardDisplay not found"
        );

    }


    /*
    -----------------------------------------------------
    BUTTON EVENTS
    -----------------------------------------------------
    */

    if (el.checkButton) {

        el.checkButton.addEventListener(
            "click",
            checkPhysicalCard
        );

    }


    if (el.approve) {

        el.approve.addEventListener(
            "click",
            approvePhysicalBingo
        );

    }


    if (el.reject) {

        el.reject.addEventListener(
            "click",
            rejectPhysicalBingo
        );

    }


    /*
    -----------------------------------------------------
    CLOSE OVERLAY

    Clicking outside the audit window closes it.
    -----------------------------------------------------
    */

    if (el.overlay) {

        el.overlay.addEventListener(
            "click",
            event => {

                if (
                    event.target ===
                    el.overlay
                ) {

                    closeCheckerOverlay();

                }

            }
        );

    }


    /*
    -----------------------------------------------------
    ENTER KEY
    -----------------------------------------------------
    */

    if (el.cardID) {

        el.cardID.addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                    "Enter"
                ) {

                    event.preventDefault();

                    checkPhysicalCard();

                }

            }
        );

    }


    /*
    -----------------------------------------------------
    SOCKET
    -----------------------------------------------------
    */

    setupCheckerSocket();


    hideCheckerOverlay();


    console.log(
        "PHYSICAL CARD CHECKER READY"
    );

}


/*
=========================================================
SOCKET EVENTS
=========================================================
*/

function setupCheckerSocket() {

    if (
        !window.hostSocket
    ) {

        console.warn(
            "hostSocket not available when checker initialized"
        );

        return;

    }


    /*
    -----------------------------------------------------
    GAME STATE
    -----------------------------------------------------
    */

    window.hostSocket.on(
        "gameState",
        state => {

            if (!state) {
                return;
            }


            calledAnswers =
                Array.isArray(
                    state.calledAnswers
                )
                    ? [
                        ...state.calledAnswers
                    ]
                    : [];


            calledQuestionIds =
                Array.isArray(
                    state.calledQuestionIds
                )
                    ? [
                        ...state.calledQuestionIds
                    ]
                    : [];


            /*
            ------------------------------------------------
            If a card is currently being displayed,
            refresh its colors automatically.
            ------------------------------------------------
            */

            if (checkerCard) {

                renderCheckerCard();

            }

        }
    );


    /*
    -----------------------------------------------------
    PHYSICAL APPROVAL
    -----------------------------------------------------
    */

    window.hostSocket.on(
        "physicalWinApproved",
        data => {

            console.log(
                "PHYSICAL WIN APPROVED:",
                data
            );


            const el =
                getCheckerElements();


            if (
                el.title &&
                data
            ) {

                el.title.textContent =
                    "CARD #" +
                    (
                        data.cardId ||
                        currentCardID
                    ) +
                    " APPROVED";

            }

        }
    );


    /*
    -----------------------------------------------------
    PHYSICAL REJECTION
    -----------------------------------------------------
    */

    window.hostSocket.on(
        "physicalWinRejected",
        data => {

            console.log(
                "PHYSICAL WIN REJECTED:",
                data
            );

        }
    );

}


/*
=========================================================
CHECK PHYSICAL CARD
=========================================================
*/

function checkPhysicalCard() {

    const el =
        getCheckerElements();


    if (!el.cardID) {

        alert(
            "Card ID input was not found."
        );

        return;

    }


    const rawID =
        String(
            el.cardID.value || ""
        ).trim();


    const cardID =
        Number(
            rawID
        );


    /*
    -----------------------------------------------------
    VALIDATE CARD ID
    -----------------------------------------------------
    */

    if (
        rawID === "" ||
        !Number.isInteger(cardID) ||
        cardID <= 0
    ) {

        alert(
            "Please enter a valid Card ID."
        );

        el.cardID.focus();

        return;

    }


    /*
    -----------------------------------------------------
    CARD GENERATOR REQUIRED
    -----------------------------------------------------
    */

    if (
        typeof window.generateCard !==
        "function"
    ) {

        console.error(
            "window.generateCard() is not available."
        );


        alert(
            "Card Generator unavailable."
        );

        return;

    }


    console.log(
        "GENERATING PHYSICAL CARD:",
        cardID
    );


    let generatedCard;


    try {

        generatedCard =
            window.generateCard(
                cardID
            );

    } catch (error) {

        console.error(
            "CARD GENERATION ERROR:",
            error
        );


        alert(
            "Unable to generate card #" +
            cardID
        );

        return;

    }


    if (
        !generatedCard
    ) {

        alert(
            "Unable to generate card #" +
            cardID
        );

        return;

    }


    checkerCard =
        generatedCard;

    currentCardID =
        cardID;


    console.log(
        "PHYSICAL CARD GENERATED:",
        checkerCard
    );


    /*
    -----------------------------------------------------
    GET CURRENT CALLED QUESTIONS
    -----------------------------------------------------
    */

    syncCalledQuestions();


    /*
    -----------------------------------------------------
    OPEN AUDIT
    -----------------------------------------------------
    */

    openCheckerOverlay();


    /*
    -----------------------------------------------------
    RENDER
    -----------------------------------------------------
    */

    renderCheckerCard();

}


/*
=========================================================
OPEN AUDIT OVERLAY
=========================================================
*/

function openCheckerOverlay() {

    const el =
        getCheckerElements();


    if (!el.overlay) {

        console.error(
            "auditOverlay not found"
        );

        return;

    }


    el.overlay.style.display =
        "flex";


    if (el.title) {

        el.title.textContent =
            "PHYSICAL CARD AUDIT #" +
            currentCardID;

    }

}


/*
=========================================================
GET CARD CELLS
=========================================================
*/

function getCardCells(card) {

    if (!card) {
        return [];
    }


    if (
        Array.isArray(
            card.grid
        )
    ) {

        return card.grid;

    }


    if (
        Array.isArray(
            card.cells
        )
    ) {

        return card.cells;

    }


    if (
        Array.isArray(
            card.card
        )
    ) {

        return card.card;

    }


    return [];

}


/*
=========================================================
GET CELL TEXT
=========================================================
*/

function getCellText(cell) {

    if (!cell) {
        return "";
    }


    return (

        cell.text ??

        cell.questionText ??

        cell.question ??

        cell.label ??

        cell.answer ??

        ""

    );

}


/*
=========================================================
GET CELL ANSWER
=========================================================
*/

function getCellAnswer(cell) {

    if (!cell) {
        return "";
    }


    return (

        cell.answer ??

        cell.a ??

        cell.correctAnswer ??

        cell.answerText ??

        ""

    );

}


/*
=========================================================
GET CELL QUESTION ID
=========================================================
*/

function getCellQuestionID(cell) {

    if (!cell) {
        return null;
    }


    const id =

        cell.questionId ??

        cell.questionID ??

        cell.question_id ??

        cell.id ??

        null;


    if (
        id === null ||
        id === undefined ||
        id === ""
    ) {

        return null;

    }


    return Number(id);

}


/*
=========================================================
FREE SPACE DETECTION
=========================================================
*/

function isFreeCell(cell) {

    if (!cell) {
        return false;
    }


    const text =
        normalizeCheckerText(
            getCellText(cell)
        );


    return (

        cell.isFreeSpace === true ||

        cell.isFree === true ||

        text === "free" ||

        text === "free space"

    );

}


/*
=========================================================
WAS CELL CALLED?
=========================================================
*/

function wasCellCalled(cell) {

    if (
        isFreeCell(cell)
    ) {

        return true;

    }


    /*
    -----------------------------------------------------
    CHECK QUESTION ID
    -----------------------------------------------------
    */

    const questionID =
        getCellQuestionID(
            cell
        );


    if (
        questionID !== null
    ) {

        const foundID =
            calledQuestionIds.some(
                id =>
                    Number(id) ===
                    questionID
            );


        if (foundID) {

            return true;

        }

    }


    /*
    -----------------------------------------------------
    CHECK ANSWER
    -----------------------------------------------------
    */

    const answer =
        normalizeCheckerText(
            getCellAnswer(cell)
        );


    if (
        answer !== ""
    ) {

        const foundAnswer =
            calledAnswers.some(
                called =>
                    normalizeCheckerText(
                        called
                    ) ===
                    answer
            );


        if (foundAnswer) {

            return true;

        }

    }


    /*
    -----------------------------------------------------
    CHECK CELL TEXT

    This is a fallback for cards where the card text
    itself is the answer.
    -----------------------------------------------------
    */

    const text =
        normalizeCheckerText(
            getCellText(cell)
        );


    if (
        text !== ""
    ) {

        const foundText =
            calledAnswers.some(
                called =>
                    normalizeCheckerText(
                        called
                    ) ===
                    text
            );


        if (foundText) {

            return true;

        }

    }


    return false;

}


/*
=========================================================
RENDER PHYSICAL CARD
=========================================================
*/

function renderCheckerCard() {

    const el =
        getCheckerElements();


    if (!el.grid) {

        console.error(
            "auditCardDisplay not found."
        );

        return;

    }


    /*
    -----------------------------------------------------
    CLEAR OLD CARD
    -----------------------------------------------------
    */

    el.grid.innerHTML =
        "";


    /*
    -----------------------------------------------------
    SYNC STATE
    -----------------------------------------------------
    */

    syncCalledQuestions();


    /*
    -----------------------------------------------------
    GET CELLS
    -----------------------------------------------------
    */

    const cells =
        getCardCells(
            checkerCard
        );


    if (
        cells.length === 0
    ) {

        console.error(
            "No cells found in generated card:",
            checkerCard
        );


        const errorBox =
            document.createElement(
                "div"
            );


        errorBox.style.color =
            "red";

        errorBox.style.padding =
            "20px";

        errorBox.textContent =
            "This card could not be rendered. Card generator returned no cells.";


        el.grid.appendChild(
            errorBox
        );


        return;

    }


    console.log(
        "RENDERING",
        cells.length,
        "CARD CELLS"
    );


    /*
    -----------------------------------------------------
    RENDER EVERY CELL
    -----------------------------------------------------
    */

    cells.forEach(
        (cell, index) => {

            const box =
                document.createElement(
                    "div"
                );


            box.className =
                "audit-cell";


            const text =
                getCellText(
                    cell
                );


            box.textContent =
                text;


            const free =
                isFreeCell(
                    cell
                );


            const called =
                wasCellCalled(
                    cell
                );


            /*
            ------------------------------------------------
            STORE DEBUG INFORMATION
            ------------------------------------------------
            */

            box.dataset.index =
                index;


            const questionID =
                getCellQuestionID(
                    cell
                );


            if (
                questionID !== null
            ) {

                box.dataset.questionId =
                    questionID;

            }


            /*
            ------------------------------------------------
            FREE SPACE
            ------------------------------------------------
            */

            if (free) {

                box.classList.add(
                    "free",
                    "correct"
                );

            }


            /*
            ------------------------------------------------
            CALLED QUESTION
            ------------------------------------------------
            */

            else if (called) {

                box.classList.add(
                    "correct"
                );

            }


            /*
            ------------------------------------------------
            NOT CALLED
            ------------------------------------------------
            */

            else {

                box.classList.add(
                    "clear"
                );

            }


            /*
            ------------------------------------------------
            DEBUG LOG
            ------------------------------------------------
            */

            console.log(
                "CHECKER CELL",
                index,
                {
                    text:
                        text,

                    answer:
                        getCellAnswer(cell),

                    questionID:
                        questionID,

                    free:
                        free,

                    called:
                        called
                }
            );


            el.grid.appendChild(
                box
            );

        }
    );

}


/*
=========================================================
APPROVE PHYSICAL BINGO
=========================================================
*/

function approvePhysicalBingo() {

    if (!checkerCard) {

        console.warn(
            "No physical card loaded."
        );

        return;

    }


    const cardId =
        Number(
            checkerCard.id ??
            currentCardID
        );


    if (
        !Number.isInteger(cardId) ||
        cardId <= 0
    ) {

        console.error(
            "Invalid physical card ID:",
            cardId
        );

        return;

    }


    console.log(
        "APPROVING PHYSICAL CARD:",
        cardId
    );


    if (
        !window.hostSocket
    ) {

        alert(
            "Host socket is not connected."
        );

        return;

    }


    window.hostSocket.emit(
        "approvePhysicalWin",
        {
            cardId:
                cardId
        }
    );


    /*
    -----------------------------------------------------
    DO NOT immediately destroy checker state.

    Server will send physicalWinApproved.
    -----------------------------------------------------
    */

}


/*
=========================================================
REJECT PHYSICAL BINGO
=========================================================
*/

function rejectPhysicalBingo() {

    if (!checkerCard) {

        return;

    }


    const cardId =
        Number(
            checkerCard.id ??
            currentCardID
        );


    if (
        !Number.isInteger(cardId) ||
        cardId <= 0
    ) {

        return;

    }


    console.log(
        "REJECTING PHYSICAL CARD:",
        cardId
    );


    if (
        window.hostSocket
    ) {

        window.hostSocket.emit(
            "rejectPhysicalWin",
            {
                cardId:
                    cardId
            }
        );

    }


    closeCheckerOverlay();

}


/*
=========================================================
CLOSE CHECKER
=========================================================
*/

function closeCheckerOverlay() {

    const el =
        getCheckerElements();


    if (el.overlay) {

        el.overlay.style.display =
            "none";

    }


    if (el.grid) {

        el.grid.innerHTML =
            "";

    }


    if (el.title) {

        el.title.textContent =
            "CARD AUDIT";

    }


    if (el.cardID) {

        el.cardID.value =
            "";

    }


    checkerCard =
        null;

    currentCardID =
        null;

}


/*
=========================================================
HIDE CHECKER
=========================================================
*/

function hideCheckerOverlay() {

    const el =
        getCheckerElements();


    if (el.overlay) {

        el.overlay.style.display =
            "none";

    }

}


/*
=========================================================
SCANNER HANDOFF
=========================================================
*/

window.receiveScannedCard =
    function(cardID) {

        console.log(
            "SCANNED CARD:",
            cardID
        );


        const el =
            getCheckerElements();


        if (el.cardID) {

            el.cardID.value =
                cardID;

        }


        checkPhysicalCard();

    };


/*
=========================================================
GLOBAL EXPORTS
=========================================================
*/

window.initializeHostChecker =
    initializeHostChecker;

window.checkPhysicalCard =
    checkPhysicalCard;

window.approvePhysicalBingo =
    approvePhysicalBingo;

window.rejectPhysicalBingo =
    rejectPhysicalBingo;

window.closeCheckerOverlay =
    closeCheckerOverlay;

window.renderCheckerCard =
    renderCheckerCard;


/*
=========================================================
DOM READY
=========================================================
*/

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initializeHostChecker();

    }
);
