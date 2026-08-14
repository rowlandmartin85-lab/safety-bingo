"use strict";

// =====================================================
// SAFETY BINGO PLAYER.JS
// =====================================================

let playerSocket = null;

// =====================================================
// PLAYER STATE
// =====================================================

const playerState = {
    cardID: null,
    card: null,
    grid: [],
    calledAnswers: [],
    locked: false,
    claimPending: false,
    winApproved: false,
    claimRejected: false,
    connected: false,
    lastRejectedPatternKey: null
};

// =====================================================
// PLAYER UI
// =====================================================

const playerUI = {
    cardInput: null,
    loadButton: null,
    cardArea: null,
    gameArea: null,
    gameMessage: null
};

// =====================================================
// WINNING PATTERNS (0-24 INDEX GRID)
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
// INITIALIZE PLAYER
// =====================================================

function initializePlayer() {
    console.log("SAFETY BINGO PLAYER INITIALIZING");

    playerUI.cardInput = document.getElementById("cardInput");
    playerUI.loadButton = document.getElementById("loadCardBtn");
    playerUI.cardArea = document.getElementById("cardArea");
    playerUI.gameArea = document.getElementById("gameArea");
    playerUI.gameMessage = document.getElementById("gameState");

    setupPlayerButtons();

    // Check if we need to open in a new tab/window
    // before initializing sockets.
    if (handleNewWindowRedirect()) {
        return;
    }

    initializeSocket();
    loadCardFromURL();

    console.log("SAFETY BINGO PLAYER READY");
}

// =====================================================
// NEW TAB / WINDOW REDIRECT LOGIC
// =====================================================

function handleNewWindowRedirect() {
    try {
        const params = new URLSearchParams(window.location.search);

        if (
            params.get("newTab") === "true" ||
            params.get("openWindow") === "true"
        ) {
            params.delete("newTab");
            params.delete("openWindow");

            const newUrl =
                window.location.pathname +
                (params.toString()
                    ? "?" + params.toString()
                    : "");

            window.open(
                newUrl,
                "_blank",
                "noopener,noreferrer"
            );

            if (playerUI.gameMessage) {
                playerUI.gameMessage.textContent =
                    "Player board opened in a new tab!";
            }

            return true;
        }
    } catch (error) {
        console.error(
            "NEW WINDOW REDIRECT ERROR:",
            error
        );
    }

    return false;
}

// =====================================================
// SOCKET INITIALIZATION
// =====================================================

function initializeSocket() {
    if (typeof io !== "function") {
        console.error(
            "SOCKET.IO NOT FOUND. Make sure socket.io is loaded before player.js."
        );
        return;
    }

    try {
        playerSocket = io(window.location.origin, {
            transports: [
                "websocket",
                "polling"
            ],
            reconnection: true,
            reconnectionAttempts: 10
        });
    } catch (error) {
        console.error(
            "SOCKET INITIALIZATION ERROR:",
            error
        );
        return;
    }

    setupSocketEvents();
}

// =====================================================
// SOCKET EVENTS
// =====================================================

function setupSocketEvents() {
    if (!playerSocket) {
        return;
    }

    playerSocket.on("connect", () => {
        playerState.connected = true;

        console.log(
            "PLAYER CONNECTED:",
            playerSocket.id
        );

        playerSocket.emit(
            "requestGameStateSyncFallback"
        );

        if (playerState.cardID) {
            playerSocket.emit(
                "loadCard",
                playerState.cardID
            );

            syncMarkedCellsToServer();
        }
    });

    playerSocket.on("disconnect", () => {
        playerState.connected = false;

        console.log(
            "PLAYER DISCONNECTED"
        );
    });

    playerSocket.on(
        "connect_error",
        error => {
            console.error(
                "PLAYER SOCKET CONNECTION ERROR:",
                error
            );
        }
    );

    playerSocket.on(
        "gameState",
        handleGameState
    );

    playerSocket.on(
        "gameReset",
        handleGameReset
    );

    playerSocket.on(
        "winApproved",
        handleWinApproved
    );

    playerSocket.on(
        "winRejected",
        handleWinRejected
    );

    playerSocket.on(
        "cardLoaded",
        data => {
            console.log(
                "CARD CONFIRMED BY SERVER:",
                data
            );
        }
    );
}

// =====================================================
// SYNC MARKED CELLS
// =====================================================

function syncMarkedCellsToServer() {
    if (
        !playerSocket ||
        !playerState.connected ||
        !playerState.cardID
    ) {
        return;
    }

    playerState.grid.forEach(
        (cell, index) => {
            if (
                cell &&
                cell.marked
            ) {
                playerSocket.emit(
                    "markCard",
                    {
                        id: playerState.cardID,
                        index: index,
                        marked: true
                    }
                );
            }
        }
    );
}

// =====================================================
// PLAYER BUTTONS
// =====================================================

function setupPlayerButtons() {

    if (playerUI.loadButton) {

        playerUI.loadButton.onclick = () => {

            if (!playerUI.cardInput) {
                console.error(
                    "CARD INPUT NOT FOUND"
                );
                return;
            }

            const id =
                playerUI.cardInput.value.trim();

            if (!id) {
                alert("Enter Card ID");
                return;
            }

            loadPlayerCard(id);
        };
    }

    if (playerUI.cardInput) {

        playerUI.cardInput.addEventListener(
            "keydown",
            event => {

                if (event.key === "Enter") {

                    if (playerUI.loadButton) {
                        playerUI.loadButton.click();
                    }
                }
            }
        );
    }
}

// =====================================================
// LOAD CARD FROM URL
// =====================================================

function loadCardFromURL() {
    try {

        const params =
            new URLSearchParams(
                window.location.search
            );

        const id =
            params.get("card");

        if (
            id &&
            playerUI.cardInput
        ) {

            playerUI.cardInput.value = id;

            setTimeout(() => {
                loadPlayerCard(id);
            }, 300);
        }

    } catch (error) {

        console.error(
            "URL CARD LOAD ERROR:",
            error
        );
    }
}

// =====================================================
// LOAD PLAYER CARD
// =====================================================

function loadPlayerCard(id) {

    console.log(
        "LOADING PLAYER CARD:",
        id
    );

    if (
        typeof window.generateCard !==
        "function"
    ) {

        console.error(
            "CARD GENERATOR NOT FOUND."
        );

        alert(
            "The Bingo card generator is not loaded. Please refresh the page."
        );

        return;
    }

    const cardID =
        Number(id);

    if (
        !Number.isInteger(cardID) ||
        cardID < 1
    ) {

        console.error(
            "INVALID CARD ID:",
            id
        );

        alert(
            "Invalid Card ID"
        );

        return;
    }

    let card = null;

    try {

        card =
            window.generateCard(cardID);

    } catch (error) {

        console.error(
            "CARD GENERATION ERROR:",
            error
        );

        alert(
            "The Bingo card could not be generated."
        );

        return;
    }

    if (
        !card ||
        !Array.isArray(card.grid)
    ) {

        console.error(
            "INVALID CARD RETURNED:",
            card
        );

        alert(
            "Invalid Bingo card."
        );

        return;
    }

    if (
        card.grid.length !== 25
    ) {

        console.error(
            "INVALID CARD GRID LENGTH:",
            card.grid.length
        );

        alert(
            "The Bingo card does not contain 25 spaces."
        );

        return;
    }

    playerState.cardID =
        cardID;

    playerState.card =
        card;

    playerState.grid =
        card.grid;

    playerState.calledAnswers =
        [];

    playerState.locked =
        false;

    playerState.claimPending =
        false;

    playerState.winApproved =
        false;

    playerState.claimRejected =
        false;

    playerState.lastRejectedPatternKey =
        null;

    renderPlayerCard();

    if (playerSocket) {

        playerSocket.emit(
            "loadCard",
            cardID
        );
    }

    console.log(
        "CARD LOADED SUCCESSFULLY:",
        cardID
    );
}

// =====================================================
// RENDER PLAYER CARD
// =====================================================

function renderPlayerCard() {

    if (!playerUI.cardArea) {

        console.error(
            "CARD AREA NOT FOUND."
        );

        return;
    }

    if (
        !Array.isArray(
            playerState.grid
        )
    ) {

        console.error(
            "PLAYER GRID IS NOT AN ARRAY."
        );

        return;
    }

    playerUI.cardArea.innerHTML =
        "";

    playerState.grid.forEach(
        (cell, index) => {

            if (!cell) {
                return;
            }

            const box =
                document.createElement("div");

            box.className =
                "bingo-cell";

            box.textContent =
                cell.text || "";

            const isFree =
                cell.isFreeSpace === true ||
                cell.text === "FREE" ||
                cell.text === "FREE SPACE" ||
                index === 12;

            if (isFree) {

                cell.marked = true;

                box.classList.add(
                    "free-space",
                    "cell-marked"
                );

            } else if (
                cell.marked === true
            ) {

                box.classList.add(
                    "cell-marked"
                );
            }

            box.addEventListener(
                "click",
                () => {

                    if (isFree) {
                        return;
                    }

                    // Approved Bingo permanently locks card
                    if (
                        playerState.winApproved
                    ) {

                        console.log(
                            "CARD LOCKED - BINGO APPROVED"
                        );

                        return;
                    }

                    // Claim waiting for host
                    if (
                        playerState.claimPending
                    ) {

                        console.log(
                            "CLAIM PENDING - WAITING FOR HOST"
                        );

                        return;
                    }

                    // Temporary safety lock
                    if (
                        playerState.locked
                    ) {

                        console.log(
                            "PLAYER LOCKED"
                        );

                        return;
                    }

                    // Toggle selected cell
                    cell.marked =
                        !cell.marked;

                    if (cell.marked) {

                        box.classList.add(
                            "cell-marked"
                        );

                    } else {

                        box.classList.remove(
                            "cell-marked"
                        );
                    }

                    // Any board change clears
                    // the rejection hold.
                    playerState.claimRejected =
                        false;

                    playerState.lastRejectedPatternKey =
                        null;

                    // Send selection to server
                    if (
                        playerSocket &&
                        playerState.connected
                    ) {

                        playerSocket.emit(
                            "markCard",
                            {
                                id:
                                    playerState.cardID,

                                index:
                                    index,

                                marked:
                                    cell.marked
                            }
                        );
                    }

                    // Check for Bingo
                    checkForBingo();
                }
            );

            playerUI.cardArea.appendChild(
                box
            );
        }
    );

    if (playerUI.gameArea) {

        playerUI.gameArea.style.display =
            "block";
    }

    setTimeout(() => {

        if (
            typeof window.fitBingoCellText ===
            "function"
        ) {

            try {

                window.fitBingoCellText();

            } catch (error) {

                console.error(
                    "CELL TEXT FIT ERROR:",
                    error
                );
            }
        }

    }, 50);
}

// =====================================================
// GAME STATE
// =====================================================

function handleGameState(state) {

    if (!state) {
        return;
    }

    if (
        Array.isArray(
            state.calledAnswers
        )
    ) {

        playerState.calledAnswers =
            [
                ...state.calledAnswers
            ];

        window.playerCalledAnswers =
            [
                ...state.calledAnswers
            ];
    }

    if (playerUI.gameMessage) {

        if (
            state.status === "running"
        ) {

            playerUI.gameMessage.textContent =
                state.currentQuestion ||
                "";

        } else {

            playerUI.gameMessage.textContent =
                "Waiting for game...";
        }
    }
}

// =====================================================
// GAME RESET
// =====================================================

function handleGameReset() {

    console.log(
        "PLAYER GAME RESET"
    );

    playerState.cardID =
        null;

    playerState.card =
        null;

    playerState.grid =
        [];

    playerState.calledAnswers =
        [];

    playerState.locked =
        false;

    playerState.claimPending =
        false;

    playerState.winApproved =
        false;

    playerState.claimRejected =
        false;

    playerState.lastRejectedPatternKey =
        null;

    // Remove rejection overlay if present
    const rejectionOverlay =
        document.getElementById(
            "bingoRejectedOverlay"
        );

    if (rejectionOverlay) {
        rejectionOverlay.remove();
    }

    if (playerUI.cardArea) {

        playerUI.cardArea.innerHTML =
            "";
    }

    if (playerUI.gameMessage) {

        playerUI.gameMessage.textContent =
            "Waiting for host...";
    }

    if (playerUI.cardInput) {

        playerUI.cardInput.value =
            "";
    }
}

// =====================================================
// VALID BINGO CELL
// =====================================================

function isValidBingoCell(index) {

    const cell =
        playerState.grid[index];

    if (!cell) {
        return false;
    }

    if (
        cell.isFreeSpace === true ||
        cell.text === "FREE" ||
        cell.text === "FREE SPACE" ||
        index === 12
    ) {

        return true;
    }

    return cell.marked === true;
}

// =====================================================
// CHECK FOR BINGO
// =====================================================

function checkForBingo() {

    if (
        playerState.grid.length !== 25 ||
        playerState.claimPending ||
        playerState.winApproved ||
        playerState.locked ||
        playerState.claimRejected
    ) {
        return;
    }

    for (
        const pattern of winningPatterns
    ) {

        const bingo =
            pattern.every(
                index =>
                    isValidBingoCell(index)
            );

        if (!bingo) {
            continue;
        }

        const patternKey =
            pattern.join(",");

        if (
            playerState.lastRejectedPatternKey ===
            patternKey
        ) {

            continue;
        }

        console.log(
            "BINGO DETECTED:",
            pattern
        );

        sendBingoClaim(
            pattern
        );

        return;
    }
}

// =====================================================
// SEND BINGO CLAIM
// =====================================================

function sendBingoClaim(
    winningPattern
) {

    if (
        playerState.claimPending ||
        playerState.winApproved ||
        playerState.locked
    ) {
        return;
    }

    if (!playerState.cardID) {

        console.error(
            "BINGO CLAIM FAILED: NO CARD ID"
        );

        return;
    }

    if (
        !playerSocket ||
        !playerState.connected
    ) {

        console.error(
            "BINGO CLAIM FAILED: SOCKET NOT CONNECTED"
        );

        return;
    }

    // Temporary lock while host decides
    playerState.claimPending =
        true;

    playerState.locked =
        true;

    const markedIndices =
        [];

    playerState.grid.forEach(
        (cell, index) => {

            if (
                cell.marked === true ||
                cell.isFreeSpace === true ||
                cell.text === "FREE" ||
                cell.text === "FREE SPACE" ||
                index === 12
            ) {

                markedIndices.push(
                    index
                );
            }
        }
    );

    const claimData = {

        cardId:
            playerState.cardID,

        markedIndices:
            markedIndices,

        winningPattern:
            [...winningPattern],

        timestamp:
            Date.now()
    };

    console.log(
        "========== SENDING BINGO CLAIM ==========",
        claimData
    );

    playerSocket.emit(
        "claimWin",
        claimData
    );
}

// =====================================================
// WIN APPROVED
// =====================================================

function handleWinApproved(data) {

    if (!data) {
        return;
    }

    if (
        Number(data.cardId) !==
        Number(playerState.cardID)
    ) {
        return;
    }

    console.log(
        "========== BINGO APPROVED =========="
    );

    playerState.claimPending =
        false;

    playerState.claimRejected =
        false;

    playerState.locked =
        true;

    playerState.winApproved =
        true;

    if (
        window.bingoAnimation &&
        typeof window.bingoAnimation.show ===
            "function"
    ) {

        window.bingoAnimation.show();

    } else {

        alert(
            "🎉 BINGO!"
        );
    }
}

// =====================================================
// WIN REJECTED
// =====================================================

function handleWinRejected(data) {

    if (!data) {
        return;
    }

    if (
        Number(data.cardId) !==
        Number(playerState.cardID)
    ) {
        return;
    }

    console.log(
        "========== BINGO REJECTED ==========",
        data
    );

    // Completely unlock player and hold
    // automatic claiming until board changes.
    playerState.claimPending =
        false;

    playerState.locked =
        false;

    playerState.winApproved =
        false;

    playerState.claimRejected =
        true;

    if (
        Array.isArray(
            data.winningPattern
        )
    ) {

        playerState.lastRejectedPatternKey =
            data.winningPattern.join(",");
    }

    console.log(
        "PLAYER UNLOCKED - CONTINUE PLAYING"
    );

    if (playerUI.gameMessage) {

        playerUI.gameMessage.textContent =
            "Bingo not approved. Unmark incorrect spaces and keep playing!";
    }

    // NEW:
    // Show polished rejection overlay
    // instead of browser alert.
    showBingoRejectedOverlay();
}

// =====================================================
// BINGO REJECTED OVERLAY
// =====================================================

function showBingoRejectedOverlay() {

    // Remove existing overlay
    const existing =
        document.getElementById(
            "bingoRejectedOverlay"
        );

    if (existing) {
        existing.remove();
    }

    // -------------------------------------------------
    // OVERLAY
    // -------------------------------------------------

    const overlay =
        document.createElement("div");

    overlay.id =
        "bingoRejectedOverlay";

    // -------------------------------------------------
    // BACKDROP
    // -------------------------------------------------

    const backdrop =
        document.createElement("div");

    backdrop.className =
        "bingo-rejected-backdrop";

    // -------------------------------------------------
    // MODAL
    // -------------------------------------------------

    const modal =
        document.createElement("div");

    modal.className =
        "bingo-rejected-modal";

    // -------------------------------------------------
    // ICON
    // -------------------------------------------------

    const iconWrap =
        document.createElement("div");

    iconWrap.className =
        "bingo-rejected-icon-wrap";

    const icon =
        document.createElement("div");

    icon.className =
        "bingo-rejected-icon";

    icon.innerHTML = `
        <svg
            viewBox="0 0 64 64"
            aria-hidden="true"
            xmlns="http://www.w3.org/2000/svg"
        >
            <circle
                cx="32"
                cy="32"
                r="27"
                fill="none"
                stroke="currentColor"
                stroke-width="4"
                opacity=".25"
            />

            <path
                d="M20 20L44 44M44 20L20 44"
                fill="none"
                stroke="currentColor"
                stroke-width="6"
                stroke-linecap="round"
            />
        </svg>
    `;

    iconWrap.appendChild(
        icon
    );

    // -------------------------------------------------
    // ACCENT
    // -------------------------------------------------

    const accent =
        document.createElement("div");

    accent.className =
        "bingo-rejected-accent";

    // -------------------------------------------------
    // TITLE
    // -------------------------------------------------

    const heading =
        document.createElement("h2");

    heading.className =
        "bingo-rejected-title";

    heading.textContent =
        "BINGO NOT APPROVED";

    // -------------------------------------------------
    // MESSAGE
    // -------------------------------------------------

    const message =
        document.createElement("p");

    message.className =
        "bingo-rejected-message";

    message.innerHTML = `
        Your Bingo claim could not be verified.
        <br>
        <strong>
            Check your marked spaces and keep playing.
        </strong>
    `;

    // -------------------------------------------------
    // TIP
    // -------------------------------------------------

    const tip =
        document.createElement("div");

    tip.className =
        "bingo-rejected-tip";

    tip.innerHTML = `
        <span class="tip-icon">!</span>

        <span>
            Unmark any incorrect answers,
            then continue playing.
        </span>
    `;

    // -------------------------------------------------
    // BUTTON
    // -------------------------------------------------

    const button =
        document.createElement("button");

    button.className =
        "bingo-rejected-button";

    button.type =
        "button";

    button.innerHTML = `
        <span>KEEP PLAYING</span>
        <span class="button-arrow">→</span>
    `;

    // -------------------------------------------------
    // CLOSE
    // -------------------------------------------------

    let closed = false;

    function closeOverlay() {

        if (closed) {
            return;
        }

        closed = true;

        overlay.classList.remove(
            "show"
        );

        setTimeout(() => {

            if (overlay) {
                overlay.remove();
            }

        }, 300);
    }

    button.addEventListener(
        "click",
        closeOverlay
    );

    backdrop.addEventListener(
        "click",
        closeOverlay
    );

    // Escape key
    const escapeHandler =
        event => {

            if (
                event.key === "Escape"
            ) {

                closeOverlay();

                document.removeEventListener(
                    "keydown",
                    escapeHandler
                );
            }
        };

    document.addEventListener(
        "keydown",
        escapeHandler
    );

    // -------------------------------------------------
    // BUILD MODAL
    // -------------------------------------------------

    modal.appendChild(
        iconWrap
    );

    modal.appendChild(
        accent
    );

    modal.appendChild(
        heading
    );

    modal.appendChild(
        message
    );

    modal.appendChild(
        tip
    );

    modal.appendChild(
        button
    );

    overlay.appendChild(
        backdrop
    );

    overlay.appendChild(
        modal
    );

    document.body.appendChild(
        overlay
    );

    // -------------------------------------------------
    // CSS
    // -------------------------------------------------

    if (
        !document.getElementById(
            "bingoRejectedStyle"
        )
    ) {

        const style =
            document.createElement(
                "style"
            );

        style.id =
            "bingoRejectedStyle";

        style.textContent = `

/* =====================================================
   BINGO REJECTED OVERLAY
   ===================================================== */

#bingoRejectedOverlay {

    position: fixed;

    inset: 0;

    z-index: 999999;

    display: flex;

    align-items: center;

    justify-content: center;

    padding: 20px;

    font-family:
        "Segoe UI",
        -apple-system,
        BlinkMacSystemFont,
        Roboto,
        Arial,
        sans-serif;

    opacity: 0;

    transition:
        opacity .3s ease;

    isolation: isolate;
}

#bingoRejectedOverlay.show {
    opacity: 1;
}


/* =====================================================
   BACKDROP
   ===================================================== */

.bingo-rejected-backdrop {

    position: absolute;

    inset: 0;

    background:
        radial-gradient(
            circle at center,
            rgba(127, 29, 29, .22),
            rgba(2, 6, 23, .92) 65%
        );

    backdrop-filter:
        blur(8px);

    -webkit-backdrop-filter:
        blur(8px);
}


/* =====================================================
   MODAL
   ===================================================== */

.bingo-rejected-modal {

    position: relative;

    width: min(440px, 94vw);

    padding:
        34px
        30px
        28px;

    text-align: center;

    border-radius: 24px;

    background:
        linear-gradient(
            145deg,
            rgba(30, 41, 59, .98),
            rgba(15, 23, 42, .98)
        );

    border:
        1px solid
        rgba(148, 163, 184, .22);

    box-shadow:
        0 30px 80px
        rgba(0, 0, 0, .55),

        0 0 0 1px
        rgba(255,255,255,.03)
        inset,

        0 0 50px
        rgba(239, 68, 68, .12);

    transform:
        translateY(25px)
        scale(.94);

    opacity: 0;

    animation:
        bingoRejectedEnter
        .45s
        cubic-bezier(.2,.8,.2,1)
        forwards;

    overflow: hidden;
}


/* =====================================================
   TOP GLOW
   ===================================================== */

.bingo-rejected-modal::before {

    content: "";

    position: absolute;

    top: -100px;

    left: 50%;

    width: 260px;

    height: 180px;

    transform:
        translateX(-50%);

    background:
        radial-gradient(
            circle,
            rgba(239,68,68,.22),
            transparent 70%
        );

    pointer-events: none;
}


/* =====================================================
   ICON
   ===================================================== */

.bingo-rejected-icon-wrap {

    position: relative;

    width: 82px;

    height: 82px;

    margin:
        0 auto 18px;

    display: flex;

    align-items: center;

    justify-content: center;

    border-radius: 50%;

    background:
        radial-gradient(
            circle,
            rgba(239,68,68,.18),
            rgba(127,29,29,.08)
        );

    border:
        1px solid
        rgba(248,113,113,.28);

    box-shadow:
        0 0 0 8px
        rgba(239,68,68,.035),

        0 0 35px
        rgba(239,68,68,.16);

    animation:
        rejectedIconPulse
        2.4s
        ease-in-out
        infinite;
}

.bingo-rejected-icon {

    width: 54px;

    height: 54px;

    display: flex;

    align-items: center;

    justify-content: center;

    color: #f87171;
}

.bingo-rejected-icon svg {

    width: 100%;

    height: 100%;
}


/* =====================================================
   ACCENT
   ===================================================== */

.bingo-rejected-accent {

    width: 48px;

    height: 3px;

    margin:
        0 auto 16px;

    border-radius: 999px;

    background:
        linear-gradient(
            90deg,
            #ef4444,
            #fb7185
        );

    box-shadow:
        0 0 12px
        rgba(239,68,68,.45);
}


/* =====================================================
   TITLE
   ===================================================== */

.bingo-rejected-title {

    margin: 0;

    color: #f8fafc;

    font-size:
        clamp(
            23px,
            6vw,
            30px
        );

    line-height: 1.1;

    font-weight: 900;

    letter-spacing: .8px;

    text-shadow:
        0 2px 10px
        rgba(0,0,0,.35);
}


/* =====================================================
   MESSAGE
   ===================================================== */

.bingo-rejected-message {

    margin:
        14px auto 0;

    max-width: 350px;

    color: #cbd5e1;

    font-size: 15px;

    line-height: 1.55;
}

.bingo-rejected-message strong {

    display: inline-block;

    margin-top: 4px;

    color: #f1f5f9;

    font-weight: 700;
}


/* =====================================================
   TIP
   ===================================================== */

.bingo-rejected-tip {

    display: flex;

    align-items: center;

    gap: 10px;

    margin:
        22px 0;

    padding:
        12px 14px;

    text-align: left;

    border-radius: 12px;

    background:
        rgba(15,23,42,.65);

    border:
        1px solid
        rgba(148,163,184,.14);

    color: #cbd5e1;

    font-size: 13px;

    line-height: 1.4;
}

.tip-icon {

    flex:
        0 0 auto;

    width: 24px;

    height: 24px;

    display: flex;

    align-items: center;

    justify-content: center;

    border-radius: 50%;

    background:
        rgba(239,68,68,.15);

    border:
        1px solid
        rgba(248,113,113,.25);

    color: #f87171;

    font-weight: 900;
}


/* =====================================================
   BUTTON
   ===================================================== */

.bingo-rejected-button {

    width: 100%;

    min-height: 52px;

    border: none;

    border-radius: 12px;

    display: flex;

    align-items: center;

    justify-content: center;

    gap: 12px;

    background:
        linear-gradient(
            135deg,
            #ef4444,
            #dc2626
        );

    color: #ffffff;

    font-size: 14px;

    font-weight: 900;

    letter-spacing: 1px;

    cursor: pointer;

    box-shadow:
        0 8px 24px
        rgba(220,38,38,.28),

        0 2px 0
        rgba(255,255,255,.12)
        inset;

    transition:
        transform .18s ease,
        box-shadow .18s ease,
        filter .18s ease;
}

.bingo-rejected-button:hover {

    transform:
        translateY(-2px);

    filter:
        brightness(1.08);

    box-shadow:
        0 12px 30px
        rgba(220,38,38,.36),

        0 2px 0
        rgba(255,255,255,.14)
        inset;
}

.bingo-rejected-button:active {

    transform:
        translateY(1px);

    box-shadow:
        0 5px 14px
        rgba(220,38,38,.25);
}

.button-arrow {

    font-size: 20px;

    line-height: 1;

    transition:
        transform .18s ease;
}

.bingo-rejected-button:hover
.button-arrow {

    transform:
        translateX(4px);
}


/* =====================================================
   ANIMATIONS
   ===================================================== */

@keyframes bingoRejectedEnter {

    0% {

        opacity: 0;

        transform:
            translateY(28px)
            scale(.93);
    }

    60% {

        opacity: 1;

        transform:
            translateY(-3px)
            scale(1.015);
    }

    100% {

        opacity: 1;

        transform:
            translateY(0)
            scale(1);
    }
}


@keyframes rejectedIconPulse {

    0%,
    100% {

        box-shadow:
            0 0 0 8px
            rgba(239,68,68,.035),

            0 0 35px
            rgba(239,68,68,.12);
    }

    50% {

        box-shadow:
            0 0 0 12px
            rgba(239,68,68,.045),

            0 0 45px
            rgba(239,68,68,.22);
    }
}


/* =====================================================
   MOBILE
   ===================================================== */

@media (max-width: 480px) {

    #bingoRejectedOverlay {

        padding: 14px;
    }

    .bingo-rejected-modal {

        width: 100%;

        padding:
            28px
            20px
            20px;

        border-radius: 20px;
    }

    .bingo-rejected-icon-wrap {

        width: 72px;

        height: 72px;

        margin-bottom: 15px;
    }

    .bingo-rejected-icon {

        width: 48px;

        height: 48px;
    }

    .bingo-rejected-title {

        font-size: 24px;
    }

    .bingo-rejected-message {

        font-size: 14px;
    }

    .bingo-rejected-tip {

        font-size: 12px;

        padding:
            11px
            12px;
    }

    .bingo-rejected-button {

        min-height: 50px;
    }
}


/* =====================================================
   REDUCED MOTION
   ===================================================== */

@media (prefers-reduced-motion: reduce) {

    .bingo-rejected-modal,
    .bingo-rejected-icon-wrap {

        animation: none;
    }

    .bingo-rejected-modal {

        opacity: 1;

        transform: none;
    }
}

`;

        document.head.appendChild(
            style
        );
    }

    // Trigger entrance animation
    requestAnimationFrame(() => {

        requestAnimationFrame(() => {

            overlay.classList.add(
                "show"
            );

        });

    });
}

// =====================================================
// BINGO STAR CELEBRATION
// =====================================================

function showBingoStarCelebration() {

    const existing =
        document.getElementById(
            "bingoStarCelebration"
        );

    if (existing) {
        return;
    }

    const overlay =
        document.createElement("div");

    overlay.id =
        "bingoStarCelebration";

    overlay.style.position =
        "fixed";

    overlay.style.inset =
        "0";

    overlay.style.pointerEvents =
        "none";

    overlay.style.overflow =
        "hidden";

    overlay.style.zIndex =
        "99999";

    document.body.appendChild(
        overlay
    );

    const gold =
        "#FFD700";

    const fragment =
        document.createDocumentFragment();

    for (
        let i = 0;
        i < 80;
        i++
    ) {

        const star =
            document.createElement(
                "div"
            );

        star.textContent =
            "★";

        star.style.position =
            "absolute";

        star.style.top =
            "-40px";

        star.style.left =
            Math.random() * 100 +
            "vw";

        star.style.color =
            gold;

        star.style.fontSize =
            Math.random() * 20 +
            14 +
            "px";

        star.style.fontWeight =
            "900";

        star.style.textShadow =
            "0 0 8px #FFD700, " +
            "0 0 18px #FFD700, " +
            "0 0 30px rgba(255,215,0,.8)";

        star.style.opacity =
            "0.95";

        const duration =
            4 +
            Math.random() * 4;

        const delay =
            Math.random() * 1.5;

        star.style.animation =
            `bingoStarFall ${duration}s linear ${delay}s forwards`;

        fragment.appendChild(
            star
        );
    }

    overlay.appendChild(
        fragment
    );

    if (
        !document.getElementById(
            "bingoStarStyle"
        )
    ) {

        const style =
            document.createElement(
                "style"
            );

        style.id =
            "bingoStarStyle";

        style.textContent = `
@keyframes bingoStarFall {

    0% {

        transform:
            translateY(-50px)
            rotate(0deg)
            scale(.6);

        opacity: 0;
    }

    10% {
        opacity: 1;
    }

    100% {

        transform:
            translateY(110vh)
            rotate(720deg)
            scale(1);

        opacity: 0;
    }
}
`;

        document.head.appendChild(
            style
        );
    }

    setTimeout(() => {

        if (overlay) {
            overlay.remove();
        }

    }, 9000);
}

// =====================================================
// BINGO ANIMATION API
// =====================================================

window.bingoAnimation = {
    show:
        showBingoStarCelebration
};

// =====================================================
// EXPORT PLAYER STATE
// =====================================================

window.getPlayerState =
    function () {
        return playerState;
    };

window.checkPlayerBingo =
    function () {
        checkForBingo();
    };

// =====================================================
// BEFORE UNLOAD
// =====================================================

window.addEventListener(
    "beforeunload",
    () => {

        if (playerSocket) {
            playerSocket.disconnect();
        }
    }
);

// =====================================================
// START PLAYER
// =====================================================

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializePlayer
    );

} else {

    initializePlayer();
}
