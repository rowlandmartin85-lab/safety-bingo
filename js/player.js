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
    automatically submitted over and over until the player
    changes the board.
    */

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

                    This allows the player to continue playing.
                    */

                    playerState.claimRejected =
                        false;


                    playerState.lastRejectedPatternKey =
                        null;


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
        "========== BINGO APPROVED =========="
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


    if (
        playerUI.gameMessage
    ) {

        playerUI.gameMessage.textContent =
            "🎉 BINGO APPROVED!";

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

    Only the exact rejected pattern is temporarily
    prevented from being submitted automatically.
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
    // UPDATE MESSAGE
    // =================================================

    if (
        playerUI.gameMessage
    ) {

        playerUI.gameMessage.textContent =
            "Bingo rejected. Unmark incorrect spaces and keep playing!";

    }


    console.log(
        "PLAYER UNLOCKED - CONTINUE PLAYING"
    );


    /*
    Alert is intentionally retained so the
    player knows the claim was rejected.
    */

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
