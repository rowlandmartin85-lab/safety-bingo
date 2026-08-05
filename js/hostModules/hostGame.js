/*
==========================================
SAFETY BINGO HOST GAME ENGINE
==========================================
*/


console.log(
    "HOST GAME MODULE LOADED"
);



let socket = null;




/*
==========================================
INITIALIZE HOST GAME
==========================================
*/


function initializeHostGame(){


    console.log(
        "INITIALIZING HOST GAME"
    );



    if(typeof io === "undefined"){


        console.error(
            "SOCKET.IO NOT AVAILABLE"
        );


        return;

    }




    socket = io(
        window.location.origin,
        {

            transports:[
                "websocket",
                "polling"
            ],

            reconnection:true

        }
    );



    window.hostSocket =
    socket;



    setupSocketEvents();


    setupGameButtons();



    console.log(
        "HOST GAME READY"
    );


}



/*
==========================================
SOCKET EVENTS
==========================================
*/

function setupSocketEvents(){


    socket.on(
        "connect",
        ()=>{

            console.log(
                "HOST CONNECTED"
            );


            if(window.hostState){

                hostState.connected = true;

            }

        }
    );




    socket.on(
        "disconnect",
        ()=>{

            console.warn(
                "HOST DISCONNECTED"
            );


            if(window.hostState){

                hostState.connected = false;

            }

        }
    );





    socket.on(
        "gameState",
        state=>{


            if(!state){

                return;

            }



            console.log(
                "GAME STATE RECEIVED:",
                state.currentQuestion
            );



            /*
            ==============================
            UPDATE DISPLAY FIRST
            ==============================
            */


            updateGameDisplay(
                state
            );



            /*
            ==============================
            UPDATE INTERNAL STATE
            ==============================
            */


            updateHostState(
                state
            );



            /*
            ==============================
            AUDIO QUESTION READ
            ==============================
            */


            if(window.audioEngine && state.currentQuestion){


                if(
                    state.currentQuestion !==
                    hostState.lastSpokenQuestion
                ){

                    hostState.lastSpokenQuestion =
                    state.currentQuestion;


                    if(
                        typeof window.audioEngine.readQuestion === "function"
                    ){

                        window.audioEngine.readQuestion(
                            state.currentQuestion
                        );

                    }

                }

            }


        }
    );






    socket.on(
        "gameReset",
        ()=>{


            if(window.hostState){

                hostState.reset();

            }


            clearHostDisplay();


            updateButtonVisibility(
                false
            );


        }
    );


}


/*
==========================================
BUTTON SETUP
==========================================
*/


function setupGameButtons(){



    hostUI.startBtn?.addEventListener(
        "click",
        startGame
    );




    hostUI.nextBtn?.addEventListener(
        "click",
        ()=>{


            socket.emit(
                "hostNext"
            );


        }
    );





    hostUI.previousBtn?.addEventListener(
        "click",
        ()=>{


            socket.emit(
                "hostPrevious"
            );


        }
    );





    hostUI.pausePlayBtn?.addEventListener(
        "click",
        ()=>{


            socket.emit(
                "togglePausePlay"
            );


        }
    );






    hostUI.repeatBtn?.addEventListener(
        "click",
        ()=>{


            socket.emit(
                "hostRepeat"
            );


        }
    );






    hostUI.resetBtn?.addEventListener(
        "click",
        ()=>{


            if(
                confirm(
                    "Reset game?"
                )
            ){


                socket.emit(
                    "hostReset"
                );


            }


        }
    );



}









/*
==========================================
START GAME
==========================================
*/


function startGame(){



    console.log(
        "START GAME REQUEST"
    );



const timerValue =
hostUI.timerMode?.value
||
"none";




    const winnerLimit =

    parseInt(

        hostUI.winLimit?.value
        ||
        1,

        10

    );





    hostState.started =
    true;


    hostState.paused =
    false;



    hostState.maxWinners =
    winnerLimit;





    socket.emit(
        "setTimerSettings",
        {


            seconds:

            timerValue === "none"

            ?

            0

            :

            Number(timerValue),



            noTimer:

            timerValue === "none"


        }
    );






    socket.emit(
        "setWinnerSettings",
        {

            maxWinners:
            winnerLimit

        }
    );






    socket.emit(
        "hostStart"
    );
    
if(window.audioEngine){

    window.audioEngine.gameStart();

}




    updateButtonVisibility(
        true
    );


}









/*
==========================================
UPDATE STATE
==========================================
*/


function updateHostState(state){



    hostState.started =

    state.status === "running";



    hostState.paused =

    state.isPaused || false;



    hostState.currentQuestion =

    state.currentQuestion || "";



    hostState.currentAnswer =

    state.currentAnswer || "";



    hostState.currentCategory =

    state.currentCategory || "";



    hostState.currentDifficulty =

    state.currentDifficulty || "";



    hostState.calledAnswers =

    state.calledAnswers || [];


window.calledAnswers =
[
    ...(state.calledAnswers || [])
];

}

/*
==========================================
DISPLAY UPDATE
==========================================
*/

function updateGameDisplay(state){

    if(state.status==="ended"){

        if(hostUI.questionBox){
            hostUI.questionBox.textContent="Game Over";
        }

        if(hostUI.answerBox){
            hostUI.answerBox.textContent="";
        }

        if(hostUI.pausePlayBtn){
            hostUI.pausePlayBtn.textContent="PAUSE";
        }

        return;
    }

    if(hostUI.questionBox){
        hostUI.questionBox.textContent=
            state.currentQuestion || "Waiting for game...";
    }

    if(hostUI.answerBox){
        hostUI.answerBox.textContent=
            state.currentAnswer || "";
    }

    if(hostUI.pausePlayBtn){
        hostUI.pausePlayBtn.textContent=
            state.isPaused ? "RESUME" : "PAUSE";
    }

}


/*
==========================================
BUTTON VISIBILITY
==========================================
*/


function updateButtonVisibility(running){



    if(hostUI.startBtn){


        hostUI.startBtn.style.display =

        running

        ?

        "none"

        :

        "inline-block";


    }






    [

        hostUI.nextBtn,

        hostUI.previousBtn,

        hostUI.pausePlayBtn,

        hostUI.repeatBtn,

        hostUI.resetBtn


    ]

    .forEach(
        button=>{


            if(!button){

                return;

            }



            button.style.display =

            running

            ?

            "inline-block"

            :

            "none";


        }
    );


}









/*
==========================================
CLEAR DISPLAY
==========================================
*/


function clearHostDisplay(){



    if(hostUI.questionBox){

        hostUI.questionBox.textContent =
        "Waiting for game...";

    }



    if(hostUI.answerBox){

        hostUI.answerBox.textContent =
        "";

    }



}



window.initializeHostGame =
initializeHostGame;
