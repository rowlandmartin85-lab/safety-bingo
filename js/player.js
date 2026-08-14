"use strict";

// =====================================================
// SAFETY BINGO PLAYER.JS
// SERVER-AUDITED PLAYER VERSION
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

    console.log(
        "=========================================="
    );

    console.log(
        "SAFETY BINGO PLAYER INITIALIZING"
    );

    console.log(
        "=========================================="
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

    console.log(
        "PLAYER UI:",
        playerUI
    );

    setupPlayerButtons();

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
// NEW TAB / WINDOW REDIRECT
// =====================================================

function handleNewWindowRedirect() {

    try {

        const params =
            new URLSearchParams(
                window.location.search
            );

        if (
            params.get("newTab") === "true" ||
            params.get("openWindow") === "true"
        ) {

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
            "================================================"
        );

        console.error(
            "SOCKET.IO NOT FOUND"
        );

        console.error(
            "Make sure /socket.io/socket.io.js is loaded"
        );

        console.error(
            "before player.js."
        );

        console.error(
            "================================================"
        );

        return;
    }

    try {

        playerSocket =
            io(window.location.origin, {

                transports: [
                    "websocket",
                    "polling"
                ],

                reconnection: true,

                reconnectionAttempts: Infinity,

                reconnectionDelay: 1000,

                reconnectionDelayMax: 5000
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

    // =================================================
    // CONNECT
    // =================================================

    playerSocket.on(
        "connect",
        () => {

            playerState.connected =
                true;

            console.log(
                "PLAYER CONNECTED:",
                playerSocket.id
            );

            // Ask server for current game state
            playerSocket.emit(
                "requestGameStateSyncFallback"
            );

            // Re-register card after reconnect
            if (playerState.cardID) {

                console.log(
                    "RE-REGISTERING PLAYER CARD:",
                    playerState.cardID
                );

                playerSocket.emit(
                    "loadCard",
                    playerState.cardID
                );

                // Re-send server-side marked cells
                syncMarkedCellsToServer();
            }
        }
    );

    // =================================================
    // DISCONNECT
    // =================================================

    playerSocket.on(
        "disconnect",
        reason => {

            playerState.connected =
                false;

            console.log(
                "PLAYER DISCONNECTED:",
                reason
            );
        }
    );

    // =================================================
    // CONNECTION ERROR
    // =================================================

    playerSocket.on(
        "connect_error",
        error => {

            playerState.connected =
                false;

            console.error(
                "PLAYER SOCKET CONNECTION ERROR:",
                error
            );
        }
    );

    // =================================================
    // GAME STATE
    // =================================================

    playerSocket.on(
        "gameState",
        handleGameState
    );

    // =================================================
    // GAME RESET
    // =================================================

    playerSocket.on(
        "gameReset",
        handleGameReset
    );

    // =================================================
    // CARD LOADED
    // =================================================

    playerSocket.on(
        "cardLoaded",
        data => {

            console.log(
                "SERVER CONFIRMED CARD LOAD:",
                data
            );

            if (!data) {
                return;
            }

            const serverCardID =
                Number(data.cardId);

            if (
                Number.isInteger(
                    serverCardID
                )
            ) {

                if (
                    playerState.cardID ===
                    serverCardID
                ) {

                    console.log(
                        "CARD REGISTRATION CONFIRMED:",
                        serverCardID
                    );

                    if (
                        playerUI.gameMessage &&
                        playerState.grid.length === 25
                    ) {

                        playerUI.gameMessage.textContent =
                            "Card loaded. Waiting for game...";
                    }
                }
            }
        }
    );

    // =================================================
    // CARD LOAD ERROR
    // =================================================

    playerSocket.on(
        "cardLoadError",
        data => {

            console.error(
                "SERVER CARD LOAD ERROR:",
                data
            );

            /*
             * Do NOT erase the locally generated card.
             *
             * The server's loadCard event is for registering
             * the player's card/session. The actual Bingo
             * card is generated locally.
             */

            if (playerUI.gameMessage) {

                playerUI.gameMessage.textContent =
                    (
                        data &&
                        data.error
                    )
                        ? data.error
                        : "Unable to register card with server.";
            }
        }
    );

    // =================================================
    // SERVER MARK CONFIRMATION
    // =================================================

    playerSocket.on(
        "cardMarkConfirmed",
        data => {

            if (!data) {
                return;
            }

            const cardID =
                Number(data.cardId);

            const index =
                Number(data.index);

            if (
                cardID !==
                Number(playerState.cardID)
            ) {
                return;
            }

            if (
                !Number.isInteger(index) ||
                index < 0 ||
                index > 24
            ) {
                return;
            }

            const cell =
                playerState.grid[index];

            if (!cell) {
                return;
            }

            cell.marked =
                data.marked === true;

            console.log(
                "SERVER MARK CONFIRMED:",
                index,
                cell.marked
            );
        }
    );

    // =================================================
    // SERVER MARK REJECTED
    // =================================================

    playerSocket.on(
        "cardMarkRejected",
        data => {

            console.warn(
                "SERVER REJECTED CARD MARK:",
                data
            );
        }
    );

    // =================================================
    // DIGITAL WIN APPROVED
    // =================================================

    playerSocket.on(
        "winApproved",
        handleWinApproved
    );

    // =================================================
    // DIGITAL WIN REJECTED
    // =================================================

    playerSocket.on(
        "winRejected",
        handleWinRejected
    );

    // =================================================
    // BINGO AUDIT RESULT
    // =================================================

    playerSocket.on(
        "bingoClaimAudit",
        data => {

            console.log(
                "BINGO CLAIM AUDIT RESULT:",
                data
            );

            if (!data) {
                return;
            }

            if (
                Number(data.cardId) !==
                Number(playerState.cardID)
            ) {
                return;
            }

            /*
             * The server has accepted the claim for
             * host review.
             */
            if (
                data.success === true &&
                data.pending === true
            ) {

                playerState.claimPending =
                    true;

                playerState.locked =
                    true;

                if (playerUI.gameMessage) {

                    playerUI.gameMessage.textContent =
                        "Bingo claim sent to host for verification...";
                }

                return;
            }

            /*
             * Server rejected the claim before host review.
             */
            if (
                data.success === false &&
                data.approved === false
            ) {

                playerState.claimPending =
                    false;

                playerState.locked =
                    false;

                playerState.claimRejected =
                    true;

                if (
                    Array.isArray(
                        data.serverWinningPattern
                    )
                ) {

                    playerState.lastRejectedPatternKey =
                        data.serverWinningPattern.join(",");
                }

                if (playerUI.gameMessage) {

                    playerUI.gameMessage.textContent =
                        data.reason ||
                        "Bingo claim rejected by server audit.";
                }
            }
        }
    );

    // =================================================
    // PHYSICAL WIN EVENTS
    // =================================================

    playerSocket.on(
        "physicalWinApproved",
        data => {

            if (!data) {
                return;
            }

            if (
                Number(data.cardId) !==
                Number(playerState.cardID)
            ) {
                return;
            }

            playerState.locked =
                true;

            playerState.winApproved =
                true;

            if (playerUI.gameMessage) {

                playerUI.gameMessage.textContent =
                    "🎉 BINGO APPROVED!";
            }

            showBingoStarCelebration();
        }
    );

    playerSocket.on(
        "physicalWinRejected",
        data => {

            if (!data) {
                return;
            }

            if (
                Number(data.cardId) !==
                Number(playerState.cardID)
            ) {
                return;
            }

            if (playerUI.gameMessage) {

                playerUI.gameMessage.textContent =
                    "Physical Bingo claim rejected.";
            }
        }
    );

    // =================================================
    // GAME ENDED
    // =================================================

    playerSocket.on(
        "gameEnded",
        data => {

            console.log(
                "GAME ENDED:",
                data
            );

            if (
                playerState.winApproved
            ) {
                return;
            }

            if (playerUI.gameMessage) {

                playerUI.gameMessage.textContent =
                    "Game ended.";
            }
        }
    );
}

// =====================================================
// SYNC MARKED CELLS TO SERVER
// =====================================================

function syncMarkedCellsToServer() {

    if (
        !playerSocket ||
        !playerState.connected ||
        !playerState.cardID ||
        !Array.isArray(playerState.grid)
    ) {
        return;
    }

    playerState.grid.forEach(
        (cell, index) => {

            if (!cell) {
                return;
            }

            if (
                cell.marked === true ||
                isFreeCell(cell, index)
            ) {

                playerSocket.emit(
                    "markCard",
                    {
                        id:
                            playerState.cardID,

                        index:
                            index,

                        marked:
                            true
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

    if (playerUI.cardInput) {

        playerUI.cardInput.addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                    "Enter"
                ) {

                    event.preventDefault();

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

            /*
             * Give the card generator time to load.
             * loadPlayerCard() also retries if necessary.
             */
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
// WAIT FOR CARD GENERATOR
// =====================================================

function waitForCardGenerator(
    callback,
    attempts = 0
) {

    if (
        typeof window.generateCard ===
        "function"
    ) {

        callback();

        return;
    }

    if (attempts >= 20) {

        console.error(
            "CARD GENERATOR NEVER BECAME AVAILABLE."
        );

        alert(
            "The Bingo card generator could not be loaded. Please refresh the page."
        );

        return;
    }

    console.log(
        "WAITING FOR CARD GENERATOR..."
    );

    setTimeout(
        () => {

            waitForCardGenerator(
                callback,
                attempts + 1
            );

        },
        250
    );
}

// =====================================================
// LOAD PLAYER CARD
// =====================================================

function loadPlayerCard(id) {

    console.log(
        "=========================================="
    );

    console.log(
        "LOADING PLAYER CARD:",
        id
    );

    console.log(
        "=========================================="
    );

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

    /*
     * Important:
     *
     * Do not require generateCard() to exist immediately.
     * This prevents a script-loading race from making
     * cards appear to be broken.
     */

    waitForCardGenerator(
        () => {

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

            console.log(
                "GENERATED CARD:",
                card
            );

            if (!card) {

                console.error(
                    "CARD GENERATOR RETURNED NOTHING"
                );

                alert(
                    "Invalid Bingo card."
                );

                return;
            }

            /*
             * Normal expected format:
             *
             * {
             *     grid: [...]
             * }
             */

            if (
                !Array.isArray(
                    card.grid
                )
            ) {

                console.error(
                    "CARD HAS NO GRID:",
                    card
                );

                alert(
                    "The Bingo card does not contain a valid grid."
                );

                return;
            }

            if (
                card.grid.length !==
                25
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
             * Normalize the cells without destroying
             * the existing card generator's data.
             */
            const normalizedGrid =
                card.grid.map(
                    (cell, index) => {

                        if (
                            cell &&
                            typeof cell ===
                            "object"
                        ) {

                            return {
                                ...cell,

                                marked:
                                    cell.marked === true ||
                                    index === 12
                            };
                        }

                        /*
                         * Also support a generator that
                         * returns simple strings/numbers.
                         */
                        return {

                            text:
                                String(
                                    cell ??
                                    ""
                                ),

                            marked:
                                index === 12,

                            isFreeSpace:
                                index === 12
                        };
                    }
                );

            card.grid =
                normalizedGrid;

            // =============================================
            // SAVE PLAYER CARD
            // =============================================

            playerState.cardID =
                cardID;

            playerState.card =
                card;

            playerState.grid =
                normalizedGrid;

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

            // =============================================
            // UPDATE INPUT
            // =============================================

            if (
                playerUI.cardInput
            ) {

                playerUI.cardInput.value =
                    String(cardID);
            }

            // =============================================
            // RENDER
            // =============================================

            renderPlayerCard();

            // =============================================
            // REGISTER CARD WITH SERVER
            // =============================================

            if (
                playerSocket &&
                playerState.connected
            ) {

                console.log(
                    "REGISTERING CARD WITH SERVER:",
                    cardID
                );

                playerSocket.emit(
                    "loadCard",
                    cardID
                );

            } else {

                console.warn(
                    "CARD GENERATED LOCALLY; SOCKET NOT YET CONNECTED"
                );
            }

            console.log(
                "=========================================="
            );

            console.log(
                "CARD LOADED SUCCESSFULLY:",
                cardID
            );

            console.log(
                "=========================================="
            );
        }
    );
}

// =====================================================
// FREE CELL
// =====================================================

function isFreeCell(
    cell,
    index
) {

    if (
        index === 12
    ) {
        return true;
    }

    if (!cell) {
        return false;
    }

    return (
        cell.isFreeSpace === true ||
        cell.text === "FREE" ||
        cell.text === "FREE SPACE"
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

    if (
        playerState.grid.length !==
        25
    ) {

        console.error(
            "PLAYER GRID MUST CONTAIN 25 CELLS."
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

            box.dataset.index =
                String(index);

            box.textContent =
                cell.text ??
                "";

            const isFree =
                isFreeCell(
                    cell,
                    index
                );

            if (isFree) {

                cell.marked =
                    true;

                cell.isFreeSpace =
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

            // =============================================
            // CELL CLICK
            // =============================================

            box.addEventListener(
                "click",
                () => {

                    if (isFree) {

                        return;
                    }

                    // Approved Bingo
                    if (
                        playerState.winApproved
                    ) {

                        console.log(
                            "CARD LOCKED - BINGO APPROVED"
                        );

                        return;
                    }

                    // Pending host audit
                    if (
                        playerState.claimPending
                    ) {

                        console.log(
                            "CLAIM PENDING - WAITING FOR HOST"
                        );

                        return;
                    }

                    // Temporary lock
                    if (
                        playerState.locked
                    ) {

                        console.log(
                            "PLAYER LOCKED"
                        );

                        return;
                    }

                    // =================================
                    // TOGGLE CELL
                    // =================================

                    cell.marked =
                        cell.marked !== true;

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

                    // =================================
                    // RESET REJECTION LOCK
                    // =================================

                    playerState.claimRejected =
                        false;

                    playerState.lastRejectedPatternKey =
                        null;

                    // =================================
                    // SERVER MARK
                    // =================================

                    if (
                        playerSocket &&
                        playerState.connected &&
                        playerState.cardID
                    ) {

                        playerSocket.emit(
                            "markCard",
                            {

                                id:
                                    playerState.cardID,

                                index:
                                    index,

                                marked:
                                    cell.marked === true
                            }
                        );
                    }

                    // =================================
                    // CHECK BINGO
                    // =================================

                    checkForBingo();
                }
            );

            playerUI.cardArea.appendChild(
                box
            );
        }
    );

    // =============================================
    // SHOW GAME AREA
    // =============================================

    if (playerUI.gameArea) {

        playerUI.gameArea.style.display =
            "block";
    }

    // =============================================
    // FIT CELL TEXT
    // =============================================

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

    // =============================================
    // CALLED ANSWERS
    // =============================================

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

    // =============================================
    // MESSAGE
    // =============================================

    if (playerUI.gameMessage) {

        if (
            state.status ===
            "running"
        ) {

            playerUI.gameMessage.textContent =
                state.currentQuestion ||
                "Game in progress...";

        } else if (
            state.status ===
            "ended"
        ) {

            playerUI.gameMessage.textContent =
                "Game ended.";

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

    return (
        cell.marked === true ||
        isFreeCell(
            cell,
            index
        )
    );
}

// =====================================================
// CHECK FOR BINGO
// =====================================================

function checkForBingo() {

    if (
        playerState.grid.length !==
        25
    ) {
        return;
    }

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

    /*
     * A rejected claim is temporarily held until
     * the player changes the board.
     */
    if (
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
                    isValidBingoCell(
                        index
                    )
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

        if (playerUI.gameMessage) {

            playerUI.gameMessage.textContent =
                "Waiting for server connection...";
        }

        return;
    }

    // =============================================
    // TEMPORARY LOCK
    // =============================================

    playerState.claimPending =
        true;

    playerState.locked =
        true;

    // =============================================
    // COLLECT MARKED CELLS
    // =============================================

    const markedIndices =
        [];

    playerState.grid.forEach(
        (cell, index) => {

            if (
                cell &&
                (
                    cell.marked === true ||
                    isFreeCell(
                        cell,
                        index
                    )
                )
            ) {

                markedIndices.push(
                    index
                );
            }
        }
    );

    // Make sure FREE is included
    if (
        !markedIndices.includes(12)
    ) {

        markedIndices.push(12);
    }

    markedIndices.sort(
        (a, b) =>
            a - b
    );

    // =============================================
    // CLAIM DATA
    // =============================================

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
        "=========================================="
    );

    console.log(
        "SENDING BINGO CLAIM"
    );

    console.log(
        claimData
    );

    console.log(
        "=========================================="
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
        "=========================================="
    );

    console.log(
        "BINGO APPROVED"
    );

    console.log(
        data
    );

    console.log(
        "=========================================="
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
        playerUI.gameMessage
    ) {

        playerUI.gameMessage.textContent =
            "🎉 BINGO APPROVED!";
    }

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
        "=========================================="
    );

    console.log(
        "BINGO REJECTED"
    );

    console.log(
        data
    );

    console.log(
        "=========================================="
    );

    // =============================================
    // UNLOCK PLAYER
    // =============================================

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
            data.reason ||
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
            Math.random() *
            100 +
            "vw";

        star.style.color =
            gold;

        star.style.fontSize =
            Math.random() *
            20 +
            14 +
            "px";

        star.style.fontWeight =
            "900";

        star.style.textShadow =
            "0 0 8px #FFD700, 0 0 18px #FFD700, 0 0 30px rgba(255,215,0,.8)";

        star.style.opacity =
            "0.95";

        const duration =
            4 +
            Math.random() *
            4;

        const delay =
            Math.random() *
            1.5;

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
