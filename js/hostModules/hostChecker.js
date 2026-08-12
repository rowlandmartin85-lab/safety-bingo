"use strict";

console.log("HOST CHECKER MODULE LOADED");

// =====================================================
// CHECKER STATE
// =====================================================

let checkerCard = null;
let currentCardID = null;
let calledAnswers = [];

// =====================================================
// INITIALIZE CHECKER
// =====================================================

function initializeHostChecker() {

    console.log("INITIALIZING HOST CHECKER");

    if (!window.hostUI) {
        console.error("hostUI not available.");
        return;
    }

    // -------------------------------------------------
    // MANUAL CHECK CARD BUTTON
    // -------------------------------------------------

    if (hostUI.checkCardBtn) {

        hostUI.checkCardBtn.addEventListener(
            "click",
            checkPhysicalCard
        );

    }

    // -------------------------------------------------
    // CLOSE AUDIT
    // -------------------------------------------------

    if (hostUI.closeAuditBtn) {

        hostUI.closeAuditBtn.addEventListener(
            "click",
            closeCheckerOverlay
        );

    }

    // -------------------------------------------------
    // APPROVE
    // -------------------------------------------------

    if (hostUI.approveBtn) {

        hostUI.approveBtn.addEventListener(
            "click",
            approvePhysicalBingo
        );

    }

    // -------------------------------------------------
    // REJECT
    // -------------------------------------------------

    if (hostUI.rejectBtn) {

        hostUI.rejectBtn.addEventListener(
            "click",
            rejectPhysicalBingo
        );

    }

    // -------------------------------------------------
    // SOCKET
    // -------------------------------------------------

    if (window.hostSocket) {

        setupCheckerSocket();

    }

    hideCheckerOverlay();

    console.log("HOST CHECKER READY");

}


// =====================================================
// SOCKET EVENTS
// =====================================================

function setupCheckerSocket() {

    if (!window.hostSocket) {
        return;
    }

    // -------------------------------------------------
    // GAME STATE
    // -------------------------------------------------

    window.hostSocket.on(
        "gameState",
        state => {

            if (!state) {
                return;
            }

            calledAnswers =
                Array.isArray(state.calledAnswers)
                    ? state.calledAnswers
                    : [];

        }
    );

    // -------------------------------------------------
    // PHYSICAL QR CLAIM
    // -------------------------------------------------
    //
    // THIS IS THE IMPORTANT NEW PART.
    //
    // Player scans:
    //
    // /physical-claim?card=27
    //
    // Server sends:
    //
    // physicalWinRequested
    //
    // Host Control receives it and
    // automatically opens the physical audit.
    // -------------------------------------------------

    window.hostSocket.on(
        "physicalWinRequested",
        data => {

            console.log(
                "======================================"
            );

            console.log(
                "PHYSICAL BINGO CLAIM RECEIVED"
            );

            console.log(
                "CLAIM DATA:",
                data
            );

            console.log(
                "======================================"
            );

            if (!data) {
                return;
            }

            const cardID =
                Number(data.cardId);

            if (!Number.isInteger(cardID) || cardID <= 0) {

                console.error(
                    "INVALID PHYSICAL CLAIM CARD ID:",
                    data.cardId
                );

                return;
            }

            // Put scanned card number
            // into the Host Control field.

            if (hostUI.checkerCardID) {

                hostUI.checkerCardID.value =
                    cardID;

            }

            // Automatically load the
            // physical Bingo audit.

            checkPhysicalCard();

        }
    );

    // -------------------------------------------------
    // PHYSICAL APPROVED
    // -------------------------------------------------

    window.hostSocket.on(
        "physicalWinApproved",
        data => {

            console.log(
                "PHYSICAL APPROVAL RECEIVED:",
                data
            );

            if (hostUI.auditTitle) {

                hostUI.auditTitle.textContent =
                    "WINNER " +
                    data.winnerNumber +
                    " OF " +
                    data.totalRequired +
                    " APPROVED";

            }

        }
    );

    // -------------------------------------------------
    // PHYSICAL REJECTED
    // -------------------------------------------------

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


// =====================================================
// CHECK PHYSICAL CARD
// =====================================================

function checkPhysicalCard() {

    const input =
        hostUI.checkerCardID;

    if (!input) {

        console.error(
            "checkerCardID input element not found."
        );

        return;

    }

    const cardID =
        Number(
            String(input.value).trim()
        );

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

    // -------------------------------------------------
    // CARD GENERATOR
    // -------------------------------------------------

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

    checkerCard =
        window.generateCard(cardID);

    if (!checkerCard) {

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
        cardID
    );

    openCheckerOverlay();

    renderCheckerCard();

}


// =====================================================
// OPEN AUDIT OVERLAY
// =====================================================

function openCheckerOverlay() {

    if (!hostUI.auditOverlay) {

        console.error(
            "auditOverlay not found."
        );

        return;

    }

    hostUI.auditOverlay.style.display =
        "flex";

    hostUI.auditOverlay.classList.add(
        "show"
    );

    if (hostUI.auditTitle) {

        hostUI.auditTitle.textContent =
            "PHYSICAL BINGO AUDIT #" +
            currentCardID;

    }

}


// =====================================================
// RENDER PHYSICAL CARD
// =====================================================

function renderCheckerCard() {

    if (!hostUI.auditGrid) {

        console.error(
            "auditGrid element not found."
        );

        return;

    }

    hostUI.auditGrid.innerHTML =
        "";

    // -------------------------------------------------
    // SYNC CALLED ANSWERS
    // -------------------------------------------------

    if (
        window.hostState &&
        Array.isArray(
            window.hostState.calledAnswers
        )
    ) {

        calledAnswers =
            window.hostState.calledAnswers;

    }

    else if (
        Array.isArray(
            window.calledAnswers
        )
    ) {

        calledAnswers =
            window.calledAnswers;

    }

    const normalizedCalled =
        calledAnswers.map(
            answer =>
                String(answer)
                    .trim()
                    .toLowerCase()
        );

    const cellsToRender =
        checkerCard.grid ||
        checkerCard.cells ||
        [];

    // -------------------------------------------------
    // RENDER CELLS
    // -------------------------------------------------

    cellsToRender.forEach(
        (cell, index) => {

            const box =
                document.createElement(
                    "div"
                );

            box.className =
                "audit-cell";

            const text =
                cell.text ||
                cell.questionText ||
                "";

            box.textContent =
                text;

            const cellTextNorm =
                String(text)
                    .trim()
                    .toLowerCase();

            const isFree =
                cell.isFreeSpace ||
                cell.isFree ||
                cellTextNorm === "free" ||
                cellTextNorm === "free space";

            const wasCalled =
                normalizedCalled.includes(
                    cellTextNorm
                ) ||
                (
                    cell.questionId &&
                    normalizedCalled.includes(
                        String(
                            cell.questionId
                        ).toLowerCase()
                    )
                );

            // -------------------------------------------------
            // FREE SPACE
            // -------------------------------------------------

            if (isFree) {

                box.classList.add(
                    "free",
                    "correct"
                );

            }

            // -------------------------------------------------
            // CALLED QUESTION
            // -------------------------------------------------

            else if (wasCalled) {

                box.classList.add(
                    "correct"
                );

            }

            // -------------------------------------------------
            // NOT CALLED
            // -------------------------------------------------

            else {

                box.classList.add(
                    "clear"
                );

            }

            hostUI.auditGrid.appendChild(
                box
            );

        }
    );

}


// =====================================================
// APPROVE PHYSICAL BINGO
// =====================================================

function approvePhysicalBingo() {

    if (!checkerCard) {

        console.warn(
            "No checker card loaded."
        );

        return;

    }

    const cardID =
        Number(
            checkerCard.id ||
            currentCardID
        );

    if (!cardID) {

        console.error(
            "No valid physical card ID."
        );

        return;

    }

    console.log(
        "PHYSICAL BINGO APPROVED:",
        cardID
    );

    if (window.hostSocket) {

        window.hostSocket.emit(
            "approvePhysicalWin",
            {
                cardId: cardID
            }
        );

    }

    closeCheckerOverlay();

}


// =====================================================
// REJECT PHYSICAL BINGO
// =====================================================

function rejectPhysicalBingo() {

    if (!checkerCard) {

        console.warn(
            "No checker card loaded."
        );

        return;

    }

    const cardID =
        Number(
            checkerCard.id ||
            currentCardID
        );

    if (!cardID) {
        return;
    }

    console.log(
        "PHYSICAL BINGO REJECTED:",
        cardID
    );

    if (window.hostSocket) {

        window.hostSocket.emit(
            "rejectPhysicalWin",
            {
                cardId: cardID
            }
        );

    }

    closeCheckerOverlay();

}


// =====================================================
// CLOSE AUDIT
// =====================================================

function closeCheckerOverlay() {

    hideCheckerOverlay();

    if (hostUI.auditGrid) {

        hostUI.auditGrid.innerHTML =
            "";

    }

    if (hostUI.auditTitle) {

        hostUI.auditTitle.textContent =
            "CARD AUDIT";

    }

    if (hostUI.checkerCardID) {

        hostUI.checkerCardID.value =
            "";

    }

    checkerCard =
        null;

    currentCardID =
        null;

}


// =====================================================
// HIDE AUDIT
// =====================================================

function hideCheckerOverlay() {

    if (!hostUI.auditOverlay) {
        return;
    }

    hostUI.auditOverlay.style.display =
        "none";

    hostUI.auditOverlay.classList.remove(
        "show"
    );

}


// =====================================================
// SCANNER HANDOFF
// =====================================================

window.receiveScannedCard =
function(cardID) {

    console.log(
        "SCANNED CARD:",
        cardID
    );

    if (hostUI.checkerCardID) {

        hostUI.checkerCardID.value =
            cardID;

    }

    checkPhysicalCard();

};


// =====================================================
// ENTER KEY
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        if (window.hostUI) {

            initializeHostChecker();

        }

        if (
            window.hostUI &&
            hostUI.checkerCardID
        ) {

            hostUI.checkerCardID.addEventListener(
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

    }
);


// =====================================================
// GLOBAL EXPORTS
// =====================================================

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
