// =====================================================
// SAFETY BINGO CLIENT STATE MIRROR
// =====================================================

const Game = {

    state:"home",

    currentQuestionIndex:-1,

    currentQuestion:"",

    currentAnswer:""

};



if(typeof socket !== "undefined"){


socket.on(
"gameState",
serverState=>{


    if(!serverState)
        return;



    Game.state =
    serverState.status;


    Game.currentQuestionIndex =
    serverState.currentQuestionIndex;


    Game.currentQuestion =
    serverState.currentQuestion || "";


    Game.currentAnswer =
    serverState.currentAnswer || "";




    const questionDisplay =
    document.getElementById("questionDisplay")
    ||
    document.getElementById("questionBox");



    if(questionDisplay){


        if(
            Game.state==="idle"
        ){

            questionDisplay.textContent =
            "Waiting for host to start...";


        }
        else if(
            Game.state==="ended"
        ){

            questionDisplay.textContent =
            "GAME OVER";


        }
        else{

            questionDisplay.textContent =
            Game.currentQuestion;

        }

    }





    const answerDisplay =
    document.getElementById(
        "answerBox"
    );


    if(answerDisplay){

        answerDisplay.textContent =
        Game.currentAnswer;

    }



});

}