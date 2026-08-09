/*
==========================================
SAFETY BINGO HOST UI CONTROLLER
==========================================
*/


console.log(
    "HOST UI MODULE LOADED"
);




const hostUI = {



    /*
    ==============================
    GAME DISPLAY
    ==============================
    */


    questionBox:null,

    answerBox:null,




    /*
    ==============================
    GAME BUTTONS
    ==============================
    */


    startBtn:null,

    nextBtn:null,

    previousBtn:null,

    pausePlayBtn:null,

    repeatBtn:null,

    resetBtn:null,



    /*
    ==============================
    SETTINGS
    ==============================
    */


    timerMode:null,

    winLimit:null,



    /*
    ==============================
    CHECKER
    ==============================
    */


    checkerCardID:null,

    checkCardBtn:null,

    cardCheckerDisplay:null,



    /*
    ==============================
    PRINT
    ==============================
    */


    buildCardsBtn:null,

    printOutputZone:null,

    printPreview:null,



    /*
    ==============================
    AUDIT
    ==============================
    */


    auditBtn:null,

    auditOverlay:null,

    auditTitle:null,

    auditGrid:null,

    approveBtn:null,

    rejectBtn:null,

    closeAuditBtn:null,



    /*
    ==============================
    WIN TRACKER
    ==============================
    */


    winCounter:null


};








function initializeHostUI(){


    console.log(
        "INITIALIZING HOST UI"
    );




    /*
    ==============================
    GAME DISPLAY
    ==============================
    */


    hostUI.questionBox =
    document.getElementById(
        "questionBox"
    );


    hostUI.answerBox =
    document.getElementById(
        "answerBox"
    );


    /*
    ==============================
    GAME BUTTONS
    ==============================
    */


    hostUI.startBtn =
    document.getElementById(
        "startBtn"
    );


    hostUI.nextBtn =
    document.getElementById(
        "nextBtn"
    );


    hostUI.previousBtn =
    document.getElementById(
        "previousBtn"
    );


    hostUI.pausePlayBtn =
    document.getElementById(
        "pausePlayBtn"
    );


    hostUI.repeatBtn =
    document.getElementById(
        "repeatBtn"
    );


    hostUI.resetBtn =
    document.getElementById(
        "resetBtn"
    );





    /*
    ==============================
    SETTINGS
    ==============================
    */


    hostUI.timerMode =
    document.getElementById(
        "timerMode"
    );


    hostUI.winLimit =
    document.getElementById(
        "winLimitMode"
    );







    /*
    ==============================
    CHECKER
    ==============================
    */


    hostUI.checkerCardID =
    document.getElementById(
        "checkerCardID"
    );


    hostUI.checkCardBtn =
    document.getElementById(
        "checkCardBtn"
    );


    hostUI.cardCheckerDisplay =
    document.getElementById(
        "cardCheckerDisplay"
    );







    /*
    ==============================
    PRINT
    ==============================
    */


    hostUI.buildCardsBtn =
    document.getElementById(
        "buildCardsBtn"
    );


    hostUI.printOutputZone =
    document.getElementById(
        "printOutputZone"
    );


    hostUI.printPreview =
    document.getElementById(
        "printPreview"
    );







    /*
    ==============================
    AUDIT
    ==============================
    */


    hostUI.auditBtn =
    document.getElementById(
        "auditWinBtn"
    );


    hostUI.auditOverlay =
    document.getElementById(
        "auditOverlay"
    );


    hostUI.auditTitle =
    document.getElementById(
        "auditTitle"
    );


    hostUI.auditGrid =
    document.getElementById(
        "auditCardDisplay"
    );


    hostUI.approveBtn =
    document.getElementById(
        "approvePhysicalWin"
    );


    hostUI.rejectBtn =
    document.getElementById(
        "rejectPhysicalWin"
    );


    hostUI.closeAuditBtn =
    document.getElementById(
        "closeAuditOverlay"
    );





    /*
    ==============================
    WIN TRACKER
    ==============================
    */


    hostUI.winCounter =
    document.getElementById(
        "winCountTrackerLabel"
    );





    window.hostUI =
    hostUI;



    console.log(
        "HOST UI READY"
    );


}



window.initializeHostUI =
initializeHostUI;
