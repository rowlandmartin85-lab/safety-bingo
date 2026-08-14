"use strict";

// =====================================================
// SAFETY BINGO PLAYER.JS
// SERVER-AUTHORITATIVE PLAYER CLIENT
// =====================================================
//
// Works with the provided server.js.
//
// Required Socket.IO:
//     <script src="/socket.io/socket.io.js"></script>
//
// Expected player card:
//     25 cells, indexes 0-24
//
// Center cell:
//     index 12 = FREE
//
// =====================================================


// =====================================================
// SOCKET CONNECTION
// =====================================================

const socket = io();


// =====================================================
// PLAYER STATE
// =====================================================

const playerState = {

    cardId: null,

    loaded: false,

    connected: false,

    markedIndices: new Set([12]),

    pendingClaim: false,

    claimApproved: false,

    gameRunning: false,

    gameEnded: false,

    currentQuestion: "",

    currentQuestionNumber: null,

    currentCategory: "",

    currentDifficulty: "",

    currentAnswer: "",

    timerSeconds: 0,

    isPaused: false,

    maxWinners: 1,

    approvedWinnersCount: 0,

    approvedWinnersList: [],

    lastWinningPattern: [],

    selectedCells: new Set()

};


// =====================================================
// WINNING PATTERNS
// =====================================================

const winningPatterns = [

    // Rows

    [0, 1, 2, 3, 4],

    [5, 6, 7, 8, 9],

    [10, 11, 12, 13, 14],

    [15, 16, 17, 18, 19],

    [20, 21, 22, 23, 24],

    // Columns

    [0, 5, 10, 15, 20],

    [1, 6, 11, 16, 21],

    [2, 7, 12, 17, 22],

    [3, 8, 13, 18, 23],

    [4, 9, 14, 19, 24],

    // Diagonals

    [0, 6, 12, 18, 24],

    [4, 8, 12, 16, 20]

];


// =====================================================
// DOM HELPERS
// =====================================================

function getElement(...ids) {

    for (const id of ids) {

        const element =
            document.getElementById(id);

        if (element) {
            return element;
        }
    }

    return null;
}


function querySelectorSafe(selector) {

    try {

        return document.querySelector(selector);

    } catch (error) {

        return null;
    }
}


function querySelectorAllSafe(selector) {

    try {

        return [
            ...document.querySelectorAll(selector)
        ];

    } catch (error) {

        return [];
    }
}


// =====================================================
// COMMON DOM ELEMENTS
// =====================================================

let cardContainer = null;

let cardIdInput = null;

let loadCardButton = null;

let claimButton = null;

let statusElement = null;

let timerElement = null;

let questionElement = null;

let questionNumberElement = null;

let categoryElement = null;

let difficultyElement = null;

let winnerElement = null;

let connectionElement = null;

let gameStatusElement = null;

let auditElement = null;


// =====================================================
// INITIALIZE DOM REFERENCES
// =====================================================

function initializeDOM() {

    cardContainer =
        getElement(
            "bingoCard",
            "card",
            "bingo-board",
            "bingoBoard",
            "cardGrid",
            "grid"
        );

    cardIdInput =
        getElement(
            "cardId",
            "cardID",
            "playerCardId",
            "playerCardID",
            "cardNumber"
        );

    loadCardButton =
        getElement(
            "loadCard",
            "loadCardButton",
            "load-card"
        );

    claimButton =
        getElement(
            "claimWin",
            "claimButton",
            "bingoButton",
            "bingoClaim",
            "claim-bingo"
        );

    statusElement =
        getElement(
            "status",
            "playerStatus",
            "message",
            "statusMessage"
        );

    timerElement =
        getElement(
            "timer",
            "timerDisplay",
            "countdown"
        );

    questionElement =
        getElement(
            "question",
            "currentQuestion"
        );

    questionNumberElement =
        getElement(
            "questionNumber",
            "currentQuestionNumber"
        );

    categoryElement =
        getElement(
            "category",
            "questionCategory"
        );

    difficultyElement =
        getElement(
            "difficulty",
            "questionDifficulty"
        );

    winnerElement =
        getElement(
            "winnerMessage",
            "winner",
            "winMessage"
        );

    connectionElement =
        getElement(
            "connectionStatus",
            "connection",
            "connectionMessage"
        );

    gameStatusElement =
        getElement(
            "gameStatus"
        );

    auditElement =
        getElement(
            "auditStatus",
            "claimAudit",
            "auditMessage"
        );

    setupAdditionalSelectors();

    bindDOMEvents();

    initializeCard();

    updateUI();
}


// =====================================================
// ADDITIONAL SELECTOR SUPPORT
// =====================================================

function setupAdditionalSelectors() {

    if (!cardContainer) {

        cardContainer =
            querySelectorSafe(
                ".bingo-card"
            );
    }

    if (!cardContainer) {

        cardContainer =
            querySelectorSafe(
                ".bingo-board"
            );
    }

    if (!cardContainer) {

        cardContainer =
            querySelectorSafe(
                ".card-grid"
            );
    }

    if (!cardContainer) {

        cardContainer =
            querySelectorSafe(
                "[data-bingo-card]"
            );
    }
}


// =====================================================
// DOM EVENTS
// =====================================================

function bindDOMEvents() {

    if (loadCardButton) {

        loadCardButton.addEventListener(
            "click",
            loadCardFromInput
        );
    }


    if (cardIdInput) {

        cardIdInput.addEventListener(
            "keydown",
            event => {

                if (
                    event.key === "Enter"
                ) {

                    loadCardFromInput();
                }
            }
        );
    }


    if (claimButton) {

        claimButton.addEventListener(
            "click",
            claimBingo
        );
    }


    // Event delegation for Bingo cells.

    document.addEventListener(
        "click",
        event => {

            const cell =
                event.target.closest(
                    "[data-index]"
                );

            if (!cell) {
                return;
            }

            const index =
                Number(
                    cell.dataset.index
                );

            if (
                Number.isInteger(index) &&
                index >= 0 &&
                index <= 24
            ) {

                handleCellClick(index);
            }
        }
    );
}


// =====================================================
// INITIALIZE CARD
// =====================================================

function initializeCard() {

    if (!cardContainer) {

        console.warn(
            "Bingo card container was not found."
        );

        return;
    }

    let cells =
        getCardCells();

    // If the HTML already contains 25 cells,
    // use them.

    if (cells.length === 25) {

        cells.forEach(
            (cell, index) => {

                cell.dataset.index =
                    String(index);

                cell.classList.toggle(
                    "free-space",
                    index === 12
                );

                if (index === 12) {

                    markCellVisual(
                        cell,
                        true
                    );
                }
            }
        );

        return;
    }


    // Otherwise create a basic 5x5 card.

    cardContainer.innerHTML = "";

    for (
        let index = 0;
        index < 25;
        index++
    ) {

        const cell =
            document.createElement(
                "button"
            );

        cell.type = "button";

        cell.className =
            "bingo-cell";

        cell.dataset.index =
            String(index);

        if (index === 12) {

            cell.textContent =
                "FREE";

            cell.classList.add(
                "free-space",
                "marked"
            );

            cell.disabled = true;
        }

        cardContainer.appendChild(
            cell
        );
    }
}


// =====================================================
// GET CARD CELLS
// =====================================================

function getCardCells() {

    if (!cardContainer) {
        return [];
    }

    let cells =
        querySelectorAllSafe(
            "[data-index]"
        );

    cells =
        cells.filter(
            cell =>
                cardContainer.contains(
                    cell
                )
        );

    if (cells.length === 25) {
        return cells;
    }

    cells =
        querySelectorAllSafe(
            ".bingo-cell"
        );

    cells =
        cells.filter(
            cell =>
                cardContainer.contains(
                    cell
                )
        );

    if (cells.length === 25) {
        return cells;
    }

    return [];
}


// =====================================================
// GET CELL
// =====================================================

function getCell(index) {

    if (
        !Number.isInteger(index) ||
        index < 0 ||
        index > 24
    ) {
        return null;
    }

    const cells =
        getCardCells();

    const direct =
        cells.find(
            cell =>
                Number(
                    cell.dataset.index
                ) === index
        );

    if (direct) {
        return direct;
    }

    return querySelectorSafe(
        `[data-index="${index}"]`
    );
}


// =====================================================
// CELL CLICK
// =====================================================

function handleCellClick(index) {

    // Center is always free.

    if (index === 12) {

        playerState.markedIndices.add(
            12
        );

        updateAllCellVisuals();

        return;
    }


    // Player must have a card.

    if (!playerState.loaded) {

        showStatus(
            "Load your Bingo card first.",
            "warning"
        );

        return;
    }


    // Game must be running.

    if (!playerState.gameRunning) {

        showStatus(
            "The Bingo game has not started.",
            "warning"
        );

        return;
    }


    // Do not allow changes after approval.

    if (playerState.claimApproved) {

        showStatus(
            "This card has already been approved as a winner.",
            "success"
        );

        return;
    }


    // Do not allow changes while waiting
    // for host approval.

    if (playerState.pendingClaim) {

        showStatus(
            "Your Bingo claim is waiting for host approval.",
            "warning"
        );

        return;
    }


    const currentlyMarked =
        playerState.markedIndices.has(
            index
        );

    const newMarked =
        !currentlyMarked;


    // Optimistic local state.

    if (newMarked) {

        playerState.markedIndices.add(
            index
        );

    } else {

        playerState.markedIndices.delete(
            index
        );
    }


    // Free square always stays marked.

    playerState.markedIndices.add(
        12
    );


    updateAllCellVisuals();


    // Send authoritative update to server.

    socket.emit(
        "markCard",
        {
            id:
                playerState.cardId,

            index:
                index,

            marked:
                newMarked
        }
    );
}


// =====================================================
// SERVER CARD MARK CONFIRMED
// =====================================================

socket.on(
    "cardMarkConfirmed",
    data => {

        if (!data) {
            return;
        }

        const cardId =
            Number(data.cardId);

        const index =
            Number(data.index);

        const marked =
            data.marked === true;


        if (
            playerState.cardId !==
            cardId
        ) {
            return;
        }


        if (marked) {

            playerState.markedIndices.add(
                index
            );

        } else {

            playerState.markedIndices.delete(
                index
            );
        }


        // Server always considers the center free.

        playerState.markedIndices.add(
            12
        );


        updateAllCellVisuals();

        updateClaimButton();
    }
);


// =====================================================
// SERVER REJECTED MARK
// =====================================================

socket.on(
    "cardMarkRejected",
    data => {

        showStatus(
            data &&
            data.reason
                ? data.reason
                : "Card mark rejected.",
            "error"
        );


        // Ask server for the latest state.

        synchronizeLocalCard();
    }
);


// =====================================================
// LOAD CARD FROM INPUT
// =====================================================

function loadCardFromInput() {

    if (!cardIdInput) {

        showStatus(
            "Card ID input was not found.",
            "error"
        );

        return;
    }

    const raw =
        cardIdInput.value.trim();

    const cardId =
        Number(raw);

    if (
        !Number.isInteger(cardId) ||
        cardId <= 0
    ) {

        showStatus(
            "Enter a valid Bingo card number.",
            "error"
        );

        return;
    }


    // Do not change cards during pending claim.

    if (playerState.pendingClaim) {

        showStatus(
            "You cannot change cards while a Bingo claim is pending.",
            "warning"
        );

        return;
    }


    socket.emit(
        "loadCard",
        cardId
    );
}


// =====================================================
// CARD LOADED
// =====================================================

socket.on(
    "cardLoaded",
    data => {

        if (!data) {
            return;
        }

        const cardId =
            Number(data.cardId);

        if (
            !Number.isInteger(cardId) ||
            cardId <= 0
        ) {

            showStatus(
                "The server returned an invalid card number.",
                "error"
            );

            return;
        }


        playerState.cardId =
            cardId;

        playerState.loaded =
            true;

        playerState.pendingClaim =
            false;

        playerState.claimApproved =
            false;

        playerState.markedIndices =
            new Set([12]);


        saveCardId(cardId);

        updateUI();

        showStatus(
            `Card ${cardId} loaded successfully.`,
            "success"
        );
    }
);


// =====================================================
// CARD LOAD ERROR
// =====================================================

socket.on(
    "cardLoadError",
    data => {

        showStatus(
            data &&
            data.error
                ? data.error
                : "Unable to load Bingo card.",
            "error"
        );
    }
);


// =====================================================
// SAVE CARD ID
// =====================================================

function saveCardId(cardId) {

    try {

        localStorage.setItem(
            "safetyBingoCardId",
            String(cardId)
        );

    } catch (error) {

        console.warn(
            "Unable to save card ID:",
            error
        );
    }
}


// =====================================================
// RESTORE CARD ID
// =====================================================

function restoreSavedCardId() {

    if (!cardIdInput) {
        return;
    }

    try {

        const saved =
            localStorage.getItem(
                "safetyBingoCardId"
            );

        if (saved) {

            cardIdInput.value =
                saved;
        }

    } catch (error) {

        console.warn(
            "Unable to restore saved card:",
            error
        );
    }
}


// =====================================================
// BINGO CLAIM
// =====================================================

function claimBingo() {

    if (!playerState.loaded) {

        showStatus(
            "Load your Bingo card first.",
            "warning"
        );

        return;
    }


    if (!playerState.gameRunning) {

        showStatus(
            "The Bingo game is not currently running.",
            "warning"
        );

        return;
    }


    if (playerState.pendingClaim) {

        showStatus(
            "Your Bingo claim is already waiting for host approval.",
            "warning"
        );

        return;
    }


    if (playerState.claimApproved) {

        showStatus(
            "This card has already been approved as a winner.",
            "success"
        );

        return;
    }


    const markedIndices =
        normalizeIndices(
            [
                ...playerState.markedIndices
            ]
        );


    const winningPattern =
        findCompletedPattern(
            markedIndices
        );


    if (!winningPattern) {

        showStatus(
            "You do not have a completed Bingo pattern yet.",
            "warning"
        );

        highlightPossibleBingo();

        return;
    }


    playerState.pendingClaim =
        true;

    playerState.lastWinningPattern =
        [
            ...winningPattern
        ];


    updateUI();


    showStatus(
        "Bingo claim sent. Waiting for host approval...",
        "warning"
    );


    // Send the exact server-authoritative
    // state we currently have.

    socket.emit(
        "claimWin",
        {

            cardId:
                playerState.cardId,

            markedIndices:
                markedIndices,

            winningPattern:
                winningPattern
        }
    );
}


// =====================================================
// NORMALIZE INDICES
// =====================================================

function normalizeIndices(indices) {

    if (!Array.isArray(indices)) {
        return [];
    }

    return [
        ...new Set(
            indices
                .map(Number)
                .filter(
                    index =>
                        Number.isInteger(index) &&
                        index >= 0 &&
                        index <= 24
                )
        )
    ].sort(
        (a, b) =>
            a - b
    );
}


// =====================================================
// SAME INDICES
// =====================================================

function sameIndices(a, b) {

    const first =
        normalizeIndices(a);

    const second =
        normalizeIndices(b);


    if (
        first.length !==
        second.length
    ) {
        return false;
    }


    return first.every(
        (value, index) =>
            value === second[index]
    );
}


// =====================================================
// FIND COMPLETED BINGO
// =====================================================

function findCompletedPattern(
    markedIndices
) {

    const normalized =
        normalizeIndices(
            markedIndices
        );


    return (
        winningPatterns.find(
            pattern =>
                pattern.every(
                    index =>
                        normalized.includes(
                            index
                        )
                )
        ) || null
    );
}


// =====================================================
// SERVER AUDIT RESULT
// =====================================================

socket.on(
    "bingoClaimAudit",
    data => {

        if (!data) {
            return;
        }


        if (
            data.cardId !== undefined &&
            Number(data.cardId) !==
                Number(playerState.cardId)
        ) {
            return;
        }


        // Server rejected the claim.

        if (data.success === false) {

            playerState.pendingClaim =
                false;


            if (
                Array.isArray(
                    data.serverMarkedIndices
                )
            ) {

                playerState.markedIndices =
                    new Set(
                        normalizeIndices(
                            data.serverMarkedIndices
                        )
                    );

                playerState.markedIndices.add(
                    12
                );
            }


            updateAllCellVisuals();

            updateUI();


            showAuditMessage(
                data.reason ||
                "Server audit failed.",
                "error"
            );

            return;
        }


        // Server audit passed and claim
        // is awaiting host approval.

        if (
            data.success === true &&
            data.pending === true
        ) {

            playerState.pendingClaim =
                true;


            if (
                Array.isArray(
                    data.markedIndices
                )
            ) {

                playerState.markedIndices =
                    new Set(
                        normalizeIndices(
                            data.markedIndices
                        )
                    );

                playerState.markedIndices.add(
                    12
                );
            }


            if (
                Array.isArray(
                    data.winningPattern
                )
            ) {

                playerState.lastWinningPattern =
                    [
                        ...data.winningPattern
                    ];
            }


            updateAllCellVisuals();

            updateUI();


            showAuditMessage(
                data.reason ||
                "Server audit passed. Waiting for host approval.",
                "success"
            );
        }
    }
);


// =====================================================
// WIN APPROVED
// =====================================================

socket.on(
    "winApproved",
    data => {

        if (!data) {
            return;
        }


        const cardId =
            Number(data.cardId);


        if (
            cardId !==
            Number(playerState.cardId)
        ) {

            // Another player's win.

            updateWinnerCountFromState();

            return;
        }


        playerState.pendingClaim =
            false;

        playerState.claimApproved =
            true;

        playerState.gameEnded =
            true;


        if (
            Array.isArray(
                data.winningPattern
            )
        ) {

            playerState.lastWinningPattern =
                [
                    ...data.winningPattern
                ];
        }


        highlightWinningPattern(
            playerState.lastWinningPattern
        );


        updateUI();


        showWinnerMessage(
            "BINGO! YOUR WIN HAS BEEN APPROVED!"
        );


        showStatus(
            "Congratulations! The host approved your Bingo.",
            "success"
        );


        disableCard();

        disableClaimButton();
    }
);


// =====================================================
// WIN REJECTED
// =====================================================

socket.on(
    "winRejected",
    data => {

        if (!data) {
            return;
        }


        const cardId =
            Number(data.cardId);


        if (
            cardId !==
            Number(playerState.cardId)
        ) {
            return;
        }


        playerState.pendingClaim =
            false;


        playerState.claimApproved =
            false;


        if (
            Array.isArray(
                data.winningPattern
            )
        ) {

            playerState.lastWinningPattern =
                [
                    ...data.winningPattern
                ];
        }


        updateUI();


        showStatus(
            data.reason ||
            "Your Bingo claim was rejected.",
            "error"
        );


        showAuditMessage(
            data.reason ||
            "The host rejected the Bingo claim.",
            "error"
        );


        enableCard();

        updateClaimButton();
    }
);


// =====================================================
// GAME STATE
// =====================================================

socket.on(
    "gameState",
    state => {

        if (!state) {
            return;
        }


        playerState.gameRunning =
            state.status === "running";


        playerState.gameEnded =
            state.status === "ended";


        playerState.currentQuestion =
            state.currentQuestion ||
            "";


        playerState.currentQuestionNumber =
            state.currentQuestionNumber ??
            null;


        playerState.currentCategory =
            state.currentCategory ||
            "";


        playerState.currentDifficulty =
            state.currentDifficulty ||
            "";


        playerState.currentAnswer =
            state.currentAnswer ||
            "";


        playerState.timerSeconds =
            Number(
                state.timerSeconds
            ) || 0;


        playerState.isPaused =
            state.isPaused === true;


        playerState.maxWinners =
            Number(
                state.maxWinners
            ) || 1;


        playerState.approvedWinnersCount =
            Number(
                state.approvedWinnersCount
            ) || 0;


        playerState.approvedWinnersList =
            Array.isArray(
                state.approvedWinnersList
            )
                ? [
                    ...state.approvedWinnersList
                ]
                : [];


        updateQuestionUI(
            state
        );


        updateGameStatusUI(
            state
        );


        updateWinnerCountFromState();


        // If game ended, prevent further marking.

        if (
            state.status === "ended"
        ) {

            if (
                playerState.claimApproved
            ) {

                disableCard();

            } else {

                disableClaimButton();
            }
        }


        updateUI();
    }
);


// =====================================================
// TIMER
// =====================================================

socket.on(
    "timerUpdate",
    seconds => {

        const value =
            Number(seconds);


        playerState.timerSeconds =
            Number.isFinite(value)
                ? value
                : 0;


        updateTimerUI();
    }
);


// =====================================================
// GAME RESET
// =====================================================

socket.on(
    "gameReset",
    () => {

        playerState.gameRunning =
            false;

        playerState.gameEnded =
            false;

        playerState.pendingClaim =
            false;

        playerState.claimApproved =
            false;

        playerState.currentQuestion =
            "";

        playerState.currentAnswer =
            "";

        playerState.currentQuestionNumber =
            null;

        playerState.currentCategory =
            "";

        playerState.currentDifficulty =
            "";

        playerState.timerSeconds =
            0;

        playerState.isPaused =
            false;

        playerState.lastWinningPattern =
            [];

        // Keep card loaded, but reset marks.

        playerState.markedIndices =
            new Set([12]);


        updateAllCellVisuals();

        enableCard();

        updateUI();


        showStatus(
            "The game has been reset.",
            "warning"
        );


        showWinnerMessage("");
    }
);


// =====================================================
// GAME ENDED
// =====================================================

socket.on(
    "gameEnded",
    data => {

        playerState.gameRunning =
            false;

        playerState.gameEnded =
            true;

        playerState.pendingClaim =
            false;


        updateUI();


        if (
            playerState.claimApproved
        ) {

            showWinnerMessage(
                "BINGO! YOU ARE AN APPROVED WINNER!"
            );

        } else {

            showStatus(
                "The Bingo game has ended.",
                "warning"
            );
        }
    }
);


// =====================================================
// PHYSICAL WIN APPROVED
// =====================================================
//
// This is primarily for QR claims.
// If this player's card was approved physically,
// show the winner notification.
//

socket.on(
    "physicalWinApproved",
    data => {

        if (!data) {
            return;
        }


        const cardId =
            Number(data.cardId);


        if (
            cardId !==
            Number(playerState.cardId)
        ) {

            updateWinnerCountFromState();

            return;
        }


        playerState.claimApproved =
            true;

        playerState.gameEnded =
            true;

        playerState.gameRunning =
            false;


        disableCard();

        disableClaimButton();


        const winnerNumber =
            Number(
                data.winnerNumber ||
                data.winnerCount ||
                1
            );


        showWinnerMessage(
            `BINGO! YOU ARE WINNER #${winnerNumber}!`
        );


        showStatus(
            "Your physical Bingo claim was approved by the host.",
            "success"
        );


        updateUI();
    }
);


// =====================================================
// PHYSICAL WIN REJECTED
// =====================================================

socket.on(
    "physicalWinRejected",
    data => {

        if (!data) {
            return;
        }


        const cardId =
            Number(data.cardId);


        if (
            cardId !==
            Number(playerState.cardId)
        ) {
            return;
        }


        showStatus(
            "Your physical Bingo claim was rejected by the host.",
            "error"
        );
    }
);


// =====================================================
// CHEAT SHEET QUESTION
// =====================================================

socket.on(
    "cheatSheetQuestion",
    data => {

        if (!data) {
            return;
        }


        playerState.currentQuestion =
            data.question ||
            "";


        playerState.currentQuestionNumber =
            data.number ??
            null;


        playerState.currentCategory =
            data.category ||
            "";


        playerState.currentDifficulty =
            data.difficulty ||
            "";


        // Do NOT expose answer to the player
        // unless your player UI explicitly wants it.
        //
        // The server sends it for other clients,
        // but we deliberately do not display it.

        updateQuestionUI({
            currentQuestion:
                playerState.currentQuestion,

            currentQuestionNumber:
                playerState.currentQuestionNumber,

            currentCategory:
                playerState.currentCategory,

            currentDifficulty:
                playerState.currentDifficulty
        });
    }
);


// =====================================================
// CONNECTION
// =====================================================

socket.on(
    "connect",
    () => {

        playerState.connected =
            true;


        updateConnectionUI();


        showStatus(
            "Connected to Safety Bingo.",
            "success"
        );


        // Re-register current card after reconnect.

        if (
            playerState.cardId
        ) {

            socket.emit(
                "loadCard",
                playerState.cardId
            );
        }


        socket.emit(
            "requestGameStateSyncFallback"
        );
    }
);


// =====================================================
// DISCONNECT
// =====================================================

socket.on(
    "disconnect",
    reason => {

        playerState.connected =
            false;


        updateConnectionUI();


        showStatus(
            "Disconnected from the Bingo server. Reconnecting...",
            "error"
        );
    }
);


// =====================================================
// CONNECTION ERROR
// =====================================================

socket.on(
    "connect_error",
    error => {

        console.error(
            "SOCKET CONNECTION ERROR:",
            error
        );


        playerState.connected =
            false;


        updateConnectionUI();
    }
);


// =====================================================
// UPDATE ALL CELL VISUALS
// =====================================================

function updateAllCellVisuals() {

    const cells =
        getCardCells();


    cells.forEach(
        cell => {

            const index =
                Number(
                    cell.dataset.index
                );


            const marked =
                playerState.markedIndices.has(
                    index
                );


            markCellVisual(
                cell,
                marked
            );
        }
    );


    // Always visually mark FREE.

    const freeCell =
        getCell(12);

    if (freeCell) {

        freeCell.classList.add(
            "marked",
            "free-space"
        );

        freeCell.disabled =
            true;
    }
}


// =====================================================
// MARK CELL VISUAL
// =====================================================

function markCellVisual(
    cell,
    marked
) {

    if (!cell) {
        return;
    }


    cell.classList.toggle(
        "marked",
        marked === true
    );


    cell.classList.toggle(
        "selected",
        marked === true
    );


    cell.setAttribute(
        "aria-pressed",
        marked === true
            ? "true"
            : "false"
    );


    if (
        Number(
            cell.dataset.index
        ) === 12
    ) {

        cell.classList.add(
            "free-space"
        );

        cell.disabled =
            true;
    }
}


// =====================================================
// HIGHLIGHT WINNING PATTERN
// =====================================================

function highlightWinningPattern(
    pattern
) {

    clearWinningHighlight();


    const normalized =
        normalizeIndices(pattern);


    normalized.forEach(
        index => {

            const cell =
                getCell(index);

            if (cell) {

                cell.classList.add(
                    "winning-cell"
                );
            }
        }
    );
}


// =====================================================
// CLEAR WINNING HIGHLIGHT
// =====================================================

function clearWinningHighlight() {

    const cells =
        getCardCells();


    cells.forEach(
        cell => {

            cell.classList.remove(
                "winning-cell"
            );
        }
    );
}


// =====================================================
// HIGHLIGHT POSSIBLE BINGO
// =====================================================

function highlightPossibleBingo() {

    clearWinningHighlight();


    const normalized =
        normalizeIndices(
            [
                ...playerState.markedIndices
            ]
        );


    const possible =
        winningPatterns.find(
            pattern => {

                const missing =
                    pattern.filter(
                        index =>
                            !normalized.includes(
                                index
                            )
                    );

                return missing.length === 1;
            }
        );


    if (!possible) {
        return;
    }


    possible.forEach(
        index => {

            if (
                normalized.includes(
                    index
                )
            ) {

                const cell =
                    getCell(index);

                if (cell) {

                    cell.classList.add(
                        "possible-winning-cell"
                    );
                }
            }
        }
    );


    setTimeout(
        () => {

            getCardCells().forEach(
                cell => {

                    cell.classList.remove(
                        "possible-winning-cell"
                    );
                }
            );

        },
        2500
    );
}


// =====================================================
// DISABLE CARD
// =====================================================

function disableCard() {

    const cells =
        getCardCells();


    cells.forEach(
        cell => {

            const index =
                Number(
                    cell.dataset.index
                );


            if (index !== 12) {

                cell.classList.add(
                    "card-disabled"
                );
            }
        }
    );
}


// =====================================================
// ENABLE CARD
// =====================================================

function enableCard() {

    const cells =
        getCardCells();


    cells.forEach(
        cell => {

            const index =
                Number(
                    cell.dataset.index
                );


            if (
                index !== 12
            ) {

                cell.classList.remove(
                    "card-disabled"
                );
            }
        }
    );
}


// =====================================================
// CLAIM BUTTON
// =====================================================

function updateClaimButton() {

    if (!claimButton) {
        return;
    }


    if (
        !playerState.loaded
    ) {

        claimButton.disabled =
            true;

        claimButton.textContent =
            "LOAD CARD FIRST";

        return;
    }


    if (
        playerState.claimApproved
    ) {

        claimButton.disabled =
            true;

        claimButton.textContent =
            "WIN APPROVED";

        return;
    }


    if (
        playerState.pendingClaim
    ) {

        claimButton.disabled =
            true;

        claimButton.textContent =
            "CLAIM PENDING...";

        return;
    }


    if (
        !playerState.gameRunning
    ) {

        claimButton.disabled =
            true;

        claimButton.textContent =
            "BINGO";

        return;
    }


    claimButton.disabled =
        false;

    claimButton.textContent =
        "BINGO!";
}


// =====================================================
// GENERAL UI UPDATE
// =====================================================

function updateUI() {

    updateConnectionUI();

    updateTimerUI();

    updateQuestionUI({
        currentQuestion:
            playerState.currentQuestion,

        currentQuestionNumber:
            playerState.currentQuestionNumber,

        currentCategory:
            playerState.currentCategory,

        currentDifficulty:
            playerState.currentDifficulty
    });

    updateClaimButton();

    updateWinnerCountFromState();

    updateAllCellVisuals();


    if (
        playerState.claimApproved
    ) {

        disableCard();

    } else if (
        playerState.gameRunning &&
        !playerState.pendingClaim
    ) {

        enableCard();
    }
}


// =====================================================
// CONNECTION UI
// =====================================================

function updateConnectionUI() {

    if (!connectionElement) {
        return;
    }


    if (
        playerState.connected
    ) {

        connectionElement.textContent =
            "Connected";

        connectionElement.classList.remove(
            "disconnected"
        );

        connectionElement.classList.add(
            "connected"
        );

    } else {

        connectionElement.textContent =
            "Disconnected";

        connectionElement.classList.remove(
            "connected"
        );

        connectionElement.classList.add(
            "disconnected"
        );
    }
}


// =====================================================
// TIMER UI
// =====================================================

function updateTimerUI() {

    if (!timerElement) {
        return;
    }


    const seconds =
        Math.max(
            0,
            Number(
                playerState.timerSeconds
            ) || 0
        );


    const minutes =
        Math.floor(
            seconds / 60
        );


    const remainder =
        seconds % 60;


    const formatted =
        `${String(minutes).padStart(2, "0")}:` +
        `${String(remainder).padStart(2, "0")}`;


    timerElement.textContent =
        formatted;


    timerElement.classList.toggle(
        "timer-warning",
        seconds <= 10 &&
        seconds > 0
    );


    timerElement.classList.toggle(
        "timer-expired",
        seconds <= 0
    );
}


// =====================================================
// QUESTION UI
// =====================================================

function updateQuestionUI(
    state
) {

    if (!state) {
        return;
    }


    if (questionElement) {

        questionElement.textContent =
            state.currentQuestion ||
            "";
    }


    if (
        questionNumberElement
    ) {

        if (
            state.currentQuestionNumber !==
                null &&
            state.currentQuestionNumber !==
                undefined
        ) {

            questionNumberElement.textContent =
                `Question ${state.currentQuestionNumber}`;

        } else {

            questionNumberElement.textContent =
                "";
        }
    }


    if (categoryElement) {

        categoryElement.textContent =
            state.currentCategory ||
            "";
    }


    if (difficultyElement) {

        difficultyElement.textContent =
            state.currentDifficulty ||
            "";
    }
}


// =====================================================
// GAME STATUS UI
// =====================================================

function updateGameStatusUI(
    state
) {

    if (!gameStatusElement) {
        return;
    }


    switch (
        state.status
    ) {

        case "idle":

            gameStatusElement.textContent =
                "Waiting for game";

            break;


        case "running":

            gameStatusElement.textContent =
                state.isPaused
                    ? "Game Paused"
                    : "Game Running";

            break;


        case "ended":

            gameStatusElement.textContent =
                "Game Ended";

            break;


        default:

            gameStatusElement.textContent =
                "";
    }
}


// =====================================================
// WINNER COUNT
// =====================================================

function updateWinnerCountFromState() {

    const count =
        playerState.approvedWinnersCount;

    const max =
        playerState.maxWinners;


    if (!winnerElement) {
        return;
    }


    if (
        count > 0
    ) {

        winnerElement.textContent =
            `Winners: ${count} / ${max}`;

    } else {

        winnerElement.textContent =
            `Winners: 0 / ${max}`;
    }
}


// =====================================================
// STATUS MESSAGE
// =====================================================

function showStatus(
    message,
    type = "normal"
) {

    if (!statusElement) {

        console.log(
            `[PLAYER STATUS - ${type}]`,
            message
        );

        return;
    }


    statusElement.textContent =
        message;


    statusElement.classList.remove(
        "success",
        "error",
        "warning",
        "normal"
    );


    statusElement.classList.add(
        type
    );
}


// =====================================================
// AUDIT MESSAGE
// =====================================================

function showAuditMessage(
    message,
    type = "normal"
) {

    if (!auditElement) {
        return;
    }


    auditElement.textContent =
        message;


    auditElement.classList.remove(
        "success",
        "error",
        "warning",
        "normal"
    );


    auditElement.classList.add(
        type
    );
}


// =====================================================
// WINNER MESSAGE
// =====================================================

function showWinnerMessage(
    message
) {

    if (!winnerElement) {
        return;
    }


    // If this is being used as a winner
    // message element, preserve winner count
    // when there is no message.

    if (!message) {

        winnerElement.textContent =
            "";

        winnerElement.classList.remove(
            "winner"
        );

        return;
    }


    winnerElement.textContent =
        message;


    winnerElement.classList.add(
        "winner"
    );
}


// =====================================================
// SYNCHRONIZE LOCAL CARD
// =====================================================
//
// The provided server does not expose a direct
// "get my mark state" event. Therefore, if the
// server rejects a mark, the safest client action
// is to request a state refresh by reloading the
// registered card.
//
// The server's card session itself is authoritative.
// =====================================================

function synchronizeLocalCard() {

    if (
        !playerState.cardId
    ) {
        return;
    }


    socket.emit(
        "loadCard",
        playerState.cardId
    );
}


// =====================================================
// PAGE VISIBILITY
// =====================================================

document.addEventListener(
    "visibilitychange",
    () => {

        if (
            document.visibilityState ===
            "visible"
        ) {

            socket.emit(
                "requestGameStateSyncFallback"
            );
        }
    }
);


// =====================================================
// BEFORE UNLOAD
// =====================================================

window.addEventListener(
    "beforeunload",
    () => {

        // Do not emit a disconnect-specific
        // event here. Socket.IO handles it.
    }
);


// =====================================================
// KEYBOARD ACCESSIBILITY
// =====================================================

document.addEventListener(
    "keydown",
    event => {

        const active =
            document.activeElement;


        if (!active) {
            return;
        }


        if (
            !active.matches(
                "[data-index]"
            )
        ) {
            return;
        }


        if (
            event.key === "Enter" ||
            event.key === " "
        ) {

            event.preventDefault();


            const index =
                Number(
                    active.dataset.index
                );


            if (
                Number.isInteger(index)
            ) {

                handleCellClick(
                    index
                );
            }
        }
    }
);


// =====================================================
// AUTO LOAD SAVED CARD
// =====================================================

function attemptAutoLoad() {

    if (!cardIdInput) {
        return;
    }


    try {

        const saved =
            localStorage.getItem(
                "safetyBingoCardId"
            );


        if (
            saved &&
            Number.isInteger(
                Number(saved)
            ) &&
            Number(saved) > 0
        ) {

            cardIdInput.value =
                saved;


            // Wait for socket connection.

            if (
                socket.connected
            ) {

                socket.emit(
                    "loadCard",
                    Number(saved)
                );
            }
        }

    } catch (error) {

        console.warn(
            "AUTO LOAD CARD ERROR:",
            error
        );
    }
}


// =====================================================
// INITIALIZATION
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initializeDOM();

        restoreSavedCardId();

        attemptAutoLoad();

        updateUI();

    }
);


// =====================================================
// EXPOSE OPTIONAL DEBUG API
// =====================================================
//
// This is intentionally read-only where possible.
// It can be useful while testing the game.
//

window.safetyBingoPlayer = {

    getState() {

        return {

            ...playerState,

            markedIndices:
                [
                    ...playerState.markedIndices
                ],

            selectedCells:
                [
                    ...playerState.selectedCells
                ]
        };
    },


    claimBingo,


    loadCard() {

        loadCardFromInput();
    },


    mark(index) {

        handleCellClick(
            Number(index)
        );
    },


    getWinningPattern() {

        return findCompletedPattern(
            [
                ...playerState.markedIndices
            ]
        );
    }

};


// =====================================================
// END PLAYER.JS
// =====================================================
