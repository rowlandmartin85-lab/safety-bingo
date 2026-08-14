/*
==========================================
SAFETY BINGO
HOST PHYSICAL CARD CHECKER
COMPLETE REBUILD
==========================================
*/

"use strict";

console.log("HOST CHECKER MODULE LOADED");


/*
==========================================
CHECKER STATE
==========================================
*/

let checkerCard = null;
let currentCardID = null;

let calledAnswers = [];
let calledQuestionIds = [];
let calledQuestions = [];


/*
==========================================
INITIALIZE CHECKER
==========================================
*/

function initializeHostChecker() {

    console.log(
        "INITIALIZING HOST CHECKER"
    );


    if (!window.hostUI) {

        console.error(
            "hostUI not available."
        );

        return;

    }


    /*
    ==========================================
    CHECK CARD BUTTON
    ==========================================
    */

    if (
        window.hostUI.checkCardBtn &&
        !window.hostUI.checkCardBtn.dataset
            .checkerBound
    ) {

        window.hostUI.checkCardBtn
            .addEventListener(
                "click",
                checkPhysicalCard
            );

        window.hostUI.checkCardBtn.dataset
            .checkerBound = "true";

    }


    /*
    ==========================================
    CLOSE BUTTON
    ==========================================
    */

    if (
        window.hostUI.closeAuditBtn &&
        !window.hostUI.closeAuditBtn.dataset
            .checkerBound
    ) {

        window.hostUI.closeAuditBtn
            .addEventListener(
                "click",
                closeCheckerOverlay
            );

        window.hostUI.closeAuditBtn.dataset
            .checkerBound = "true";

    }


    /*
    ==========================================
    APPROVE BUTTON
    ==========================================
    */

    if (
        window.hostUI.approveBtn &&
        !window.hostUI.approveBtn.dataset
            .checkerBound
    ) {

        window.hostUI.approveBtn
            .addEventListener(
                "click",
                approvePhysicalBingo
            );

        window.hostUI.approveBtn.dataset
            .checkerBound = "true";

    }


    /*
    ==========================================
    REJECT BUTTON
    ==========================================
    */

    if (
        window.hostUI.rejectBtn &&
        !window.hostUI.rejectBtn.dataset
            .checkerBound
    ) {

        window.hostUI.rejectBtn
            .addEventListener(
                "click",
                rejectPhysicalBingo
            );

        window.hostUI.rejectBtn.dataset
            .checkerBound = "true";

    }


    /*
    ==========================================
    ENTER KEY
    ==========================================
    */

    if (
        window.hostUI.checkerCardID &&
        !window.hostUI.checkerCardID.dataset
            .checkerEnterBound
    ) {

        window.hostUI.checkerCardID
            .addEventListener(
                "keydown",
                event => {

                    if (
                        event.key === "Enter"
                    ) {

                        event.preventDefault();

                        checkPhysicalCard();

                    }

                }
            );

        window.hostUI.checkerCardID.dataset
            .checkerEnterBound = "true";

    }


    /*
    ==========================================
    SOCKET
    ==========================================
    */

    if (window.hostSocket) {

        setupCheckerSocket();

    }


    /*
    ==========================================
    HIDE OVERLAY
    ==========================================
    */

    hideCheckerOverlay();


    console.log(
        "HOST CHECKER READY"
    );

}


/*
==========================================
SOCKET EVENTS
==========================================
*/

let checkerSocketBound = false;


function setupCheckerSocket() {

    if (
        !window.hostSocket
    ) {

        return;

    }


    if (checkerSocketBound) {

        return;

    }


    checkerSocketBound = true;


    /*
    ==========================================
    GAME STATE
    ==========================================
    */

    window.hostSocket.on(
        "gameState",
        state => {

            if (!state) {

                return;

            }


            /*
            ----------------------------------
            KEEP COMPLETE STATE AVAILABLE
            ----------------------------------
            */

            window.hostState =
                state;


            /*
            ----------------------------------
            CALLED ANSWERS
            ----------------------------------
            */

            calledAnswers =
                Array.isArray(
                    state.calledAnswers
                )
                    ? [
                        ...state.calledAnswers
                    ]
                    : [];


            /*
            ----------------------------------
            CALLED QUESTION IDS
            ----------------------------------
            */

            calledQuestionIds =
                Array.isArray(
                    state.calledQuestionIds
                )
                    ? [
                        ...state.calledQuestionIds
                    ]
                    : [];


            /*
            ----------------------------------
            CALLED QUESTIONS
            ----------------------------------
            */

            calledQuestions =
                Array.isArray(
                    state.calledQuestions
                )
                    ? [
                        ...state.calledQuestions
                    ]
                    : [];


            console.log(
                "CHECKER GAME STATE UPDATED:",
                {
                    calledAnswers:
                        calledAnswers,

                    calledQuestionIds:
                        calledQuestionIds,

                    calledQuestions:
                        calledQuestions
                }
            );


            /*
            ----------------------------------
            IF A CARD IS CURRENTLY OPEN,
            REFRESH IT
            ----------------------------------
            */

            if (checkerCard) {

                renderCheckerCard();

            }

        }
    );


    /*
    ==========================================
    PHYSICAL WIN APPROVED
    ==========================================
    */

    window.hostSocket.on(
        "physicalWinApproved",
        data => {

            console.log(
                "PHYSICAL APPROVAL RECEIVED:",
                data
            );


            if (
                window.hostUI &&
                window.hostUI.auditTitle
            ) {

                const winnerCount =
                    data &&
                    data.winnerCount
                        ? data.winnerCount
                        : 1;


                window.hostUI.auditTitle
                    .textContent =
                        "WINNER " +
                        winnerCount +
                        " APPROVED";

            }

        }
    );


    /*
    ==========================================
    PHYSICAL WIN REJECTED
    ==========================================
    */

    window.hostSocket.on(
        "physicalWinRejected",
        data => {

            console.log(
                "PHYSICAL CARD REJECTED:",
                data
            );

        }
    );

}


/*
==========================================
CHECK PHYSICAL CARD
==========================================
*/

function checkPhysicalCard() {

    if (
        !window.hostUI
    ) {

        console.error(
            "hostUI unavailable."
        );

        return;

    }


    const input =
        window.hostUI.checkerCardID;


    if (!input) {

        console.error(
            "checkerCardID input element not found."
        );

        return;

    }


    const rawValue =
        String(
            input.value || ""
        ).trim();


    const cardID =
        Number(
            rawValue
        );


    /*
    ==========================================
    VALIDATE CARD ID
    ==========================================
    */

    if (
        !Number.isInteger(cardID) ||
        cardID <= 0
    ) {

        alert(
            "Please enter a valid Card ID."
        );

        input.focus();

        return;

    }


    /*
    ==========================================
    GENERATOR CHECK
    ==========================================
    */

    if (
        typeof window.generateCard !==
        "function"
    ) {

        console.error(
            "generateCard() missing."
        );

        alert(
            "Card Generator unavailable."
        );

        return;

    }


    /*
    ==========================================
    GENERATE CARD
    ==========================================
    */

    try {

        checkerCard =
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
        !checkerCard
    ) {

        alert(
            "Unable to generate card #" +
            cardID
        );

        return;

    }


    currentCardID =
        cardID;


    console.log(
        "PHYSICAL CARD LOADED:",
        checkerCard
    );


    /*
    ==========================================
    OPEN AND RENDER
    ==========================================
    */

    openCheckerOverlay();

    renderCheckerCard();

}


/*
==========================================
OPEN OVERLAY
==========================================
*/

function openCheckerOverlay() {

    if (
        !window.hostUI ||
        !window.hostUI.auditOverlay
    ) {

        console.error(
            "auditOverlay not found."
        );

        return;

    }


    window.hostUI.auditOverlay.style
        .display = "flex";


    if (
        window.hostUI.auditTitle
    ) {

        window.hostUI.auditTitle
            .textContent =
                "PHYSICAL CARD AUDIT #" +
                currentCardID;

    }

}


/*
==========================================
NORMALIZE
==========================================
*/

function normalizeValue(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";

    }


    return String(value)
        .trim()
        .toLowerCase();

}


/*
==========================================
GET CARD CELLS
==========================================
*/

function getCardCells(card) {

    if (!card) {

        return [];

    }


    if (
        Array.isArray(card.grid)
    ) {

        return card.grid;

    }


    if (
        Array.isArray(card.cells)
    ) {

        return card.cells;

    }


    if (
        Array.isArray(card.squares)
    ) {

        return card.squares;

    }


    return [];

}


/*
==========================================
GET CELL TEXT
==========================================
*/

function getCellText(cell) {

    if (!cell) {

        return "";

    }


    return (
        cell.text ??
        cell.questionText ??
        cell.question ??
        cell.answer ??
        cell.label ??
        ""
    );

}


/*
==========================================
GET QUESTION ID
==========================================
*/

function getCellQuestionID(cell) {

    if (!cell) {

        return null;

    }


    return (
        cell.questionId ??
        cell.questionID ??
        cell.question_id ??
        cell.question?.id ??
        null
    );

}


/*
==========================================
FREE SPACE
==========================================
*/

function isFreeCell(cell) {

    if (!cell) {

        return false;

    }


    const text =
        normalizeValue(
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
==========================================
CHECK WHETHER CELL WAS CALLED
==========================================
*/

function wasCellCalled(cell) {

    if (
        isFreeCell(cell)
    ) {

        return true;

    }


    const cellText =
        normalizeValue(
            getCellText(cell)
        );


    const cellQuestionID =
        getCellQuestionID(cell);


    const cellQuestionIDNorm =
        cellQuestionID !== null &&
        cellQuestionID !== undefined
            ? String(
                cellQuestionID
            ).trim()
            : "";


    /*
    ==========================================
    1. QUESTION ID — BEST MATCH
    ==========================================
    */

    if (
        cellQuestionIDNorm &&
        calledQuestionIds.some(
            id =>
                String(id).trim() ===
                cellQuestionIDNorm
        )
    ) {

        return true;

    }


    /*
    ==========================================
    2. CALLED QUESTIONS BY ID
    ==========================================
    */

    if (
        cellQuestionIDNorm &&
        calledQuestions.some(
            item =>
                item &&
                String(item.id).trim() ===
                cellQuestionIDNorm
        )
    ) {

        return true;

    }


    /*
    ==========================================
    3. QUESTION TEXT
    ==========================================
    */

    if (
        cellText &&
        calledQuestions.some(
            item =>
                item &&
                normalizeValue(
                    item.question
                ) === cellText
        )
    ) {

        return true;

    }


    /*
    ==========================================
    4. ANSWER TEXT
    ==========================================
    */

    if (
        cellText &&
        calledAnswers.some(
            answer =>
                normalizeValue(answer) ===
                cellText
        )
    ) {

        return true;

    }


    return false;

}


/*
==========================================
RENDER CHECKER CARD
==========================================
*/

function renderCheckerCard() {

    if (
        !window.hostUI ||
        !window.hostUI.auditGrid
    ) {

        console.error(
            "auditGrid element not found."
        );

        return;

    }


    if (
        !checkerCard
    ) {

        console.error(
            "No checker card loaded."
        );

        return;

    }


    const grid =
        window.hostUI.auditGrid;


    grid.innerHTML = "";


    /*
    ==========================================
    GET LATEST STATE
    ==========================================
    */

    if (
        window.hostState
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


        if (
            Array.isArray(
                window.hostState.calledQuestions
            )
        ) {

            calledQuestions =
                [
                    ...window.hostState.calledQuestions
                ];

        }

    }


    /*
    ==========================================
    GET CELLS
    ==========================================
    */

    const cells =
        getCardCells(
            checkerCard
        );


    if (
        cells.length === 0
    ) {

        console.error(
            "CARD HAS NO CELLS:",
            checkerCard
        );

        const errorBox =
            document.createElement(
                "div"
            );

        errorBox.className =
            "audit-error";

        errorBox.textContent =
            "Unable to read this card.";

        grid.appendChild(
            errorBox
        );

        return;

    }


    console.log(
        "RENDERING PHYSICAL CARD:",
        {
            cardID:
                currentCardID,

            cells:
                cells.length,

            calledQuestionIds:
                calledQuestionIds,

            calledQuestions:
                calledQuestions,

            calledAnswers:
                calledAnswers
        }
    );


    /*
    ==========================================
    RENDER CELLS
    ==========================================
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


            const questionID =
                getCellQuestionID(
                    cell
                );


            box.textContent =
                text || "";


            /*
            ----------------------------------
            DATA ATTRIBUTES
            ----------------------------------
            */

            box.dataset.index =
                String(index);


            if (
                questionID !== null &&
                questionID !== undefined
            ) {

                box.dataset.questionId =
                    String(questionID);

            }


            /*
            ----------------------------------
            FREE SPACE
            ----------------------------------
            */

            if (
                isFreeCell(cell)
            ) {

                box.classList.add(
                    "free",
                    "correct"
                );

            }


            /*
            ----------------------------------
            CALLED
            ----------------------------------
            */

            else if (
                wasCellCalled(cell)
            ) {

                box.classList.add(
                    "correct"
                );

            }


            /*
            ----------------------------------
            NOT CALLED
            ----------------------------------
            */

            else {

                box.classList.add(
                    "clear"
                );

            }


            grid.appendChild(
                box
            );

        }
    );

}


/*
==========================================
APPROVE PHYSICAL BINGO
==========================================
*/

function approvePhysicalBingo() {

    if (
        !checkerCard
    ) {

        console.warn(
            "No checker card loaded."
        );

        return;

    }


    const cardID =
        Number(
            checkerCard.id ??
            currentCardID
        );


    if (
        !Number.isInteger(cardID) ||
        cardID <= 0
    ) {

        console.error(
            "INVALID PHYSICAL CARD ID:",
            cardID
        );

        return;

    }


    console.log(
        "PHYSICAL BINGO APPROVED:",
        cardID
    );


    if (
        window.hostSocket
    ) {

        window.hostSocket.emit(
            "approvePhysicalWin",
            {
                cardId:
                    cardID
            }
        );

    } else {

        console.error(
            "hostSocket unavailable."
        );

    }


    closeCheckerOverlay();

}


/*
==========================================
REJECT PHYSICAL BINGO
==========================================
*/

function rejectPhysicalBingo() {

    if (
        !checkerCard
    ) {

        return;

    }


    const cardID =
        Number(
            checkerCard.id ??
            currentCardID
        );


    if (
        !Number.isInteger(cardID) ||
        cardID <= 0
    ) {

        console.error(
            "INVALID PHYSICAL CARD ID:",
            cardID
        );

        return;

    }


    console.log(
        "REJECTING PHYSICAL CARD:",
        cardID
    );


    if (
        window.hostSocket
    ) {

        window.hostSocket.emit(
            "rejectPhysicalWin",
            {
                cardId:
                    cardID
            }
        );

    }


    closeCheckerOverlay();

}


/*
==========================================
CLOSE CHECKER
==========================================
*/

function closeCheckerOverlay() {

    hideCheckerOverlay();


    if (
        window.hostUI &&
        window.hostUI.auditGrid
    ) {

        window.hostUI.auditGrid.innerHTML =
            "";

    }


    if (
        window.hostUI &&
        window.hostUI.auditTitle
    ) {

        window.hostUI.auditTitle
            .textContent =
                "CARD AUDIT";

    }


    if (
        window.hostUI &&
        window.hostUI.checkerCardID
    ) {

        window.hostUI.checkerCardID.value =
            "";

        window.hostUI.checkerCardID.focus();

    }


    checkerCard =
        null;

    currentCardID =
        null;

}


/*
==========================================
HIDE OVERLAY
==========================================
*/

function hideCheckerOverlay() {

    if (
        !window.hostUI ||
        !window.hostUI.auditOverlay
    ) {

        return;

    }


    window.hostUI.auditOverlay.style
        .display = "none";

}


/*
==========================================
SCANNER HANDOFF
==========================================
*/

window.receiveScannedCard =
    function(cardID) {

        console.log(
            "SCANNED CARD:",
            cardID
        );


        if (
            window.hostUI &&
            window.hostUI.checkerCardID
        ) {

            window.hostUI.checkerCardID.value =
                cardID;

        }


        checkPhysicalCard();

    };


/*
==========================================
DOM READY
==========================================
*/

document.addEventListener(
    "DOMContentLoaded",
    () => {

        if (
            window.hostUI
        ) {

            initializeHostChecker();

        }

    }
);


/*
==========================================
GLOBAL EXPORTS
==========================================
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
