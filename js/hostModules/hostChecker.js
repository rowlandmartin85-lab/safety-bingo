"use strict";

// =====================================================
// SAFETY BINGO - HOST PHYSICAL CARD CHECKER
// =====================================================
// Handles:
//
// 1. Manual Card ID entry
// 2. Physical QR claims
// 3. Physical card audit
// 4. Approve / Reject
// 5. Host socket communication
//
// DIGITAL AUDIT:
//     audit.js
//
// PHYSICAL AUDIT:
//     hostChecker.js
//
// QR ENDPOINT:
//     /physical-claim?card=27
// =====================================================

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

```
console.log("INITIALIZING HOST CHECKER");

if (!window.hostUI) {

    console.error(
        "HOST CHECKER: hostUI not available."
    );

    return;
}


// =================================================
// CHECK CARD BUTTON
// =================================================

if (hostUI.checkCardBtn) {

    if (
        hostUI.checkCardBtn.dataset.checkerReady !==
        "true"
    ) {

        hostUI.checkCardBtn.dataset.checkerReady =
            "true";

        hostUI.checkCardBtn.addEventListener(
            "click",
            checkPhysicalCard
        );

    }

}


// =================================================
// CLOSE AUDIT
// =================================================

if (hostUI.closeAuditBtn) {

    if (
        hostUI.closeAuditBtn.dataset.checkerReady !==
        "true"
    ) {

        hostUI.closeAuditBtn.dataset.checkerReady =
            "true";

        hostUI.closeAuditBtn.addEventListener(
            "click",
            closeCheckerOverlay
        );

    }

}


// =================================================
// APPROVE
// =================================================

if (hostUI.approveBtn) {

    if (
        hostUI.approveBtn.dataset.checkerReady !==
        "true"
    ) {

        hostUI.approveBtn.dataset.checkerReady =
            "true";

        hostUI.approveBtn.addEventListener(
            "click",
            approvePhysicalBingo
        );

    }

}


// =================================================
// REJECT
// =================================================

if (hostUI.rejectBtn) {

    if (
        hostUI.rejectBtn.dataset.checkerReady !==
        "true"
    ) {

        hostUI.rejectBtn.dataset.checkerReady =
            "true";

        hostUI.rejectBtn.addEventListener(
            "click",
            rejectPhysicalBingo
        );

    }

}


// =================================================
// SOCKET
// =================================================

if (window.hostSocket) {

    setupCheckerSocket();

}


// =================================================
// ENTER KEY
// =================================================

if (hostUI.checkerCardID) {

    if (
        hostUI.checkerCardID.dataset.enterReady !==
        "true"
    ) {

        hostUI.checkerCardID.dataset.enterReady =
            "true";

        hostUI.checkerCardID.addEventListener(
            "keydown",
            function (event) {

                if (event.key === "Enter") {

                    event.preventDefault();

                    checkPhysicalCard();

                }

            }
        );

    }

}


hideCheckerOverlay();


console.log(
    "HOST CHECKER READY"
);
```

}

// =====================================================
// SOCKET EVENTS
// =====================================================

function setupCheckerSocket() {

```
if (!window.hostSocket) {

    console.error(
        "HOST CHECKER: hostSocket unavailable."
    );

    return;
}


console.log(
    "HOST CHECKER SOCKET LISTENERS READY"
);


// =================================================
// GAME STATE
// =================================================

window.hostSocket.on(
    "gameState",
    function (state) {

        if (!state) {
            return;
        }


        calledAnswers =
            Array.isArray(
                state.calledAnswers
            )
                ? state.calledAnswers
                : [];


        window.hostState = state;

    }
);


// =================================================
// PHYSICAL QR CLAIM
// =================================================

window.hostSocket.on(
    "physicalWinRequested",
    function (data) {

        console.log(
            "=========================================="
        );

        console.log(
            "PHYSICAL BINGO CLAIM RECEIVED:",
            data
        );

        console.log(
            "=========================================="
        );


        if (!data) {
            return;
        }


        const cardID =
            Number(
                data.cardId
            );


        if (
            !Number.isInteger(cardID) ||
            cardID <= 0
        ) {

            console.error(
                "INVALID PHYSICAL CLAIM CARD ID:",
                data.cardId
            );

            return;
        }


        // -----------------------------------------
        // PUT CARD ID INTO HOST CHECKER
        // -----------------------------------------

        if (hostUI.checkerCardID) {

            hostUI.checkerCardID.value =
                cardID;

        }


        // -----------------------------------------
        // AUTOMATICALLY OPEN PHYSICAL AUDIT
        // -----------------------------------------

        checkPhysicalCard();

    }
);


// =================================================
// PHYSICAL WIN APPROVED
// =================================================

window.hostSocket.on(
    "physicalWinApproved",
    function (data) {

        console.log(
            "PHYSICAL APPROVAL RECEIVED:",
            data
        );


        if (!data) {
            return;
        }


        if (hostUI.auditTitle) {

            const winnerNumber =
                data.winnerNumber ||
                data.winnerCount ||
                1;


            const totalRequired =
                data.totalRequired ||
                1;


            hostUI.auditTitle.textContent =
                "WINNER " +
                winnerNumber +
                " OF " +
                totalRequired +
                " APPROVED";

        }

    }
);


// =================================================
// PHYSICAL WIN REJECTED
// =================================================

window.hostSocket.on(
    "physicalWinRejected",
    function (data) {

        console.log(
            "PHYSICAL REJECTION RECEIVED:",
            data
        );

    }
);
```

}

// =====================================================
// CHECK PHYSICAL CARD
// =====================================================

function checkPhysicalCard() {

```
if (!window.hostUI) {

    console.error(
        "HOST CHECKER: hostUI unavailable."
    );

    return;
}


const input =
    hostUI.checkerCardID;


if (!input) {

    console.error(
        "checkerCardID input element not found."
    );

    return;
}


const rawValue =
    String(
        input.value
    ).trim();


const cardID =
    Number(
        rawValue
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


// =================================================
// CARD GENERATOR
// =================================================

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


// =================================================
// GENERATE CARD
// =================================================

checkerCard =
    window.generateCard(
        cardID
    );


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


// =================================================
// OPEN AUDIT
// =================================================

openCheckerOverlay();


// =================================================
// RENDER CARD
// =================================================

renderCheckerCard();
```

}

// =====================================================
// OPEN PHYSICAL AUDIT
// =====================================================

function openCheckerOverlay() {

```
if (!hostUI.auditOverlay) {

    console.error(
        "auditOverlay element not found."
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
        "PHYSICAL CARD AUDIT #" +
        currentCardID;

}
```

}

// =====================================================
// RENDER PHYSICAL CARD
// =====================================================

function renderCheckerCard() {

```
if (!hostUI.auditGrid) {

    console.error(
        "auditGrid element not found."
    );

    return;
}


if (!checkerCard) {

    console.error(
        "No checker card available."
    );

    return;
}


hostUI.auditGrid.innerHTML =
    "";


// =================================================
// SYNC CALLED ANSWERS
// =================================================

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
        function (answer) {

            return String(
                answer
            )
                .trim()
                .toLowerCase();

        }
    );


// =================================================
// GET CARD CELLS
// =================================================

const cellsToRender =
    checkerCard.grid ||
    checkerCard.cells ||
    [];


// =================================================
// RENDER EACH CELL
// =================================================

cellsToRender.forEach(
    function (cell, index) {

        const box =
            document.createElement(
                "div"
            );


        box.className =
            "audit-cell";


        // -----------------------------------------
        // CELL TEXT
        // -----------------------------------------

        const cellText =
            cell &&
            (
                cell.text ||
                cell.questionText ||
                ""
            );


        box.textContent =
            cellText;


        // -----------------------------------------
        // NORMALIZED TEXT
        // -----------------------------------------

        const cellTextNorm =
            String(
                cellText
            )
                .trim()
                .toLowerCase();


        // -----------------------------------------
        // FREE SPACE
        // -----------------------------------------

        const isFree =
            Boolean(
                cell &&
                (
                    cell.isFreeSpace ||
                    cell.isFree
                )
            ) ||
            cellTextNorm === "free" ||
            cellTextNorm === "free space";


        // -----------------------------------------
        // QUESTION CALLED
        // -----------------------------------------

        const wasCalled =
            normalizedCalled.includes(
                cellTextNorm
            ) ||
            (
                cell &&
                cell.questionId &&
                normalizedCalled.includes(
                    String(
                        cell.questionId
                    )
                        .trim()
                        .toLowerCase()
                )
            );


        // -----------------------------------------
        // FREE SPACE = GREEN
        // -----------------------------------------

        if (isFree) {

            box.classList.add(
                "free",
                "correct"
            );

        }


        // -----------------------------------------
        // CALLED ANSWER = GREEN
        // -----------------------------------------

        else if (wasCalled) {

            box.classList.add(
                "correct"
            );

        }


        // -----------------------------------------
        // NOT CALLED = CLEAR
        // -----------------------------------------

        else {

            box.classList.add(
                "clear"
            );

        }


        // -----------------------------------------
        // STORE INDEX
        // -----------------------------------------

        box.dataset.index =
            index;


        hostUI.auditGrid.appendChild(
            box
        );

    }
);
```

}

// =====================================================
// APPROVE PHYSICAL BINGO
// =====================================================

function approvePhysicalBingo() {

```
if (!checkerCard) {

    console.warn(
        "No physical checker card loaded."
    );

    return;
}


const cardID =
    Number(
        checkerCard.id ||
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


// =================================================
// SEND TO SERVER
// =================================================

if (
    window.hostSocket &&
    typeof window.hostSocket.emit ===
    "function"
) {

    window.hostSocket.emit(
        "approvePhysicalWin",
        {
            cardId: cardID
        }
    );

}
else {

    console.error(
        "HOST SOCKET NOT AVAILABLE."
    );

    return;
}


closeCheckerOverlay();
```

}

// =====================================================
// REJECT PHYSICAL BINGO
// =====================================================

function rejectPhysicalBingo() {

```
if (!checkerCard) {

    console.warn(
        "No physical checker card loaded."
    );

    return;
}


const cardID =
    Number(
        checkerCard.id ||
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
    "PHYSICAL BINGO REJECTED:",
    cardID
);


// =================================================
// SEND TO SERVER
// =================================================

if (
    window.hostSocket &&
    typeof window.hostSocket.emit ===
    "function"
) {

    window.hostSocket.emit(
        "rejectPhysicalWin",
        {
            cardId: cardID
        }
    );

}
else {

    console.error(
        "HOST SOCKET NOT AVAILABLE."
    );

    return;
}


closeCheckerOverlay();
```

}

// =====================================================
// CLOSE CHECKER OVERLAY
// =====================================================

function closeCheckerOverlay() {

```
hideCheckerOverlay();


// =================================================
// CLEAR CARD
// =================================================

if (hostUI.auditGrid) {

    hostUI.auditGrid.innerHTML =
        "";

}


// =================================================
// RESET TITLE
// =================================================

if (hostUI.auditTitle) {

    hostUI.auditTitle.textContent =
        "CARD AUDIT";

}


// =================================================
// CLEAR INPUT
// =================================================

if (hostUI.checkerCardID) {

    hostUI.checkerCardID.value =
        "";

}


checkerCard =
    null;


currentCardID =
    null;
```

}

// =====================================================
// HIDE CHECKER OVERLAY
// =====================================================

function hideCheckerOverlay() {

```
if (!window.hostUI) {
    return;
}


if (!hostUI.auditOverlay) {
    return;
}


hostUI.auditOverlay.style.display =
    "none";


hostUI.auditOverlay.classList.remove(
    "show"
);
```

}

// =====================================================
// SCAN HANDOFF
// =====================================================
// Allows a QR scanner or another Host Control
// component to send a Card ID directly here.
//
// Example:
//
// window.receiveScannedCard(27);
// =====================================================

window.receiveScannedCard =
function (cardID) {

```
    console.log(
        "SCANNED CARD:",
        cardID
    );


    if (!window.hostUI) {
        return;
    }


    if (!hostUI.checkerCardID) {
        return;
    }


    hostUI.checkerCardID.value =
        cardID;


    checkPhysicalCard();

};
```

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

window.openCheckerOverlay =
openCheckerOverlay;

window.renderCheckerCard =
renderCheckerCard;

// =====================================================
// DOM READY
// =====================================================

document.addEventListener(
"DOMContentLoaded",
function () {

```
    console.log(
        "HOST CHECKER DOM READY"
    );


    if (
        window.hostUI &&
        typeof window.initializeHostChecker ===
        "function"
    ) {

        initializeHostChecker();

    }

}
```

);

console.log(
"HOST CHECKER MODULE READY"
);
