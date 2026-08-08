"use strict";


/* =====================================================
   PLAYER SOCKET
   ===================================================== */

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


/* =====================================================
   PLAYER STATE
   ===================================================== */

const playerState = {

    cardID:null,

    card:null,

    grid:[],

    calledAnswers:[],

    locked:false,

    connected:false

};


/* =====================================================
   PLAYER UI
   ===================================================== */

const playerUI = {

    cardInput:null,

    loadButton:null,

    cardArea:null,

    gameArea:null,

    gameMessage:null

};


/* =====================================================
   DOM READY
   ===================================================== */

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

    }
);


/* =====================================================
   SOCKET CONNECT
   ===================================================== */

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


        /*
         * If the player already has a card,
         * tell the server again after reconnect.
         */

        if(playerState.cardID){

            playerSocket.emit(
                "loadCard",
                playerState.cardID
            );

        }

    }
);


/* =====================================================
   SOCKET DISCONNECT
   ===================================================== */

playerSocket.on(
    "disconnect",
    ()=>{

        playerState.connected =
            false;


        console.log(
            "PLAYER DISCONNECTED"
        );

    }
);


/* =====================================================
   PLAYER BUTTONS
   ===================================================== */

function setupPlayerButtons(){

    if(playerUI.loadButton){

        playerUI.loadButton.onclick =
            ()=>{

                const id =
                    playerUI.cardInput.value
                    .trim();


                if(!id){

                    alert(
                        "Enter Card ID"
                    );

                    return;

                }


                loadPlayerCard(id);

            };

    }


    if(playerUI.cardInput){

        playerUI.cardInput.addEventListener(
            "keydown",
            event=>{

                if(event.key==="Enter"){

                    playerUI.loadButton?.click();

                }

            }
        );

    }

}


/* =====================================================
   LOAD CARD FROM URL
   ===================================================== */

function loadCardFromURL(){

    const params =
        new URLSearchParams(
            window.location.search
        );


    const id =
        params.get("card");


    if(
        id &&
        playerUI.cardInput
    ){

        playerUI.cardInput.value =
            id;


        setTimeout(
            ()=>{
                loadPlayerCard(id);
            },
            300
        );

    }

}


/* =====================================================
   LOAD PLAYER CARD
   ===================================================== */

function loadPlayerCard(id){

    if(
        typeof window.generateCard !==
        "function"
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


/* =====================================================
   RENDER PLAYER CARD
   ===================================================== */

function renderPlayerCard(){

    if(!playerUI.cardArea){

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


            const isFree =
                cell.isFreeSpace ||
                cell.text === "FREE" ||
                cell.text === "FREE SPACE";


            if(isFree){

                cell.marked =
                    true;


                box.classList.add(
                    "free-space",
                    "cell-marked"
                );

            }


            box.onclick =
                ()=>{

                    if(isFree){

                        return;

                    }


                    if(playerState.locked){

                        return;

                    }


                    cell.marked =
                        !cell.marked;


                    if(cell.marked){

                        box.classList.add(
                            "cell-marked"
                        );

                    }else{

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


    if(playerUI.gameArea){

        playerUI.gameArea.style.display =
            "block";

    }


    /*
     * Give the browser time to finish
     * laying out the grid, then allow
     * the smart text fitting system
     * to measure every cell.
     */

    setTimeout(
        ()=>{

            if(
                typeof window.fitBingoCellText ===
                "function"
            ){

                window.fitBingoCellText();

            }

        },
        50
    );

}


/* =====================================================
   GAME STATE
   ===================================================== */

playerSocket.on(
    "gameState",
    state=>{

        if(!state){

            return;

        }


        if(
            Array.isArray(
                state.calledAnswers
            )
        ){

            playerState.calledAnswers =
                [
                    ...state.calledAnswers
                ];


            window.playerCalledAnswers =
                [
                    ...(state.calledAnswers || [])
                ];

        }


        if(playerUI.gameMessage){

            if(
                state.status ===
                "running"
            ){

                playerUI.gameMessage.textContent =
                    state.currentQuestion || "";

            }else{

                playerUI.gameMessage.textContent =
                    "Waiting for game...";

            }

        }


        checkForBingo();

    }
);


/* =====================================================
   GAME RESET
   ===================================================== */

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


        if(playerUI.cardArea){

            playerUI.cardArea.innerHTML =
                "";

        }


        if(playerUI.gameMessage){

            playerUI.gameMessage.textContent =
                "Waiting for host...";

        }

    }
);


/* =====================================================
   VALID BINGO CELL
   ===================================================== */

function isValidBingoCell(index){

    const cell =
        playerState.grid[index];


    if(!cell){

        return false;

    }


    /*
     * FREE SPACE ALWAYS COUNTS.
     */

    if(

        cell.isFreeSpace ||

        cell.text === "FREE" ||

        cell.text === "FREE SPACE"

    ){

        return true;

    }


    /*
     * PLAYER ONLY REPORTS
     * THAT THE CELL IS MARKED.
     *
     * HOST AUDIT DETERMINES WHETHER
     * THE ANSWER WAS ACTUALLY CALLED.
     */

    return cell.marked === true;

}


/* =====================================================
   CHECK FOR BINGO
   ===================================================== */

function checkForBingo(){

    if(playerState.locked){

        return;

    }


    if(
        playerState.grid.length !==
        25
    ){

        return;

    }


    const winningPatterns = [

        [0,1,2,3,4],

        [5,6,7,8,9],

        [10,11,12,13,14],

        [15,16,17,18,19],

        [20,21,22,23,24],

        [0,5,10,15,20],

        [1,6,11,16,21],

        [2,7,12,17,22],

        [3,8,13,18,23],

        [4,9,14,19,24],

        [0,6,12,18,24],

        [4,8,12,16,20]

    ];


    for(
        const pattern of winningPatterns
    ){

        const bingo =
            pattern.every(
                index =>
                    isValidBingoCell(index)
            );


        if(bingo){

            console.log(
                "PLAYER BINGO COMBINATION DETECTED:",
                pattern
            );


            sendBingoClaim(
                pattern
            );


            return;

        }

    }

}


/* =====================================================
   SEND BINGO CLAIM
   ===================================================== */

function sendBingoClaim(
    winningPattern
){

    if(playerState.locked){

        return;

    }


    if(!playerState.cardID){

        console.error(
            "BINGO CLAIM FAILED: NO CARD ID"
        );

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

                cell.text === "FREE" ||

                cell.text === "FREE SPACE"

            ){

                markedIndices.push(
                    index
                );

            }

        }
    );


    const claimData = {

        cardId:
            playerState.cardID,

        markedIndices:
            markedIndices,

        winningPattern:
            winningPattern,

        timestamp:
            Date.now()

    };


    console.log(
        "========== SENDING BINGO CLAIM ==========",
        claimData
    );


    playerSocket.emit(
        "claimWin",
        claimData
    );

}


/* =====================================================
   WIN APPROVED
   ===================================================== */

playerSocket.on(
    "winApproved",
    data=>{

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


        playerState.locked =
            true;


        if(

            window.bingoAnimation &&

            typeof window.bingoAnimation.show ===
            "function"

        ){

            window.bingoAnimation.show();

        }else{

            alert(
                "🎉 BINGO!"
            );

        }

    }
);


/* =====================================================
   WIN REJECTED
   ===================================================== */

playerSocket.on(
    "winRejected",
    data=>{

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


        playerState.locked =
            false;


        alert(
            "Bingo was not approved. Keep playing!"
        );

    }
);


/* =====================================================
   CARD LOADED
   ===================================================== */

playerSocket.on(
    "cardLoaded",
    data=>{

        console.log(
            "CARD CONFIRMED",
            data
        );

    }
);


/* =====================================================
   BEFORE UNLOAD
   ===================================================== */

window.addEventListener(
    "beforeunload",
    ()=>{

        if(playerSocket){

            playerSocket.disconnect();

        }

    }
);


/* =====================================================
   EXPORT PLAYER STATE
   ===================================================== */

window.getPlayerState =
    function(){

        return playerState;

    };


window.checkPlayerBingo =
    function(){

        checkForBingo();

    };


/* =====================================================
   BINGO WINNER STAR CELEBRATION
   ===================================================== */

function showBingoStarCelebration(){

    if(
        document.getElementById(
            "bingoStarCelebration"
        )
    ){

        return;

    }


    const overlay =
        document.createElement(
            "div"
        );


    overlay.id =
        "bingoStarCelebration";


    overlay.style.position =
        "fixed";


    overlay.style.inset =
        "0";


    overlay.style.pointerEvents =
        "none";


    overlay.style.overflow =
        "hidden";


    overlay.style.zIndex =
        "99999";


    document.body.appendChild(
        overlay
    );


    const gold =
        "#FFD700";


    for(
        let i=0;
        i<260;
        i++
    ){

        const star =
            document.createElement(
                "div"
            );


        star.textContent =
            "★";


        star.style.position =
            "absolute";


        star.style.top =
            "-40px";


        star.style.left =
            Math.random() * 100 +
            "vw";


        star.style.color =
            gold;


        star.style.fontSize =
            (
                Math.random() * 24 +
                12
            ) + "px";


        star.style.fontWeight =
            "900";


        star.style.textShadow =
            "0 0 8px #FFD700," +
            "0 0 18px #FFD700," +
            "0 0 30px rgba(255,215,0,.8)";


        star.style.opacity =
            "0.95";


        const duration =
            5 +
            Math.random() * 5;


        const delay =
            Math.random() * 2;


        star.style.animation =
            `bingoStarFall ${duration}s linear ${delay}s forwards`;


        overlay.appendChild(
            star
        );

    }


    if(
        !document.getElementById(
            "bingoStarStyle"
        )
    ){

        const style =
            document.createElement(
                "style"
            );


        style.id =
            "bingoStarStyle";


        style.textContent = `

            @keyframes bingoStarFall{

                0%{

                    transform:
                        translateY(-50px)
                        rotate(0deg)
                        scale(.6);

                    opacity:0;

                }

                10%{

                    opacity:1;

                }

                100%{

                    transform:
                        translateY(110vh)
                        rotate(720deg)
                        scale(1);

                    opacity:0;

                }

            }

        `;


        document.head.appendChild(
            style
        );

    }


    setTimeout(
        ()=>{

            overlay.remove();

        },
        10000
    );

}


/* =====================================================
   BINGO ANIMATION API
   ===================================================== */

window.bingoAnimation = {

    show:
        showBingoStarCelebration

};


/* =====================================================
   PLAYER READY
   ===================================================== */

console.log(
    "SAFETY BINGO PLAYER READY"
);
