"use strict";

/**

Safety Bingo Host State Manager
*/
console.log("HOST STATE LOADED");
const hostState = {
// Connection
connected: false,

// Game Status
started: false,
paused: false,

// Current Question
currentQuestion: "",
currentAnswer: "",
currentCategory: "",
currentDifficulty: "",
currentQuestionIndex: -1,
currentQuestionNumber: null,
currentQuestionID: null,

// Question Tracking
calledAnswers: [],
askedIndices: [],
selectedQuestionIds: [],

// Settings
timerSeconds: 30,
noTimer: false,
maxWinners: 1,
timerRemaining: 0,

// Winners
approvedWinners: [],
approvedWinnersList: [],
approvedWinnersCount: 0,
pendingWinner: null,

// Audio
lastSpokenQuestion: "",

// Persistence
save() {
const { connected, ...data } = this;
localStorage.setItem("safetyBingoHostState", JSON.stringify(data));
},

load() {
const saved = localStorage.getItem("safetyBingoHostState");
if (!saved) return false;
try {
Object.assign(this, JSON.parse(saved));
console.log("HOST LOCAL STATE RESTORED FROM STORAGE");
return true;
} catch (e) {
console.error("FAILED TO PARSE SAVED STATE", e);
return false;
}
},

clearStorage() {
localStorage.removeItem("safetyBingoHostState");
},

// Reset all state
reset() {
Object.assign(this, {
connected: false,
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
askedIndices: [],
selectedQuestionIds: [],
timerSeconds: 30,
noTimer: false,
maxWinners: 1,
timerRemaining: 0,
approvedWinners: [],
approvedWinnersList: [],
approvedWinnersCount: 0,
pendingWinner: null,
lastSpokenQuestion: ""
});
this.clearStorage();
console.log("HOST LOCAL STATE RESET");
}
};

window.hostState = hostState;
console.log("HOST STATE READY");

