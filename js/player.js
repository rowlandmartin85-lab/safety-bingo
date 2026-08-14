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
    ==========================================
    NEW TAB / WINDOW
    ==========================================
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
// NEW TAB / WINDOW REDIRECT LOGIC
// =====================================================

function handleNewWindowRedirect() {

    try {

        const params =
            new URLSearchParams(
                window.location.search
            );


        if (
            params.get("newTab") ===
                "true" ||
            params.get("openWindow") ===
                "true"
        ) {

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
                        ? "?" +
                          params.toString()
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

    } catch (
        error
    ) {

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
        typeof io !==
        "function"
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

                    reconnection:
                        true,

                    reconnectionAttempts:
                        10

                }
            );

    } catch (
        error
    ) {

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

    if (
        !playerSocket
    ) {

        return;

    }


    playerSocket.on(
        "connect",
        () => {

            playerState.connected =
                true;


            console.log(
                "PLAYER CONNECTED:",
                playerSocket.id
            );


            playerSocket.emit(
                "requestGameStateSyncFallback"
            );


            if (
                playerState.cardID
            ) {

                playerSocket.emit(
                    "loadCard",
                    playerState.cardID
                );


                syncMarkedCellsToServer();

            }

        }
    );


    playerSocket.on(
        "disconnect",
        () => {

            playerState.connected =
                false;


            console.log(
                "PLAYER DISCONNECTED"
            );

        }
    );


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
        (
            cell,
            index
        ) => {

            if (
                cell &&
                cell.marked
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

    if (
        playerUI.loadButton
    ) {

        playerUI.loadButton.onclick =
            () => {

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


                if (
                    !id
                ) {

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


    if (
        playerUI.cardInput
    ) {

        playerUI.cardInput.addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                    "Enter"
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
                () => {

                    loadPlayerCard(
                        id
                    );

                },
                300
            );

        }

    } catch (
        error
    ) {

        console.error(
            "URL CARD LOAD ERROR:",
            error
        );

    }

}


// =====================================================
// LOAD PLAYER CARD
// =====================================================

function loadPlayerCard(
    id
) {

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
        Number(
            id
        );


    if (
        !Number.isInteger(
            cardID
        ) ||
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

    } catch (
        error
    ) {

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
        !Array.isArray(
            card.grid
        )
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


    hideBingoRejectedOverlay();


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
        (
            cell,
            index
        ) => {

            if (
                !cell
            ) {

                return;

            }


            const box =
                document.createElement(
                    "div"
                );


            box.className =
                "bingo-cell";


            box.textContent =
                cell.text ||
                "";


            const isFree =
                cell.isFreeSpace ===
                    true ||
                cell.text ===
                    "FREE" ||
                cell.text ===
                    "FREE SPACE" ||
                index ===
                    12;


            if (
                isFree
            ) {

                cell.marked =
                    true;

                box.classList.add(
                    "free-space",
                    "cell-marked"
                );

            } else if (
                cell.marked ===
                true
            ) {

                box.classList.add(
                    "cell-marked"
                );

            }


            box.addEventListener(
                "click",
                () => {

                    if (
                        isFree
                    ) {

                        return;

                    }


                    if (
                        playerState.winApproved
                    ) {

                        console.log(
                            "CARD LOCKED - BINGO APPROVED"
                        );

                        return;

                    }


                    if (
                        playerState.claimPending
                    ) {

                        console.log(
                            "CLAIM PENDING - WAITING FOR HOST"
                        );

                        return;

                    }


                    if (
                        playerState.locked
                    ) {

                        console.log(
                            "PLAYER LOCKED"
                        );

                        return;

                    }


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


                    playerState.claimRejected =
                        false;

                    playerState.lastRejectedPatternKey =
                        null;


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


                    checkForBingo();

                }
            );


            playerUI.cardArea.appendChild(
                box
            );

        }
    );


    if (
        playerUI.gameArea
    ) {

        playerUI.gameArea.style.display =
            "block";

    }


    setTimeout(
        () => {

            if (
                typeof window.fitBingoCellText ===
                "function"
            ) {

                try {

                    window.fitBingoCellText();

                } catch (
                    error
                ) {

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

function handleGameState(
    state
) {

    if (
        !state
    ) {

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


    if (
        playerUI.gameMessage
    ) {

        if (
            state.status ===
            "running"
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


    hideBingoRejectedOverlay();


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


    if (
        playerUI.cardArea
    ) {

        playerUI.cardArea.innerHTML =
            "";

    }


    if (
        playerUI.gameMessage
    ) {

        playerUI.gameMessage.textContent =
            "Waiting for host...";

    }


    if (
        playerUI.cardInput
    ) {

        playerUI.cardInput.value =
            "";

    }

}


// =====================================================
// VALID BINGO CELL
// =====================================================

function isValidBingoCell(
    index
) {

    const cell =
        playerState.grid[
            index
        ];


    if (
        !cell
    ) {

        return false;

    }


    if (
        cell.isFreeSpace ===
            true ||
        cell.text ===
            "FREE" ||
        cell.text ===
            "FREE SPACE" ||
        index ===
            12
    ) {

        return true;

    }


    return cell.marked ===
        true;

}


// =====================================================
// CHECK FOR BINGO
// =====================================================

function checkForBingo() {

    if (
        playerState.grid.length !==
            25 ||
        playerState.claimPending ||
        playerState.winApproved ||
        playerState.locked ||
        playerState.claimRejected
    ) {

        return;

    }


    for (
        const pattern
        of winningPatterns
    ) {

        const bingo =
            pattern.every(
                index =>
                    isValidBingoCell(
                        index
                    )
            );


        if (
            !bingo
        ) {

            continue;

        }


        const patternKey =
            pattern.join(
                ","
            );


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


    playerState.claimPending =
        true;

    playerState.locked =
        true;


    const markedIndices =
        [];


    playerState.grid.forEach(
        (
            cell,
            index
        ) => {

            if (
                cell.marked ===
                    true ||
                cell.isFreeSpace ===
                    true ||
                cell.text ===
                    "FREE" ||
                cell.text ===
                    "FREE SPACE" ||
                index ===
                    12
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
            [
                ...winningPattern
            ],

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

    if (
        !data
    ) {

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


    hideBingoRejectedOverlay();


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
// CREATE BINGO REJECTED OVERLAY
// =====================================================

function createBingoRejectedOverlay() {

    if (
        document.getElementById(
            "bingoRejectedOverlay"
        )
    ) {

        return;

    }


    const overlay =
        document.createElement(
            "div"
        );


    overlay.id =
        "bingoRejectedOverlay";


    overlay.innerHTML = `

        <div class="bingo-rejected-window">

            <div class="bingo-rejected-icon">

                ✕

            </div>


            <div class="bingo-rejected-title">

                BINGO REJECTED

            </div>


            <div class="bingo-rejected-divider"></div>


            <div class="bingo-rejected-message">

                Your Bingo claim was not approved.

            </div>


            <div class="bingo-rejected-submessage">

                Unmark any incorrect spaces and
                keep playing.

            </div>


            <button
                id="bingoRejectedContinue"
                type="button"
            >

                KEEP PLAYING

            </button>

        </div>

    `;


    document.body.appendChild(
        overlay
    );


    const continueButton =
        document.getElementById(
            "bingoRejectedContinue"
        );


    if (
        continueButton
    ) {

        continueButton.addEventListener(
            "click",
            () => {

                hideBingoRejectedOverlay();

            }
        );

    }


    /*
    ==========================================
    OVERLAY STYLES
    ==========================================
    */

    if (
        !document.getElementById(
            "bingoRejectedOverlayStyles"
        )
    ) {

        const style =
            document.createElement(
                "style"
            );


        style.id =
            "bingoRejectedOverlayStyles";


        style.textContent = `

            #bingoRejectedOverlay {

                position: fixed;

                inset: 0;

                width: 100%;

                height: 100%;

                display: flex;

                align-items: center;

                justify-content: center;

                padding: 20px;

                background:
                    rgba(2, 6, 23, 0.78);

                backdrop-filter:
                    blur(7px);

                -webkit-backdrop-filter:
                    blur(7px);

                z-index: 999999;

                opacity: 0;

                animation:
                    bingoRejectedFadeIn
                    0.25s ease forwards;

            }


            .bingo-rejected-window {

                width: min(
                    92vw,
                    430px
                );

                padding:
                    32px 26px 28px;

                text-align: center;

                background:
                    linear-gradient(
                        145deg,
                        #ffffff 0%,
                        #f8fafc 100%
                    );

                border:
                    3px solid #ef4444;

                border-radius:
                    22px;

                box-shadow:
                    0 0 0 1px
                        rgba(255,255,255,.1),
                    0 20px 60px
                        rgba(0,0,0,.45),
                    0 0 35px
                        rgba(239,68,68,.35);

                transform:
                    scale(.92)
                    translateY(10px);

                animation:
                    bingoRejectedPop
                    .3s cubic-bezier(
                        .2,
                        .8,
                        .2,
                        1
                    ) forwards;

            }


            .bingo-rejected-icon {

                width: 72px;

                height: 72px;

                margin:
                    0 auto 16px;

                display: flex;

                align-items: center;

                justify-content: center;

                border-radius: 50%;

                background:
                    linear-gradient(
                        135deg,
                        #ef4444,
                        #b91c1c
                    );

                color: #ffffff;

                font-size: 43px;

                font-weight: 900;

                line-height: 1;

                box-shadow:
                    0 8px 24px
                    rgba(185,28,28,.35);

            }


            .bingo-rejected-title {

                color: #991b1b;

                font-size: 27px;

                font-weight: 950;

                letter-spacing: 1.5px;

                line-height: 1.1;

            }


            .bingo-rejected-divider {

                width: 70px;

                height: 3px;

                margin:
                    14px auto 18px;

                border-radius: 10px;

                background:
                    #ef4444;

            }


            .bingo-rejected-message {

                color: #1e293b;

                font-size: 17px;

                font-weight: 800;

                line-height: 1.4;

            }


            .bingo-rejected-submessage {

                margin-top: 8px;

                color: #64748b;

                font-size: 14px;

                font-weight: 600;

                line-height: 1.5;

            }


            #bingoRejectedContinue {

                width: 100%;

                min-height: 54px;

                margin-top: 24px;

                padding:
                    13px 20px;

                border: none;

                border-radius: 13px;

                background:
                    linear-gradient(
                        135deg,
                        #16a34a,
                        #15803d
                    );

                color: #ffffff;

                font-size: 16px;

                font-weight: 900;

                letter-spacing: .7px;

                cursor: pointer;

                box-shadow:
                    0 7px 18px
                    rgba(22,163,74,.28);

                transition:
                    transform .15s ease,
                    box-shadow .15s ease;

                -webkit-tap-highlight-color:
                    transparent;

            }


            #bingoRejectedContinue:hover {

                transform:
                    translateY(-1px);

                box-shadow:
                    0 10px 22px
                    rgba(22,163,74,.35);

            }


            #bingoRejectedContinue:active {

                transform:
                    translateY(1px)
                    scale(.99);

            }


            @keyframes bingoRejectedFadeIn {

                from {

                    opacity: 0;

                }

                to {

                    opacity: 1;

                }

            }


            @keyframes bingoRejectedPop {

                from {

                    opacity: 0;

                    transform:
                        scale(.92)
                        translateY(10px);

                }

                to {

                    opacity: 1;

                    transform:
                        scale(1)
                        translateY(0);

                }

            }


            @media (
                max-width: 600px
            ) {

                #bingoRejectedOverlay {

                    padding:
                        16px;

                }


                .bingo-rejected-window {

                    width: 100%;

                    max-width: 390px;

                    padding:
                        28px 21px 23px;

                    border-radius:
                        20px;

                }


                .bingo-rejected-icon {

                    width: 64px;

                    height: 64px;

                    font-size: 37px;

                    margin-bottom: 14px;

                }


                .bingo-rejected-title {

                    font-size: 23px;

                }


                .bingo-rejected-message {

                    font-size: 16px;

                }


                .bingo-rejected-submessage {

                    font-size: 13.5px;

                }


                #bingoRejectedContinue {

                    min-height: 56px;

                    font-size: 16px;

                    margin-top: 22px;

                }

            }

        `;


        document.head.appendChild(
            style
        );

    }

}


// =====================================================
// SHOW BINGO REJECTED OVERLAY
// =====================================================

function showBingoRejectedOverlay() {

    createBingoRejectedOverlay();


    const overlay =
        document.getElementById(
            "bingoRejectedOverlay"
        );


    if (
        !overlay
    ) {

        return;

    }


    overlay.style.display =
        "flex";


    /*
    Force animation to restart
    if the same overlay is reused.
    */

    overlay.style.animation =
        "none";


    void overlay.offsetWidth;


    overlay.style.animation =
        "bingoRejectedFadeIn .25s ease forwards";


    const continueButton =
        document.getElementById(
            "bingoRejectedContinue"
        );


    if (
        continueButton
    ) {

        setTimeout(
            () => {

                continueButton.focus();

            },
            100
        );

    }

}


// =====================================================
// HIDE BINGO REJECTED OVERLAY
// =====================================================

function hideBingoRejectedOverlay() {

    const overlay =
        document.getElementById(
            "bingoRejectedOverlay"
        );


    if (
        !overlay
    ) {

        return;

    }


    overlay.style.opacity =
        "0";


    overlay.style.pointerEvents =
        "none";


    setTimeout(
        () => {

            if (
                overlay
            ) {

                overlay.style.display =
                    "none";

                overlay.style.pointerEvents =
                    "auto";

            }

        },
        250
    );

}


// =====================================================
// WIN REJECTED
// =====================================================

function handleWinRejected(
    data
) {

    if (
        !data
    ) {

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
    ==========================================
    UNLOCK PLAYER
    ==========================================
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
    ==========================================
    REMEMBER REJECTED PATTERN
    ==========================================
    */

    if (
        Array.isArray(
            data.winningPattern
        )
    ) {

        playerState.lastRejectedPatternKey =
            data.winningPattern.join(
                ","
            );

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


    /*
    ==========================================
    SHOW BEAUTIFUL OVERLAY
    INSTEAD OF ALERT
    ==========================================
    */

    showBingoRejectedOverlay();

}


// =====================================================
// BINGO STAR CELEBRATION
// =====================================================

function showBingoStarCelebration() {

    const existing =
        document.getElementById(
            "bingoStarCelebration"
        );


    if (
        existing
    ) {

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

@keyframes bingoStarFall{

    0%{

        transform:
            translateY(-50px)
            rotate(0deg)
            scale(.6);

        opacity:0;

    }


    10%{

        opacity:1;

    }


    100%{

        transform:
            translateY(110vh)
            rotate(720deg)
            scale(1);

        opacity:0;

    }

}

`;


        document.head.appendChild(
            style
        );

    }


    setTimeout(
        () => {

            if (
                overlay
            ) {

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

        if (
            playerSocket
        ) {

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
