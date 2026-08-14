"use strict";

console.log("HOST DIGITAL AUDIT MODULE LOADED");

let digitalAuditCard = null;
let digitalAuditData = null;
let digitalAuditInitialized = false;


// =====================================================
// INITIALIZE
// =====================================================

function initializeHostAudit() {

    console.log("INITIALIZING DIGITAL AUDITOR");

    waitForHostSocket();

}


// =====================================================
// WAIT FOR HOST SOCKET
// =====================================================

function waitForHostSocket() {

    if (!window.hostSocket) {

        console.log("WAITING FOR HOST SOCKET...");

        setTimeout(
            waitForHostSocket,
            500
        );

        return;
    }

    console.log("DIGITAL AUDITOR CONNECTED");

    setupDigitalAuditSocket();

}


// =====================================================
// SOCKET LISTENER
// =====================================================

function setupDigitalAuditSocket() {

    if (digitalAuditInitialized) {

        console.log(
            "DIGITAL AUDIT SOCKET ALREADY INITIALIZED"
        );

        return;
    }

    digitalAuditInitialized = true;

    window.hostSocket.on(
        "winRequested",
        function(data) {

            console.log(
                "========== WIN REQUEST RECEIVED ==========",
                data
            );

            if (!data) {

                console.warn(
                    "WIN REQUEST DATA MISSING"
                );

                return;
            }

            createAuditButton(data);

        }
    );

    console.log(
        "DIGITAL AUDIT SOCKET LISTENER READY"
    );

}


// =====================================================
// CREATE AUDIT BUTTON
// =====================================================

function createAuditButton(data) {

    const list =
        document.getElementById(
            "auditWinnerList"
        );

    if (!list) {

        console.error(
            "Missing auditWinnerList"
        );

        return;
    }

    const cardId =
        Number(data.cardId);

    if (!cardId) {

        console.error(
            "Invalid audit card ID:",
            data
        );

        return;
    }

    const existing =
        list.querySelector(
            '[data-card="' + cardId + '"]'
        );

    if (existing) {

        console.log(
            "Audit request already exists for card:",
            cardId
        );

        return;
    }

    const button =
        document.createElement(
            "button"
        );

    button.className =
        "audit-list-button";

    button.dataset.card =
        cardId;

    button.type =
        "button";

    button.textContent =
        "AUDIT CARD #" + cardId;

    button.onclick =
        function() {

            openDigitalAudit(data);

        };

    list.appendChild(button);

    console.log(
        "AUDIT BUTTON CREATED:",
        cardId
    );

}


// =====================================================
// OPEN DIGITAL AUDIT
// =====================================================

function openDigitalAudit(data) {

    if (
        typeof window.generateCard !==
        "function"
    ) {

        console.error(
            "Card generator missing"
        );

        return;
    }

    const cardId =
        Number(data.cardId);

    if (!cardId) {

        console.error(
            "Invalid card ID"
        );

        return;
    }

    digitalAuditCard =
        window.generateCard(cardId);

    digitalAuditData =
        data;

    if (!digitalAuditCard) {

        console.error(
            "Unable to generate audit card:",
            cardId
        );

        return;
    }

    const overlay =
        document.getElementById(
            "auditOverlay"
        );

    if (overlay) {

        overlay.style.display =
            "flex";

    }

    const title =
        document.getElementById(
            "auditTitle"
        );

    if (title) {

        title.textContent =
            "DIGITAL AUDIT CARD #" +
            cardId;

    }

    renderDigitalAuditCard();

}


// =====================================================
// RENDER DIGITAL AUDIT CARD
// =====================================================

function renderDigitalAuditCard() {

    const grid =
        document.getElementById(
            "auditCardDisplay"
        );

    if (!grid) {

        console.error(
            "Missing auditCardDisplay"
        );

        return;
    }

    if (!digitalAuditCard) {

        return;
    }

    grid.innerHTML = "";

    const auditData =
        digitalAuditData || {};

    // =================================================
    // PLAYER MARKED CELLS
    // =================================================

    let markedIndices = [];

    if (
        Array.isArray(
            auditData.markedIndices
        )
    ) {

        markedIndices =
            auditData.markedIndices;

    }


    // =================================================
    // WINNING PATTERN
    // =================================================

    let winningPattern = [];

    if (
        Array.isArray(
            auditData.winningPattern
        )
    ) {

        winningPattern =
            auditData.winningPattern;

    }


    // =================================================
    // CALLED ANSWERS
    // =================================================

    let calledAnswers = [];

    if (
        window.hostState &&
        Array.isArray(
            window.hostState.calledAnswers
        )
    ) {

        calledAnswers =
            window.hostState.calledAnswers;

    }


    // =================================================
    // BUILD AUDIT CARD
    // =================================================

    digitalAuditCard.grid.forEach(
        function(cell, index) {

            const box =
                document.createElement(
                    "div"
                );

            box.className =
                "audit-cell";

            box.textContent =
                cell.text;


            // =================================================
            // FREE SPACE
            // =================================================

            const isFree =
                cell.isFreeSpace ||
                cell.text === "FREE" ||
                cell.text === "FREE SPACE";


            // =================================================
            // WAS ANSWER CALLED?
            // =================================================

            const called =
                calledAnswers.some(
                    function(answer) {

                        return (
                            String(answer)
                                .trim()
                                .toLowerCase()
                            ===
                            String(cell.text)
                                .trim()
                                .toLowerCase()
                        );

                    }
                );


            // =================================================
            // WAS CELL MARKED BY PLAYER?
            // =================================================

            const marked =
                markedIndices.includes(index);


            // =================================================
            // IS CELL PART OF WINNING PATTERN?
            // =================================================

            const inWinningPattern =
                winningPattern.includes(index);


            // =================================================
            // FREE SPACE
            // GREEN
            // =================================================

            if (isFree) {

                box.classList.add(
                    "audit-correct"
                );

            }


            // =================================================
            // CORRECT
            // PLAYER MARKED A CALLED ANSWER
            // GREEN
            // =================================================

            else if (
                marked &&
                called
            ) {

                box.classList.add(
                    "audit-correct"
                );

            }


            // =================================================
            // WRONG
            // PLAYER MARKED AN ANSWER
            // THAT WAS NOT CALLED
            // RED
            // =================================================

            else if (
                marked &&
                !called
            ) {

                box.classList.add(
                    "audit-wrong"
                );

            }


            // =================================================
            // MISSED
            // WINNING CELL WAS NOT MARKED
            // YELLOW
            // =================================================

            else if (
                inWinningPattern &&
                !marked
            ) {

                box.classList.add(
                    "audit-missed"
                );

            }


            // =================================================
            // ADD CELL TO GRID
            // =================================================

            grid.appendChild(box);

        }
    );

}


// =====================================================
// APPROVE DIGITAL WINNER
// =====================================================

function approveDigitalWinner() {

    if (!digitalAuditCard) {

        console.warn(
            "No digital audit card open"
        );

        return;
    }

    const cardId =
        Number(digitalAuditCard.id);

    console.log(
        "APPROVING DIGITAL WIN:",
        cardId
    );

    if (window.hostSocket) {

        window.hostSocket.emit(
            "approveWin",
            cardId
        );

    }

    removeAuditButton(cardId);

    closeDigitalAudit();

}


// =====================================================
// REJECT DIGITAL WINNER
// =====================================================

function rejectDigitalWinner() {

    if (!digitalAuditCard) {

        console.warn(
            "No digital audit card open"
        );

        return;
    }

    const cardId =
        Number(digitalAuditCard.id);

    console.log(
        "REJECTING DIGITAL WIN:",
        cardId
    );

    if (window.hostSocket) {

        window.hostSocket.emit(
            "rejectWin",
            cardId
        );

    }

    removeAuditButton(cardId);

    closeDigitalAudit();

}


// =====================================================
// REMOVE AUDIT BUTTON
// =====================================================

function removeAuditButton(cardId) {

    const list =
        document.getElementById(
            "auditWinnerList"
        );

    if (!list) {

        return;
    }

    const button =
        list.querySelector(
            '[data-card="' +
            Number(cardId) +
            '"]'
        );

    if (button) {

        button.remove();

    }

}


// =====================================================
// CLOSE DIGITAL AUDIT
// =====================================================

function closeDigitalAudit() {

    digitalAuditCard =
        null;

    digitalAuditData =
        null;

    const overlay =
        document.getElementById(
            "auditOverlay"
        );

    if (overlay) {

        overlay.style.display =
            "none";

    }

}


// =====================================================
// CLEAR ALL AUDIT REQUESTS
// =====================================================

function clearDigitalAuditRequests() {

    const list =
        document.getElementById(
            "auditWinnerList"
        );

    if (list) {

        list.innerHTML =
            "";

    }

    closeDigitalAudit();

}


// =====================================================
// BUTTON CONNECTION
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    function() {

        const approveButton =
            document.getElementById(
                "approvePhysicalWin"
            );

        const rejectButton =
            document.getElementById(
                "rejectPhysicalWin"
            );

        if (approveButton) {

            approveButton.addEventListener(
                "click",
                approveDigitalWinner
            );

        }

        if (rejectButton) {

            rejectButton.addEventListener(
                "click",
                rejectDigitalWinner
            );

        }

    }
);


// =====================================================
// EXPORT
// =====================================================

window.initializeHostAudit =
    initializeHostAudit;

window.approveDigitalWinner =
    approveDigitalWinner;

window.rejectDigitalWinner =
    rejectDigitalWinner;

window.closeDigitalAudit =
    closeDigitalAudit;

window.clearDigitalAuditRequests =
    clearDigitalAuditRequests;


console.log(
    "HOST DIGITAL AUDIT MODULE READY"
);
