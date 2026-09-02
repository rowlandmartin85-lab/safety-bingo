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
// AUDIO CONTROL STATE
// =====================================================
let hostAudioControlsInitialized = false;
let hostAudioVolume = 1;

// =====================================================
// DOM READY
// =====================================================
document.addEventListener("DOMContentLoaded", initializeHostMain);

// =====================================================
// CREATE HOST SOCKET
// =====================================================
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

// =====================================================
// CONNECTION STATUS BANNER
// =====================================================
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

        if (document.body) {
            document.body.prepend(statusBanner);
        }
    }

    return statusBanner;
}

// =====================================================
// CLEAR BANNER TIMERS
// =====================================================
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

// =====================================================
// HIDE BANNER
// =====================================================
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

// =====================================================
// SHOW CONNECTED
// =====================================================
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

// =====================================================
// UPDATE CONNECTION STATUS
// =====================================================
function updateConnectionStatusUI(isConnected, message = "") {
    currentServerConnectionState = isConnected ? "connected" : "disconnected";

    if (isConnected) {
        showConnectedNotification();
        return;
    }

    clearConnectionBannerTimers();
    updateCombinedConnectionStatus(message);
}

// =====================================================
// NETWORK INFORMATION
// =====================================================
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

// =====================================================
// CHECK NETWORK QUALITY
// =====================================================
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

    let weak = false;

    if (info.effectiveType === "slow-2g" || info.effectiveType === "2g") {
        weak = true;
    }

    if (info.downlink !== null && info.downlink < 1) {
        weak = true;
    }

    if (info.rtt !== null && info.rtt > 600) {
        weak = true;
    }

    currentConnectionQuality = weak ? "weak" : "good";
    updateCombinedConnectionStatus();
}

// =====================================================
// COMBINED STATUS
// =====================================================
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
        if (connectionBannerNotificationTimer) return;
        if (statusBanner.style.display === "none") return;

        hideConnectionBanner();
        return;
    }
}

// =====================================================
// NETWORK MONITORING
// =====================================================
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
        weakNetworkMonitorTimer = setInterval(() => {
            checkNetworkQuality();
        }, 10000);
    }
}

// =====================================================
// HOST AUDIO CONTROLS
// =====================================================
function initializeHostAudioControls() {
    if (hostAudioControlsInitialized) return;
    hostAudioControlsInitialized = true;

    console.log("INITIALIZING HOST AUDIO CONTROLS");

    let audioPanel = document.getElementById("hostAudioControls");

    if (!audioPanel) {
        audioPanel = document.createElement("section");
        audioPanel.id = "hostAudioControls";
        audioPanel.innerHTML = `
            <h2>AUDIO CONTROLS</h2>
            <div id="hostAudioButtonGroup" style="display:flex; flex-wrap:wrap; gap:12px; justify-content:center; align-items:center; width:100%;">
                <button id="hostAudioRepeatBtn" type="button">🔊 REPEAT QUESTION</button>
                <button id="hostAudioPauseBtn" type="button">⏸ PAUSE AUDIO</button>
                <button id="hostAudioResumeBtn" type="button">▶ RESUME AUDIO</button>
                <button id="hostAudioStopBtn" type="button">⏹ STOP AUDIO</button>
            </div>
            <div style="margin-top:15px; display:flex; align-items:center; justify-content:center; gap:12px; flex-wrap:wrap;">
                <label for="hostAudioVolume" style="font-weight:700;">VOLUME</label>
                <input id="hostAudioVolume" type="range" min="0" max="1" step="0.05" value="1" style="width:220px;">
                <span id="hostAudioVolumeValue" style="font-weight:700;">100%</span>
            </div>
            <div id="hostAudioStatus" style="margin-top:12px; text-align:center; font-weight:700;">
                Audio ready
            </div>
        `;

        audioPanel.style.cssText = `
            width:100%;
            max-width:800px;
            margin:20px auto;
            padding:20px;
            box-sizing:border-box;
            border-radius:18px;
            background:rgba(0,0,0,.20);
            border:2px solid rgba(34,197,94,.45);
            box-shadow: 0 0 18px rgba(34,197,94,.25), 0 10px 35px rgba(0,0,0,.35);
        `;

        const gameControls = document.querySelector(".game-controls");
        if (gameControls && gameControls.parentNode) {
            gameControls.parentNode.insertBefore(audioPanel, gameControls.nextSibling);
        } else if (document.querySelector(".host-container")) {
            document.querySelector(".host-container").appendChild(audioPanel);
        } else {
            document.body.appendChild(audioPanel);
        }
    }

    const repeatButton = document.getElementById("hostAudioRepeatBtn");
    const pauseButton = document.getElementById("hostAudioPauseBtn");
    const resumeButton = document.getElementById("hostAudioResumeBtn");
    const stopButton = document.getElementById("hostAudioStopBtn");
    const volumeSlider = document.getElementById("hostAudioVolume");
    const volumeValue = document.getElementById("hostAudioVolumeValue");

    if (repeatButton) {
        repeatButton.addEventListener("click", () => sendHostAudioCommand("repeat"));
    }

    if (pauseButton) {
        pauseButton.addEventListener("click", () => sendHostAudioCommand("pause"));
    }

    if (resumeButton) {
        resumeButton.addEventListener("click", () => sendHostAudioCommand("resume"));
    }

    if (stopButton) {
        stopButton.addEventListener("click", () => sendHostAudioCommand("stop"));
    }

    if (volumeSlider) {
        volumeSlider.addEventListener("input", () => {
            hostAudioVolume = Number(volumeSlider.value);

            if (volumeValue) {
                volumeValue.textContent = `${Math.round(hostAudioVolume * 100)}%`;
            }

            sendHostAudioCommand("volume", { volume: hostAudioVolume });
        });
    }

    console.log("HOST AUDIO CONTROLS READY");
}

// =====================================================
// SEND AUDIO COMMAND
// =====================================================
function sendHostAudioCommand(command, data = {}) {
    if (!window.hostSocket) {
        console.warn("HOST AUDIO: SOCKET NOT AVAILABLE");
        setHostAudioStatus("Server connection unavailable.");
        return;
    }

    if (!window.hostSocket.connected) {
        console.warn("HOST AUDIO: SOCKET NOT CONNECTED");
        setHostAudioStatus("Server disconnected.");
        return;
    }

    const payload = { command, ...data };
    console.log("HOST AUDIO COMMAND:", payload);

    window.hostSocket.emit("hostAudioCommand", payload);

    switch (command) {
        case "repeat":
            setHostAudioStatus("Repeating question on display...");
            break;
        case "pause":
            setHostAudioStatus("Audio paused.");
            break;
        case "resume":
            setHostAudioStatus("Audio resumed.");
            break;
        case "stop":
            setHostAudioStatus("Audio stopped.");
            break;
        case "volume":
            setHostAudioStatus(`Volume: ${Math.round(Number(data.volume || 0) * 100)}%`);
            break;
    }
}

// =====================================================
// AUDIO STATUS
// =====================================================
function setHostAudioStatus(message) {
    const status = document.getElementById("hostAudioStatus");
    if (status) {
        status.textContent = message;
    }
}

// =====================================================
// HOST MAIN INITIALIZATION
// =====================================================
function initializeHostMain() {
    if (hostMainInitialized) return;
    hostMainInitialized = true;

    console.log("HOST DOM READY");

    const hostSocket = initializeHostSocket();
    if (!hostSocket) {
        console.error("HOST SOCKET COULD NOT BE CREATED");
    }

    initializeNetworkConnectionMonitoring();

    if (typeof window.initializeHostUI === "function") {
        try { window.initializeHostUI(); } catch (error) { console.error("HOST UI INITIALIZATION ERROR:", error); }
    } else {
        console.error("HOST UI MISSING");
    }

    if (typeof window.initializeHostGame === "function") {
        try { window.initializeHostGame(); } catch (error) { console.error("HOST GAME INITIALIZATION ERROR:", error); }
    } else {
        console.error("HOST GAME MISSING");
    }

    if (typeof window.initializeHostPrinter === "function") {
        try { window.initializeHostPrinter(); } catch (error) { console.error("HOST PRINTER INITIALIZATION ERROR:", error); }
    }

    if (typeof window.initializeHostChecker === "function") {
        try { window.initializeHostChecker(); } catch (error) { console.error("HOST CHECKER INITIALIZATION ERROR:", error); }
    }

    if (typeof window.initializeHostAudit === "function") {
        try { window.initializeHostAudit(); } catch (error) { console.error("HOST AUDIT INITIALIZATION ERROR:", error); }
    }

    initializeHostReferenceButtons();
    initializeHomeButton();
    initializeHostAudioControls();

    console.log("SAFETY BINGO HOST READY");
}

// =====================================================
// REFERENCE BUTTONS
// =====================================================
function initializeHostReferenceButtons() {
    const answerKeyBtn = document.getElementById("answerKeyBtn");
    if (answerKeyBtn && answerKeyBtn.dataset.hostReady !== "true") {
        answerKeyBtn.dataset.hostReady = "true";
        answerKeyBtn.addEventListener("click", () => window.open("/answerkey.html", "_blank"));
    }

    const cheatSheetBtn = document.getElementById("cheatSheetBtn");
    if (cheatSheetBtn && cheatSheetBtn.dataset.hostReady !== "true") {
        cheatSheetBtn.dataset.hostReady = "true";
        cheatSheetBtn.addEventListener("click", () => window.open("/cheatsheet.html", "_blank"));
    }

    const questionManagerBtn = document.getElementById("questionManagerBtn");
    if (questionManagerBtn && questionManagerBtn.dataset.hostReady !== "true") {
        questionManagerBtn.dataset.hostReady = "true";
        questionManagerBtn.addEventListener("click", () => window.open("/questionManager.html", "_blank"));
    }
}

// =====================================================
// HOME BUTTON
// =====================================================
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
            } catch (error) {
                console.warn("LOCAL STORAGE ERROR:", error);
            }

            try {
                sessionStorage.removeItem("startNewHostGame");
            } catch (error) {
                console.warn("SESSION STORAGE ERROR:", error);
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

// =====================================================
// EXPORTS
// =====================================================
window.initializeHostMain = initializeHostMain;
window.updateConnectionStatusUI = updateConnectionStatusUI;
window.initializeNetworkConnectionMonitoring = initializeNetworkConnectionMonitoring;
window.initializeHostReferenceButtons = initializeHostReferenceButtons;
window.initializeHomeButton = initializeHomeButton;
window.initializeHostSocket = initializeHostSocket;
window.initializeHostAudioControls = initializeHostAudioControls;
window.sendHostAudioCommand = sendHostAudioCommand;
