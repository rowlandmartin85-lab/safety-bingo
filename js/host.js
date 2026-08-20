"use strict";

console.log("HOST.JS LOADED");

let hostMainInitialized = false;


// =====================================================
// CONNECTION STATUS STATE
// =====================================================

let currentServerConnectionState =
    "unknown";

let currentNetworkState =
    "unknown";

let currentConnectionQuality =
    "unknown";

let networkListenersInitialized =
    false;

let weakNetworkMonitorTimer =
    null;


// =====================================================
// CONNECTION BANNER STATE
// =====================================================
//
// IMPORTANT:
//
// The network-quality monitor is NOT allowed to
// repeatedly show the "Server: Connected" message.
//
// The Connected notification is shown only when:
//
// 1. Socket.IO initially connects
// 2. Socket.IO genuinely reconnects
//
// It then disappears after 3.5 seconds.
//
// Network-quality checks can update weak/offline
// status, but they cannot restart the Connected
// notification.
// =====================================================

let connectionBannerNotificationTimer =
    null;

let connectionBannerHideTimer =
    null;

let connectedNotificationRequested =
    false;


// =====================================================
// DOM READY
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    initializeHostMain
);


// =====================================================
// CONNECTION STATUS BANNER
// =====================================================

function getHostConnectionBanner() {

    let statusBanner =
        document.getElementById(
            "hostConnectionBanner"
        );


    // -------------------------------------------------
    // CREATE BANNER IF IT DOES NOT EXIST
    // -------------------------------------------------

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
// CLEAR CONNECTION BANNER TIMERS
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
// HIDE CONNECTION BANNER
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
// SHOW CONNECTED NOTIFICATION
// =====================================================
//
// THIS FUNCTION IS THE ONLY PLACE WHERE THE
// 3.5-SECOND CONNECTED TIMER IS STARTED.
//
// Network monitoring does NOT call this.
// =====================================================

function showConnectedNotification() {

    const statusBanner =
        getHostConnectionBanner();


    if (!statusBanner) {

        return;

    }


    clearConnectionBannerTimers();


    connectedNotificationRequested =
        false;


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


    /*
    ==========================================
    SHOW FOR 3.5 SECONDS
    ==========================================
    */

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

                            /*
                            ==========================================
                            ONLY HIDE IF WE ARE STILL CONNECTED.

                            If we disconnected during the fade,
                            the disconnect handler will have already
                            changed the banner.
                            ==========================================
                            */

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
// UPDATE CONNECTION STATUS UI
// =====================================================

function updateConnectionStatusUI(
    isConnected,
    message = ""
) {

    const previousServerState =
        currentServerConnectionState;


    currentServerConnectionState =
        isConnected
            ? "connected"
            : "disconnected";


    /*
    ==========================================
    SERVER CONNECTED
    ==========================================

    ONLY an explicit call from the Socket.IO
    connect event should request the Connected
    notification.

    The network monitor calls
    updateCombinedConnectionStatus() directly,
    so it cannot trigger this notification.
    ==========================================
    */

    if (
        isConnected
    ) {

        connectedNotificationRequested =
            true;


        showConnectedNotification();


        return;

    }


    /*
    ==========================================
    SERVER DISCONNECTED
    ==========================================
    */

    connectedNotificationRequested =
        false;


    clearConnectionBannerTimers();


    updateCombinedConnectionStatus(
        message
    );

}


// =====================================================
// GET BROWSER NETWORK INFORMATION
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

    /*
    ==========================================
    NETWORK OFFLINE
    ==========================================
    */

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


    /*
    ==========================================
    GET CONNECTION INFORMATION
    ==========================================
    */

    const info =
        getNetworkConnectionInfo();


    /*
    ==========================================
    CONNECTION QUALITY INFORMATION MAY NOT
    BE AVAILABLE IN EVERY BROWSER
    ==========================================
    */

    if (!info) {

        currentConnectionQuality =
            "unknown";


        /*
        IMPORTANT:

        This can update network state, but it
        must NOT restart the Connected banner.
        */

        updateCombinedConnectionStatus();

        return;

    }


    let weak =
        false;


    /*
    ==========================================
    EFFECTIVE CONNECTION TYPE

    slow-2g and 2g are considered weak.
    ==========================================
    */

    if (
        info.effectiveType ===
        "slow-2g" ||
        info.effectiveType ===
        "2g"
    ) {

        weak =
            true;

    }


    /*
    ==========================================
    ESTIMATED DOWNLOAD SPEED

    downlink is measured in Mbps.
    ==========================================
    */

    if (
        info.downlink !== null &&
        info.downlink < 1
    ) {

        weak =
            true;

    }


    /*
    ==========================================
    ROUND TRIP TIME

    High latency can indicate a weak
    or unstable connection.
    ==========================================
    */

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


    /*
    IMPORTANT:

    This function may update a weak-network
    warning, but it cannot restart the
    Connected notification.
    */

    updateCombinedConnectionStatus();

}


// =====================================================
// COMBINED CONNECTION STATUS
// =====================================================

function updateCombinedConnectionStatus(
    customMessage = ""
) {

    const statusBanner =
        getHostConnectionBanner();


    if (!statusBanner) {

        return;

    }


    /*
    ==========================================
    NETWORK OFFLINE
    ==========================================
    */

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


    /*
    ==========================================
    SERVER DISCONNECTED
    ==========================================
    */

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


    /*
    ==========================================
    SERVER UNKNOWN
    ==========================================
    */

    if (
        currentServerConnectionState ===
        "unknown"
    ) {

        /*
        Do not interfere with an existing
        notification timer.
        */

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


    /*
    ==========================================
    SERVER CONNECTED + NETWORK WEAK
    ==========================================

    A weak-network warning is allowed to
    replace the Connected notification.

    However, it does NOT start another
    Connected timer.
    ==========================================
    */

    if (
        currentServerConnectionState ===
        "connected" &&
        currentConnectionQuality ===
        "weak"
    ) {

        /*
        If the Connected notification is
        currently visible, don't interrupt it.

        This prevents network checks from
        fighting with the 3.5-second message.
        */

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


    /*
    ==========================================
    SERVER CONNECTED + NETWORK GOOD
    ==========================================

    IMPORTANT:

    DO NOT SHOW THE CONNECTED MESSAGE HERE.

    The Socket.IO "connect" event is responsible
    for that.

    This prevents the 10-second network-quality
    monitor from repeatedly showing Connected.
    ==========================================
    */

    if (
        currentServerConnectionState ===
        "connected"
    ) {

        /*
        If there is currently an active Connected
        notification, leave it alone.

        If it has already disappeared, leave it
        hidden.
        */

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


        /*
        If the banner is currently visible but
        there is no active notification timer,
        hide it.

        This ensures that a routine network check
        cannot make Connected reappear.
        */

        hideConnectionBanner();

        return;

    }


    /*
    ==========================================
    FALLBACK
    ==========================================
    */

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


    // -------------------------------------------------
    // INITIAL NETWORK STATE
    // -------------------------------------------------

    currentNetworkState =
        navigator.onLine
            ? "online"
            : "offline";


    // =================================================
    // NETWORK ONLINE
    // =================================================

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


    // =================================================
    // NETWORK OFFLINE
    // =================================================

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


    // =================================================
    // CONNECTION INFORMATION
    // =================================================

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


    // =================================================
    // INITIAL QUALITY CHECK
    // =================================================

    checkNetworkQuality();


    // =================================================
    // PERIODIC QUALITY CHECK
    //
    // This can continue running.
    //
    // It no longer has permission to show
    // "Server: Connected".
    // =================================================

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
    // NETWORK CONNECTION MONITORING
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
    // HOST PRINTER
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
    // HOST CHECKER
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
    // HOST AUDIT
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
        answerKeyBtn
    ) {

        if (
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

    }


    const cheatSheetBtn =
        document.getElementById(
            "cheatSheetBtn"
        );


    if (
        cheatSheetBtn
    ) {

        if (
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

    }


    const questionManagerBtn =
        document.getElementById(
            "questionManagerBtn"
        );


    if (
        questionManagerBtn
    ) {

        if (
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


    // =================================================
    // OPEN HOME CONFIRMATION
    // =================================================

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


    // =================================================
    // CANCEL HOME
    // =================================================

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


    // =================================================
    // CONFIRM HOME
    // =================================================

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


                // -------------------------------------
                // CLOSE MODAL
                // -------------------------------------

                if (
                    homeModal
                ) {

                    homeModal.style.display =
                        "none";

                    homeModal.classList.remove(
                        "show"
                    );

                }


                // -------------------------------------
                // TELL SERVER HOST IS LEAVING
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
                // CLEAR LOCAL GAME DATA
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
                // DISCONNECT HOST SOCKET
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


                        // ---------------------------------
                        // RETURN HOME
                        // ---------------------------------

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

window.initializeHostReferenceButtons =
    initializeHostReferenceButtons;


window.initializeHomeButton =
    initializeHomeButton;


window.initializeHostMain =
    initializeHostMain;


window.updateConnectionStatusUI =
    updateConnectionStatusUI;


window.initializeNetworkConnectionMonitoring =
    initializeNetworkConnectionMonitoring;
