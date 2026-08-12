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
let checkerSocketReady = false;

// =====================================================
// SAFE NUMBER
// =====================================================

function normalizeCardID(value) {
const number = Number(value);

```
if (!Number.isInteger(number) || number <= 0) {
    return null;
}

return number;
```

}

// =====================================================
// NORMALIZE VALUE
// =====================================================

function normalizeValue(value) {
if (value === null || value === undefined) {
return "";
}

```
return String(value)
    .trim()
    .toLowerCase();
```

}

// =====================================================
// INITIALIZE CHECKER
// =====================================================

function initializeHostChecker() {

```
console.log("INITIALIZING HOST CHECKER");

if (!window.hostUI) {

    console.error(
        "HOST CHECKER: hostUI is not available."
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

// =================================================
// SOCKET
// =================================================

setupCheckerSocket();

// =================================================
// INITIAL STATE
// =================================================

hideCheckerOverlay();

console.log("HOST CHECKER READY");
```

}

// =====================================================
// SOCKET SETUP
// =====================================================

function setupCheckerSocket() {

```
if (!window.hostSocket) {

    console.warn(
        "HOST CHECKER: hostSocket is not available yet."
    );

    return;
}

if (checkerSocketReady) {
    return;
}

checkerSocketReady = true;

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
            Array.isArray(state.calledAnswers)
                ? state.calledAnswers.slice()
                : [];

        window.hostState = state;

        // If an audit is currently open,
        // refresh its colors.

        if (
            checkerCard &&
            hostUI &&
            hostUI.auditOverlay &&
            hostUI.auditOverlay.classList.contains("show")
        ) {

            renderCheckerCard();
        }
    }
);

// =================================================
// PHYSICAL QR CLAIM
// =================================================

window.hostSocket.on(
    "physicalWinRequested",
    function (data) {

        console.log(
            "PHYSICAL BINGO CLAIM RECEIVED:",
            data
        );

        if (!data) {
            return;
        }

        const cardID =
            normalizeCardID(
                data.cardId ??
                data.cardID ??
                data.card
            );

        if (!cardID) {

            console.error(
                "INVALID PHYSICAL CLAIM CARD ID:",
                data
            );

            return;
        }

        // Put the card number into the checker.

        if (hostUI.checkerCardID) {

            hostUI.checkerCardID.value =
                cardID;
        }

        // Automatically check the card.

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
            "PHYSICAL WIN APPROVED:",
            data
        );

        if (!data) {
            return;
        }

        const winnerNumber =
            data.winnerNumber ??
            data.winnerCount ??
            1;

        const totalRequired =
            data.totalRequired ??
            data.winLimit ??
            1;

        if (hostUI.auditTitle) {

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
            "PHYSICAL WIN REJECTED:",
            data
        );

        if (
            data &&
            data.message &&
            hostUI.auditTitle
        ) {

            hostUI.auditTitle.textContent =
                String(data.message);
        }
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
        "checkerCardID element not found."
    );

    return;
}

const cardID =
    normalizeCardID(input.value);

if (!cardID) {

    alert(
        "Please enter a valid Card ID."
    );

    input.focus();

    return;
}

// =================================================
// CARD GENERATOR CHECK
// =================================================

if (
    typeof window.generateCard !==
    "function"
) {

    console.error(
        "HOST CHECKER: generateCard() is missing."
    );

    alert(
        "Card Generator unavailable."
    );

    return;
}

// =================================================
// GENERATE CARD
// =================================================

let generatedCard;

try {

    generatedCard =
        window.generateCard(cardID);

} catch (error) {

    console.error(
        "ERROR GENERATING CARD:",
        error
    );

    alert(
        "Unable to generate card #" +
        cardID +
        "."
    );

    return;
}

if (!generatedCard) {

    console.error(
        "generateCard() returned no card."
    );

    alert(
        "Unable to generate card #" +
        cardID +
        "."
    );

    return;
}

checkerCard =
    generatedCard;

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
if (!window.hostUI) {
    return;
}

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

    const cardNumber =
        currentCardID ||
        "";

    hostUI.auditTitle.textContent =
        "PHYSICAL CARD AUDIT #" +
        cardNumber;
}
```

}

// =====================================================
// GET CARD CELLS
// =====================================================

function getCheckerCells(card) {

```
if (!card) {
    return [];
}

// Standard object format.

if (Array.isArray(card.grid)) {
    return flattenCells(card.grid);
}

if (Array.isArray(card.cells)) {
    return flattenCells(card.cells);
}

// Some generators return rows directly.

if (Array.isArray(card)) {
    return flattenCells(card);
}

return [];
```

}

// =====================================================
// FLATTEN CARD CELLS
// =====================================================

function flattenCells(value) {

```
if (!Array.isArray(value)) {
    return [];
}

const result = [];

value.forEach(function (item) {

    if (Array.isArray(item)) {

        item.forEach(function (nestedItem) {
            result.push(nestedItem);
        });

    } else {

        result.push(item);
    }
});

return result;
```

}

// =====================================================
// GET CELL TEXT
// =====================================================

function getCellText(cell) {

```
if (cell === null || cell === undefined) {
    return "";
}

if (
    typeof cell ===
    "string"
) {
    return cell;
}

if (
    typeof cell ===
    "number"
) {
    return String(cell);
}

return (
    cell.text ??
    cell.questionText ??
    cell.answer ??
    cell.question ??
    cell.label ??
    ""
);
```

}

// =====================================================
// GET CELL IDENTIFIERS
// =====================================================

function getCellIdentifiers(cell) {

```
if (
    !cell ||
    typeof cell !== "object"
) {
    return [];
}

return [

    cell.questionId,
    cell.questionID,
    cell.id,
    cell.answer,
    cell.text,
    cell.questionText

]
    .filter(
        function (value) {
            return (
                value !== null &&
                value !== undefined &&
                String(value).trim() !== ""
            );
        }
    )
    .map(
        normalizeValue
    );
```

}

// =====================================================
// CHECK FREE SPACE
// =====================================================

function isFreeSpace(cell, cellText) {

```
if (
    cell &&
    typeof cell === "object"
) {

    if (
        cell.isFreeSpace === true ||
        cell.isFree === true
    ) {
        return true;
    }

    if (
        normalizeValue(
            cell.type
        ) === "free"
    ) {
        return true;
    }
}

const normalized =
    normalizeValue(cellText);

return (
    normalized === "free" ||
    normalized === "free space" ||
    normalized === "free-space"
);
```

}

// =====================================================
// CHECK WHETHER CELL WAS CALLED
// =====================================================

function cellWasCalled(
cell,
cellText,
normalizedCalled
) {

```
const identifiers = [
    normalizeValue(cellText)
];

getCellIdentifiers(cell)
    .forEach(
        function (identifier) {

            if (
                identifier &&
                !identifiers.includes(
                    identifier
                )
            ) {

                identifiers.push(
                    identifier
                );
            }
        }
    );

return identifiers.some(
    function (identifier) {

        return (
            identifier &&
            normalizedCalled.has(
                identifier
            )
        );
    }
);
```

}

// =====================================================
// RENDER PHYSICAL CARD
// =====================================================

function renderCheckerCard() {

```
if (!window.hostUI) {
    return;
}

if (!hostUI.auditGrid) {

    console.error(
        "auditCardDisplay element not found."
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
        window.hostState.calledAnswers.slice();

} else if (
    Array.isArray(
        window.calledAnswers
    )
) {

    calledAnswers =
        window.calledAnswers.slice();
}

const normalizedCalled =
    new Set(
        calledAnswers
            .map(
                normalizeValue
            )
            .filter(
                Boolean
            )
    );

// =================================================
// GET CARD CELLS
// =================================================

const cellsToRender =
    getCheckerCells(
        checkerCard
    );

if (!cellsToRender.length) {

    const emptyMessage =
        document.createElement(
            "div"
        );

    emptyMessage.className =
        "audit-empty";

    emptyMessage.textContent =
        "No card cells were found.";

    hostUI.auditGrid.appendChild(
        emptyMessage
    );

    console.error(
        "CARD CHECKER: No card cells found.",
        checkerCard
    );

    return;
}

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

        const cellText =
            getCellText(cell);

        box.textContent =
            cellText;

        const freeSpace =
            isFreeSpace(
                cell,
                cellText
            );

        const wasCalled =
            cellWasCalled(
                cell,
                cellText,
                normalizedCalled
            );

        // =================================================
        // FREE SPACE
        // =================================================

        if (freeSpace) {

            box.classList.add(
                "free",
                "correct"
            );

            box.dataset.status =
                "free";
        }

        // =================================================
        // CALLED
        // =================================================

        else if (wasCalled) {

            box.classList.add(
                "correct"
            );

            box.dataset.status =
                "called";
        }

        // =================================================
        // NOT CALLED
        // =================================================

        else {

            box.classList.add(
                "clear"
            );

            box.dataset.status =
                "not-called";
        }

        box.dataset.index =
            String(index);

        hostUI.auditGrid.appendChild(
            box
        );
    }
);
```

}

// =====================================================
// GET CURRENT CARD ID
// =====================================================

function getCurrentCheckerCardID() {

```
if (checkerCard) {

    const generatedID =
        checkerCard.id ??
        checkerCard.cardId ??
        checkerCard.cardID;

    const normalizedGeneratedID =
        normalizeCardID(
            generatedID
        );

    if (normalizedGeneratedID) {
        return normalizedGeneratedID;
    }
}

return normalizeCardID(
    currentCardID
);
```

}

// =====================================================
// APPROVE PHYSICAL BINGO
// =====================================================

function approvePhysicalBingo() {

```
const cardID =
    getCurrentCheckerCardID();

if (!cardID) {

    console.warn(
        "No valid physical checker card loaded."
    );

    alert(
        "No valid card is loaded."
    );

    return;
}

if (
    !window.hostSocket ||
    typeof window.hostSocket.emit !==
    "function"
) {

    console.error(
        "HOST SOCKET NOT AVAILABLE."
    );

    alert(
        "Host connection is unavailable."
    );

    return;
}

console.log(
    "PHYSICAL BINGO APPROVED:",
    cardID
);

window.hostSocket.emit(
    "approvePhysicalWin",
    {
        cardId: cardID
    }
);

closeCheckerOverlay();
```

}

// =====================================================
// REJECT PHYSICAL BINGO
// =====================================================

function rejectPhysicalBingo() {

```
const cardID =
    getCurrentCheckerCardID();

if (!cardID) {

    console.warn(
        "No valid physical checker card loaded."
    );

    alert(
        "No valid card is loaded."
    );

    return;
}

if (
    !window.hostSocket ||
    typeof window.hostSocket.emit !==
    "function"
) {

    console.error(
        "HOST SOCKET NOT AVAILABLE."
    );

    alert(
        "Host connection is unavailable."
    );

    return;
}

console.log(
    "PHYSICAL BINGO REJECTED:",
    cardID
);

window.hostSocket.emit(
    "rejectPhysicalWin",
    {
        cardId: cardID
    }
);

closeCheckerOverlay();
```

}

// =====================================================
// CLOSE CHECKER OVERLAY
// =====================================================

function closeCheckerOverlay() {

```
hideCheckerOverlay();

if (
    window.hostUI &&
    hostUI.auditGrid
) {

    hostUI.auditGrid.innerHTML =
        "";
}

if (
    window.hostUI &&
    hostUI.auditTitle
) {

    hostUI.auditTitle.textContent =
        "CARD AUDIT";
}

if (
    window.hostUI &&
    hostUI.checkerCardID
) {

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
// RECEIVE SCANNED CARD
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

    const normalizedID =
        normalizeCardID(
            cardID
        );

    if (!normalizedID) {

        console.error(
            "INVALID SCANNED CARD ID:",
            cardID
        );

        return;
    }

    if (!window.hostUI) {

        console.error(
            "HOST UI unavailable."
        );

        return;
    }

    if (!hostUI.checkerCardID) {

        console.error(
            "checkerCardID input unavailable."
        );

        return;
    }

    hostUI.checkerCardID.value =
        normalizedID;

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

window.hideCheckerOverlay =
hideCheckerOverlay;

window.renderCheckerCard =
renderCheckerCard;

window.setupCheckerSocket =
setupCheckerSocket;

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

    } else {

        console.warn(
            "HOST CHECKER: hostUI is not ready yet."
        );
    }
}
```

);

console.log(
"HOST CHECKER MODULE READY"
);
