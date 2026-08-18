/* =====================================================
   SAFETY BINGO HOST STATE MANAGER
===================================================== */

"use strict";

console.log("HOST STATE LOADED");

const hostState = {

    /*
    ======================================================
    CONNECTION
    ======================================================
    */
    connected: false,


    /*
    ======================================================
    GAME STATUS
    ======================================================
    */
    started: false,

    paused: false,


    /*
    ======================================================
    CURRENT QUESTION
    ======================================================
    */
    currentQuestion: "",

    currentAnswer: "",

    currentCategory: "",

    currentDifficulty: "",

    currentQuestionIndex: -1,

    currentQuestionNumber: null,

    currentQuestionID: null,


    /*
    ======================================================
    QUESTION TRACKING
    ======================================================
    */
    calledAnswers: [],

    askedIndices: [],

    selectedQuestionIds: [],


    /*
    ======================================================
    GAME SETTINGS
    ======================================================
    */
    timerSeconds: 30,

    noTimer: false,

    maxWinners: 1,


    /*
    ======================================================
    TIMER / PAUSE
    ======================================================
    */
    timerRemaining: 0,


    /*
    ======================================================
    WIN TRACKING
    ======================================================
    */
    approvedWinners: [],

    approvedWinnersList: [],

    approvedWinnersCount: 0,

    pendingWinner: null,


    /*
    ======================================================
    AUDIO TRACKING
    ======================================================
    */
    lastSpokenQuestion: "",


    /*
    ======================================================
    PERSISTENCE (SAVE & LOAD)
    ======================================================
    */

    save() {
        const stateData = {
            started: this.started,
            paused: this.paused,
            currentQuestion: this.currentQuestion,
            currentAnswer: this.currentAnswer,
            currentCategory: this.currentCategory,
            currentDifficulty: this.currentDifficulty,
            currentQuestionIndex: this.currentQuestionIndex,
            currentQuestionNumber: this.currentQuestionNumber,
            currentQuestionID: this.currentQuestionID,
            calledAnswers: this.calledAnswers,
            askedIndices: this.askedIndices,
            selectedQuestionIds: this.selectedQuestionIds,
            timerSeconds: this.timerSeconds,
            noTimer: this.noTimer,
            maxWinners: this.maxWinners,
            timerRemaining: this.timerRemaining,
            approvedWinners: this.approvedWinners,
            approvedWinnersList: this.approvedWinnersList,
            approvedWinnersCount: this.approvedWinnersCount,
            pendingWinner: this.pendingWinner,
            lastSpokenQuestion: this.lastSpokenQuestion
        };
        localStorage.setItem('safetyBingoHostState', JSON.stringify(stateData));
    },

    load() {
        const saved = localStorage.getItem('safetyBingoHostState');
        if (saved) {
            try {
                const data = JSON.parse(saved);
                Object.assign(this, data);
                console.log("HOST LOCAL STATE RESTORED FROM STORAGE");
                return true;
            } catch (e) {
                console.error("FAILED TO PARSE SAVED STATE", e);
            }
        }
        return false;
    },

    clearStorage() {
        localStorage.removeItem('safetyBingoHostState');
    },


    /*
    ======================================================
    RESET LOCAL STATE
    ======================================================
    */

    reset() {

        /*
        ------------------------------------------
        CONNECTION
        ------------------------------------------
        */
        this.connected = false;


        /*
        ------------------------------------------
        GAME STATUS
        ------------------------------------------
        */
        this.started = false;

        this.paused = false;


        /*
        ------------------------------------------
        CURRENT QUESTION
        ------------------------------------------
        */
        this.currentQuestion = "";

        this.currentAnswer = "";

        this.currentCategory = "";

        this.currentDifficulty = "";

        this.currentQuestionIndex = -1;

        this.currentQuestionNumber = null;

        this.currentQuestionID = null;


        /*
        ------------------------------------------
        QUESTION TRACKING
        ------------------------------------------
        */
        this.calledAnswers = [];

        this.askedIndices = [];

        this.selectedQuestionIds = [];


        /*
        ------------------------------------------
        SETTINGS
        ------------------------------------------
        */
        this.timerSeconds = 30;

        this.noTimer = false;

        this.maxWinners = 1;


        /*
        ------------------------------------------
        TIMER
        ------------------------------------------
        */
        this.timerRemaining = 0;


        /*
        ------------------------------------------
        WIN TRACKING
        ------------------------------------------
        */
        this.approvedWinners = [];

        this.approvedWinnersList = [];

        this.approvedWinnersCount = 0;

        this.pendingWinner = null;


        /*
        ------------------------------------------
        AUDIO
        ------------------------------------------
        */
        this.lastSpokenQuestion = "";


        /*
        ------------------------------------------
        CLEAR PERSISTENCE
        ------------------------------------------
        */
        this.clearStorage();


        console.log(
            "HOST LOCAL STATE RESET"
        );

    }

};


/*
======================================================
GLOBAL EXPORT
======================================================
*/

window.hostState = hostState;

console.log("HOST STATE READY");
