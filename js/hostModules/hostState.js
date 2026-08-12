# /*

# SAFETY BINGO HOST STATE MANAGER

*/

"use strict";

console.log(
"HOST STATE LOADED"
);

# /*

# HOST STATE

*/

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


    console.log(
        "HOST LOCAL STATE RESET"
    );

}

};

# /*

# GLOBAL EXPORT

*/

window.hostState =
hostState;

console.log(
"HOST STATE READY"
);
