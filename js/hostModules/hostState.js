/*
==========================================
SAFETY BINGO HOST STATE MANAGER
==========================================
*/

console.log("HOST STATE LOADED");

const hostState = {

    /*
    ==============================
    CONNECTION
    ==============================
    */

    connected: false,

    /*
    ==============================
    GAME STATUS
    ==============================
    */

    started: false,

    paused: false,

    /*
    ==============================
    CURRENT QUESTION
    ==============================
    */

    currentQuestion: "",

    currentAnswer: "",

    currentCategory: "",

    currentDifficulty: "",

    /*
    ==============================
    QUESTION TRACKING
    ==============================
    */

    calledAnswers: [],

    currentQuestionIndex: -1,

    /*
    ==============================
    SETTINGS
    ==============================
    */

    timerSeconds: 30,

    noTimer: false,

    maxWinners: 1,

    /*
    ==============================
    WIN TRACKING
    ==============================
    */

    approvedWinners: [],

    pendingWinner: null,

    /*
    ==============================
    RESET STATE
    ==============================
    */

    reset(notifyServer = true) {

        this.started = false;

        this.paused = false;

        this.currentQuestion = "";

        this.currentAnswer = "";

        this.currentCategory = "";

        this.currentDifficulty = "";

        this.calledAnswers = [];

        this.currentQuestionIndex = -1;

        this.approvedWinners = [];

        this.pendingWinner = null;

        // If connected, notify backend server to reset server-side game state
        if (notifyServer && typeof window.socket !== "undefined" && window.socket.connected) {
            window.socket.emit("resetGame");
        }
    }

};

/*
==========================================
SOCKET & PAGE LIFECYCLE LISTENERS
==========================================
*/

// Register Host status automatically when socket connects
document.addEventListener("DOMContentLoaded", () => {
    if (typeof window.socket !== "undefined") {
        
        window.socket.on("connect", () => {
            hostState.connected = true;
            window.socket.emit("registerHost");
            // Automatically reset game state whenever a host launches/reloads page
            hostState.reset(true);
        });

        window.socket.on("disconnect", () => {
            hostState.connected = false;
        });
    }
});

// Emit host exit event when host leaves page, closes tab, or navigates to index
window.addEventListener("beforeunload", () => {
    if (typeof window.socket !== "undefined" && window.socket.connected) {
        window.socket.emit("hostLeftGame");
    }
});

window.hostState = hostState;

console.log("HOST STATE READY");
