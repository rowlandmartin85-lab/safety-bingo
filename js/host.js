"use strict";

console.log("HOST.JS LOADED");

let hostMainInitialized = false;

let currentServerConnectionState = "unknown";
let currentNetworkState = "unknown";
let currentConnectionQuality = "unknown";

let networkListenersInitialized = false;
let weakNetworkMonitorTimer = null;

let connectionBannerNotificationTimer = null;
let connectionBannerHideTimer = null;


// =====================================================
// HOST AUDIO
// =====================================================

let hostAudioMuted = false;


// =====================================================
// DOM READY
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    initializeHostMain
);


// =====================================================
// CREATE HOST SOCKET
// =====================================================
//
// IMPORTANT:
//
// host.js is the ONLY file that creates the
// host Socket.IO connection.
//
// hostGame.js MUST reuse window.hostSocket.
//
// =====================================================

function initializeHostSocket() {

    console.log(
        "INITIALIZING HOST SOCKET"
    );


    // -------------------------------------------------
    // Socket.IO must exist
    // -------------------------------------------------

    if (
        typeof window.io !== "function"
    ) {

        console.error(
            "SOCKET.IO NOT AVAILABLE"
        );

        return null;

    }


    // -------------------------------------------------
    // Already created?
    // -------------------------------------------------

    if (
        window.hostSocket
    ) {

        console.log(
            "HOST SOCKET ALREADY EXISTS:",
            window.hostSocket.id ||
            "NOT CONNECTED YET"
        );

        return window.hostSocket;

    }


    // =================================================
    // USE CURRENT SERVER ORIGIN
    // =================================================

    const socketServer =
        window.location.origin;


    console.log(
        "SOCKET SERVER:",
        socketServer
    );


    // =================================================
    // CREATE THE ONE AND ONLY HOST SOCKET
    // =================================================

    const hostSocket =
        window.io(
            socketServer,
            {

                transports: [
                    "polling",
                    "websocket"
                ],

                reconnection:
                    true,

                reconnectionAttempts:
                    Infinity,

                reconnectionDelay:
                    1000,

                reconnectionDelayMax:
                    5000

            }
        );


    // =================================================
    // STORE GLOBALLY
    // =================================================

    window.hostSocket =
        hostSocket;


    console.log(
        "HOST SOCKET CREATED"
    );


    return hostSocket;

}


// =====================================================
// CONNECTION STATUS BANNER
// =====================================================

function getHostConnectionBanner() {

    let statusBanner =
        document.getElementById(
            "hostConnectionBanner"
        );


    if (!statusBanner) {

        statusBanner =
            document.createElement(
                "div"
            );


        statusBanner.id =
            "hostConnectionBanner";


        statusBanner.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            padding: 10px;
            text-align: center;
            font-weight: bold;
            z-index: 9999;
            transition: opacity 0.5s ease;
            opacity: 1;
            box-sizing: border-box;
        `;


        if (document.body) {

            document.body.prepend(
                statusBanner
            );

        }

    }


    return statusBanner;

}


// =====================================================
// CLEAR BANNER TIMERS
// =====================================================

function clearConnectionBannerTimers() {

    if (
        connectionBannerNotificationTimer
    ) {

        clearTimeout(
            connectionBannerNotificationTimer
        );

        connectionBannerNotificationTimer =
            null;

    }


    if (
        connectionBannerHideTimer
    ) {

        clearTimeout(
            connectionBannerHideTimer
        );

        connectionBannerHideTimer =
            null;

    }

}


// =====================================================
// HIDE BANNER
// =====================================================

function hideConnectionBanner() {

    const statusBanner =
        getHostConnectionBanner();


    if (!statusBanner) {

        return;

    }


    clearConnectionBannerTimers();


    statusBanner.style.opacity =
        "0";


    connectionBannerHideTimer =
        setTimeout(
            () => {

                statusBanner.style.display =
                    "none";

                connectionBannerHideTimer =
                    null;

            },
            500
        );

}


// =====================================================
// SHOW CONNECTED
// =====================================================

function showConnectedNotification() {

    const statusBanner =
        getHostConnectionBanner();


    if (!statusBanner) {

        return;

    }


    clearConnectionBannerTimers();


    statusBanner.style.display =
        "block";

    statusBanner.style.opacity =
        "1";

    statusBanner.style.backgroundColor =
        "#28a745";

    statusBanner.style.color =
        "#ffffff";

    statusBanner.textContent =
        "Server: Connected";


    connectionBannerNotificationTimer =
        setTimeout(
            () => {

                statusBanner.style.opacity =
                    "0";


                connectionBannerNotificationTimer =
                    null;


                connectionBannerHideTimer =
                    setTimeout(
                        () => {

                            if (
                                currentServerConnectionState ===
                                "connected"
                            ) {

                                statusBanner.style.display =
                                    "none";

                            }

                            connectionBannerHideTimer =
                                null;

                        },
                        500
                    );

            },
            3500
        );

}


// =====================================================
// UPDATE CONNECTION STATUS
// =====================================================

function updateConnectionStatusUI(
    isConnected,
    message = ""
) {

    currentServerConnectionState =
        isConnected
            ? "connected"
            : "disconnected";


    if (isConnected) {

        showConnectedNotification();

        return;

    }


    clearConnectionBannerTimers();

    updateCombinedConnectionStatus(
        message
    );

}


// =====================================================
// NETWORK INFORMATION
// =====================================================

function getNetworkConnectionInfo() {

    const connection =
        navigator.connection ||
        navigator.mozConnection ||
        navigator.webkitConnection;


    if (!connection) {

        return null;

    }


    return {

        effectiveType:
            connection.effectiveType ||
            "",

        downlink:
            Number.isFinite(
                connection.downlink
            )
                ? connection.downlink
                : null,

        rtt:
            Number.isFinite(
                connection.rtt
            )
                ? connection.rtt
                : null,

        saveData:
            connection.saveData === true

    };

}


// =====================================================
// CHECK NETWORK QUALITY
// =====================================================

function checkNetworkQuality() {

    if (
        navigator.onLine === false
    ) {

        currentNetworkState =
            "offline";

        currentConnectionQuality =
            "offline";


        updateCombinedConnectionStatus();

        return;

    }


    currentNetworkState =
        "online";


    const info =
        getNetworkConnectionInfo();


    if (!info) {

        currentConnectionQuality =
            "unknown";


        updateCombinedConnectionStatus();

        return;

    }


    let weak =
        false;


    if (
        info.effectiveType === "slow-2g" ||
        info.effectiveType === "2g"
    ) {

        weak =
            true;

    }


    if (
        info.downlink !== null &&
        info.downlink < 1
    ) {

        weak =
            true;

    }


    if (
        info.rtt !== null &&
        info.rtt > 600
    ) {

        weak =
            true;

    }


    currentConnectionQuality =
        weak
            ? "weak"
            : "good";


    updateCombinedConnectionStatus();

}


// =====================================================
// COMBINED STATUS
// =====================================================

function updateCombinedConnectionStatus(
    customMessage = ""
) {

    const statusBanner =
        getHostConnectionBanner();


    if (!statusBanner) {

        return;

    }


    // -------------------------------------------------
    // OFFLINE
    // -------------------------------------------------

    if (
        currentNetworkState ===
        "offline"
    ) {

        clearConnectionBannerTimers();

        statusBanner.style.display =
            "block";

        statusBanner.style.opacity =
            "1";

        statusBanner.style.backgroundColor =
            "#dc3545";

        statusBanner.style.color =
            "#ffffff";

        statusBanner.textContent =
            "Network: Offline";

        return;

    }


    // -------------------------------------------------
    // SERVER DISCONNECTED
    // -------------------------------------------------

    if (
        currentServerConnectionState ===
        "disconnected"
    ) {

        clearConnectionBannerTimers();

        statusBanner.style.display =
            "block";

        statusBanner.style.opacity =
            "1";

        statusBanner.style.backgroundColor =
            "#dc3545";

        statusBanner.style.color =
            "#ffffff";

        statusBanner.textContent =
            customMessage ||
            "Server: Disconnected. Attempting to reconnect...";

        return;

    }


    // -------------------------------------------------
    // SERVER UNKNOWN
    // -------------------------------------------------

    if (
        currentServerConnectionState ===
        "unknown"
    ) {

        if (
            statusBanner.style.display ===
            "block"
        ) {

            return;

        }


        statusBanner.style.display =
            "block";

        statusBanner.style.opacity =
            "1";

        statusBanner.style.backgroundColor =
            "#ffc107";

        statusBanner.style.color =
            "#212529";

        statusBanner.textContent =
            "Network: Online — Checking server connection...";

        return;

    }


    // -------------------------------------------------
    // WEAK CONNECTION
    // -------------------------------------------------

    if (
        currentServerConnectionState ===
        "connected" &&
        currentConnectionQuality ===
        "weak"
    ) {

        if (
            connectionBannerNotificationTimer
        ) {

            return;

        }


        statusBanner.style.display =
            "block";

        statusBanner.style.opacity =
            "1";

        statusBanner.style.backgroundColor =
            "#ffc107";

        statusBanner.style.color =
            "#212529";

        statusBanner.textContent =
            "Network: Weak — Connection may be unstable";

        return;

    }


    // -------------------------------------------------
    // CONNECTED + GOOD
    // -------------------------------------------------

    if (
        currentServerConnectionState ===
        "connected"
    ) {

        if (
            connectionBannerNotificationTimer
        ) {

            return;

        }


        if (
            statusBanner.style.display ===
            "none"
        ) {

            return;

        }


        hideConnectionBanner();

        return;

    }

}


// =====================================================
// NETWORK MONITORING
// =====================================================

function initializeNetworkConnectionMonitoring() {

    if (
        networkListenersInitialized
    ) {

        return;

    }


    networkListenersInitialized =
        true;


    console.log(
        "INITIALIZING NETWORK CONNECTION MONITORING"
    );


    currentNetworkState =
        navigator.onLine
            ? "online"
            : "offline";


    // -------------------------------------------------
    // ONLINE
    // -------------------------------------------------

    window.addEventListener(
        "online",
        () => {

            console.log(
                "HOST NETWORK ONLINE"
            );


            currentNetworkState =
                "online";


            checkNetworkQuality();

        }
    );


    // -------------------------------------------------
    // OFFLINE
    // -------------------------------------------------

    window.addEventListener(
        "offline",
        () => {

            console.warn(
                "HOST NETWORK OFFLINE"
            );


            currentNetworkState =
                "offline";

            currentConnectionQuality =
                "offline";


            updateCombinedConnectionStatus();

        }
    );


    // -------------------------------------------------
    // CONNECTION CHANGE
    // -------------------------------------------------

    const connection =
        navigator.connection ||
        navigator.mozConnection ||
        navigator.webkitConnection;


    if (
        connection &&
        typeof connection.addEventListener ===
        "function"
    ) {

        connection.addEventListener(
            "change",
            () => {

                console.log(
                    "HOST NETWORK CONNECTION CHANGED"
                );


                checkNetworkQuality();

            }
        );

    }


    checkNetworkQuality();


    // -------------------------------------------------
    // PERIODIC CHECK
    // -------------------------------------------------

    if (
        !weakNetworkMonitorTimer
    ) {

        weakNetworkMonitorTimer =
            setInterval(
                () => {

                    checkNetworkQuality();

                },
                10000
            );

    }

}


// =====================================================
// HOST AUDIO CONTROL
// =====================================================

function initializeHostAudioControl() {

    const audioToggleBtn =
        document.getElementById(
            "audioToggleBtn"
        );


    if (
        !audioToggleBtn
    ) {

        console.warn(
            "HOST AUDIO BUTTON NOT FOUND"
        );

        return;

    }


    // -------------------------------------------------
    // PREVENT DUPLICATE LISTENER
    // -------------------------------------------------

    if (
        audioToggleBtn.dataset.audioReady ===
        "true"
    ) {

        return;

    }


    audioToggleBtn.dataset.audioReady =
        "true";


    // -------------------------------------------------
    // DEFAULT STATE
    // -------------------------------------------------

    hostAudioMuted =
        false;


    updateHostAudioButton();


    // -------------------------------------------------
    // BUTTON CLICK
    // -------------------------------------------------

    audioToggleBtn.addEventListener(
        "click",
        () => {

            hostAudioMuted =
                !hostAudioMuted;


            updateHostAudioButton();


            sendDisplayAudioState();

        }
    );


    console.log(
        "HOST AUDIO CONTROL READY"
    );

}


// =====================================================
// UPDATE HOST AUDIO BUTTON
// =====================================================

function updateHostAudioButton() {

    const audioToggleBtn =
        document.getElementById(
            "audioToggleBtn"
        );


    if (
        !audioToggleBtn
    ) {

        return;

    }


    if (
        hostAudioMuted
    ) {

        audioToggleBtn.textContent =
            "🔇 AUDIO MUTED";


        audioToggleBtn.classList.add(
            "audio-muted"
        );

    }

    else {

        audioToggleBtn.textContent =
            "🔊 AUDIO ON";


        audioToggleBtn.classList.remove(
            "audio-muted"
        );

    }

}


// =====================================================
// SEND AUDIO STATE TO DISPLAY
// =====================================================

function sendDisplayAudioState() {

    if (
        !window.hostSocket
    ) {

        console.warn(
            "HOST AUDIO: HOST SOCKET NOT AVAILABLE"
        );

        return;

    }


    if (
        typeof window.hostSocket.emit !==
        "function"
    ) {

        console.warn(
            "HOST AUDIO: SOCKET EMIT NOT AVAILABLE"
        );

        return;

    }


    const audioState = {

        muted:
            hostAudioMuted

    };


    console.log(
        "HOST AUDIO STATE:",
        audioState
    );


    window.hostSocket.emit(
        "setDisplayAudio",
        audioState
    );

}


// =====================================================
// RESEND AUDIO STATE AFTER SOCKET CONNECT
// =====================================================
//
// If the host reconnects while the game is running,
// send the current audio state again.
//
// =====================================================

function initializeHostAudioSocketSync(
    hostSocket
) {

    if (
        !hostSocket
    ) {

        return;

    }


    if (
        hostSocket.dataset &&
        hostSocket.dataset.audioSyncReady ===
        "true"
    ) {

        return;

    }


    // -------------------------------------------------
    // Socket objects do not normally have dataset.
// -------------------------------------------------

    if (
        hostSocket.__hostAudioSyncReady
    ) {

        return;

    }


    hostSocket.__hostAudioSyncReady =
        true;


    hostSocket.on(
        "connect",
        () => {

            console.log(
                "HOST AUDIO: SOCKET CONNECTED — SYNCING AUDIO STATE"
            );


            // Small delay allows room reconnection
            // to complete first.

            setTimeout(
                () => {

                    sendDisplayAudioState();

                },
                250
            );

        }
    );

}


// =====================================================
// HOST MAIN INITIALIZATION
// =====================================================

function initializeHostMain() {

    if (
        hostMainInitialized
    ) {

        return;

    }


    hostMainInitialized =
        true;


    console.log(
        "HOST DOM READY"
    );


    // =================================================
    // CRITICAL:
    //
    // CREATE SOCKET FIRST.
    //
    // hostGame.js will now find window.hostSocket.
    // =================================================

    const hostSocket =
        initializeHostSocket();


    if (!hostSocket) {

        console.error(
            "HOST SOCKET COULD NOT BE CREATED"
        );

    }


    // =================================================
    // NETWORK
    // =================================================

    initializeNetworkConnectionMonitoring();


    // =================================================
    // HOST UI
    // =================================================

    if (
        typeof window.initializeHostUI ===
        "function"
    ) {

        try {

            window.initializeHostUI();

        } catch (error) {

            console.error(
                "HOST UI INITIALIZATION ERROR:",
                error
            );

        }

    } else {

        console.error(
            "HOST UI MISSING"
        );

    }


    // =================================================
    // HOST GAME
    // =================================================

    if (
        typeof window.initializeHostGame ===
        "function"
    ) {

        try {

            window.initializeHostGame();

        } catch (error) {

            console.error(
                "HOST GAME INITIALIZATION ERROR:",
                error
            );

        }

    } else {

        console.error(
            "HOST GAME MISSING"
        );

    }


    // =================================================
    // PRINTER
    // =================================================

    if (
        typeof window.initializeHostPrinter ===
        "function"
    ) {

        try {

            window.initializeHostPrinter();

        } catch (error) {

            console.error(
                "HOST PRINTER INITIALIZATION ERROR:",
                error
            );

        }

    }


    // =================================================
    // CHECKER
    // =================================================

    if (
        typeof window.initializeHostChecker ===
        "function"
    ) {

        try {

            window.initializeHostChecker();

        } catch (error) {

            console.error(
                "HOST CHECKER INITIALIZATION ERROR:",
                error
            );

        }

    }


    // =================================================
    // AUDIT
    // =================================================

    if (
        typeof window.initializeHostAudit ===
        "function"
    ) {

        try {

            window.initializeHostAudit();

        } catch (error) {

            console.error(
                "HOST AUDIT INITIALIZATION ERROR:",
                error
            );

        }

    }


    // =================================================
    // BUTTONS
    // =================================================

    initializeHostReferenceButtons();

    initializeHomeButton();

    initializeHostAudioControl();

    initializeHostAudioSocketSync(
        hostSocket
    );


    console.log(
        "SAFETY BINGO HOST READY"
    );

}


// =====================================================
// REFERENCE BUTTONS
// =====================================================

function initializeHostReferenceButtons() {

    const answerKeyBtn =
        document.getElementById(
            "answerKeyBtn"
        );


    if (
        answerKeyBtn &&
        answerKeyBtn.dataset.hostReady !==
        "true"
    ) {

        answerKeyBtn.dataset.hostReady =
            "true";


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


    const cheatSheetBtn =
        document.getElementById(
            "cheatSheetBtn"
        );


    if (
        cheatSheetBtn &&
        cheatSheetBtn.dataset.hostReady !==
        "true"
    ) {

        cheatSheetBtn.dataset.hostReady =
            "true";


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


    const questionManagerBtn =
        document.getElementById(
            "questionManagerBtn"
        );


    if (
        questionManagerBtn &&
        questionManagerBtn.dataset.hostReady !==
        "true"
    ) {

        questionManagerBtn.dataset.hostReady =
            "true";


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


    // -------------------------------------------------
    // OPEN
    // -------------------------------------------------

    if (
        homeBtn &&
        homeModal &&
        homeBtn.dataset.homeReady !==
        "true"
    ) {

        homeBtn.dataset.homeReady =
            "true";


        homeBtn.addEventListener(
            "click",
            () => {

                homeModal.style.display =
                    "flex";

                homeModal.classList.add(
                    "show"
                );

            }
        );

    }


    // -------------------------------------------------
    // CANCEL
    // -------------------------------------------------

    if (
        cancelHome &&
        homeModal &&
        cancelHome.dataset.homeReady !==
        "true"
    ) {

        cancelHome.dataset.homeReady =
            "true";


        cancelHome.addEventListener(
            "click",
            () => {

                homeModal.style.display =
                    "none";

                homeModal.classList.remove(
                    "show"
                );

            }
        );

    }


    // -------------------------------------------------
    // CONFIRM
    // -------------------------------------------------

    if (
        confirmHome &&
        homeModal &&
        confirmHome.dataset.homeReady !==
        "true"
    ) {

        confirmHome.dataset.homeReady =
            "true";


        confirmHome.addEventListener(
            "click",
            () => {

                console.log(
                    "========== HOST LEAVING GAME =========="
                );


                confirmHome.disabled =
                    true;


                homeModal.style.display =
                    "none";

                homeModal.classList.remove(
                    "show"
                );


                // -------------------------------------
                // TELL SERVER
                // -------------------------------------

                if (
                    window.hostSocket &&
                    typeof window.hostSocket.emit ===
                    "function"
                ) {

                    console.log(
                        "SENDING hostLeftGame"
                    );


                    window.hostSocket.emit(
                        "hostLeftGame"
                    );

                }


                // -------------------------------------
                // CLEAR LOCAL DATA
                // -------------------------------------

                try {

                    localStorage.removeItem(
                        "safetyBingoState"
                    );

                } catch (error) {

                    console.warn(
                        "LOCAL STORAGE ERROR:",
                        error
                    );

                }


                try {

                    sessionStorage.removeItem(
                        "startNewHostGame"
                    );

                } catch (error) {

                    console.warn(
                        "SESSION STORAGE ERROR:",
                        error
                    );

                }


                // -------------------------------------
                // DISCONNECT
                // -------------------------------------

                setTimeout(
                    () => {

                        if (
                            window.hostSocket &&
                            typeof window.hostSocket.disconnect ===
                            "function"
                        ) {

                            console.log(
                                "DISCONNECTING OLD HOST SOCKET"
                            );


                            window.hostSocket.disconnect();

                        }


                        window.hostSocket =
                            null;


                        window.location.href =
                            "/index.html";

                    },
                    500
                );

            }
        );

    }

}


// =====================================================
// EXPORTS
// =====================================================

window.initializeHostMain =
    initializeHostMain;

window.updateConnectionStatusUI =
    updateConnectionStatusUI;

window.initializeNetworkConnectionMonitoring =
    initializeNetworkConnectionMonitoring;

window.initializeHostReferenceButtons =
    initializeHostReferenceButtons;

window.initializeHomeButton =
    initializeHomeButton;

window.initializeHostSocket =
    initializeHostSocket;

window.initializeHostAudioControl =
    initializeHostAudioControl;

window.sendDisplayAudioState =
    sendDisplayAudioState;
