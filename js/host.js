"use strict";

console.log("==========================================");
console.log("SAFETY BINGO HOST.JS LOADED");
console.log("==========================================");

let hostMainInitialized = false;

let hostSocket = null;

let hostRegistered = false;

let currentGameState = null;

let currentPhysicalClaim = null;

let currentDigitalClaims = new Map();


// =====================================================
// DOM READY
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    initializeHostMain
);


// =====================================================
// MAIN INITIALIZATION
// =====================================================

function initializeHostMain() {

    if (hostMainInitialized) {
        return;
    }

    hostMainInitialized = true;

    console.log("HOST DOM READY");

    initializeHostSocket();

    initializeGameControls();

    initializeReferenceButtons();

    initializeHomeButton();

    initializeAudit();

    initializeOptionalModules();

    console.log(
        "SAFETY BINGO HOST READY"
    );

}


// =====================================================
// SOCKET INITIALIZATION
// =====================================================

function initializeHostSocket() {

    if (
        typeof io !== "function"
    ) {

        console.error(
            "Socket.IO library is missing."
        );

        setConnectionStatus(
            "SOCKET.IO NOT FOUND",
            "red"
        );

        return;
    }


    hostSocket = io({
        transports: [
            "websocket",
            "polling"
        ],

        reconnection: true,

        reconnectionAttempts: Infinity,

        reconnectionDelay: 500,

        reconnectionDelayMax: 3000
    });


    /*
     * IMPORTANT:
     *
     * Export the socket globally because other
     * host code may use window.hostSocket.
     */

    window.hostSocket =
        hostSocket;


    // -------------------------------------------------
    // CONNECT
    // -------------------------------------------------

    hostSocket.on(
        "connect",
        () => {

            console.log(
                "HOST SOCKET CONNECTED:",
                hostSocket.id
            );

            setConnectionStatus(
                "CONNECTED - REGISTERING HOST",
                "yellow"
            );


            hostRegistered =
                false;


            /*
             * ALWAYS register the host after connecting.
             *
             * This is one of the most important fixes.
             */

            hostSocket.emit(
                "registerHost"
            );

        }
    );


    // -------------------------------------------------
    // HOST REGISTERED
    // -------------------------------------------------

    hostSocket.on(
        "hostRegistered",
        () => {

            hostRegistered =
                true;

            console.log(
                "HOST SUCCESSFULLY REGISTERED:",
                hostSocket.id
            );

            setConnectionStatus(
                "HOST CONNECTED",
                "green"
            );

            updateControls();

        }
    );


    // -------------------------------------------------
    // HOST REGISTRATION REJECTED
    // -------------------------------------------------

    hostSocket.on(
        "hostRegistrationRejected",
        data => {

            hostRegistered =
                false;

            console.error(
                "HOST REGISTRATION REJECTED:",
                data
            );

            setConnectionStatus(
                "HOST REGISTRATION REJECTED",
                "red"
            );

            alert(
                data &&
                data.reason
                    ? data.reason
                    : "Another host is already connected."
            );

        }
    );


    // -------------------------------------------------
    // DISCONNECT
    // -------------------------------------------------

    hostSocket.on(
        "disconnect",
        reason => {

            console.warn(
                "HOST SOCKET DISCONNECTED:",
                reason
            );

            hostRegistered =
                false;

            setConnectionStatus(
                "DISCONNECTED - RECONNECTING...",
                "red"
            );

            updateControls();

        }
    );


    // -------------------------------------------------
    // RECONNECT ERROR
    // -------------------------------------------------

    hostSocket.on(
        "connect_error",
        error => {

            console.error(
                "HOST SOCKET ERROR:",
                error
            );

            setConnectionStatus(
                "SERVER CONNECTION ERROR",
                "red"
            );

        }
    );


    // -------------------------------------------------
    // GAME STATE
    // -------------------------------------------------

    hostSocket.on(
        "gameState",
        state => {

            console.log(
                "HOST RECEIVED GAME STATE:",
                state
            );

            currentGameState =
                state;

            renderGameState(
                state
            );

        }
    );


    // -------------------------------------------------
    // TIMER
    // -------------------------------------------------

    hostSocket.on(
        "timerUpdate",
        seconds => {

            updateTimerDisplay(
                seconds
            );

        }
    );


    // -------------------------------------------------
    // GAME RESET
    // -------------------------------------------------

    hostSocket.on(
        "gameReset",
        () => {

            console.log(
                "GAME RESET RECEIVED"
            );

            currentGameState =
                null;

            currentPhysicalClaim =
                null;

            currentDigitalClaims.clear();

            closeAudit();

            clearQuestionDisplay();

            updateControls();

        }
    );


    // -------------------------------------------------
    // GAME ENDED
    // -------------------------------------------------

    hostSocket.on(
        "gameEnded",
        data => {

            console.log(
                "GAME ENDED:",
                data
            );

            updateControls();

        }
    );


    // -------------------------------------------------
    // GAME START ERROR
    // -------------------------------------------------

    hostSocket.on(
        "gameStartError",
        data => {

            console.error(
                "GAME START ERROR:",
                data
            );

            alert(
                data &&
                data.error
                    ? data.error
                    : "Unable to start game."
            );

            updateControls();

        }
    );


    // -------------------------------------------------
    // DIGITAL WIN REQUEST
    // -------------------------------------------------

    hostSocket.on(
        "winRequested",
        claim => {

            if (!claim) {
                return;
            }

            console.log(
                "DIGITAL WIN REQUEST:",
                claim
            );

            currentDigitalClaims.set(
                Number(claim.cardId),
                claim
            );

            addDigitalWinRequest(
                claim
            );

        }
    );


    // -------------------------------------------------
    // DIGITAL WIN APPROVED
    // -------------------------------------------------

    hostSocket.on(
        "winApproved",
        data => {

            if (!data) {
                return;
            }

            const cardId =
                Number(
                    data.cardId
                );

            currentDigitalClaims.delete(
                cardId
            );

            removeWinRequest(
                cardId
            );

        }
    );


    // -------------------------------------------------
    // DIGITAL WIN REJECTED
    // -------------------------------------------------

    hostSocket.on(
        "winRejected",
        data => {

            if (!data) {
                return;
            }

            const cardId =
                Number(
                    data.cardId
                );

            currentDigitalClaims.delete(
                cardId
            );

            removeWinRequest(
                cardId
            );

        }
    );


    // -------------------------------------------------
    // PHYSICAL QR CLAIM
    // -------------------------------------------------

    hostSocket.on(
        "physicalWinRequested",
        data => {

            if (!data) {
                return;
            }

            console.log(
                "PHYSICAL WIN REQUEST:",
                data
            );

            currentPhysicalClaim =
                data;

            showPhysicalAudit(
                data
            );

        }
    );


    // -------------------------------------------------
    // PHYSICAL WIN APPROVED
    // -------------------------------------------------

    hostSocket.on(
        "physicalWinApproved",
        data => {

            console.log(
                "PHYSICAL WIN APPROVED:",
                data
            );

            currentPhysicalClaim =
                null;

            closeAudit();

            updateControls();

        }
    );


    // -------------------------------------------------
    // PHYSICAL WIN REJECTED
    // -------------------------------------------------

    hostSocket.on(
        "physicalWinRejected",
        data => {

            console.log(
                "PHYSICAL WIN REJECTED:",
                data
            );

            currentPhysicalClaim =
                null;

            closeAudit();

        }
    );


    // -------------------------------------------------
    // CHEAT SHEET
    // -------------------------------------------------

    hostSocket.on(
        "cheatSheetQuestion",
        question => {

            /*
             * Store latest question locally so the
             * host answer tools can use it if needed.
             */

            try {

                sessionStorage.setItem(
                    "latestSafetyBingoQuestion",
                    JSON.stringify(
                        question
                    )
                );

            } catch (error) {

                console.warn(
                    "Unable to save question:",
                    error
                );

            }

        }
    );

}


// =====================================================
// CONNECTION STATUS
// =====================================================

function setConnectionStatus(
    message,
    color
) {

    const element =
        document.getElementById(
            "connectionStatus"
        );

    if (!element) {
        return;
    }

    element.textContent =
        message;


    if (color === "green") {

        element.style.color =
            "#22c55e";

    } else if (color === "red") {

        element.style.color =
            "#ef4444";

    } else {

        element.style.color =
            "#facc15";

    }

}


// =====================================================
// GAME CONTROLS
// =====================================================

function initializeGameControls() {

    const startBtn =
        document.getElementById(
            "startBtn"
        );

    const pausePlayBtn =
        document.getElementById(
            "pausePlayBtn"
        );

    const previousBtn =
        document.getElementById(
            "previousBtn"
        );

    const nextBtn =
        document.getElementById(
            "nextBtn"
        );

    const repeatBtn =
        document.getElementById(
            "repeatBtn"
        );

    const resetBtn =
        document.getElementById(
            "resetBtn"
        );

    const timerMode =
        document.getElementById(
            "timerMode"
        );

    const winLimitMode =
        document.getElementById(
            "winLimitMode"
        );


    // -------------------------------------------------
    // START
    // -------------------------------------------------

    if (startBtn) {

        startBtn.addEventListener(
            "click",
            () => {

                if (
                    !hostSocket ||
                    !hostSocket.connected
                ) {

                    alert(
                        "Host is not connected to the server."
                    );

                    return;
                }

                if (!hostRegistered) {

                    alert(
                        "Host is not registered yet. Please wait a moment."
                    );

                    return;
                }


                const timerValue =
                    timerMode
                        ? timerMode.value
                        : "none";


                const noTimer =
                    timerValue ===
                    "none";


                const seconds =
                    noTimer
                        ? 30
                        : Number(
                            timerValue
                        );


                const winLimit =
                    winLimitMode
                        ? Number(
                            winLimitMode.value
                        )
                        : 1;


                hostSocket.emit(
                    "setTimerSettings",
                    {
                        seconds:
                            seconds,

                        noTimer:
                            noTimer
                    }
                );


                hostSocket.emit(
                    "setWinnerSettings",
                    {
                        maxWinners:
                            winLimit
                    }
                );


                /*
                 * Allow Question Manager to provide
                 * selected question IDs.
                 */

                let selectedQuestionIds =
                    [];


                try {

                    const saved =
                        localStorage.getItem(
                            "selectedQuestionIds"
                        );

                    if (saved) {

                        const parsed =
                            JSON.parse(
                                saved
                            );

                        if (
                            Array.isArray(
                                parsed
                            )
                        ) {

                            selectedQuestionIds =
                                parsed;

                        }

                    }

                } catch (error) {

                    console.warn(
                        "Unable to read selected questions:",
                        error
                    );

                }


                hostSocket.emit(
                    "hostStart",
                    {
                        selectedQuestionIds:
                            selectedQuestionIds
                    }
                );

            }
        );

    }


    // -------------------------------------------------
    // PAUSE / PLAY
    // -------------------------------------------------

    if (pausePlayBtn) {

        pausePlayBtn.addEventListener(
            "click",
            () => {

                if (
                    !isHostReady()
                ) {
                    return;
                }

                hostSocket.emit(
                    "togglePausePlay"
                );

            }
        );

    }


    // -------------------------------------------------
    // PREVIOUS
    // -------------------------------------------------

    if (previousBtn) {

        previousBtn.addEventListener(
            "click",
            () => {

                if (
                    !isHostReady()
                ) {
                    return;
                }

                hostSocket.emit(
                    "hostPrevious"
                );

            }
        );

    }


    // -------------------------------------------------
    // NEXT
    // -------------------------------------------------

    if (nextBtn) {

        nextBtn.addEventListener(
            "click",
            () => {

                if (
                    !isHostReady()
                ) {
                    return;
                }

                hostSocket.emit(
                    "hostNext"
                );

            }
        );

    }


    // -------------------------------------------------
    // REPEAT
    // -------------------------------------------------

    if (repeatBtn) {

        repeatBtn.addEventListener(
            "click",
            () => {

                if (
                    !isHostReady()
                ) {
                    return;
                }

                hostSocket.emit(
                    "hostRepeat"
                );

            }
        );

    }


    // -------------------------------------------------
    // RESET
    // -------------------------------------------------

    if (resetBtn) {

        resetBtn.addEventListener(
            "click",
            () => {

                if (
                    !isHostReady()
                ) {
                    return;
                }

                const confirmed =
                    window.confirm(
                        "Reset the current Bingo game?"
                    );

                if (!confirmed) {
                    return;
                }

                hostSocket.emit(
                    "hostReset"
                );

            }
        );

    }


    updateControls();

}


// =====================================================
// HOST READY
// =====================================================

function isHostReady() {

    if (
        !hostSocket ||
        !hostSocket.connected
    ) {

        alert(
            "Host is not connected to the server."
        );

        return false;
    }

    if (!hostRegistered) {

        alert(
            "This browser is not registered as the host."
        );

        return false;
    }

    return true;

}


// =====================================================
// RENDER GAME STATE
// =====================================================

function renderGameState(
    state
) {

    if (!state) {
        return;
    }


    const questionBox =
        document.getElementById(
            "questionBox"
        );

    const answerBox =
        document.getElementById(
            "answerBox"
        );


    if (state.status === "idle") {

        if (questionBox) {

            questionBox.textContent =
                "Waiting for game...";

        }

        if (answerBox) {

            answerBox.textContent =
                "";

        }

    } else if (
        state.status === "running"
    ) {

        if (questionBox) {

            questionBox.textContent =
                state.currentQuestion ||
                "Waiting for question...";

        }

        if (answerBox) {

            answerBox.textContent =
                state.currentAnswer
                    ? "ANSWER: " +
                      state.currentAnswer
                    : "";

        }

    } else if (
        state.status === "ended"
    ) {

        if (questionBox) {

            questionBox.textContent =
                "GAME ENDED";

        }

        if (answerBox) {

            answerBox.textContent =
                state.currentAnswer
                    ? "ANSWER: " +
                      state.currentAnswer
                    : "";

        }

    }


    updateControls();

}


// =====================================================
// UPDATE CONTROLS
// =====================================================

function updateControls() {

    const startBtn =
        document.getElementById(
            "startBtn"
        );

    const pausePlayBtn =
        document.getElementById(
            "pausePlayBtn"
        );

    const previousBtn =
        document.getElementById(
            "previousBtn"
        );

    const nextBtn =
        document.getElementById(
            "nextBtn"
        );

    const repeatBtn =
        document.getElementById(
            "repeatBtn"
        );

    const resetBtn =
        document.getElementById(
            "resetBtn"
        );


    const connected =
        !!(
            hostSocket &&
            hostSocket.connected &&
            hostRegistered
        );


    const running =
        !!(
            currentGameState &&
            currentGameState.status ===
            "running"
        );


    const ended =
        !!(
            currentGameState &&
            currentGameState.status ===
            "ended"
        );


    const paused =
        !!(
            currentGameState &&
            currentGameState.isPaused
        );


    if (startBtn) {

        startBtn.style.display =
            running
                ? "none"
                : "inline-flex";

        startBtn.disabled =
            !connected;

    }


    if (pausePlayBtn) {

        pausePlayBtn.style.display =
            running
                ? "inline-flex"
                : "none";

        pausePlayBtn.textContent =
            paused
                ? "PLAY"
                : "PAUSE";

    }


    if (previousBtn) {

        previousBtn.style.display =
            running
                ? "inline-flex"
                : "none";

        previousBtn.disabled =
            !running ||
            !currentGameState ||
            !Array.isArray(
                currentGameState.gameOrder
            ) ||
            currentGameState.gameOrder.length === 0 ||
            Number(
                currentGameState.currentQuestionIndex
            ) < 0;

    }


    if (nextBtn) {

        nextBtn.style.display =
            running
                ? "inline-flex"
                : "none";

    }


    if (repeatBtn) {

        repeatBtn.style.display =
            running
                ? "inline-flex"
                : "none";

    }


    if (resetBtn) {

        resetBtn.style.display =
            running || ended
                ? "inline-flex"
                : "none";

    }

}


// =====================================================
// TIMER DISPLAY
// =====================================================

function updateTimerDisplay(
    seconds
) {

    const questionBox =
        document.getElementById(
            "questionBox"
        );

    /*
     * Do not overwrite the question.
     *
     * host.css can provide a timer display if
     * desired. For now put timer in the title.
     */

    if (
        Number.isFinite(
            Number(seconds)
        )
    ) {

        document.title =
            "Safety Bingo - Host (" +
            Number(seconds) +
            "s)";

    }

}


// =====================================================
// CLEAR QUESTION
// =====================================================

function clearQuestionDisplay() {

    const questionBox =
        document.getElementById(
            "questionBox"
        );

    const answerBox =
        document.getElementById(
            "answerBox"
        );


    if (questionBox) {

        questionBox.textContent =
            "Waiting for game...";

    }


    if (answerBox) {

        answerBox.textContent =
            "";

    }


    document.title =
        "Safety Bingo - Host";

}


// =====================================================
// REFERENCE BUTTONS
// =====================================================

function initializeReferenceButtons() {

    const answerKeyBtn =
        document.getElementById(
            "answerKeyBtn"
        );

    const cheatSheetBtn =
        document.getElementById(
            "cheatSheetBtn"
        );

    const questionManagerBtn =
        document.getElementById(
            "questionManagerBtn"
        );


    if (answerKeyBtn) {

        answerKeyBtn.addEventListener(
            "click",
            () => {

                window.open(
                    "/answerkey.html",
                    "_blank"
                );

            }
        );

    }


    if (cheatSheetBtn) {

        cheatSheetBtn.addEventListener(
            "click",
            () => {

                window.open(
                    "/cheatsheet.html",
                    "_blank"
                );

            }
        );

    }


    if (questionManagerBtn) {

        questionManagerBtn.addEventListener(
            "click",
            () => {

                window.open(
                    "/questionManager.html",
                    "_blank"
                );

            }
        );

    }

}


// =====================================================
// HOME BUTTON
// =====================================================

function initializeHomeButton() {

    const homeBtn =
        document.getElementById(
            "homeBtn"
        );

    const homeModal =
        document.getElementById(
            "homeModal"
        );

    const cancelHome =
        document.getElementById(
            "cancelHome"
        );

    const confirmHome =
        document.getElementById(
            "confirmHome"
        );


    if (homeBtn) {

        homeBtn.addEventListener(
            "click",
            () => {

                if (homeModal) {

                    homeModal.style.display =
                        "flex";

                    homeModal.classList.add(
                        "show"
                    );

                }

            }
        );

    }


    if (cancelHome) {

        cancelHome.addEventListener(
            "click",
            closeHomeModal
        );

    }


    if (confirmHome) {

        confirmHome.addEventListener(
            "click",
            () => {

                if (confirmHome.disabled) {
                    return;
                }

                confirmHome.disabled =
                    true;


                /*
                 * Tell server FIRST.
                 *
                 * Do not immediately disconnect before
                 * server receives the event.
                 */

                if (
                    hostSocket &&
                    hostSocket.connected &&
                    hostRegistered
                ) {

                    hostSocket.emit(
                        "hostLeftGame"
                    );

                }


                try {

                    localStorage.removeItem(
                        "safetyBingoState"
                    );

                } catch (error) {

                    console.warn(
                        error
                    );

                }


                try {

                    sessionStorage.removeItem(
                        "startNewHostGame"
                    );

                } catch (error) {

                    console.warn(
                        error
                    );

                }


                /*
                 * Give Socket.IO enough time to send
                 * hostLeftGame before leaving.
                 */

                setTimeout(
                    () => {

                        if (
                            hostSocket &&
                            typeof hostSocket.disconnect ===
                            "function"
                        ) {

                            hostSocket.disconnect();

                        }

                        window.location.href =
                            "/index.html";

                    },
                    400
                );

            }
        );

    }

}


function closeHomeModal() {

    const homeModal =
        document.getElementById(
            "homeModal"
        );

    if (!homeModal) {
        return;
    }

    homeModal.style.display =
        "none";

    homeModal.classList.remove(
        "show"
    );

}


// =====================================================
// AUDIT
// =====================================================

function initializeAudit() {

    const approve =
        document.getElementById(
            "approvePhysicalWin"
        );

    const reject =
        document.getElementById(
            "rejectPhysicalWin"
        );


    if (approve) {

        approve.addEventListener(
            "click",
            () => {

                if (
                    !currentPhysicalClaim
                ) {
                    return;
                }


                if (!isHostReady()) {
                    return;
                }


                hostSocket.emit(
                    "approvePhysicalWin",
                    {
                        cardId:
                            Number(
                                currentPhysicalClaim.cardId
                            )
                    }
                );

            }
        );

    }


    if (reject) {

        reject.addEventListener(
            "click",
            () => {

                if (
                    !currentPhysicalClaim
                ) {
                    return;
                }


                if (!isHostReady()) {
                    return;
                }


                hostSocket.emit(
                    "rejectPhysicalWin",
                    {
                        cardId:
                            Number(
                                currentPhysicalClaim.cardId
                            )
                    }
                );

            }
        );

    }

}


// =====================================================
// SHOW PHYSICAL AUDIT
// =====================================================

function showPhysicalAudit(
    claim
) {

    const overlay =
        document.getElementById(
            "auditOverlay"
        );

    const title =
        document.getElementById(
            "auditTitle"
        );

    const display =
        document.getElementById(
            "auditCardDisplay"
        );


    if (!overlay || !display) {
        return;
    }


    const cardId =
        Number(
            claim.cardId
        );


    if (title) {

        title.textContent =
            "CARD #" +
            cardId +
            " AUDIT";

    }


    display.innerHTML = `

        <div class="audit-card-info">

            <h2>
                BINGO CLAIM
            </h2>

            <p>
                Card ID:
                <strong>
                    #${escapeHtml(cardId)}
                </strong>
            </p>

            <p>
                A player scanned the physical
                Bingo card QR code.
            </p>

            <p>
                Check the physical card before
                approving the win.
            </p>

        </div>

    `;


    overlay.style.display =
        "flex";

    overlay.classList.add(
        "show"
    );

}


// =====================================================
// CLOSE AUDIT
// =====================================================

function closeAudit() {

    const overlay =
        document.getElementById(
            "auditOverlay"
        );


    if (!overlay) {
        return;
    }


    overlay.style.display =
        "none";

    overlay.classList.remove(
        "show"
    );

}


// =====================================================
// DIGITAL WIN REQUEST DISPLAY
// =====================================================

function addDigitalWinRequest(
    claim
) {

    const list =
        document.getElementById(
            "auditWinnerList"
        );


    if (!list) {
        return;
    }


    const cardId =
        Number(
            claim.cardId
        );


    if (
        list.querySelector(
            `[data-card-id="${cardId}"]`
        )
    ) {

        return;

    }


    const item =
        document.createElement(
            "div"
        );


    item.className =
        "winner-request";


    item.dataset.cardId =
        String(cardId);


    item.innerHTML = `

        <div>

            <strong>
                DIGITAL BINGO CLAIM
            </strong>

            <br>

            Card #${escapeHtml(cardId)}

        </div>


        <div>

            <button
                type="button"
                data-action="approve"
            >
                APPROVE
            </button>


            <button
                type="button"
                data-action="reject"
            >
                REJECT
            </button>

        </div>

    `;


    const approve =
        item.querySelector(
            '[data-action="approve"]'
        );

    const reject =
        item.querySelector(
            '[data-action="reject"]'
        );


    if (approve) {

        approve.addEventListener(
            "click",
            () => {

                if (
                    !isHostReady()
                ) {
                    return;
                }

                hostSocket.emit(
                    "approveWin",
                    cardId
                );

            }
        );

    }


    if (reject) {

        reject.addEventListener(
            "click",
            () => {

                if (
                    !isHostReady()
                ) {
                    return;
                }

                hostSocket.emit(
                    "rejectWin",
                    cardId
                );

            }
        );

    }


    list.appendChild(
        item
    );

}


// =====================================================
// REMOVE WIN REQUEST
// =====================================================

function removeWinRequest(
    cardId
) {

    const list =
        document.getElementById(
            "auditWinnerList"
        );


    if (!list) {
        return;
    }


    const item =
        list.querySelector(
            `[data-card-id="${Number(cardId)}"]`
        );


    if (item) {

        item.remove();

    }

}


// =====================================================
// OPTIONAL EXISTING MODULES
// =====================================================

function initializeOptionalModules() {

    /*
     * These are optional.
     *
     * The host page will continue working if the
     * modules are not present.
     */


    try {

        if (
            typeof window.initializeHostChecker ===
            "function"
        ) {

            window.initializeHostChecker();

        }

    } catch (error) {

        console.error(
            "HOST CHECKER ERROR:",
            error
        );

    }


    try {

        if (
            typeof window.initializeHostPrinter ===
            "function"
        ) {

            window.initializeHostPrinter();

        }

    } catch (error) {

        console.error(
            "HOST PRINTER ERROR:",
            error
        );

    }

}


// =====================================================
// HTML ESCAPE
// =====================================================

function escapeHtml(
    value
) {

    return String(
        value
    )
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


// =====================================================
// EXPORT
// =====================================================

window.hostSocket =
    hostSocket;

window.initializeHostMain =
    initializeHostMain;

window.closeAudit =
    closeAudit;
