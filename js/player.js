"use strict";

// =====================================================
// SAFETY BINGO PLAYER
// CLEAN PLAYER.JS
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
    connected: false
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
// INITIALIZE PLAYER
// =====================================================

function initializePlayer() {
    console.log("SAFETY BINGO PLAYER INITIALIZING");

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
    initializeSocket();
    loadCardFromURL();

    console.log("SAFETY BINGO PLAYER READY");
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
            transports: ["websocket", "polling"],
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

    // -------------------------------------------------
    // CONNECT
    // -------------------------------------------------

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
        }
    });

    // -------------------------------------------------
    // DISCONNECT
    // -------------------------------------------------

    playerSocket.on("disconnect", () => {
        playerState.connected = false;

        console.log(
            "PLAYER DISCONNECTED"
        );
    });

    // -------------------------------------------------
    // CONNECTION ERROR
    // -------------------------------------------------

    playerSocket.on(
        "connect_error",
        error => {
            console.error(
                "PLAYER SOCKET CONNECTION ERROR:",
                error
            );
        }
    );

    // -------------------------------------------------
    // GAME STATE
    // -------------------------------------------------

    playerSocket.on(
        "gameState",
        handleGameState
    );

    // -------------------------------------------------
    // GAME RESET
    // -------------------------------------------------

    playerSocket.on(
        "gameReset",
        handleGameReset
    );

    // -------------------------------------------------
    // WIN APPROVED
    // -------------------------------------------------

    playerSocket.on(
        "winApproved",
        handleWinApproved
    );

    // -------------------------------------------------
    // WIN REJECTED
    // -------------------------------------------------

    playerSocket.on(
        "winRejected",
        handleWinRejected
    );

    // -------------------------------------------------
    // CARD LOADED
    // -------------------------------------------------

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

    // -------------------------------------------------
    // CHECK CARD GENERATOR
    // -------------------------------------------------

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

    // -------------------------------------------------
    // VALIDATE CARD ID
    // -------------------------------------------------

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

    // -------------------------------------------------
    // GENERATE CARD
    // -------------------------------------------------

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

    // -------------------------------------------------
    // VALIDATE CARD
    // -------------------------------------------------

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

    // -------------------------------------------------
    // SAVE CARD
    // -------------------------------------------------

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

    // -------------------------------------------------
    // RENDER CARD
    // -------------------------------------------------

    renderPlayerCard();

    // -------------------------------------------------
    // TELL SERVER ABOUT CARD
    // -------------------------------------------------

    if (
        playerSocket &&
        playerSocket.connected
    ) {
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

    playerUI.cardArea.innerHTML = "";

    playerState.grid.forEach(
        (cell, index) => {
            const box =
                document.createElement(
                    "div"
                );

            box.className =
                "bingo-cell";

            box.textContent =
                cell.text || "";

            // -------------------------------------------------
            // FREE SPACE
            // -------------------------------------------------

            const isFree =
                cell.isFreeSpace === true ||
                cell.text === "FREE" ||
                cell.text === "FREE SPACE";

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

            // -------------------------------------------------
            // CELL CLICK
            // -------------------------------------------------

            box.addEventListener(
                "click",
                () => {
                    // Free space cannot be changed
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

                    // Waiting for host decision
                    if (
                        playerState.claimPending
                    ) {
                        console.log(
                            "CLAIM PENDING - WAITING FOR HOST"
                        );

                        return;
                    }

                    // Extra safety lock
                    if (
                        playerState.locked
                    ) {
                        console.log(
                            "PLAYER LOCKED"
                        );

                        return;
                    }

                    // Toggle cell
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

                    // Tell server
                    if (playerSocket) {
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

                    // Check Bingo
                    checkForBingo();
                }
            );

            playerUI.cardArea.appendChild(
                box
            );
        }
    );

    // -------------------------------------------------
    // SHOW GAME AREA
    // -------------------------------------------------

    if (playerUI.gameArea) {
        playerUI.gameArea.style.display =
            "block";
    }

    // -------------------------------------------------
    // FIT CELL TEXT
    // -------------------------------------------------

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
// GAME STATE HANDLER
// =====================================================

function handleGameState(state) {
    if (!state) {
        return;
    }

    // -------------------------------------------------
    // CALLED ANSWERS
    // -------------------------------------------------

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

    // -------------------------------------------------
    // GAME MESSAGE
    // -------------------------------------------------

    if (playerUI.gameMessage) {
        if (
            state.status ===
            "running"
        ) {
            playerUI.gameMessage.textContent =
                state.currentQuestion || "";
        } else {
            playerUI.gameMessage.textContent =
                "Waiting for game...";
        }
    }

    // Do not modify:
    // locked
    // claimPending
    // winApproved
    //
    // Those are controlled by the Bingo events.

    checkForBingo();
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

    // Free space always counts
    if (
        cell.isFreeSpace === true ||
        cell.text === "FREE" ||
        cell.text === "FREE SPACE"
    ) {
        return true;
    }

    return cell.marked === true;
}

// =====================================================
// CHECK FOR BINGO
// =====================================================

function checkForBingo() {
    // No card
    if (
        playerState.grid.length !== 25
    ) {
        return;
    }

    // Claim waiting
    if (
        playerState.claimPending
    ) {
        return;
    }

    // Already approved
    if (
        playerState.winApproved
    ) {
        return;
    }

    // Safety lock
    if (
        playerState.locked
    ) {
        return;
    }

    for (
        const pattern of
        winningPatterns
    ) {
        const bingo =
            pattern.every(
                index =>
                    isValidBingoCell(
                        index
                    )
            );

        if (!bingo) {
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
    // Prevent duplicate claims
    if (
        playerState.claimPending
    ) {
        return;
    }

    if (
        playerState.winApproved
    ) {
        return;
    }

    if (
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

    // -------------------------------------------------
    // TEMPORARY LOCK
    // -------------------------------------------------

    playerState.locked =
        true;

    playerState.claimPending =
        true;

    // -------------------------------------------------
    // COLLECT MARKED CELLS
    // -------------------------------------------------

    const markedIndices =
        [];

    playerState.grid.forEach(
        (cell, index) => {
            if (
                cell.marked === true ||
                cell.isFreeSpace === true ||
                cell.text === "FREE" ||
                cell.text === "FREE SPACE"
            ) {
                markedIndices.push(
                    index
                );
            }
        }
    );

    // -------------------------------------------------
    // CREATE CLAIM
    // -------------------------------------------------

    const claimData = {
        cardId:
            playerState.cardID,

        markedIndices:
            markedIndices,

        winningPattern:
            [
                ...winningPattern
            ],

        timestamp:
            Date.now()
    };

    console.log(
        "========== SENDING BINGO CLAIM =========="
    );

    console.log(
        claimData
    );

    // -------------------------------------------------
    // SEND CLAIM
    // -------------------------------------------------

    if (!playerSocket) {
        console.error(
            "BINGO CLAIM FAILED: SOCKET NOT INITIALIZED"
        );

        playerState.locked =
            false;

        playerState.claimPending =
            false;

        return;
    }

    if (!playerSocket.connected) {
        console.error(
            "BINGO CLAIM FAILED: SOCKET NOT CONNECTED"
        );

        playerState.locked =
            false;

        playerState.claimPending =
            false;

        return;
    }

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

    // Claim is finished
    playerState.claimPending =
        false;

    // Permanently lock card
    playerState.locked =
        true;

    playerState.winApproved =
        true;

    // Celebration
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

    // -------------------------------------------------
    // CRITICAL:
    // REJECTION DOES NOT ELIMINATE PLAYER
    // -------------------------------------------------

    playerState.claimPending =
        false;

    playerState.locked =
        false;

    playerState.winApproved =
        false;

    console.log(
        "PLAYER UNLOCKED AFTER BINGO REJECTION"
    );

    /*
     * Do NOT automatically call checkForBingo().
     *
     * The player can now change their selections.
     * The next click will perform the next check.
     */

    alert(
        "Bingo was not approved. Keep playing!"
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

    // -------------------------------------------------
    // CREATE STARS
    // -------------------------------------------------

    for (
        let i = 0;
        i < 260;
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
            Math.random() *
            100 +
            "vw";

        star.style.color =
            gold;

        star.style.fontSize =
            (
                Math.random() *
                24 +
                12
            ) +
            "px";

        star.style.fontWeight =
            "900";

        star.style.textShadow =
            "0 0 8px #FFD700," +
            "0 0 18px #FFD700," +
            "0 0 30px rgba(255,215,0,.8)";

        star.style.opacity =
            "0.95";

        const duration =
            5 +
            Math.random() *
            5;

        const delay =
            Math.random() *
            2;

        star.style.animation =
            `bingoStarFall ${duration}s linear ${delay}s forwards`;

        overlay.appendChild(
            star
        );
    }

    // -------------------------------------------------
    // ANIMATION CSS
    // -------------------------------------------------

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

    // -------------------------------------------------
    // REMOVE AFTER ANIMATION
    // -------------------------------------------------

    setTimeout(
        () => {
            if (overlay) {
                overlay.remove();
            }
        },
        10000
    );
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
    function() {
        return playerState;
    };

window.checkPlayerBingo =
    function() {
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
        initializePlayer,
        {
            once: true
        }
    );
} else {
    initializePlayer();
}
