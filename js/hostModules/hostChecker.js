"use strict";

/*
===========================================================
SAFETY BINGO
PHYSICAL CARD CHECKER
===========================================================
IMPORTANT:
- Uses the ACTUAL HTML IDs from host.html
- Uses #auditCardDisplay
- Does not require hostUI.auditGrid
- Does not depend on digital card checking
- Does not overwrite digital win requests until a physical
  card is actually requested
===========================================================
*/

console.log("HOST CHECKER MODULE LOADED");


/*
===========================================================
STATE
===========================================================
*/

let checkerCard = null;
let currentCardID = null;
let calledAnswers = [];

let checkerInitialized = false;


/*
===========================================================
GET ELEMENTS DIRECTLY

We use the real HTML IDs rather than assuming hostUI
contains every element.
===========================================================
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

        display:
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
===========================================================
INITIALIZE
===========================================================
*/

function initializeHostChecker() {

    if (checkerInitialized) {

        return;

    }

    console.log(
        "INITIALIZING HOST CHECKER"
    );


    const el =
        getCheckerElements();


    if (!el.cardID) {

        console.error(
            "Physical checker: #checkerCardID not found."
        );

    }


    if (!el.checkButton) {

        console.error(
            "Physical checker: #checkCardBtn not found."
        );

    }


    if (!el.overlay) {

        console.error(
            "Physical checker: #auditOverlay not found."
        );

    }


    if (!el.display) {

        console.error(
            "Physical checker: #auditCardDisplay not found."
        );

    }


    /*
    -------------------------------------------------------
    CHECK CARD BUTTON
    -------------------------------------------------------
    */

    if (el.checkButton) {

        el.checkButton.addEventListener(
            "click",
            checkPhysicalCard
        );

    }


    /*
    -------------------------------------------------------
    ENTER KEY
    -------------------------------------------------------
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
    -------------------------------------------------------
    APPROVE
    -------------------------------------------------------
    */

    if (el.approve) {

        el.approve.addEventListener(
            "click",
            approvePhysicalBingo
        );

    }


    /*
    -------------------------------------------------------
    REJECT
    -------------------------------------------------------
    */

    if (el.reject) {

        el.reject.addEventListener(
            "click",
            rejectPhysicalBingo
        );

    }


    /*
    -------------------------------------------------------
    SOCKET
    -------------------------------------------------------
    */

    setupCheckerSocket();


    /*
    -------------------------------------------------------
    HIDE OVERLAY INITIALLY
    -------------------------------------------------------
    */

    hideCheckerOverlay();


    checkerInitialized =
        true;


    console.log(
        "HOST CHECKER READY"
    );

}


/*
===========================================================
SOCKET
===========================================================
*/

function setupCheckerSocket() {

    if (
        !window.hostSocket
    ) {

        console.warn(
            "HOST SOCKET NOT AVAILABLE YET."
        );

        return;

    }


    /*
    -------------------------------------------------------
    GAME STATE
    -------------------------------------------------------
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


            /*
            If a physical card is currently being displayed,
            refresh its colors when a new question is called.
            */

            if (
                checkerCard &&
                currentCardID !== null
            ) {

                renderCheckerCard();

            }

        }
    );


    /*
    -------------------------------------------------------
    PHYSICAL APPROVAL
    -------------------------------------------------------
    */

    window.hostSocket.on(
        "physicalWinApproved",
        data => {

            console.log(
                "PHYSICAL APPROVAL RECEIVED:",
                data
            );


            const el =
                getCheckerElements();


            if (
                el.title
            ) {

                const winnerCount =
                    data &&
                    data.winnerCount
                        ? data.winnerCount
                        : "";


                if (winnerCount) {

                    el.title.textContent =
                        "PHYSICAL CARD #" +
                        (
                            data.cardId ||
                            currentCardID ||
                            ""
                        ) +
                        " APPROVED — WINNER #" +
                        winnerCount;

                } else {

                    el.title.textContent =
                        "PHYSICAL CARD APPROVED";

                }

            }

        }
    );


    /*
    -------------------------------------------------------
    PHYSICAL REJECTION
    -------------------------------------------------------
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
===========================================================
CHECK PHYSICAL CARD
===========================================================
*/

function checkPhysicalCard() {

    const el =
        getCheckerElements();


    if (!el.cardID) {

        console.error(
            "Cannot check card: #checkerCardID missing."
        );

        return;

    }


    const rawValue =
        String(
            el.cardID.value
        ).trim();


    if (
        rawValue === ""
    ) {

        alert(
            "Please enter a valid Card ID."
        );

        el.cardID.focus();

        return;

    }


    const cardID =
        Number(
            rawValue
        );


    if (
        !Number.isInteger(
            cardID
        ) ||
        cardID <= 0
    ) {

        alert(
            "Please enter a valid Card ID."
        );

        el.cardID.focus();

        return;

    }


    /*
    -------------------------------------------------------
    CARD GENERATOR
    -------------------------------------------------------
    */

    if (
        typeof window.generateCard !==
        "function"
    ) {

        console.error(
            "generateCard() is not available."
        );

        alert(
            "Card Generator unavailable."
        );

        return;

    }


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


    if (!generatedCard) {

        alert(
            "Unable to generate card #" +
            cardID
        );

        return;

    }


    /*
    -------------------------------------------------------
    STORE CARD
    -------------------------------------------------------
    */

    checkerCard =
        generatedCard;

    currentCardID =
        cardID;


    console.log(
        "PHYSICAL CARD LOADED:",
        cardID,
        generatedCard
    );


    /*
    -------------------------------------------------------
    OPEN AND RENDER
    -------------------------------------------------------
    */

    openCheckerOverlay();

    renderCheckerCard();

}


/*
===========================================================
OPEN OVERLAY
===========================================================
*/

function openCheckerOverlay() {

    const el =
        getCheckerElements();


    if (!el.overlay) {

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
===========================================================
RENDER PHYSICAL CARD
===========================================================
*/

function renderCheckerCard() {

    const el =
        getCheckerElements();


    if (!el.display) {

        console.error(
            "Cannot render physical card: " +
            "#auditCardDisplay not found."
        );

        return;

    }


    if (!checkerCard) {

        return;

    }


    /*
    -------------------------------------------------------
    GET CURRENT CALLED ANSWERS
    -------------------------------------------------------
    */

    if (
        window.hostState &&
        Array.isArray(
            window.hostState.calledAnswers
        )
    ) {

        calledAnswers =
            [
                ...window.hostState.calledAnswers
            ];

    }
    else if (
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
    else if (
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
    -------------------------------------------------------
    NORMALIZE CALLED ANSWERS
    -------------------------------------------------------
    */

    const normalizedCalled =
        calledAnswers.map(
            answer =>
                String(
                    answer
                )
                .trim()
                .toLowerCase()
        );


    /*
    -------------------------------------------------------
    GET CARD CELLS

    Supports several possible card-generator formats.
    -------------------------------------------------------
    */

    let cells =
        [];


    if (
        Array.isArray(
            checkerCard.grid
        )
    ) {

        cells =
            checkerCard.grid;

    }
    else if (
        Array.isArray(
            checkerCard.cells
        )
    ) {

        cells =
            checkerCard.cells;

    }
    else if (
        Array.isArray(
            checkerCard.card
        )
    ) {

        cells =
            checkerCard.card;

    }


    if (
        cells.length === 0
    ) {

        console.error(
            "Physical card contains no cells:",
            checkerCard
        );

        el.display.innerHTML =
            "<p>Unable to display this card.</p>";

        return;

    }


    /*
    -------------------------------------------------------
    CLEAR OLD CARD
    -------------------------------------------------------
    */

    el.display.innerHTML =
        "";


    /*
    -------------------------------------------------------
    CREATE GRID
    -------------------------------------------------------
    */

    const grid =
        document.createElement(
            "div"
        );


    grid.className =
        "physical-audit-grid";


    /*
    -------------------------------------------------------
    FORCE 5 x 5
    -------------------------------------------------------
    */

    grid.style.display =
        "grid";

    grid.style.gridTemplateColumns =
        "repeat(5, minmax(0, 1fr))";

    grid.style.gap =
        "6px";

    grid.style.width =
        "100%";


    /*
    -------------------------------------------------------
    CREATE CELLS
    -------------------------------------------------------
    */

    cells.forEach(
        (cell, index) => {

            const box =
                document.createElement(
                    "div"
                );


            box.className =
                "audit-cell";


            /*
            -----------------------------------------------
            GET TEXT
            -----------------------------------------------
            */

            const text =
                cell &&
                (
                    cell.text ??
                    cell.questionText ??
                    cell.answer ??
                    cell.value ??
                    ""
                );


            box.textContent =
                String(
                    text
                );


            /*
            -----------------------------------------------
            FREE SPACE
            -----------------------------------------------
            */

            const normalizedText =
                String(
                    text
                )
                .trim()
                .toLowerCase();


            const isFree =
                !!(
                    cell &&
                    (
                        cell.isFreeSpace === true ||
                        cell.isFree === true
                    )
                ) ||
                normalizedText ===
                    "free" ||
                normalizedText ===
                    "free space";


            /*
            -----------------------------------------------
            QUESTION ID
            -----------------------------------------------
            */

            const questionId =
                cell &&
                (
                    cell.questionId ??
                    cell.questionID ??
                    cell.id ??
                    null
                );


            /*
            -----------------------------------------------
            WAS CALLED?
            -----------------------------------------------
            */

            let wasCalled =
                false;


            if (
                normalizedCalled.includes(
                    normalizedText
                )
            ) {

                wasCalled =
                    true;

            }


            if (
                questionId !== null &&
                questionId !== undefined
            ) {

                const normalizedID =
                    String(
                        questionId
                    )
                    .trim()
                    .toLowerCase();


                if (
                    normalizedCalled.includes(
                        normalizedID
                    )
                ) {

                    wasCalled =
                        true;

                }

            }


            /*
            -----------------------------------------------
            CELL CLASSES
            -----------------------------------------------
            */

            if (
                isFree
            ) {

                box.classList.add(
                    "free",
                    "correct"
                );

            }
            else if (
                wasCalled
            ) {

                box.classList.add(
                    "correct"
                );

            }
            else {

                box.classList.add(
                    "clear"
                );

            }


            /*
            -----------------------------------------------
            DATA FOR DEBUGGING
            -----------------------------------------------
            */

            box.dataset.index =
                index;


            if (
                questionId !== null &&
                questionId !== undefined
            ) {

                box.dataset.questionId =
                    questionId;

            }


            grid.appendChild(
                box
            );

        }
    );


    el.display.appendChild(
        grid
    );


    /*
    -------------------------------------------------------
    CARD ID LABEL
    -------------------------------------------------------
    */

    const label =
        document.createElement(
            "div"
        );


    label.className =
        "physical-audit-card-id";


    label.textContent =
        "CARD ID: " +
        currentCardID;


    label.style.textAlign =
        "center";

    label.style.fontWeight =
        "700";

    label.style.marginTop =
        "10px";


    el.display.appendChild(
        label
    );


    console.log(
        "PHYSICAL CARD RENDERED:",
        currentCardID,
        cells.length,
        "cells"
    );

}


/*
===========================================================
APPROVE PHYSICAL BINGO
===========================================================
*/

function approvePhysicalBingo() {

    if (!checkerCard) {

        console.warn(
            "No physical card loaded."
        );

        return;

    }


    const cardID =
        Number(
            checkerCard.id ??
            currentCardID
        );


    if (
        !Number.isInteger(
            cardID
        ) ||
        cardID <= 0
    ) {

        console.error(
            "Invalid physical card ID:",
            cardID
        );

        return;

    }


    console.log(
        "APPROVING PHYSICAL BINGO:",
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

    }
    else {

        console.error(
            "Host socket unavailable."
        );

        alert(
            "Server connection unavailable."
        );

        return;

    }


    closeCheckerOverlay();

}


/*
===========================================================
REJECT PHYSICAL BINGO
===========================================================
*/

function rejectPhysicalBingo() {

    if (!checkerCard) {

        return;

    }


    const cardID =
        Number(
            checkerCard.id ??
            currentCardID
        );


    if (
        !Number.isInteger(
            cardID
        ) ||
        cardID <= 0
    ) {

        return;

    }


    console.log(
        "REJECTING PHYSICAL BINGO:",
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
===========================================================
CLOSE OVERLAY
===========================================================
*/

function closeCheckerOverlay() {

    const el =
        getCheckerElements();


    if (el.overlay) {

        el.overlay.style.display =
            "none";

    }


    if (el.display) {

        el.display.innerHTML =
            "";

    }


    if (el.title) {

        el.title.textContent =
            "CARD AUDIT";

    }


    checkerCard =
        null;

    currentCardID =
        null;


    /*
    DO NOT erase the input automatically.

    This makes it easier to check another physical card.
    */

}


/*
===========================================================
HIDE OVERLAY
===========================================================
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
===========================================================
SCANNER HANDOFF
===========================================================
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
===========================================================
GLOBAL EXPORTS
===========================================================
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


/*
===========================================================
DOM READY
===========================================================
*/

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initializeHostChecker();

    }
);
