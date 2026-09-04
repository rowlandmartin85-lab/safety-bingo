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

document.addEventListener("DOMContentLoaded", initializeHostMain);

function initializeHostSocket() {
    console.log("INITIALIZING HOST SOCKET");
    if (typeof window.io !== "function") {
        console.error("SOCKET.IO NOT AVAILABLE");
        return null;
    }

    if (window.hostSocket) {
        console.log("HOST SOCKET ALREADY EXISTS:", window.hostSocket.id || "NOT CONNECTED YET");
        return window.hostSocket;
    }

    const socketServer = window.location.origin;
    console.log("SOCKET SERVER:", socketServer);

    const hostSocket = window.io(socketServer, {
        transports: ["polling", "websocket"],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000
    });

    window.hostSocket = hostSocket;
    console.log("HOST SOCKET CREATED");

    return hostSocket;
}

function getHostConnectionBanner() {
    let statusBanner = document.getElementById("hostConnectionBanner");
    if (!statusBanner) {
        statusBanner = document.createElement("div");
        statusBanner.id = "hostConnectionBanner";
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
        if (document.body) document.body.prepend(statusBanner);
    }

    return statusBanner;
}

function clearConnectionBannerTimers() {
    if (connectionBannerNotificationTimer) {
        clearTimeout(connectionBannerNotificationTimer);
        connectionBannerNotificationTimer = null;
    }
    if (connectionBannerHideTimer) {
        clearTimeout(connectionBannerHideTimer);
        connectionBannerHideTimer = null;
    }
}

function hideConnectionBanner() {
    const statusBanner = getHostConnectionBanner();
    if (!statusBanner) return;
    
    clearConnectionBannerTimers();
    statusBanner.style.opacity = "0";

    connectionBannerHideTimer = setTimeout(() => {
        statusBanner.style.display = "none";
        connectionBannerHideTimer = null;
    }, 500);
}

function showConnectedNotification() {
    const statusBanner = getHostConnectionBanner();
    if (!statusBanner) return;
    
    clearConnectionBannerTimers();
    statusBanner.style.display = "block";
    statusBanner.style.opacity = "1";
    statusBanner.style.backgroundColor = "#28a745";
    statusBanner.style.color = "#ffffff";
    statusBanner.textContent = "Server: Connected";

    connectionBannerNotificationTimer = setTimeout(() => {
        statusBanner.style.opacity = "0";
        connectionBannerNotificationTimer = null;

        connectionBannerHideTimer = setTimeout(() => {
            if (currentServerConnectionState === "connected") {
                statusBanner.style.display = "none";
            }
            connectionBannerHideTimer = null;
        }, 500);
    }, 3500);
}

function updateConnectionStatusUI(isConnected, message = "") {
    currentServerConnectionState = isConnected ? "connected" : "disconnected";
    if (isConnected) {
        showConnectedNotification();
        return;
    }

    clearConnectionBannerTimers();
    updateCombinedConnectionStatus(message);
}

function getNetworkConnectionInfo() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!connection) return null;
    
    return {
        effectiveType: connection.effectiveType || "",
        downlink: Number.isFinite(connection.downlink) ? connection.downlink : null,
        rtt: Number.isFinite(connection.rtt) ? connection.rtt : null,
        saveData: connection.saveData === true
    };
}

function checkNetworkQuality() {
    if (navigator.onLine === false) {
        currentNetworkState = "offline";
        currentConnectionQuality = "offline";
        updateCombinedConnectionStatus();
        return;
    }
    
    currentNetworkState = "online";
    const info = getNetworkConnectionInfo();
    if (!info) {
        currentConnectionQuality = "unknown";
        updateCombinedConnectionStatus();
        return;
    }

    const isWeak = 
        info.effectiveType === "slow-2g" || 
        info.effectiveType === "2g" || 
        (info.downlink !== null && info.downlink < 1) || 
        (info.rtt !== null && info.rtt > 600);

    currentConnectionQuality = isWeak ? "weak" : "good";
    updateCombinedConnectionStatus();
}

function updateCombinedConnectionStatus(customMessage = "") {
    const statusBanner = getHostConnectionBanner();
    if (!statusBanner) return;

    if (currentNetworkState === "offline") {
        clearConnectionBannerTimers();
        statusBanner.style.display = "block";
        statusBanner.style.opacity = "1";
        statusBanner.style.backgroundColor = "#dc3545";
        statusBanner.style.color = "#ffffff";
        statusBanner.textContent = "Network: Offline";
        return;
    }

    if (currentServerConnectionState === "disconnected") {
        clearConnectionBannerTimers();
        statusBanner.style.display = "block";
        statusBanner.style.opacity = "1";
        statusBanner.style.backgroundColor = "#dc3545";
        statusBanner.style.color = "#ffffff";
        statusBanner.textContent = customMessage || "Server: Disconnected. Attempting to reconnect...";
        return;
    }

    if (currentServerConnectionState === "unknown") {
        if (statusBanner.style.display === "block") return;

        statusBanner.style.display = "block";
        statusBanner.style.opacity = "1";
        statusBanner.style.backgroundColor = "#ffc107";
        statusBanner.style.color = "#212529";
        statusBanner.textContent = "Network: Online — Checking server connection...";
        return;
    }

    if (currentServerConnectionState === "connected" && currentConnectionQuality === "weak") {
        if (connectionBannerNotificationTimer) return;

        statusBanner.style.display = "block";
        statusBanner.style.opacity = "1";
        statusBanner.style.backgroundColor = "#ffc107";
        statusBanner.style.color = "#212529";
        statusBanner.textContent = "Network: Weak — Connection may be unstable";
        return;
    }

    if (currentServerConnectionState === "connected") {
        if (connectionBannerNotificationTimer || statusBanner.style.display === "none") return;
        hideConnectionBanner();
    }
}

function initializeNetworkConnectionMonitoring() {
    if (networkListenersInitialized) return;
    networkListenersInitialized = true;
    console.log("INITIALIZING NETWORK CONNECTION MONITORING");

    currentNetworkState = navigator.onLine ? "online" : "offline";

    window.addEventListener("online", () => {
        console.log("HOST NETWORK ONLINE");
        currentNetworkState = "online";
        checkNetworkQuality();
    });

    window.addEventListener("offline", () => {
        console.warn("HOST NETWORK OFFLINE");
        currentNetworkState = "offline";
        currentConnectionQuality = "offline";
        updateCombinedConnectionStatus();
    });

    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection && typeof connection.addEventListener === "function") {
        connection.addEventListener("change", () => {
            console.log("HOST NETWORK CONNECTION CHANGED");
            checkNetworkQuality();
        });
    }

    checkNetworkQuality();

    if (!weakNetworkMonitorTimer) {
        weakNetworkMonitorTimer = setInterval(checkNetworkQuality, 10000);
    }
}

function initializeHostMain() {
    if (hostMainInitialized) return;
    hostMainInitialized = true;
    console.log("HOST DOM READY");

    const hostSocket = initializeHostSocket();
    if (!hostSocket) console.error("HOST SOCKET COULD NOT BE CREATED");

    initializeNetworkConnectionMonitoring();

    const modules = [
        { name: "HostUI", fn: window.initializeHostUI },
        { name: "HostGame", fn: window.initializeHostGame },
        { name: "HostPrinter", fn: window.initializeHostPrinter },
        { name: "HostChecker", fn: window.initializeHostChecker },
        { name: "HostAudit", fn: window.initializeHostAudit }
    ];

    modules.forEach(({ name, fn }) => {
        if (typeof fn === "function") {
            try {
                fn();
            } catch (error) {
                console.error(`${name.toUpperCase()} INITIALIZATION ERROR:`, error);
            }
        } else {
            console.error(`${name.toUpperCase()} MISSING`);
        }
    });

    initializeHostReferenceButtons();
    initializeHomeButton();

    console.log("SAFETY BINGO HOST READY");
}

function initializeHostReferenceButtons() {
    const buttons = [
        { id: "answerKeyBtn", url: "/answerkey.html" },
        { id: "cheatSheetBtn", url: "/cheatsheet.html" },
        { id: "questionManagerBtn", url: "/questionManager.html" }
    ];

    buttons.forEach(({ id, url }) => {
        const btn = document.getElementById(id);
        if (btn && btn.dataset.hostReady !== "true") {
            btn.dataset.hostReady = "true";
            btn.addEventListener("click", () => window.open(url, "_blank"));
        }
    });
}

function initializeHomeButton() {
    const homeBtn = document.getElementById("homeBtn");
    const homeModal = document.getElementById("homeModal");
    const cancelHome = document.getElementById("cancelHome");
    const confirmHome = document.getElementById("confirmHome");

    if (homeBtn && homeModal && homeBtn.dataset.homeReady !== "true") {
        homeBtn.dataset.homeReady = "true";
        homeBtn.addEventListener("click", () => {
            homeModal.style.display = "flex";
            homeModal.classList.add("show");
        });
    }

    if (cancelHome && homeModal && cancelHome.dataset.homeReady !== "true") {
        cancelHome.dataset.homeReady = "true";
        cancelHome.addEventListener("click", () => {
            homeModal.style.display = "none";
            homeModal.classList.remove("show");
        });
    }

    if (confirmHome && homeModal && confirmHome.dataset.homeReady !== "true") {
        confirmHome.dataset.homeReady = "true";
        confirmHome.addEventListener("click", () => {
            console.log("========== HOST LEAVING GAME ==========");
            confirmHome.disabled = true;

            homeModal.style.display = "none";
            homeModal.classList.remove("show");

            if (window.hostSocket && typeof window.hostSocket.emit === "function") {
                console.log("SENDING hostLeftGame");
                window.hostSocket.emit("hostLeftGame");
            }

            try {
                localStorage.removeItem("safetyBingoState");
                sessionStorage.removeItem("startNewHostGame");
            } catch (error) {
                console.warn("STORAGE ERROR:", error);
            }

            setTimeout(() => {
                if (window.hostSocket && typeof window.hostSocket.disconnect === "function") {
                    console.log("DISCONNECTING OLD HOST SOCKET");
                    window.hostSocket.disconnect();
                }

                window.hostSocket = null;
                window.location.href = "/index.html";
            }, 500);
        });
    }
}

window.initializeHostMain = initializeHostMain;
window.updateConnectionStatusUI = updateConnectionStatusUI;
window.initializeNetworkConnectionMonitoring = initializeNetworkConnectionMonitoring;
window.initializeHostReferenceButtons = initializeHostReferenceButtons;
window.initializeHomeButton = initializeHomeButton;
window.initializeHostSocket = initializeHostSocket;
