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

    /*
    Stores the exact winning pattern that was rejected.

    This prevents the same rejected pattern from being
    automatically submitted over and over until the
    player changes the board.
    */

    lastRejectedPatternKey: null,

    /*
    Stores the most recent audit result.

    Example:

    {
        correct: [0, 1],
        wrong: [2, 3],
        missed: [4, 5]
    }
    */

    auditResult: null

};


// =====================================================
// PLAYER UI
// =====================================================

const playerUI = {

    cardInput: null,

    loadButton: null,

    cardArea: null,

    gameArea: null,

    gameMessage: null,

    auditArea: null

};


// =====================================================
// WINNING PATTERNS
// 0 - 24 INDEX GRID
// =====================================================

const winningPatterns = [

    // -------------------------------------------------
    // ROWS
    // -------------------------------------------------

    [0, 1, 2, 3, 4],

    [5, 6, 7, 8, 9],

    [10, 11, 12, 13, 14],

    [15, 16, 17, 18, 19],

    [20, 21, 22, 23, 24],


    // -------------------------------------------------
    // COLUMNS
    // -------------------------------------------------

    [0, 5, 10, 15, 20],

    [1, 6, 11, 16, 21],

    [2, 7, 12, 17, 22],

    [3, 8, 13, 18, 23],

    [4, 9, 14, 19, 24],


    // -------------------------------------------------
    // DIAGONALS
    // -------------------------------------------------

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
        document.getElementById(
            "cardInput"
        );


    playerUI.loadButton =
        document.getElementById(
            "loadCardBtn"
        );


    playerUI.cardArea =
        document.getElementById(
            "cardArea"
        );


    playerUI.gameArea =
        document.getElementById(
            "gameArea"
        );


    playerUI.gameMessage =
        document.getElementById(
            "gameState"
        );


    /*
    The audit area is optional.

    If your HTML already contains:

        <div id="auditArea"></div>

    it will be used.

    Otherwise this script creates one automatically.
    */

    playerUI.auditArea =
        document.getElementById(
            "auditArea"
        );


    setupAuditStyles();


    setupPlayerButtons();


    /*
    Check whether this page was launched
    as a new player window.
    */

    if (
        handleNewWindowRedirect()
    ) {

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

            /*
            Remove the trigger parameters so
            the new window does not open another
            window.
            */

            params.delete(
                "newTab"
            );

            params.delete(
                "openWindow"
            );


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


            if (
                playerUI.gameMessage
            ) {

                playerUI.gameMessage.textContent =
                    "Player board opened in a new tab!";

            }


            return true;

        }

    }
    catch (error) {

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

    if (
        typeof io !== "function"
    ) {

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

    }
    catch (error) {

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
        function() {

            playerState.connected =
                true;


            console.log(
                "PLAYER CONNECTED:",
                playerSocket.id
            );


            /*
            Request the latest game state.
            */

            playerSocket.emit(
                "requestGameStateSyncFallback"
            );


            /*
            If the player already has a card,
            tell the server about it.
            */

            if (
                playerState.cardID
            ) {

                playerSocket.emit(
                    "loadCard",
                    playerState.cardID
                );


                /*
                Re-send the player's marked cells.

                This is especially important after
                a temporary socket disconnect.
                */

                syncMarkedCellsToServer();

            }

        }
    );


    // =================================================
    // DISCONNECT
    // =================================================

    playerSocket.on(
        "disconnect",
        function() {

            playerState.connected =
                false;


            console.log(
                "PLAYER DISCONNECTED"
            );

        }
    );


    // =================================================
    // CONNECTION ERROR
    // =================================================

    playerSocket.on(
        "connect_error",
        function(error) {

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
    // WIN APPROVED
    // =================================================

    playerSocket.on(
        "winApproved",
        handleWinApproved
    );


    // =================================================
    // WIN REJECTED
    // =================================================

    playerSocket.on(
        "winRejected",
        handleWinRejected
    );


    // =================================================
    // CARD LOADED
    // =================================================

    playerSocket.on(
        "cardLoaded",
        function(data) {

            console.log(
                "CARD CONFIRMED BY SERVER:",
                data
            );

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
        !playerState.cardID
    ) {

        return;

    }


    if (
        !Array.isArray(
            playerState.grid
        )
    ) {

        return;

    }


    playerState.grid.forEach(
        function(cell, index) {

            if (!cell) {

                return;

            }


            const isFree =
                isFreeSpace(
                    cell,
                    index
                );


            /*
            Free space is always considered marked.
            */

            if (
                cell.marked === true ||
                isFree
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

    // =================================================
    // LOAD CARD
    // =================================================

    if (
        playerUI.loadButton
    ) {

        playerUI.loadButton.onclick =
            function() {

                if (
                    !playerUI.cardInput
                ) {

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


                loadPlayerCard(
                    id
                );

            };

    }


    // =================================================
    // ENTER KEY
    // =================================================

    if (
        playerUI.cardInput
    ) {

        playerUI.cardInput.addEventListener(
            "keydown",
            function(event) {

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
            params.get(
                "card"
            );


        if (
            id &&
            playerUI.cardInput
        ) {

            playerUI.cardInput.value =
                id;


            setTimeout(
                function() {

                    loadPlayerCard(
                        id
                    );

                },
                300
            );

        }

    }
    catch (error) {

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


    let card =
        null;


    try {

        card =
            window.generateCard(
                cardID
            );

    }
    catch (error) {

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


    // =================================================
    // STORE CARD
    // =================================================

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


    playerState.auditResult =
        null;


    clearAuditDisplay();


    // =================================================
    // ENABLE PLAYER GAME
    // =================================================

    renderPlayerCard();


    if (
        playerSocket
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
// FREE SPACE CHECK
// =====================================================

function isFreeSpace(
    cell,
    index
) {

    if (!cell) {

        return false;

    }


    return (
        cell.isFreeSpace === true ||
        cell.isFree === true ||
        cell.free === true ||
        cell.text === "FREE" ||
        cell.text === "FREE SPACE" ||
        index === 12
    );

}


// =====================================================
// RENDER PLAYER CARD
// =====================================================

function renderPlayerCard() {

    if (
        !playerUI.cardArea
    ) {

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
        function(cell, index) {

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
                index;


            box.textContent =
                cell.text || "";


            const free =
                isFreeSpace(
                    cell,
                    index
                );


            // =================================================
            // FREE SPACE
            // =================================================

            if (free) {

                /*
                Free space is permanently marked.
                */

                cell.marked =
                    true;


                box.classList.add(
                    "free-space",
                    "cell-marked"
                );

            }


            // =================================================
            // NORMAL MARKED CELL
            // =================================================

            else if (
                cell.marked === true
            ) {

                box.classList.add(
                    "cell-marked"
                );

            }


            // =================================================
            // CLICK
            // =================================================

            box.addEventListener(
                "click",
                function() {

                    /*
                    FREE SPACE CANNOT CHANGE.
                    */

                    if (free) {

                        return;

                    }


                    /*
                    APPROVED BINGO PERMANENTLY
                    LOCKS THE CARD.
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
                    CLAIM IS CURRENTLY WITH HOST.

                    Player cannot alter the card
                    while host is reviewing.
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


                    // =================================================
                    // TOGGLE CELL
                    // =================================================

                    cell.marked =
                        !cell.marked;


                    if (
                        cell.marked
                    ) {

                        box.classList.add(
                            "cell-marked"
                        );

                    }
                    else {

                        box.classList.remove(
                            "cell-marked"
                        );

                    }


                    /*
                    IMPORTANT:

                    Any board modification after a rejected
                    claim clears the rejected-pattern block.

                    It also clears the previous audit display.
                    */

                    playerState.claimRejected =
                        false;


                    playerState.lastRejectedPatternKey =
                        null;


                    clearAuditDisplay();


                    // =================================================
                    // SEND MARK STATE TO SERVER
                    // =================================================

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


                    // =================================================
                    // CHECK BINGO
                    // =================================================

                    checkForBingo();

                }
            );


            playerUI.cardArea.appendChild(
                box
            );

        }
    );


    // =================================================
    // SHOW GAME AREA
    // =================================================

    if (
        playerUI.gameArea
    ) {

        playerUI.gameArea.style.display =
            "block";

    }


    // =================================================
    // FIT CELL TEXT
    // =================================================

    setTimeout(
        function() {

            if (
                typeof window.fitBingoCellText ===
                "function"
            ) {

                try {

                    window.fitBingoCellText();

                }
                catch (error) {

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


    // =================================================
    // CALLED ANSWERS
    // =================================================

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


    // =================================================
    // GAME MESSAGE
    // =================================================

    if (
        playerUI.gameMessage
    ) {

        if (
            state.status === "running"
        ) {

            playerUI.gameMessage.textContent =
                state.currentQuestion || "";

        }
        else {

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


    // =================================================
    // RESET STATE
    // =================================================

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


    playerState.auditResult =
        null;


    window.playerCalledAnswers =
        [];


    // =================================================
    // CLEAR CARD
    // =================================================

    if (
        playerUI.cardArea
    ) {

        playerUI.cardArea.innerHTML =
            "";

    }


    clearAuditDisplay();


    // =================================================
    // RESET INPUT
    // =================================================

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


    // =================================================
    // RESET MESSAGE
    // =================================================

    if (
        playerUI.gameMessage
    ) {

        playerUI.gameMessage.textContent =
            "Enter your Card ID to begin.";

    }


    // =================================================
    // HIDE GAME
    // =================================================

    if (
        playerUI.gameArea
    ) {

        playerUI.gameArea.style.display =
            "none";

    }


    // =================================================
    // REMOVE BINGO CELEBRATION
    // =================================================

    if (
        window.bingoAnimation &&
        typeof window.bingoAnimation.reset ===
        "function"
    ) {

        window.bingoAnimation.reset();

    }
    else {

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
        isFreeSpace(
            cell,
            index
        )
    ) {

        return true;

    }


    return cell.marked === true;

}


// =====================================================
// GET CURRENT MARKED INDICES
// =====================================================

function getCurrentMarkedIndices() {

    const markedIndices =
        [];


    if (
        !Array.isArray(
            playerState.grid
        )
    ) {

        return markedIndices;

    }


    playerState.grid.forEach(
        function(cell, index) {

            if (!cell) {

                return;

            }


            if (
                cell.marked === true ||
                isFreeSpace(
                    cell,
                    index
                )
            ) {

                markedIndices.push(
                    index
                );

            }

        }
    );


    return markedIndices;

}


// =====================================================
// GET COMPLETE CLAIM CELLS
// =====================================================

function getClaimCells() {

    if (
        !Array.isArray(
            playerState.grid
        )
    ) {

        return [];

    }


    return playerState.grid.map(
        function(cell, index) {

            if (!cell) {

                return {

                    index:
                        index,

                    text:
                        "",

                    marked:
                        false,

                    isFree:
                        false

                };

            }


            return {

                index:
                    index,

                /*
                Include multiple possible answer
                properties because different versions
                of the card generator may use different
                property names.
                */

                text:
                    cell.text || "",

                question:
                    cell.question ||
                    cell.prompt ||
                    cell.clue ||
                    "",

                answer:
                    cell.answer ||
                    cell.correctAnswer ||
                    cell.value ||
                    "",

                id:
                    cell.id ||
                    cell.answerId ||
                    cell.questionId ||
                    null,

                marked:
                    cell.marked === true,

                isFree:
                    isFreeSpace(
                        cell,
                        index
                    )

            };

        }
    );

}


// =====================================================
// CHECK FOR BINGO
// =====================================================

function checkForBingo() {

    if (
        playerState.grid.length !== 25
    ) {

        return;

    }


    /*
    Do not submit another claim while one
    is waiting for host approval.
    */

    if (
        playerState.claimPending
    ) {

        return;

    }


    /*
    Approved Bingo permanently ends play.
    */

    if (
        playerState.winApproved
    ) {

        return;

    }


    /*
    Temporary safety lock.
    */

    if (
        playerState.locked
    ) {

        return;

    }


    /*
    If the player has just been rejected,
    don't immediately submit the exact same
    pattern again.

    A board change clears this protection.
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
                function(index) {

                    return isValidBingoCell(
                        index
                    );

                }
            );


        if (!bingo) {

            continue;

        }


        const patternKey =
            pattern.join(",");


        /*
        Extra protection against duplicate
        submission of the same rejected pattern.
        */

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

        if (
            playerUI.gameMessage
        ) {

            playerUI.gameMessage.textContent =
                "Unable to submit Bingo. Reconnecting...";

        }

        return;

    }


    /*
    Temporary lock while host reviews.
    */

    playerState.claimPending =
        true;


    playerState.locked =
        true;


    // =================================================
    // CAPTURE EXACT MARKED STATE
    // =================================================

    const markedIndices =
        getCurrentMarkedIndices();


    // =================================================
    // CAPTURE COMPLETE CARD INFORMATION
    // =================================================

    const claimCells =
        getClaimCells();


    // =================================================
    // CLAIM DATA
    // =================================================

    const claimData = {

        cardId:
            playerState.cardID,

        markedIndices:
            [
                ...markedIndices
            ],

        winningPattern:
            [
                ...winningPattern
            ],

        /*
        NEW:

        Send the actual cell information as well.

        This gives the server enough information to
        audit the player's selections without having
        to guess what each index represents.
        */

        cells:
            claimCells,

        /*
        Include the current called answers.

        This can be used by the server audit if
        calledAnswers are part of the game's rules.
        */

        calledAnswers:
            [
                ...playerState.calledAnswers
            ],

        timestamp:
            Date.now()

    };


    console.log(
        "========== SENDING BINGO CLAIM =========="
    );


    console.log(
        "CLAIM DATA:",
        claimData
    );


    // =================================================
    // SEND TO SERVER
    // =================================================

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
        "========== BINGO APPROVED ==========",
        data
    );


    playerState.claimPending =
        false;


    playerState.claimRejected =
        false;


    /*
    Approved Bingo permanently locks
    the player's card.
    */

    playerState.locked =
        true;


    playerState.winApproved =
        true;


    /*
    Store audit data if the server included it.
    */

    playerState.auditResult =
        extractAuditResult(
            data
        );


    if (
        playerUI.gameMessage
    ) {

        playerUI.gameMessage.textContent =
            "🎉 BINGO APPROVED!";

    }


    /*
    If an audit was supplied, display it.
    */

    if (
        playerState.auditResult
    ) {

        displayAuditResult(
            playerState.auditResult,
            true
        );

    }


    // =================================================
    // CELEBRATION
    // =================================================

    if (
        window.bingoAnimation &&
        typeof window.bingoAnimation.show ===
        "function"
    ) {

        window.bingoAnimation.show();

    }
    else {

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


    /*
    =====================================================
    CRITICAL BEHAVIOR
    =====================================================

    A rejected Bingo claim DOES NOT disable the card.

    The player remains active.

    The player may:

    - unmark incorrect cells
    - mark other cells
    - continue playing
    - eventually submit another valid Bingo
    */


    playerState.claimPending =
        false;


    playerState.locked =
        false;


    playerState.winApproved =
        false;


    playerState.claimRejected =
        true;


    /*
    Remember the rejected pattern.
    */

    if (
        Array.isArray(
            data.winningPattern
        )
    ) {

        playerState.lastRejectedPatternKey =
            data.winningPattern.join(",");

    }
    else {

        playerState.lastRejectedPatternKey =
            null;

    }


    // =================================================
    // EXTRACT AUDIT
    // =================================================

    const audit =
        extractAuditResult(
            data
        );


    playerState.auditResult =
        audit;


    // =================================================
    // UPDATE MESSAGE
    // =================================================

    if (
        playerUI.gameMessage
    ) {

        playerUI.gameMessage.textContent =
            "Bingo rejected. Review the audit below, unmark incorrect spaces, and keep playing!";

    }


    // =================================================
    // DISPLAY AUDIT
    // =================================================

    if (audit) {

        displayAuditResult(
            audit,
            false
        );

    }
    else {

        console.warn(
            "WIN REJECTED BUT NO AUDIT DATA WAS PROVIDED BY SERVER.",
            data
        );


        displayAuditMessage(
            "Bingo was rejected, but the server did not provide detailed audit information."
        );

    }


    console.log(
        "PLAYER UNLOCKED - CONTINUE PLAYING"
    );


    /*
    Alert is intentionally retained so the
    player knows the claim was rejected.
    */

    alert(
        "Bingo was not approved. Review the audit, unmark incorrect answers, and keep playing!"
    );

}


// =====================================================
// EXTRACT AUDIT RESULT
// =====================================================

function extractAuditResult(data) {

    if (!data || typeof data !== "object") {

        return null;

    }


    /*
    The server may return the audit directly:

        {
            correct: [],
            wrong: [],
            missed: []
        }

    Or inside:

        data.audit

    Or:

        data.auditResult

    Or:

        data.result
    */

    const source =
        data.audit ||
        data.auditResult ||
        data.result ||
        data;


    if (
        !source ||
        typeof source !== "object"
    ) {

        return null;

    }


    /*
    Find the first usable array for each category.

    This supports several naming conventions.
    */

    const correct =
        findAuditArray(
            source,
            [
                "correct",
                "correctAnswers",
                "correctIndices",
                "correctCells",
                "matched",
                "matches"
            ]
        );


    const wrong =
        findAuditArray(
            source,
            [
                "wrong",
                "wrongAnswers",
                "wrongIndices",
                "wrongCells",
                "incorrect",
                "incorrectAnswers",
                "incorrectIndices",
                "incorrectCells"
            ]
        );


    const missed =
        findAuditArray(
            source,
            [
                "missed",
                "missedAnswers",
                "missedIndices",
                "missedCells",
                "missing",
                "unmarked",
                "unmarkedAnswers",
                "unmarkedIndices"
            ]
        );


    /*
    If the server uses a detailed audit array such as:

        audit: [
            { index: 0, status: "correct" },
            { index: 1, status: "wrong" },
            { index: 2, status: "missed" }
        ]

    convert it.
    */

    let finalCorrect =
        normalizeAuditIndices(
            correct
        );


    let finalWrong =
        normalizeAuditIndices(
            wrong
        );


    let finalMissed =
        normalizeAuditIndices(
            missed
        );


    if (
        Array.isArray(
            source.cells
        )
    ) {

        const detailed =
            convertDetailedAudit(
                source.cells
            );


        finalCorrect =
            mergeUnique(
                finalCorrect,
                detailed.correct
            );


        finalWrong =
            mergeUnique(
                finalWrong,
                detailed.wrong
            );


        finalMissed =
            mergeUnique(
                finalMissed,
                detailed.missed
            );

    }


    if (
        Array.isArray(
            source.answers
        )
    ) {

        const detailed =
            convertDetailedAudit(
                source.answers
            );


        finalCorrect =
            mergeUnique(
                finalCorrect,
                detailed.correct
            );


        finalWrong =
            mergeUnique(
                finalWrong,
                detailed.wrong
            );


        finalMissed =
            mergeUnique(
                finalMissed,
                detailed.missed
            );

    }


    /*
    Some audit systems return:

        {
            audit: {
                correct: 3,
                wrong: 2,
                missed: 1
            }
        }

    That's useful as a summary, but not enough to
    highlight individual cells.

    Preserve those counts separately.
    */

    const summary = {

        correctCount:
            getAuditCount(
                source,
                "correct",
                finalCorrect
            ),

        wrongCount:
            getAuditCount(
                source,
                "wrong",
                finalWrong
            ),

        missedCount:
            getAuditCount(
                source,
                "missed",
                finalMissed
            )

    };


    /*
    If there is absolutely no audit information,
    return null.
    */

    const hasAudit =
        finalCorrect.length > 0 ||
        finalWrong.length > 0 ||
        finalMissed.length > 0 ||
        summary.correctCount !== null ||
        summary.wrongCount !== null ||
        summary.missedCount !== null;


    if (!hasAudit) {

        return null;

    }


    return {

        correct:
            finalCorrect,

        wrong:
            finalWrong,

        missed:
            finalMissed,

        summary:
            summary,

        raw:
            source

    };

}


// =====================================================
// FIND AUDIT ARRAY
// =====================================================

function findAuditArray(
    source,
    keys
) {

    if (
        !source ||
        typeof source !== "object"
    ) {

        return [];

    }


    for (
        const key of keys
    ) {

        if (
            Array.isArray(
                source[key]
            )
        ) {

            return source[key];

        }

    }


    return [];

}


// =====================================================
// NORMALIZE AUDIT INDICES
// =====================================================

function normalizeAuditIndices(
    values
) {

    if (
        !Array.isArray(values)
    ) {

        return [];

    }


    const result =
        [];


    values.forEach(
        function(value) {

            let index =
                null;


            if (
                typeof value === "number"
            ) {

                index =
                    value;

            }
            else if (
                typeof value === "string" &&
                value.trim() !== ""
            ) {

                const parsed =
                    Number(
                        value
                    );


                if (
                    Number.isInteger(
                        parsed
                    )
                ) {

                    index =
                        parsed;

                }

            }
            else if (
                value &&
                typeof value === "object"
            ) {

                const possibleIndex =
                    value.index ??
                    value.cellIndex ??
                    value.position ??
                    value.cell;


                if (
                    possibleIndex !== undefined &&
                    possibleIndex !== null
                ) {

                    const parsed =
                        Number(
                            possibleIndex
                        );


                    if (
                        Number.isInteger(
                            parsed
                        )
                    ) {

                        index =
                            parsed;

                    }

                }

            }


            if (
                Number.isInteger(index) &&
                index >= 0 &&
                index < 25
            ) {

                if (
                    !result.includes(index)
                ) {

                    result.push(
                        index
                    );

                }

            }

        }
    );


    return result.sort(
        function(a, b) {

            return a - b;

        }
    );

}


// =====================================================
// CONVERT DETAILED AUDIT
// =====================================================

function convertDetailedAudit(
    values
) {

    const result = {

        correct: [],

        wrong: [],

        missed: []

    };


    if (
        !Array.isArray(values)
    ) {

        return result;

    }


    values.forEach(
        function(item) {

            if (
                !item ||
                typeof item !== "object"
            ) {

                return;

            }


            const possibleIndex =
                item.index ??
                item.cellIndex ??
                item.position ??
                item.cell;


            const index =
                Number(
                    possibleIndex
                );


            if (
                !Number.isInteger(index) ||
                index < 0 ||
                index >= 25
            ) {

                return;

            }


            const status =
                String(
                    item.status ??
                    item.result ??
                    item.auditStatus ??
                    ""
                ).toLowerCase();


            if (
                status.includes("correct") ||
                status.includes("match") ||
                status === "right"
            ) {

                result.correct.push(
                    index
                );

            }
            else if (
                status.includes("wrong") ||
                status.includes("incorrect") ||
                status === "false"
            ) {

                result.wrong.push(
                    index
                );

            }
            else if (
                status.includes("miss") ||
                status.includes("unmarked") ||
                status.includes("missing")
            ) {

                result.missed.push(
                    index
                );

            }

        }
    );


    result.correct =
        normalizeAuditIndices(
            result.correct
        );


    result.wrong =
        normalizeAuditIndices(
            result.wrong
        );


    result.missed =
        normalizeAuditIndices(
            result.missed
        );


    return result;

}


// =====================================================
// MERGE UNIQUE
// =====================================================

function mergeUnique(
    first,
    second
) {

    return Array.from(
        new Set(
            [
                ...(first || []),
                ...(second || [])
            ]
        )
    ).sort(
        function(a, b) {

            return a - b;

        }
    );

}


// =====================================================
// GET AUDIT COUNT
// =====================================================

function getAuditCount(
    source,
    type,
    fallback
) {

    if (
        !source ||
        typeof source !== "object"
    ) {

        return null;

    }


    const keys = {

        correct: [
            "correctCount",
            "numCorrect",
            "correctTotal"
        ],

        wrong: [
            "wrongCount",
            "incorrectCount",
            "numWrong",
            "wrongTotal"
        ],

        missed: [
            "missedCount",
            "missingCount",
            "numMissed",
            "missedTotal"
        ]

    };


    const possibleKeys =
        keys[type] || [];


    for (
        const key of possibleKeys
    ) {

        if (
            source[key] !== undefined &&
            source[key] !== null
        ) {

            const value =
                Number(
                    source[key]
                );


            if (
                Number.isFinite(value)
            ) {

                return value;

            }

        }

    }


    if (
        Array.isArray(
            fallback
        ) &&
        fallback.length > 0
    ) {

        return fallback.length;

    }


    return null;

}


// =====================================================
// DISPLAY AUDIT RESULT
// =====================================================

function displayAuditResult(
    audit,
    approved
) {

    if (!audit) {

        clearAuditDisplay();

        return;

    }


    ensureAuditArea();


    if (
        !playerUI.auditArea
    ) {

        return;

    }


    playerUI.auditArea.innerHTML =
        "";


    playerUI.auditArea.classList.add(
        "bingo-audit-visible"
    );


    const title =
        document.createElement(
            "div"
        );


    title.className =
        approved
            ? "audit-title audit-approved"
            : "audit-title audit-rejected";


    title.textContent =
        approved
            ? "Bingo Audit — Approved"
            : "Bingo Audit — Review Required";


    playerUI.auditArea.appendChild(
        title
    );


    const summary =
        document.createElement(
            "div"
        );


    summary.className =
        "audit-summary";


    summary.innerHTML =
        buildAuditSummaryHTML(
            audit
        );


    playerUI.auditArea.appendChild(
        summary
    );


    /*
    Detailed sections.
    */

    appendAuditSection(
        "Correct Answers",
        audit.correct,
        "audit-correct",
        "✓"
    );


    appendAuditSection(
        "Wrong Answers",
        audit.wrong,
        "audit-wrong",
        "✗"
    );


    appendAuditSection(
        "Missed Answers",
        audit.missed,
        "audit-missed",
        "!"
    );


    /*
    Highlight the Bingo card itself.
    */

    highlightAuditCells(
        audit
    );


    /*
    Log the complete result so debugging
    is much easier.
    */

    console.log(
        "========== BINGO AUDIT =========="
    );

    console.log(
        "CORRECT:",
        audit.correct
    );

    console.log(
        "WRONG:",
        audit.wrong
    );

    console.log(
        "MISSED:",
        audit.missed
    );

    console.log(
        "RAW AUDIT:",
        audit.raw
    );

}


// =====================================================
// BUILD AUDIT SUMMARY
// =====================================================

function buildAuditSummaryHTML(
    audit
) {

    const correctCount =
        audit.summary.correctCount !== null
            ? audit.summary.correctCount
            : audit.correct.length;


    const wrongCount =
        audit.summary.wrongCount !== null
            ? audit.summary.wrongCount
            : audit.wrong.length;


    const missedCount =
        audit.summary.missedCount !== null
            ? audit.summary.missedCount
            : audit.missed.length;


    return `
        <div class="audit-summary-item audit-summary-correct">
            <strong>${correctCount}</strong>
            <span>Correct</span>
        </div>

        <div class="audit-summary-item audit-summary-wrong">
            <strong>${wrongCount}</strong>
            <span>Wrong</span>
        </div>

        <div class="audit-summary-item audit-summary-missed">
            <strong>${missedCount}</strong>
            <span>Missed</span>
        </div>
    `;

}


// =====================================================
// APPEND AUDIT SECTION
// =====================================================

function appendAuditSection(
    title,
    indices,
    className,
    icon
) {

    if (
        !playerUI.auditArea
    ) {

        return;

    }


    const section =
        document.createElement(
            "div"
        );


    section.className =
        `audit-section ${className}`;


    const heading =
        document.createElement(
            "h4"
        );


    heading.textContent =
        `${icon} ${title}`;


    section.appendChild(
        heading
    );


    if (
        !Array.isArray(indices) ||
        indices.length === 0
    ) {

        const empty =
            document.createElement(
                "div"
            );


        empty.className =
            "audit-empty";


        empty.textContent =
            "None";


        section.appendChild(
            empty
        );

    }
    else {

        indices.forEach(
            function(index) {

                const cell =
                    playerState.grid[index];


                const item =
                    document.createElement(
                        "div"
                    );


                item.className =
                    "audit-item";


                const answerText =
                    getCellDisplayText(
                        cell,
                        index
                    );


                item.innerHTML =
                    `
                    <span class="audit-index">
                        ${index + 1}
                    </span>

                    <span class="audit-answer">
                        ${escapeHTML(answerText)}
                    </span>
                    `;


                /*
                Clicking an audit result scrolls
                to that Bingo cell.
                */

                item.addEventListener(
                    "click",
                    function() {

                        scrollToBingoCell(
                            index
                        );

                    }
                );


                section.appendChild(
                    item
                );

            }
        );

    }


    playerUI.auditArea.appendChild(
        section
    );

}


// =====================================================
// GET CELL DISPLAY TEXT
// =====================================================

function getCellDisplayText(
    cell,
    index
) {

    if (!cell) {

        return `Cell ${index + 1}`;

    }


    return (
        cell.text ||
        cell.answer ||
        cell.correctAnswer ||
        cell.question ||
        cell.prompt ||
        `Cell ${index + 1}`
    );

}


// =====================================================
// HIGHLIGHT AUDIT CELLS
// =====================================================

function highlightAuditCells(
    audit
) {

    if (
        !playerUI.cardArea
    ) {

        return;

    }


    /*
    Remove previous audit classes.
    */

    const cells =
        playerUI.cardArea.querySelectorAll(
            ".bingo-cell"
        );


    cells.forEach(
        function(element) {

            element.classList.remove(
                "audit-correct-cell",
                "audit-wrong-cell",
                "audit-missed-cell"
            );

        }
    );


    /*
    Correct.
    */

    audit.correct.forEach(
        function(index) {

            const element =
                getBingoCellElement(
                    index
                );


            if (element) {

                element.classList.add(
                    "audit-correct-cell"
                );

            }

        }
    );


    /*
    Wrong.
    */

    audit.wrong.forEach(
        function(index) {

            const element =
                getBingoCellElement(
                    index
                );


            if (element) {

                element.classList.add(
                    "audit-wrong-cell"
                );

            }

        }
    );


    /*
    Missed.
    */

    audit.missed.forEach(
        function(index) {

            const element =
                getBingoCellElement(
                    index
                );


            if (element) {

                element.classList.add(
                    "audit-missed-cell"
                );

            }

        }
    );

}


// =====================================================
// GET BINGO CELL ELEMENT
// =====================================================

function getBingoCellElement(
    index
) {

    if (
        !playerUI.cardArea
    ) {

        return null;

    }


    return playerUI.cardArea.querySelector(
        `.bingo-cell[data-index="${index}"]`
    );

}


// =====================================================
// SCROLL TO BINGO CELL
// =====================================================

function scrollToBingoCell(
    index
) {

    const element =
        getBingoCellElement(
            index
        );


    if (!element) {

        return;

    }


    element.scrollIntoView(
        {

            behavior:
                "smooth",

            block:
                "center",

            inline:
                "center"

        }
    );


    element.classList.add(
        "audit-focus-cell"
    );


    setTimeout(
        function() {

            element.classList.remove(
                "audit-focus-cell"
            );

        },
        1500
    );

}


// =====================================================
// ENSURE AUDIT AREA
// =====================================================

function ensureAuditArea() {

    if (
        playerUI.auditArea
    ) {

        return;

    }


    /*
    Create audit area automatically.

    This means you do NOT have to change the HTML
    immediately.
    */

    playerUI.auditArea =
        document.createElement(
            "div"
        );


    playerUI.auditArea.id =
        "auditArea";


    playerUI.auditArea.className =
        "bingo-audit";


    if (
        playerUI.gameArea
    ) {

        playerUI.gameArea.appendChild(
            playerUI.auditArea
        );

    }
    else {

        document.body.appendChild(
            playerUI.auditArea
        );

    }

}


// =====================================================
// CLEAR AUDIT DISPLAY
// =====================================================

function clearAuditDisplay() {

    playerState.auditResult =
        null;


    if (
        playerUI.auditArea
    ) {

        playerUI.auditArea.innerHTML =
            "";

        playerUI.auditArea.classList.remove(
            "bingo-audit-visible"
        );

    }


    if (
        playerUI.cardArea
    ) {

        const cells =
            playerUI.cardArea.querySelectorAll(
                ".bingo-cell"
            );


        cells.forEach(
            function(element) {

                element.classList.remove(
                    "audit-correct-cell",
                    "audit-wrong-cell",
                    "audit-missed-cell",
                    "audit-focus-cell"
                );

            }
        );

    }

}


// =====================================================
// DISPLAY AUDIT MESSAGE
// =====================================================

function displayAuditMessage(
    message
) {

    ensureAuditArea();


    if (
        !playerUI.auditArea
    ) {

        return;

    }


    playerUI.auditArea.innerHTML =
        "";


    const messageElement =
        document.createElement(
            "div"
        );


    messageElement.className =
        "audit-message";


    messageElement.textContent =
        message;


    playerUI.auditArea.appendChild(
        messageElement
    );


    playerUI.auditArea.classList.add(
        "bingo-audit-visible"
    );

}


// =====================================================
// ESCAPE HTML
// =====================================================

function escapeHTML(
    value
) {

    const div =
        document.createElement(
            "div"
        );


    div.textContent =
        String(
            value ?? ""
        );


    return div.innerHTML;

}


// =====================================================
// SETUP AUDIT STYLES
// =====================================================

function setupAuditStyles() {

    if (
        document.getElementById(
            "playerAuditStyles"
        )
    ) {

        return;

    }


    const style =
        document.createElement(
            "style"
        );


    style.id =
        "playerAuditStyles";


    style.textContent = `

        /* ==========================================
           AUDIT CONTAINER
           ========================================== */

        .bingo-audit {

            display: none;

            margin-top: 20px;

            padding: 18px;

            border-radius: 14px;

            background:
                rgba(15, 23, 42, 0.96);

            color: #ffffff;

            box-shadow:
                0 8px 30px
                rgba(0, 0, 0, 0.30);

            font-family:
                Arial,
                sans-serif;

        }


        .bingo-audit-visible {

            display: block;

        }


        /* ==========================================
           TITLE
           ========================================== */

        .audit-title {

            font-size: 22px;

            font-weight: 800;

            margin-bottom: 15px;

        }


        .audit-approved {

            color:
                #22c55e;

        }


        .audit-rejected {

            color:
                #f87171;

        }


        /* ==========================================
           SUMMARY
           ========================================== */

        .audit-summary {

            display: grid;

            grid-template-columns:
                repeat(3, 1fr);

            gap: 10px;

            margin-bottom: 18px;

        }


        .audit-summary-item {

            padding: 12px;

            border-radius: 10px;

            text-align: center;

            background:
                rgba(255, 255, 255, 0.08);

        }


        .audit-summary-item strong {

            display: block;

            font-size: 25px;

        }


        .audit-summary-item span {

            font-size: 13px;

            opacity: 0.9;

        }


        .audit-summary-correct strong {

            color:
                #22c55e;

        }


        .audit-summary-wrong strong {

            color:
                #ef4444;

        }


        .audit-summary-missed strong {

            color:
                #facc15;

        }


        /* ==========================================
           AUDIT SECTIONS
           ========================================== */

        .audit-section {

            margin-top: 15px;

            padding: 12px;

            border-radius: 10px;

            background:
                rgba(255, 255, 255, 0.05);

        }


        .audit-section h4 {

            margin:
                0 0 10px 0;

            font-size:
                16px;

        }


        .audit-correct h4 {

            color:
                #22c55e;

        }


        .audit-wrong h4 {

            color:
                #ef4444;

        }


        .audit-missed h4 {

            color:
                #facc15;

        }


        .audit-item {

            display:
                flex;

            align-items:
                center;

            gap:
                10px;

            padding:
                8px;

            margin:
                4px 0;

            border-radius:
                7px;

            background:
                rgba(255, 255, 255, 0.06);

            cursor:
                pointer;

        }


        .audit-item:hover {

            background:
                rgba(255, 255, 255, 0.13);

        }


        .audit-index {

            display:
                inline-flex;

            align-items:
                center;

            justify-content:
                center;

            min-width:
                28px;

            height:
                28px;

            border-radius:
                50%;

            background:
                rgba(255, 255, 255, 0.12);

            font-weight:
                700;

        }


        .audit-answer {

            word-break:
                break-word;

        }


        .audit-empty {

            opacity:
                0.65;

            font-style:
                italic;

        }


        .audit-message {

            padding:
                10px;

            color:
                #facc15;

        }


        /* ==========================================
           CARD AUDIT COLORS
           ========================================== */

        .bingo-cell.audit-correct-cell {

            outline:
                4px solid #22c55e !important;

            box-shadow:
                0 0 18px
                rgba(34, 197, 94, 0.75) !important;

        }


        .bingo-cell.audit-wrong-cell {

            outline:
                4px solid #ef4444 !important;

            box-shadow:
                0 0 18px
                rgba(239, 68, 68, 0.75) !important;

        }


        .bingo-cell.audit-missed-cell {

            outline:
                4px solid #facc15 !important;

            box-shadow:
                0 0 18px
                rgba(250, 204, 21, 0.75) !important;

        }


        .bingo-cell.audit-focus-cell {

            animation:
                auditCellPulse
                0.5s
                ease-in-out
                3;

        }


        @keyframes auditCellPulse {

            0% {

                transform:
                    scale(1);

            }

            50% {

                transform:
                    scale(1.08);

            }

            100% {

                transform:
                    scale(1);

            }

        }


        /* ==========================================
           MOBILE
           ========================================== */

        @media (
            max-width: 600px
        ) {

            .audit-summary {

                grid-template-columns:
                    1fr;

            }

        }

    `;


    document.head.appendChild(
        style
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
            "0 0 8px #FFD700, 0 0 18px #FFD700, 0 0 30px rgba(255,215,0,.8)";


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


    // =================================================
    // ANIMATION STYLE
    // =================================================

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


    // =================================================
    // REMOVE AFTER ANIMATION
    // =================================================

    setTimeout(
        function() {

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
        function() {

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
    function() {

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

}
else {

    initializePlayer();

}
