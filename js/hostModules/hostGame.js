"use strict";

/**

Safety Bingo Host Game Engine
Uses window.hostSocket created by host.js - NEVER creates its own socket
*/
console.log("HOST GAME MODULE LOADED");

// ==========================================
// STATE
// ==========================================

let socket = null;
let hostGameInitialized = false;
let hostGameEventsRegistered = false;
let hostGameButtonsRegistered = false;
let hostSocketWaitTimer = null;

// ==========================================
// SOCKET MANAGEMENT
// ==========================================

function getHostSocket() {
if (window.hostSocket) {
socket = window.hostSocket;
console.log("HOST GAME USING EXISTING SOCKET:", socket.id || "NOT CONNECTED YET");
return socket;
}
console.error("HOST GAME CANNOT INITIALIZE: window.hostSocket is missing.");
return null;
}

function waitForHostSocket() {
if (window.hostSocket) {
socket = window.hostSocket;
console.log("HOST GAME SOCKET FOUND");
initializeHostGame();
return;
}

if (hostSocketWaitTimer) return;

console.warn("HOST GAME WAITING FOR window.hostSocket...");
hostSocketWaitTimer = setInterval(() => {
if (window.hostSocket) {
clearInterval(hostSocketWaitTimer);
hostSocketWaitTimer = null;
socket = window.hostSocket;
console.log("HOST GAME SOCKET FOUND AFTER WAIT");
initializeHostGame();
}
}, 100);
}

function isSocketConnected() {
return socket?.connected === true;
}

// ==========================================
// INITIALIZATION
// ==========================================

function initializeHostGame() {
console.log("INITIALIZING HOST GAME");

const hostSocket = getHostSocket();
if (!hostSocket) {
waitForHostSocket();
return false;
}

socket = hostSocket;

if (!hostGameEventsRegistered) {
setupSocketEvents();
hostGameEventsRegistered = true;
}

if (!hostGameButtonsRegistered && setupGameButtons()) {
hostGameButtonsRegistered = true;
}

hostGameInitialized = true;
console.log("HOST GAME READY");
return true;
}

// ==========================================
// SOCKET EVENTS
// ==========================================

function setupSocketEvents() {
if (!socket) {
console.error("CANNOT SETUP HOST SOCKET EVENTS: SOCKET MISSING");
return;
}

socket
.on("connect", () => {
console.log("HOST CONNECTED:", socket.id);
window.updateConnectionStatusUI?.(true);
if (window.hostState) hostState.connected = true;

socket.emit("registerHost");

  const startNew = sessionStorage.getItem("startNewHostGame");
  if (startNew === "true") {
    console.log("STARTING COMPLETELY NEW BINGO GAME");
    try {
      sessionStorage.removeItem("startNewHostGame");
    } catch (e) {
      console.warn("SESSION STORAGE ERROR:", e);
    }
    socket.emit("hostReset");
  }
})
.on("hostRegistered", () => {
  console.log("HOST REGISTERED WITH SERVER");
  if (window.hostState) hostState.connected = true;
})
.on("hostRegistrationRejected", (data) => {
  console.error("HOST REGISTRATION REJECTED:", data);
  if (window.hostState) {
    hostState.connected = false;
    hostState.started = false;
    hostState.paused = false;
  }
  updateButtonVisibility(false);
  window.updateConnectionStatusUI?.(false, "Server: Host registration rejected.");
  alert(data?.reason || "Another host is already connected.");
})
.on("gameStartError", (data) => {
  console.error("GAME START ERROR:", data);
  if (window.hostState) {
    hostState.started = false;
    hostState.paused = false;
  }
  updateButtonVisibility(false);
  alert(data?.error || "Unable to start game.");
})
.on("disconnect", (reason) => {
  console.warn("HOST DISCONNECTED:", reason);
  window.updateConnectionStatusUI?.(false, `Server: Disconnected (${reason}). Reconnecting...`);
  if (window.hostState) hostState.connected = false;
})
.on("connect_error", (error) => {
  console.error("HOST SOCKET CONNECTION ERROR:", error);
  window.updateConnectionStatusUI?.(false, "Server: Connection error. Retrying...");
})
.on("gameState", (state) => {
  if (!state) return;
  console.log("GAME STATE RECEIVED:", state);
  updateHostState(state);
  updateGameDisplay(state);
  updateButtonVisibility(state.status === "running");
})
.on("gameReset", () => {
  console.log("GAME RESET RECEIVED");
  if (window.hostState) {
    if (typeof hostState.reset === "function") {
      hostState.reset();
    } else {
      Object.assign(hostState, {
        started: false,
        paused: false,
        currentQuestion: "",
        currentAnswer: "",
        currentCategory: "",
        currentDifficulty: "",
        currentQuestionIndex: -1,
        currentQuestionNumber: null,
        currentQuestionID: null,
        calledAnswers: [],
        selectedQuestionIds: [],
        approvedWinnersCount: 0,
        approvedWinnersList: [],
        lastSpokenQuestion: ""
      });
    }
  }
  clearHostDisplay();
  updateButtonVisibility(false);
})
.on("gameEnded", (data) => {
  console.log("GAME ENDED:", data);
  if (window.hostState) {
    hostState.started = false;
    hostState.paused = false;
  }
  updateButtonVisibility(false);
})
.on("timerUpdate", (data) => {
  if (!data || !window.hostState) return;
  if ("timerSeconds" in data) hostState.timerSeconds = data.timerSeconds;
  if ("noTimer" in data) hostState.noTimer = data.noTimer === true;
});
}

// ==========================================
// GAME BUTTONS
// ==========================================

function setupGameButtons() {
if (!window.hostUI) {
console.warn("HOST UI NOT AVAILABLE - GAME BUTTONS WILL BE REGISTERED LATER");
return false;
}

const buttons = [
{ el: hostUI.startBtn, handler: startGame },
{ el: hostUI.nextBtn, emit: "hostNext", name: "NEXT" },
{ el: hostUI.previousBtn, emit: "hostPrevious", name: "PREVIOUS" },
{ el: hostUI.pausePlayBtn, emit: "togglePausePlay", name: "PAUSE/RESUME" },
{ el: hostUI.repeatBtn, emit: "hostRepeat", name: "REPEAT" },
{
el: hostUI.resetBtn,
handler: () => {
if (!isSocketConnected()) {
console.warn("RESET IGNORED: HOST SOCKET NOT CONNECTED");
return;
}
if (confirm("Reset game?")) socket.emit("hostReset");
}
}
];

buttons.forEach(({ el, handler, emit, name }) => {
if (!el || el.dataset.gameReady === "true") return;

el.dataset.gameReady = "true";

if (handler) {
  el.addEventListener("click", handler);
} else if (emit) {
  el.addEventListener("click", () => {
    if (!isSocketConnected()) {
      console.warn(`${name} IGNORED: HOST SOCKET NOT CONNECTED`);
      return;
    }
    socket.emit(emit);
  });
}
});

console.log("HOST GAME BUTTONS REGISTERED");
return true;
}

// ==========================================
// GAME CONTROL
// ==========================================

function startGame() {
console.log("START GAME REQUEST");

if (!socket) {
console.error("CANNOT START GAME: HOST SOCKET NOT READY");
alert("Host is not connected to the game server yet.");
return;
}

if (!socket.connected) {
console.error("CANNOT START GAME: HOST SOCKET DISCONNECTED");
alert("Host is not connected to the game server yet.");
return;
}

if (!window.hostUI) {
console.error("CANNOT START GAME: HOST UI NOT AVAILABLE");
return;
}

const timerValue = hostUI.timerMode?.value || "none";
let winnerLimit = parseInt(hostUI.winLimit?.value || "1", 10);
if (!Number.isInteger(winnerLimit) || winnerLimit < 1) winnerLimit = 1;

let selectedQuestionIds = [];
if (window.hostState && Array.isArray(hostState.selectedQuestionIds)) {
selectedQuestionIds = [...new Set(
hostState.selectedQuestionIds
.map(Number)
.filter(id => Number.isInteger(id) && id > 0)
)];
}

console.log("==========================================");
console.log("STARTING HOST GAME");
console.log("TIMER:", timerValue);
console.log("MAX WINNERS:", winnerLimit);
console.log("SELECTED QUESTION IDS:", selectedQuestionIds);
console.log("==========================================");

if (window.hostState) {
hostState.paused = false;
hostState.maxWinners = winnerLimit;
}

socket.emit("setTimerSettings", {
seconds: timerValue === "none" ? 0 : Number(timerValue),
noTimer: timerValue === "none"
});

socket.emit("setWinnerSettings", { maxWinners: winnerLimit });
socket.emit("hostStart", { selectedQuestionIds });
}

// ==========================================
// STATE & UI UPDATES
// ==========================================

function updateHostState(state) {
if (!window.hostState || !state) return;

hostState.started = state.status === "running";
hostState.paused = state.isPaused === true;
hostState.currentQuestion = state.currentQuestion || "";
hostState.currentAnswer = state.currentAnswer || "";
hostState.currentCategory = state.currentCategory || "";
hostState.currentDifficulty = state.currentDifficulty || "";
hostState.calledAnswers = Array.isArray(state.calledAnswers) ? [...state.calledAnswers] : [];
window.calledAnswers = [...(state.calledAnswers || [])];
hostState.currentQuestionIndex = Number.isInteger(state.currentQuestionIndex) ? state.currentQuestionIndex : -1;

if ("currentQuestionNumber" in state) hostState.currentQuestionNumber = state.currentQuestionNumber;
if ("currentQuestionID" in state) hostState.currentQuestionID = state.currentQuestionID;
if ("timerSeconds" in state) hostState.timerSeconds = state.timerSeconds;
if ("noTimer" in state) hostState.noTimer = state.noTimer === true;
if ("maxWinners" in state) hostState.maxWinners = state.maxWinners;
if ("approvedWinnersCount" in state) hostState.approvedWinnersCount = state.approvedWinnersCount;
if (Array.isArray(state.approvedWinnersList)) hostState.approvedWinnersList = [...state.approvedWinnersList];
if (Array.isArray(state.selectedQuestionIds)) hostState.selectedQuestionIds = [...state.selectedQuestionIds];
if ("repeatQuestion" in state) hostState.repeatQuestion = state.repeatQuestion === true;
}

function updateGameDisplay(state) {
if (!window.hostUI || !state) return;

if (state.status === "ended") {
hostUI.questionBox && (hostUI.questionBox.textContent = "Game Over");
hostUI.answerBox && (hostUI.answerBox.textContent = "");
hostUI.pausePlayBtn && (hostUI.pausePlayBtn.textContent = "PAUSE");
return;
}

if (hostUI.questionBox) hostUI.questionBox.textContent = state.currentQuestion || "Waiting for game...";
if (hostUI.answerBox) hostUI.answerBox.textContent = state.currentAnswer || "";
if (hostUI.pausePlayBtn) hostUI.pausePlayBtn.textContent = state.isPaused ? "RESUME" : "PAUSE";
}

function updateButtonVisibility(running) {
if (!window.hostUI) return;

if (hostUI.startBtn) {
hostUI.startBtn.style.display = running ? "none" : "inline-flex";
}

[hostUI.nextBtn, hostUI.previousBtn, hostUI.pausePlayBtn, hostUI.repeatBtn, hostUI.resetBtn]
.forEach(btn => btn && (btn.style.display = running ? "inline-flex" : "none"));
}

function clearHostDisplay() {
if (!window.hostUI) return;

if (hostUI.questionBox) hostUI.questionBox.textContent = "Waiting for game...";
if (hostUI.answerBox) hostUI.answerBox.textContent = "";
if (hostUI.pausePlayBtn) hostUI.pausePlayBtn.textContent = "PAUSE";
}

// ==========================================
// EXPORTS
// ==========================================

Object.assign(window, {
initializeHostGame,
getHostSocket,
updateHostState,
updateGameDisplay,
updateButtonVisibility,
clearHostDisplay
});

