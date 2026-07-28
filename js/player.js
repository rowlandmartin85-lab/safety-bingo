/*
=====================================================
SAFETY BINGO PLAYER ENGINE
CLEAN DIGITAL BUILD
PART 1 / 5

Handles:
- Socket connection
- Player state
- Page startup
- Card loading
=====================================================
*/


"use strict";



/*
=====================================================
SOCKET CONNECTION
=====================================================
*/


const playerSocket =
io(
    window.location.origin,
    {
        transports:[
            "websocket",
            "polling"
        ],

        reconnection:true,

        reconnectionAttempts:10
    }
);



console.log(
    "PLAYER ENGINE LOADED"
);




/*
=====================================================
PLAYER STATE
=====================================================
*/


const playerState = {


    cardID:null,


    card:null,


    grid:[],


    calledAnswers:[],


    locked:false,


    connected:false


};




/*
=====================================================
UI REFERENCES
=====================================================
*/


const playerUI = {


    cardInput:null,


    loadButton:null,


    cardArea:null,


    gameArea:null,


    gameMessage:null


};





/*
=====================================================
PAGE START
=====================================================
*/


document.addEventListener(
"DOMContentLoaded",
()=>{


    console.log(
        "PLAYER DOM READY"
    );



    playerUI.cardInput =
    document.getElementById(
        "cardInput"
    );



    playerUI.loadButton =
    document.getElementById(
        "loadCardBtn"
    );



    playerUI.cardArea =
    document.getElementById(
        "cardArea"
    );



    playerUI.gameArea =
    document.getElementById(
        "gameArea"
    );



    playerUI.gameMessage =
    document.getElementById(
        "gameState"
    );



    setupPlayerButtons();


    loadCardFromURL();



});





/*
=====================================================
SOCKET EVENTS
=====================================================
*/


playerSocket.on(
"connect",
()=>{


    playerState.connected =
    true;



    console.log(
        "PLAYER CONNECTED",
        playerSocket.id
    );



    playerSocket.emit(
        "requestGameStateSyncFallback"
    );


});




playerSocket.on(
"disconnect",
()=>{


    playerState.connected =
    false;



    console.log(
        "PLAYER DISCONNECTED"
    );


});






/*
=====================================================
PLAYER BUTTONS
=====================================================
*/


function setupPlayerButtons(){


    if(
        playerUI.loadButton
    ){


        playerUI.loadButton.onclick =
        ()=>{


            const id =
            playerUI.cardInput.value.trim();



            if(!id){

                alert(
                    "Enter Card ID"
                );

                return;

            }



            loadPlayerCard(id);


        };


    }




    if(
        playerUI.cardInput
    ){


        playerUI.cardInput.addEventListener(
            "keydown",
            event=>{


                if(
                    event.key==="Enter"
                ){

                    playerUI.loadButton?.click();

                }


            }
        );


    }


}







/*
=====================================================
LOAD CARD FROM QR / URL
Example:
player.html?card=25
=====================================================
*/


function loadCardFromURL(){


    const params =
    new URLSearchParams(
        window.location.search
    );



    const id =
    params.get(
        "card"
    );



    if(
        id &&
        playerUI.cardInput
    ){


        playerUI.cardInput.value =
        id;



        setTimeout(
            ()=>{


                loadPlayerCard(
                    id
                );


            },
            300
        );


    }


}






/*
=====================================================
LOAD PLAYER CARD
=====================================================
*/


function loadPlayerCard(id){


    if(
        typeof window.generateCard !== "function"
    ){


        console.error(
            "CARD GENERATOR NOT FOUND"
        );


        return;

    }



    const cardID =
    Number(id);



    if(
        !cardID ||
        cardID < 1
    ){


        alert(
            "Invalid Card ID"
        );


        return;

    }



    const card =
    window.generateCard(
        cardID
    );



    if(
        !card ||
        !card.grid
    ){


        console.error(
            "CARD GENERATION FAILED"
        );


        return;

    }




    playerState.cardID =
    cardID;



    playerState.card =
    card;



    playerState.grid =
    card.grid;



    playerState.calledAnswers =
    [];



    playerState.locked =
    false;



    renderPlayerCard();



    playerSocket.emit(
        "loadCard",
        cardID
    );



    console.log(
        "CARD LOADED",
        cardID
    );


}

/*
=====================================================
PLAYER CARD DISPLAY
PART 2 / 5
=====================================================
*/


function renderPlayerCard(){


    if(
        !playerUI.cardArea
    ){

        console.error(
            "CARD AREA MISSING"
        );

        return;

    }



    playerUI.cardArea.innerHTML =
    "";



    playerState.grid.forEach(
        (cell,index)=>{


            const box =
            document.createElement(
                "div"
            );



            box.className =
            "bingo-cell";



            box.textContent =
            cell.text;



            /*
            FREE SPACE
            */


            if(
                cell.isFreeSpace ||
                cell.text==="FREE" ||
                cell.text==="FREE SPACE"
            ){

                cell.marked =
                true;


                box.classList.add(
                    "free-space",
                    "cell-marked"
                );


            }




            box.onclick =
            ()=>{


                if(
                    cell.isFreeSpace ||
                    cell.text==="FREE" ||
                    cell.text==="FREE SPACE"
                ){

                    return;

                }




                cell.marked =
                !cell.marked;



                if(
                    cell.marked
                ){

                    box.classList.add(
                        "cell-marked"
                    );

                }

                else{

                    box.classList.remove(
                        "cell-marked"
                    );

                }



                playerSocket.emit(
                    "markCard",
                    {

                        id:
                        playerState.cardID,


                        index:
                        index,


                        marked:
                        cell.marked

                    }
                );



                checkForBingo();



            };



            playerUI.cardArea.appendChild(
                box
            );


        }
    );



    if(
        playerUI.gameArea
    ){

        playerUI.gameArea.style.display =
        "block";

    }


}







/*
=====================================================
GAME STATE SYNC
HOST ANSWER TRACKING
=====================================================
*/


playerSocket.on(
"gameState",
(state)=>{
    

    if(
        !state
    ){

        return;

    }




    if(
        Array.isArray(
            state.calledAnswers
        )
    ){

        playerState.calledAnswers =
        state.calledAnswers;

window.playerCalledAnswers =
[
    ...(state.calledAnswers || [])
];

    }




    if(
        playerUI.gameMessage
    ){


        if(
            state.status==="running"
        ){


            playerUI.gameMessage.textContent =
            state.currentQuestion || "";


        }
        else{


            playerUI.gameMessage.textContent =
            "Waiting for game...";


        }


    }





    /*
    IMPORTANT:

    When host calls a new answer,
    automatically check bingo.

    Player does not press anything.
    */


    checkForBingo();



});








/*
=====================================================
GAME RESET
=====================================================
*/


playerSocket.on(
"gameReset",
()=>{


    console.log(
        "PLAYER RESET"
    );



    playerState.cardID =
    null;



    playerState.card =
    null;



    playerState.grid =
    [];



    playerState.calledAnswers =
    [];



    playerState.locked =
    false;



    if(
        playerUI.cardArea
    ){

        playerUI.cardArea.innerHTML =
        "";

    }



    if(
        playerUI.gameMessage
    ){

        playerUI.gameMessage.textContent =
        "Waiting for host...";

    }



});
/*
=====================================================
BINGO DETECTION ENGINE
PART 3 / 5
=====================================================
*/


function isValidBingoCell(index){


    const cell =
    playerState.grid[index];



    if(
        !cell
    ){

        return false;

    }



    /*
    FREE SPACE ALWAYS COUNTS
    */


    if(
        cell.isFreeSpace ||
        cell.text==="FREE" ||
        cell.text==="FREE SPACE"
    ){

        return true;

    }



    /*
    PLAYER MUST MARK IT
    */


    if(
        !cell.marked
    ){

        return false;

    }



    /*
    ANSWER MUST HAVE BEEN CALLED
    */


    return playerState.calledAnswers.some(
        answer=>


        String(answer)
        .trim()
        .toLowerCase()


        ===


        String(cell.text)
        .trim()
        .toLowerCase()

    );


}






/*
=====================================================
CHECK ALL WINNING PATTERNS
=====================================================
*/


function checkForBingo(){


    if(
        playerState.locked
    ){

        return;

    }



    if(
        playerState.grid.length !== 25
    ){

        return;

    }



    const winningPatterns = [



        /*
        ROWS
        */


        [
            0,1,2,3,4
        ],


        [
            5,6,7,8,9
        ],


        [
            10,11,12,13,14
        ],


        [
            15,16,17,18,19
        ],


        [
            20,21,22,23,24
        ],




        /*
        COLUMNS
        */


        [
            0,5,10,15,20
        ],


        [
            1,6,11,16,21
        ],


        [
            2,7,12,17,22
        ],


        [
            3,8,13,18,23
        ],


        [
            4,9,14,19,24
        ],




        /*
        DIAGONALS
        */


        [
            0,6,12,18,24
        ],


        [
            4,8,12,16,20
        ]

    ];






    for(
        const pattern of winningPatterns
    ){



        const bingo =
        pattern.every(
            index=>
            isValidBingoCell(index)
        );



        if(
            bingo
        ){


            sendBingoClaim(
                pattern
            );


            return;

        }


    }



}








/*
=====================================================
BUILD CLAIM DATA
=====================================================
*/


function sendBingoClaim(
winningPattern
){


    if(
        playerState.locked
    ){

        return;

    }



    if(
        !playerState.cardID
    ){

        return;

    }




    playerState.locked =
    true;




    const markedIndices =
    [];




    playerState.grid.forEach(
        (cell,index)=>{


            if(
                cell.marked ||
                cell.isFreeSpace ||
                cell.text==="FREE" ||
                cell.text==="FREE SPACE"
            ){


                markedIndices.push(
                    index
                );


            }


        }
    );







    playerSocket.emit(
        "claimWin",
        {

            cardId:
            playerState.cardID,


            markedIndices:
            markedIndices,


            winningPattern:
            winningPattern,


            timestamp:
            Date.now()

        }
    );





    console.log(
        "AUTOMATIC BINGO CLAIM SENT",
        {

            card:
            playerState.cardID,


            pattern:
            winningPattern

        }
    );



}
/*
=====================================================
WIN RESPONSE HANDLING
PART 4 / 5
=====================================================
*/

/*
=====================================================
BINGO APPROVED
=====================================================
*/

playerSocket.on(
"winApproved",
(data)=>{

    if(!data){
        return;
    }

    if(
        Number(data.cardId) !==
        Number(playerState.cardID)
    ){
        return;
    }

    console.log(
        "BINGO APPROVED"
    );

    playerState.locked = true;

    if(
        window.bingoAnimation &&
        typeof window.bingoAnimation.show === "function"
    ){

        window.bingoAnimation.show();

    }else{

        alert("🎉 BINGO!");

    }

});

/*
=====================================================
BINGO REJECTED
=====================================================
*/

playerSocket.on(
"winRejected",
(data)=>{

    if(!data){
        return;
    }

    if(
        Number(data.cardId) !==
        Number(playerState.cardID)
    ){
        return;
    }

    console.log(
        "BINGO REJECTED"
    );

    /*
    Unlock the card so it can
    earn another Bingo later.
    */

    playerState.locked = false;

    alert(
        "Bingo was not approved. Keep playing!"
    );

});

/*
=====================================================
CARD SYNC CONFIRMATION
=====================================================
*/


playerSocket.on(
"cardLoaded",
(data)=>{


    console.log(
        "CARD CONFIRMED",
        data
    );


});








/*
=====================================================
SERVER CONNECTION RECOVERY
=====================================================
*/


playerSocket.on(
"connect",
()=>{


    if(
        playerState.cardID
    ){


        playerSocket.emit(
            "loadCard",
            playerState.cardID
        );


    }



});








/*
=====================================================
SAFE PAGE EXIT
=====================================================
*/


window.addEventListener(
"beforeunload",
()=>{


    if(
        playerSocket
    ){

        playerSocket.disconnect();

    }


});
/*
=====================================================
PLAYER ENGINE EXPORTS
PART 5 / 5
=====================================================
*/


/*
=====================================================
EXPOSE PLAYER STATE
Useful for debugging
=====================================================
*/


window.getPlayerState =
function(){

    return playerState;

};






/*
=====================================================
MANUAL DEBUG CHECK
=====================================================
*/


window.checkPlayerBingo =
function(){

    checkForBingo();

};






/*
=====================================================
PLAYER READY
=====================================================
*/


console.log(
    "SAFETY BINGO PLAYER READY"
);