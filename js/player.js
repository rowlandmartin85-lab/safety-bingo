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
    connected: false,
    lastRejectedPatternKey: null // Prevents re-triggering identical rejected claims
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
    [0,1,2,3,4],     [5,6,7,8,9],     [10,11,12,13,14],
    [15,16,17,18,19],[20,21,22,23,24],[0,5,10,15,20],
    [1,6,11,16,21],  [2,7,12,17,22],  [3,8,13,18,23],
    [4,9,14,19,24],  [0,6,12,18,24],  [4,8,12,16,20]
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
    initializeSocket();
    loadCardFromURL();

    console.log("SAFETY BINGO PLAYER READY");
}

// =====================================================
// SOCKET INITIALIZATION
// =====================================================

function initializeSocket() {
    if (typeof io !== "function") {
        console.error("SOCKET.IO NOT FOUND. Make sure socket.io is loaded before player.js.");
        return;
    }

    try {
        playerSocket = io(window.location.origin, {
            transports: ["websocket", "polling"],
            reconnection: true,
            reconnectionAttempts: 10
        });
    } catch (error) {
        console.error("SOCKET INITIALIZATION ERROR:", error);
        return;
    }

    setupSocketEvents();
}

// =====================================================
// SOCKET EVENTS
// =====================================================

function setupSocketEvents() {
    if (!playerSocket) return;

    playerSocket.on("connect", () => {
        playerState.connected = true;
        console.log("PLAYER CONNECTED:", playerSocket.id);

        playerSocket.emit("requestGameStateSyncFallback");

        if (playerState.cardID) {
            playerSocket.emit("loadCard", playerState.cardID);
            // Sync all marked cells back to server on reconnect
            syncMarkedCellsToServer();
        }
    });

    playerSocket.on("disconnect", () => {
        playerState.connected = false;
        console.log("PLAYER DISCONNECTED");
    });

    playerSocket.on("connect_error", error => {
        console.error("PLAYER SOCKET CONNECTION ERROR:", error);
    });

    playerSocket.on("gameState", handleGameState);
    playerSocket.on("gameReset", handleGameReset);
    playerSocket.on("winApproved", handleWinApproved);
    playerSocket.on("winRejected", handleWinRejected);
    playerSocket.on("cardLoaded", data => {
        console.log("CARD CONFIRMED BY SERVER:", data);
    });
}

// =====================================================
// SYNC MARKED CELLS
// =====================================================

function syncMarkedCellsToServer() {
    if (!playerSocket || !playerState.connected || !playerState.cardID) return;

    playerState.grid.forEach((cell, index) => {
        if (cell && cell.marked) {
            playerSocket.emit("markCard", {
                id: playerState.cardID,
                index: index,
                marked: true
            });
        }
    });
}

// =====================================================
// PLAYER BUTTONS
// =====================================================

function setupPlayerButtons() {
    if (playerUI.loadButton) {
        playerUI.loadButton.onclick = () => {
            if (!playerUI.cardInput) {
                console.error("CARD INPUT NOT FOUND");
                return;
            }

            const id = playerUI.cardInput.value.trim();
            if (!id) {
                alert("Enter Card ID");
                return;
            }

            loadPlayerCard(id);
        };
    }

    if (playerUI.cardInput) {
        playerUI.cardInput.addEventListener("keydown", event => {
            if (event.key === "Enter" && playerUI.loadButton) {
                playerUI.loadButton.click();
            }
        });
    }
}

// =====================================================
// LOAD CARD FROM URL
// =====================================================

function loadCardFromURL() {
    try {
        const params = new URLSearchParams(window.location.search);
        const id = params.get("card");

        if (id && playerUI.cardInput) {
            playerUI.cardInput.value = id;
            setTimeout(() => {
                loadPlayerCard(id);
            }, 300);
        }
    } catch (error) {
        console.error("URL CARD LOAD ERROR:", error);
    }
}

// =====================================================
// LOAD PLAYER CARD
// =====================================================

function loadPlayerCard(id) {
    console.log("LOADING PLAYER CARD:", id);

    if (typeof window.generateCard !== "function") {
        console.error("CARD GENERATOR NOT FOUND.");
        alert("The Bingo card generator is not loaded. Please refresh the page.");
        return;
    }

    const cardID = Number(id);
    if (!Number.isInteger(cardID) || cardID < 1) {
        console.error("INVALID CARD ID:", id);
        alert("Invalid Card ID");
        return;
    }

    let card = null;

    try {
        card = window.generateCard(cardID);
    } catch (error) {
        console.error("CARD GENERATION ERROR:", error);
        alert("The Bingo card could not be generated.");
        return;
    }

    if (!card || !Array.isArray(card.grid) || card.grid.length !== 25) {
        console.error("INVALID CARD STRUCTURE:", card);
        alert("Invalid Bingo card structure.");
        return;
    }

    playerState.cardID = cardID;
    playerState.card = card;
    playerState.grid = card.grid;
    playerState.calledAnswers = [];

    playerState.locked = false;
    playerState.claimPending = false;
    playerState.winApproved = false;
    playerState.lastRejectedPatternKey = null;

    renderPlayerCard();

    if (playerSocket) {
        playerSocket.emit("loadCard", cardID);
    }

    console.log("CARD LOADED SUCCESSFULLY:", cardID);
}

// =====================================================
// RENDER PLAYER CARD
// =====================================================

function renderPlayerCard() {
    if (!playerUI.cardArea || !Array.isArray(playerState.grid)) {
        console.error("CARD AREA OR GRID MISSING.");
        return;
    }

    playerUI.cardArea.innerHTML = "";

    playerState.grid.forEach((cell, index) => {
        if (!cell) return;

        const box = document.createElement("div");
        box.className = "bingo-cell";
        box.textContent = cell.text || "";

        const isFree = cell.isFreeSpace === true || cell.text === "FREE" || cell.text === "FREE SPACE";

        if (isFree) {
            cell.marked = true;
            box.classList.add("free-space", "cell-marked");
        } else if (cell.marked === true) {
            box.classList.add("cell-marked");
        }

        box.addEventListener("click", () => {
            if (isFree || playerState.winApproved || playerState.claimPending || playerState.locked) {
                return;
            }

            // Toggle selected answer
            cell.marked = !cell.marked;
            box.classList.toggle("cell-marked", cell.marked);

            // Clear rejected state on new user interaction
            playerState.lastRejectedPatternKey = null;

            // Send selection to server
            if (playerSocket && playerState.connected) {
                playerSocket.emit("markCard", {
                    id: playerState.cardID,
                    index: index,
                    marked: cell.marked
                });
            }

            // Check for Bingo
            checkForBingo();
        });

        playerUI.cardArea.appendChild(box);
    });

    if (playerUI.gameArea) {
        playerUI.gameArea.style.display = "block";
    }

    setTimeout(() => {
        if (typeof window.fitBingoCellText === "function") {
            try {
                window.fitBingoCellText();
            } catch (error) {
                console.error("CELL TEXT FIT ERROR:", error);
            }
        }
    }, 50);
}

// =====================================================
// GAME STATE & RESET HANDLERS
// =====================================================

function handleGameState(state) {
    if (!state) return;

    if (Array.isArray(state.calledAnswers)) {
        playerState.calledAnswers = [...state.calledAnswers];
        window.playerCalledAnswers = [...state.calledAnswers];
    }

    if (playerUI.gameMessage) {
        playerUI.gameMessage.textContent = state.status === "running"
            ? (state.currentQuestion || "")
            : "Waiting for game...";
    }
}

function handleGameReset() {
    console.log("PLAYER GAME RESET");

    playerState.cardID = null;
    playerState.card = null;
    playerState.grid = [];
    playerState.calledAnswers = [];

    playerState.locked = false;
    playerState.claimPending = false;
    playerState.winApproved = false;
    playerState.lastRejectedPatternKey = null;

    if (playerUI.cardArea) playerUI.cardArea.innerHTML = "";
    if (playerUI.gameMessage) playerUI.gameMessage.textContent = "Waiting for host...";
    if (playerUI.cardInput) playerUI.cardInput.value = "";
}

// =====================================================
// CHECK FOR BINGO
// =====================================================

function isValidBingoCell(index) {
    const cell = playerState.grid[index];
    if (!cell) return false;

    return cell.isFreeSpace === true || cell.text === "FREE" || cell.text === "FREE SPACE" || cell.marked === true;
}

function checkForBingo() {
    if (playerState.grid.length !== 25 || playerState.claimPending || playerState.winApproved || playerState.locked) {
        return;
    }

    for (const pattern of winningPatterns) {
        const bingo = pattern.every(index => isValidBingoCell(index));

        if (!bingo) continue;

        const patternKey = pattern.join(",");
        if (playerState.lastRejectedPatternKey === patternKey) {
            console.log("SKIPPING REJECTED BINGO PATTERN:", patternKey);
            continue;
        }

        console.log("BINGO DETECTED:", pattern);
        sendBingoClaim(pattern);
        return;
    }
}

// =====================================================
// SEND BINGO CLAIM
// =====================================================

function sendBingoClaim(winningPattern) {
    if (playerState.claimPending || playerState.winApproved || playerState.locked) return;

    if (!playerState.cardID || !playerSocket || !playerState.connected) {
        console.error("BINGO CLAIM FAILED: MISSING CARD ID OR SOCKET");
        return;
    }

    playerState.claimPending = true;
    playerState.locked = true;

    const markedIndices = [];
    playerState.grid.forEach((cell, index) => {
        if (cell.marked || cell.isFreeSpace || cell.text === "FREE" || cell.text === "FREE SPACE") {
            markedIndices.push(index);
        }
    });

    const claimData = {
        cardId: playerState.cardID,
        markedIndices: markedIndices,
        winningPattern: [...winningPattern],
        timestamp: Date.now()
    };

    console.log("========== SENDING BINGO CLAIM ==========", claimData);
    playerSocket.emit("claimWin", claimData);
}

// =====================================================
// WIN APPROVAL / REJECTION
// =====================================================

function handleWinApproved(data) {
    if (!data || Number(data.cardId) !== Number(playerState.cardID)) return;

    console.log("========== BINGO APPROVED ==========");
    playerState.claimPending = false;
    playerState.locked = true;
    playerState.winApproved = true;

    if (window.bingoAnimation && typeof window.bingoAnimation.show === "function") {
        window.bingoAnimation.show();
    } else {
        alert("🎉 BINGO!");
    }
}

function handleWinRejected(data) {
    if (!data || Number(data.cardId) !== Number(playerState.cardID)) return;

    console.log("========== BINGO REJECTED ==========", data);

    playerState.claimPending = false;
    playerState.locked = false;
    playerState.winApproved = false;

    if (Array.isArray(data.winningPattern)) {
        playerState.lastRejectedPatternKey = data.winningPattern.join(",");
    }

    if (playerUI.gameMessage) {
        playerUI.gameMessage.textContent = "Bingo rejected. Keep playing!";
    }

    alert("Bingo was not approved. Keep playing!");
}

// =====================================================
// OPTIMIZED BINGO STAR CELEBRATION
// =====================================================

function showBingoStarCelebration() {
    if (document.getElementById("bingoStarCelebration")) return;

    const overlay = document.createElement("div");
    overlay.id = "bingoStarCelebration";
    Object.assign(overlay.style, {
        position: "fixed",
        inset: "0",
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: "99999"
    });

    document.body.appendChild(overlay);

    const fragment = document.createDocumentFragment();
    const starCount = 80; // Optimized count for performance

    for (let i = 0; i < starCount; i++) {
        const star = document.createElement("div");
        star.textContent = "★";
        Object.assign(star.style, {
            position: "absolute",
            top: "-40px",
            left: `${Math.random() * 100}vw`,
            color: "#FFD700",
            fontSize: `${Math.random() * 20 + 14}px`,
            fontWeight: "900",
            textShadow: "0 0 8px #FFD700, 0 0 18px #FFD700",
            opacity: "0.95",
            animation: `bingoStarFall ${4 + Math.random() * 4}s linear ${Math.random() * 1.5}s forwards`
        });
        fragment.appendChild(star);
    }
    overlay.appendChild(fragment);

    if (!document.getElementById("bingoStarStyle")) {
        const style = document.createElement("style");
        style.id = "bingoStarStyle";
        style.textContent = `
            @keyframes bingoStarFall {
                0% { transform: translateY(-50px) rotate(0deg) scale(.6); opacity: 0; }
                10% { opacity: 1; }
                100% { transform: translateY(110vh) rotate(720deg) scale(1); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }

    setTimeout(() => overlay.remove(), 9000);
}

// =====================================================
// EXPORTS & INITIALIZATION
// =====================================================

window.bingoAnimation = { show: showBingoStarCelebration };
window.getPlayerState = () => playerState;
window.checkPlayerBingo = () => checkForBingo();

window.addEventListener("beforeunload", () => {
    if (playerSocket) playerSocket.disconnect();
});

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializePlayer);
} else {
    initializePlayer();
}
