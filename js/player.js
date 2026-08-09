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

    console.log(
        "SAFETY BINGO PLAYER INITIALIZING"
    );

    playerUI.cardInput =
        document.getElementById("cardInput");

    playerUI.loadButton =
        document.getElementById("loadCardBtn");

    playerUI.cardArea =
        document.getElementById("cardArea");

    playerUI.gameArea =
        document.getElementById("gameArea");

    playerUI.gameMessage =
        document.getElementById("gameState");

    setupPlayerButtons();

    /*
    Check if this page was launched as a
    new player window.
    */

    if (handleNewWindowRedirect()) {
        return;
    }

    initializeSocket();

    loadCardFromURL();

    console.log(
        "SAFETY BINGO PLAYER READY"
    );
}

// =====================================================
// NEW TAB / WINDOW REDIRECT LOGIC
// =====================================================

function handleNewWindowRedirect() {

    try {

        const params =
            new URLSearchParams(
                window.location.search
            );

        /*
        Triggers if URL contains:
        ?newTab=true
        or
        ?openWindow=true
        */

        if (
            params.get("newTab") === "true" ||
            params.get("openWindow") === "true"
        ) {

            /*
            Remove the auto-open parameter so
            the newly opened window doesn't
            open another window.
            */

            params.delete("newTab");
            params.delete("openWindow");

            const newUrl =
                window.location.pathname +
                (
                    params.toString()
                        ? "?" + params.toString()
                        : ""
                );

            window.open(
                newUrl,
                "_blank",
                "noopener,noreferrer"
            );

            /*
            Inform the original tab.
            */

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

        playerSocket =
            io(
                window.location.origin,
                {
                    transports: [
                        "websocket",
                        "polling"
                    ],

                    reconnection: true,

                    reconnectionAttempts: 10
                }
            );

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

    /*
    ==========================================
    CONNECT
    ==========================================
    */

    playerSocket.on(
        "connect",
        () => {

            playerState.connected = true;

            console.log(
                "PLAYER CONNECTED:",
                playerSocket.id
            );

            /*
            Request current game state.
            */

            playerSocket.emit(
                "requestGameStateSyncFallback"
            );

            /*
            If player already has a card,
            tell the server about it.
            */

            if (playerState.cardID) {

                playerSocket.emit(
                    "loadCard",
                    playerState.cardID
                );

                syncMarkedCellsToServer();
            }

        }
    );

    /*
    ==========================================
    DISCONNECT
    ==========================================
    */

    playerSocket.on(
        "disconnect",
        () => {

            playerState.connected = false;

            console.log(
                "PLAYER DISCONNECTED"
            );

        }
    );

    /*
    ==========================================
    CONNECTION ERROR
    ==========================================
    */

    playerSocket.on(
        "connect_error",
        error => {

            console.error(
                "PLAYER SOCKET CONNECTION ERROR:",
                error
            );

        }
    );

    /*
    ==========================================
    GAME EVENTS
    ==========================================
    */

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

    /*
    ==========================================
    CARD EVENTS
    ==========================================
    */

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

    /*
    ==========================================
    LOAD CARD BUTTON
    ==========================================
    */

    if (playerUI.loadButton) {

        playerUI.loadButton.onclick =
            () => {

                if (!playerUI.cardInput) {

                    console.error(
                        "CARD INPUT NOT FOUND"
                    );

                    return;
                }

                const id =
                    playerUI.cardInput.value.trim();

                if (!id) {

                    alert(
                        "Enter Card ID"
                    );

                    return;
                }

                loadPlayerCard(id);

            };

    }

    /*
    ==========================================
    ENTER KEY
    ==========================================
    */

    if (playerUI.cardInput) {

        playerUI.cardInput.addEventListener(
            "keydown",
            event => {

                if (
                    event.key === "Enter"
                ) {

                    if (
                        playerUI.loadButton
                    ) {

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

            playerUI.cardInput.value =
                id;

            setTimeout(
                () => {

                    loadPlayerCard(id);

                },
                300
            );

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
            window.generateCard(
                cardID
            );

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

    /*
    ==========================================
    STORE CARD
    ==========================================
    */

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

    /*
    ==========================================
    ENABLE PLAYER GAME
    ==========================================
    */

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
                document.createElement(
                    "div"
                );

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

                cell.marked =
                    true;

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

                    /*
                    Free space cannot be changed.
                    */

                    if (isFree) {
                        return;
                    }

                    /*
                    Approved Bingo permanently
                    locks the card.
                    */

                    if (
                        playerState.winApproved
                    ) {

                        console.log(
                            "CARD LOCKED - BINGO APPROVED"
                        );

                        return;
                    }

                    /*
                    Claim waiting for host.
                    */

                    if (
                        playerState.claimPending
                    ) {

                        console.log(
                            "CLAIM PENDING - WAITING FOR HOST"
                        );

                        return;
                    }

                    /*
                    Temporary safety lock.
                    */

                    if (
                        playerState.locked
                    ) {

                        console.log(
                            "PLAYER LOCKED"
                        );

                        return;
                    }

                    /*
                    Toggle selected cell.
                    */

                    cell.marked =
                        !cell.marked;

                    if (
                        cell.marked
                    ) {

                        box.classList.add(
                            "cell-marked"
                        );

                    } else {

                        box.classList.remove(
                            "cell-marked"
                        );

                    }

                    /*
                    Reset rejection locks on
                    any board change.
                    */

                    playerState.claimRejected =
                        false;

                    playerState.lastRejectedPatternKey =
                        null;

                    /*
                    Send selection to server.
                    */

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

                    /*
                    Check for Bingo.
                    */

                    checkForBingo();

                }
            );

            playerUI.cardArea.appendChild(
                box
            );

        }
    );

    /*
    ==========================================
    SHOW GAME AREA
    ==========================================
    */

    if (playerUI.gameArea) {

        playerUI.gameArea.style.display =
            "block";

    }

    /*
    ==========================================
    FIT CELL TEXT
    ==========================================
    */

    setTimeout(
        () => {

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

        },
        50
    );
}

// =====================================================
// GAME STATE
// =====================================================

function handleGameState(state) {

    if (!state) {
        return;
    }

    /*
    ==========================================
    UPDATE CALLED ANSWERS
    ==========================================
    */

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

    /*
    ==========================================
    UPDATE GAME MESSAGE
    ==========================================
    */

    if (
        playerUI.gameMessage
    ) {

        if (
            state.status === "running"
        ) {

            playerUI.gameMessage.textContent =
                state.currentQuestion || "";

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
        "========== PLAYER GAME RESET =========="
    );

    /*
    ==========================================
    RESET PLAYER STATE
    ==========================================
    */

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

    /*
    Clear globally exposed called answers.
    */

    window.playerCalledAnswers =
        [];

    /*
    ==========================================
    CLEAR CARD
    ==========================================
    */

    if (
        playerUI.cardArea
    ) {

        playerUI.cardArea.innerHTML =
            "";

    }

    /*
    ==========================================
    RETURN TO PLAYER START STATE
    ==========================================
    */

    if (
        playerUI.cardInput
    ) {

        playerUI.cardInput.value =
            "";

        playerUI.cardInput.disabled =
            false;

    }

    if (
        playerUI.loadButton
    ) {

        playerUI.loadButton.disabled =
            false;

    }

    if (
        playerUI.gameMessage
    ) {

        playerUI.gameMessage.textContent =
            "Enter your Card ID to begin.";

    }

    /*
    Hide the game area until a new
    card is loaded.
    */

    if (
        playerUI.gameArea
    ) {

        playerUI.gameArea.style.display =
            "none";

    }

    /*
    ==========================================
    REMOVE BINGO CELEBRATION
    ==========================================
    */

    if (
        window.bingoAnimation &&
        typeof window.bingoAnimation.reset ===
        "function"
    ) {

        window.bingoAnimation.reset();

    } else {

        const celebration =
            document.getElementById(
                "bingoStarCelebration"
            );

        if (celebration) {

            celebration.remove();

        }

    }

    console.log(
        "PLAYER RETURNED TO START STATE"
    );
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

    if (
        !playerState.cardID
    ) {

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

    /*
    Temporary lock while host decides.
    */

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

function handleWinApproved(
    data
) {

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

    /*
    Show celebration.
    */

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

function handleWinRejected(
    data
) {

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

    /*
    Completely unlock player and hold
    automatic claiming until board changes.
    */

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

    if (
        playerUI.gameMessage
    ) {

        playerUI.gameMessage.textContent =
            "Bingo rejected. Unmark incorrect spaces and keep playing!";

    }

    alert(
        "Bingo was not approved. Unmark any incorrect answers and keep playing!"
    );
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
        document.createElement(
            "div"
        );

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
            Math.random() * 100 + "vw";

        star.style.color =
            gold;

        star.style.fontSize =
            Math.random() * 20 + 14 + "px";

        star.style.fontWeight =
            "900";

        star.style.textShadow =
            "0 0 8px #FFD700, 0 0 18px #FFD700, 0 0 30px rgba(255,215,0,.8)";

        star.style.opacity =
            "0.95";

        const duration =
            4 + Math.random() * 4;

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

    /*
    ==========================================
    ANIMATION STYLE
    ==========================================
    */

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
@keyframes bingoStarFall{
    0%{
        transform: translateY(-50px) rotate(0deg) scale(.6);
        opacity:0;
    }

    10%{
        opacity:1;
    }

    100%{
        transform: translateY(110vh) rotate(720deg) scale(1);
        opacity:0;
    }
}
`;

        document.head.appendChild(
            style
        );

    }

    /*
    Automatically remove celebration
    after the animation finishes.
    */

    setTimeout(
        () => {

            if (overlay) {
                overlay.remove();
            }

        },
        9000
    );
}

// =====================================================
// BINGO ANIMATION API
// =====================================================

window.bingoAnimation = {

    show:
        showBingoStarCelebration,

    reset:
        function () {

            const celebration =
                document.getElementById(
                    "bingoStarCelebration"
                );

            if (celebration) {

                celebration.remove();

            }

        }

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
