"use strict";

console.log("HOST.JS LOADED");

// ==========================================
// HOST SOCKET
// ==========================================

let hostSocket = null;

function initializeHostSocket() {

    if (hostSocket) {
        console.log("HOST SOCKET ALREADY EXISTS");
        return hostSocket;
    }

    if (typeof io !== "function") {
        console.error("SOCKET.IO IS NOT AVAILABLE");
        updateConnectionStatusUI(
            false,
            "Socket.IO failed to load."
        );
        return null;
    }

    console.log("CREATING HOST SOCKET");

    hostSocket = io();

    window.hostSocket = hostSocket;

    hostSocket.on("connect", () => {

        console.log(
            "HOST SOCKET CONNECTED:",
            hostSocket.id
        );

        updateConnectionStatusUI(true);

        if (window.hostState) {
            hostState.connected = true;
        }

        /*
         * hostGame.js is responsible for registering
         * the host with the server.
         */
        if (typeof window.initializeHostGame === "function") {
            window.initializeHostGame();
        }
    });

    hostSocket.on("disconnect", reason => {

        console.warn(
            "HOST SOCKET DISCONNECTED:",
            reason
        );

        updateConnectionStatusUI(
            false,
            `Server disconnected (${reason}). Reconnecting...`
        );

        if (window.hostState) {
            hostState.connected = false;
        }
    });

    hostSocket.on("connect_error", error => {

        console.error(
            "HOST SOCKET CONNECTION ERROR:",
            error
        );

        updateConnectionStatusUI(
            false,
            "Unable to connect to the game server. Retrying..."
        );

        if (window.hostState) {
            hostState.connected = false;
        }
    });

    return hostSocket;
}


// ==========================================
// HOST STATE
// ==========================================

window.hostState = {

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

    selectedQuestionIds: [],

    approvedWinnersCount: 0,

    approvedWinnersList: [],

    maxWinners: 1,

    timerSeconds: 30,

    noTimer: true,

    repeatQuestion: false,

    reset() {

        this.connected = false;

        this.started = false;

        this.paused = false;

        this.currentQuestion = "";

        this.currentAnswer = "";

        this.currentCategory = "";

        this.currentDifficulty = "";

        this.currentQuestionIndex = -1;

        this.currentQuestionNumber = null;

        this.currentQuestionID = null;

        this.calledAnswers = [];

        this.selectedQuestionIds = [];

        this.approvedWinnersCount = 0;

        this.approvedWinnersList = [];

        this.maxWinners = 1;

        this.timerSeconds = 30;

        this.noTimer = true;

        this.repeatQuestion = false;
    }
};


// ==========================================
// HOST UI
// ==========================================

function buildHostUI() {

    window.hostUI = {

        startBtn:
            document.getElementById("startBtn"),

        nextBtn:
            document.getElementById("nextBtn"),

        previousBtn:
            document.getElementById("previousBtn"),

        pausePlayBtn:
            document.getElementById("pausePlayBtn"),

        repeatBtn:
            document.getElementById("repeatBtn"),

        resetBtn:
            document.getElementById("resetBtn"),

        timerMode:
            document.getElementById("timerMode"),

        winLimit:
            document.getElementById("winLimit"),

        questionBox:
            document.getElementById("questionBox"),

        answerBox:
            document.getElementById("answerBox"),

        categoryBadge:
            document.getElementById("categoryBadge"),

        difficultyBadge:
            document.getElementById("difficultyBadge"),

        questionNumber:
            document.getElementById("questionNumber"),

        timerDisplay:
            document.getElementById("timerDisplay"),

        connectionStatus:
            document.getElementById("connectionStatus"),

        hostStatus:
            document.getElementById("hostStatus")
    };

    console.log(
        "HOST UI READY:",
        window.hostUI
    );
}


// ==========================================
// CONNECTION STATUS UI
// ==========================================

function updateConnectionStatusUI(
    connected,
    message = ""
) {

    const status =
        document.getElementById("connectionStatus");

    const hostStatus =
        document.getElementById("hostStatus");

    if (status) {

        status.textContent =
            connected
                ? "Connected"
                : "Disconnected";

        status.classList.toggle(
            "connected",
            connected
        );
    }

    if (hostStatus) {

        if (message) {

            hostStatus.textContent = message;

        } else if (connected) {

            hostStatus.textContent =
                "Host connected. Ready to start the safety standdown.";

        } else {

            hostStatus.textContent =
                "Host is not connected to the game server.";
        }
    }
}


// ==========================================
// TIMER DISPLAY
// ==========================================

function updateTimerDisplay(seconds) {

    const timerDisplay =
        document.getElementById("timerDisplay");

    if (!timerDisplay) return;

    const value = Number(seconds);

    if (!Number.isFinite(value) || value <= 0) {

        timerDisplay.textContent = "—";

        return;
    }

    timerDisplay.textContent =
        Math.ceil(value);
}


// ==========================================
// GAME DISPLAY HELPERS
// ==========================================

function updateQuestionMetadata(state) {

    if (!state) return;

    const categoryBadge =
        document.getElementById("categoryBadge");

    const difficultyBadge =
        document.getElementById("difficultyBadge");

    const questionNumber =
        document.getElementById("questionNumber");

    if (categoryBadge) {

        categoryBadge.textContent =
            state.currentCategory ||
            "General";
    }

    if (difficultyBadge) {

        difficultyBadge.textContent =
            state.currentDifficulty ||
            "Medium";
    }

    if (questionNumber) {

        if (
            Number.isInteger(
                state.currentQuestionNumber
            )
        ) {

            questionNumber.textContent =
                `Question ${state.currentQuestionNumber}`;

        } else {

            questionNumber.textContent =
                "Question —";
        }
    }
}


// ==========================================
// SOCKET TIMER EVENT
// ==========================================

function registerHostDisplayEvents() {

    if (!window.hostSocket) {
        console.warn(
            "CANNOT REGISTER HOST DISPLAY EVENTS: SOCKET MISSING"
        );
        return;
    }

    window.hostSocket.on(
        "timerUpdate",
        seconds => {

            updateTimerDisplay(seconds);

            if (window.hostState) {
                hostState.timerSeconds =
                    Number(seconds) || 0;
            }
        }
    );


    window.hostSocket.on(
        "gameState",
        state => {

            if (!state) return;

            updateQuestionMetadata(state);

            if (
                state.status === "running" &&
                window.hostUI?.hostStatus
            ) {

                if (state.isPaused) {

                    hostUI.hostStatus.textContent =
                        "Game paused.";

                } else {

                    hostUI.hostStatus.textContent =
                        "Game running — answer the current safety question.";
                }

            }

            if (
                state.status === "ended" &&
                window.hostUI?.hostStatus
            ) {

                hostUI.hostStatus.textContent =
                    "Game ended.";
            }
        }
    );


    window.hostSocket.on(
        "gameReset",
        () => {

            updateTimerDisplay(0);

            const categoryBadge =
                document.getElementById(
                    "categoryBadge"
                );

            const difficultyBadge =
                document.getElementById(
                    "difficultyBadge"
                );

            const questionNumber =
                document.getElementById(
                    "questionNumber"
                );

            if (categoryBadge) {
                categoryBadge.textContent =
                    "Category";
            }

            if (difficultyBadge) {
                difficultyBadge.textContent =
                    "Difficulty";
            }

            if (questionNumber) {
                questionNumber.textContent =
                    "Question —";
            }
        }
    );
}


// ==========================================
// PAGE STARTUP
// ==========================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        console.log(
            "HOST PAGE INITIALIZING"
        );

        buildHostUI();

        updateConnectionStatusUI(
            false,
            "Connecting to game server..."
        );

        registerHostDisplayEvents();

        initializeHostSocket();

        /*
         * hostGame.js may already be loaded,
         * so initialize it after the socket exists.
         */
        setTimeout(() => {

            if (
                typeof window.initializeHostGame ===
                "function"
            ) {

                window.initializeHostGame();

            } else {

                console.warn(
                    "HOST GAME ENGINE NOT AVAILABLE YET"
                );
            }

        }, 0);
    }
);


// ==========================================
// EXPORTS
// ==========================================

window.updateConnectionStatusUI =
    updateConnectionStatusUI;

window.updateTimerDisplay =
    updateTimerDisplay;

window.updateQuestionMetadata =
    updateQuestionMetadata;

window.initializeHostSocket =
    initializeHostSocket;

window.buildHostUI =
    buildHostUI;
