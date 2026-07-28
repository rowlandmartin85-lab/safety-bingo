/*
==========================================
SAFETY BINGO HOST CARD CHECKER
COMPLETE REBUILD
PART 1 OF 8
==========================================
*/

"use strict";

console.log(
    "HOST CHECKER MODULE LOADED"
);

/*
==========================================
CHECKER STATE
==========================================
*/

let checkerCard = null;

let currentCardID = null;

let calledAnswers = [];

/*
==========================================
INITIALIZE CHECKER
==========================================
*/

function initializeHostChecker(){

    console.log(
        "INITIALIZING HOST CHECKER"
    );

    if(!window.hostUI){

        console.error(
            "hostUI not available."
        );

        return;

    }

    if(hostUI.checkCardBtn){

        hostUI.checkCardBtn.addEventListener(
            "click",
            checkPhysicalCard
        );

    }

    if(hostUI.closeAuditBtn){

        hostUI.closeAuditBtn.addEventListener(
            "click",
            closeCheckerOverlay
        );

    }

    if(hostUI.approveBtn){

        hostUI.approveBtn.addEventListener(
            "click",
            approvePhysicalBingo
        );

    }

    if(hostUI.rejectBtn){

        hostUI.rejectBtn.addEventListener(
            "click",
            rejectPhysicalBingo
        );

    }

    if(window.hostSocket){

        setupCheckerSocket();

    }

    hideCheckerOverlay();

    console.log(
        "HOST CHECKER READY"
    );

}

/*
==========================================
SOCKET EVENTS
==========================================
*/

function setupCheckerSocket(){

    window.hostSocket.on(
        "gameState",
        state=>{

            if(!state){

                return;

            }

            calledAnswers =
            state.calledAnswers || [];

        }
    );

}
/*
==========================================
CHECK PHYSICAL CARD
PART 2 OF 8
==========================================
*/

function checkPhysicalCard(){

    const input =
    hostUI.checkerCardID;

    if(!input){

        console.error(
            "checkerCardID not found."
        );

        return;

    }

    const cardID =
    Number(
        input.value.trim()
    );

    if(!cardID){

        alert(
            "Please enter a valid Card ID."
        );

        input.focus();

        return;

    }

    if(
        typeof window.generateCard !== "function"
    ){

        console.error(
            "generateCard() missing."
        );

        alert(
            "Card Generator unavailable."
        );

        return;

    }

    checkerCard =
    window.generateCard(cardID);

    if(!checkerCard){

        alert(
            "Unable to generate that card."
        );

        return;

    }

    currentCardID =
    cardID;

    openCheckerOverlay();

    renderCheckerCard();

}

/*
==========================================
OPEN OVERLAY
==========================================
*/

function openCheckerOverlay(){

    if(!hostUI.auditOverlay){

        return;

    }

    hostUI.auditOverlay.style.display =
    "flex";

    if(hostUI.auditTitle){

        hostUI.auditTitle.textContent =
        "CARD #" + currentCardID;

    }

}
/*
==========================================
RENDER CHECKER CARD
PART 3 OF 8
==========================================
*/

function renderCheckerCard(){

    if(
        !hostUI.auditGrid
    ){

        console.error(
            "auditCardDisplay not found."
        );

        return;

    }

    hostUI.auditGrid.innerHTML =
    "";

    checkerCard.grid.forEach(

        (cell,index)=>{

            const box =
            document.createElement(
                "div"
            );

            box.className =
            "audit-cell";

            box.textContent =
            cell.text;

            /*
            ==============================
            FREE SPACE
            ==============================
            */

            if(

                cell.isFreeSpace ||

                cell.text === "FREE" ||

                cell.text === "FREE SPACE"

            ){

                box.classList.add(
                    "free"
                );

            }

            /*
            ==============================
            CALLED ANSWER
            ==============================
            */

            else{

                const wasCalled =

                calledAnswers.some(

                    answer=>

                    String(answer)
                    .trim()
                    .toLowerCase()

                    ===

                    String(cell.text)
                    .trim()
                    .toLowerCase()

                );

                if(
                    wasCalled
                ){

                    box.classList.add(
                        "correct"
                    );

                }

                else{

                    box.classList.add(
                        "missed"
                    );

                }

            }

            hostUI.auditGrid.appendChild(
                box
            );

        }

    );

}
/*
==========================================
APPROVE / REJECT BINGO
PART 4 OF 8
==========================================
*/


function approvePhysicalBingo(){

    if(!checkerCard){

        console.warn(
            "No checker card loaded"
        );

        return;

    }


    console.log(
        "PHYSICAL BINGO APPROVED:",
        checkerCard.id
    );


    if(window.hostSocket){

        window.hostSocket.emit(
            "approvePhysicalWin",
            {
                cardId: checkerCard.id
            }
        );

    }


    closeCheckerOverlay();

}

function rejectPhysicalBingo(){

    if(
        !checkerCard
    ){

        return;

    }

    console.log(
        "REJECTING CARD",
        checkerCard.id
    );

    if(window.hostSocket){

        window.hostSocket.emit(
            "rejectPhysicalWin",
            {
                cardId: checkerCard.id
            }
        );

    }

    closeCheckerOverlay();

}

/*
==========================================
CLOSE / RESET CHECKER
PART 5 OF 8
==========================================
*/

function closeCheckerOverlay(){

    hideCheckerOverlay();

    if(hostUI.auditGrid){

        hostUI.auditGrid.innerHTML =
        "";

    }

    if(hostUI.auditTitle){

        hostUI.auditTitle.textContent =
        "CARD AUDIT";

    }

    if(hostUI.checkerCardID){

        hostUI.checkerCardID.value =
        "";

        hostUI.checkerCardID.focus();

    }

    checkerCard = null;

    currentCardID = null;

}



function hideCheckerOverlay(){

    if(!hostUI.auditOverlay){

        return;

    }

    hostUI.auditOverlay.style.display =
    "none";

}
/*
==========================================
SCAN HANDOFF
PART 6 OF 8
==========================================
*/

window.receiveScannedCard =
function(cardID){

    console.log(
        "SCANNED CARD:",
        cardID
    );

    if(
        hostUI.checkerCardID
    ){

        hostUI.checkerCardID.value =
        cardID;

    }

    checkPhysicalCard();

};



/*
==========================================
ENTER KEY SUPPORT
==========================================
*/

document.addEventListener(
    "DOMContentLoaded",
    ()=>{

        if(
            !hostUI.checkerCardID
        ){

            return;

        }

        hostUI.checkerCardID.addEventListener(

            "keydown",

            event=>{

                if(
                    event.key === "Enter"
                ){

                    event.preventDefault();

                    checkPhysicalCard();

                }

            }

        );

    }

);

/*
==========================================
CLOSE OVERLAY
==========================================
*/

function closeCheckerOverlay(){

    if(hostUI.auditOverlay){
        hostUI.auditOverlay.style.display = "none";
    }

    checkerCard = null;

}

window.hostSocket?.on(
"physicalWinApproved",
data=>{


    console.log(
        "PHYSICAL APPROVAL RECEIVED",
        data
    );


    if(hostUI.auditTitle){

        hostUI.auditTitle.textContent =
        "WINNER "
        +
        data.winnerNumber
        +
        " OF "
        +
        data.totalRequired
        +
        " APPROVED";

    }


});

