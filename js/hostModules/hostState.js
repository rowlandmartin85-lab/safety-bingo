/*
==========================================
SAFETY BINGO HOST STATE MANAGER
==========================================
*/


console.log(
    "HOST STATE LOADED"
);



const hostState = {


    /*
    ==============================
    CONNECTION
    ==============================
    */


    connected:false,



    /*
    ==============================
    GAME STATUS
    ==============================
    */


    started:false,

    paused:false,



    /*
    ==============================
    CURRENT QUESTION
    ==============================
    */


    currentQuestion:"",

    currentAnswer:"",

    currentCategory:"",

    currentDifficulty:"",



    /*
    ==============================
    QUESTION TRACKING
    ==============================
    */


    calledAnswers:[],

    currentQuestionIndex:-1,



    /*
    ==============================
    SETTINGS
    ==============================
    */


    timerSeconds:30,

    noTimer:false,


    maxWinners:1,


    /*
    ==============================
    WIN TRACKING
    ==============================
    */


    approvedWinners:[],


    pendingWinner:null,


    /*
    ==============================
    RESET STATE
    ==============================
    */


    reset(){


        this.started=false;


        this.paused=false;


        this.currentQuestion="";


        this.currentAnswer="";


        this.currentCategory="";


        this.currentDifficulty="";


        this.calledAnswers=[];


        this.currentQuestionIndex=-1;


        this.approvedWinners=[];


        this.pendingWinner=null;


    }



};




window.hostState =
hostState;



console.log(
    "HOST STATE READY"
);