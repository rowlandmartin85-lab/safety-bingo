/*
==========================================
SAFETY BINGO DIGITAL HOST AUDITOR
AUTOMATIC WIN DETECTION VERSION
==========================================
*/

"use strict";


console.log(
    "HOST DIGITAL AUDIT MODULE LOADED"
);



let digitalAuditCard = null;

let pendingAuditData = null;



/*
==========================================
INITIALIZE
==========================================
*/

function initializeHostAudit(){


    console.log(
        "STARTING DIGITAL AUDITOR"
    );


    waitForSocket();


}






/*
==========================================
WAIT FOR HOST SOCKET
==========================================
*/

function waitForSocket(){


    if(!window.hostSocket){


        console.log(
            "WAITING FOR HOST SOCKET..."
        );


        setTimeout(
            waitForSocket,
            300
        );


        return;

    }



    console.log(
        "DIGITAL AUDITOR CONNECTED"
    );



    listenForWins();


}







/*
==========================================
LISTEN FOR AUTOMATIC BINGO CLAIMS
==========================================
*/


function listenForWins(){



    window.hostSocket.on(

        "winRequested",

        data=>{


            console.log(
                "AUTOMATIC BINGO DETECTED:",
                data
            );



            createAuditButton(
                data
            );


        }

    );


    setupAuditButtons();


}



/*
==========================================
CREATE HOST AUDIT BUTTON
==========================================
*/


function createAuditButton(data){


    const list =
    document.getElementById(
        "auditWinnerList"
    );



    if(!list){

        console.error(
            "Missing auditWinnerList"
        );

        return;

    }




    const existing =
    document.querySelector(
        `[data-card-id="${data.cardId}"]`
    );



    if(existing){

        return;

    }




    const button =
    document.createElement(
        "button"
    );



    button.className =
    "audit-list-button";



    button.dataset.cardId =
    data.cardId;



    button.textContent =
    "AUDIT BINGO CARD #" +
    data.cardId;




    button.onclick =
    function(){


        openDigitalAudit(
            data
        );


    };



    list.appendChild(
        button
    );



    console.log(
        "HOST AUDIT BUTTON CREATED"
    );


}



/*
==========================================
OPEN AUDIT
==========================================
*/


function openDigitalAudit(data){


    pendingAuditData =
    data;



    digitalAuditCard =
    window.generateCard(
        Number(data.cardId)
    );



    if(!digitalAuditCard){

        console.error(
            "CARD GENERATION FAILED"
        );

        return;

    }




    const overlay =
    document.getElementById(
        "auditOverlay"
    );



    if(overlay){

        overlay.style.display =
        "flex";

    }




    const title =
    document.getElementById(
        "auditTitle"
    );



    if(title){

        title.textContent =
        "DIGITAL AUDIT CARD #" +
        digitalAuditCard.id;

    }



    renderDigitalCard();


}



/*
==========================================
RENDER AUDIT CARD
==========================================
*/


function renderDigitalCard(){


    const display =
    document.getElementById(
        "auditCardDisplay"
    );



    if(!display)
        return;



    display.innerHTML =
    "";



    digitalAuditCard.grid.forEach(

        (cell,index)=>{


            const box =
            document.createElement(
                "div"
            );



            box.className =
            "audit-cell";



            box.textContent =
            cell.text;





            const marked =
            pendingAuditData.markedIndices.includes(
                index
            );



            const called =
            window.hostState?.calledAnswers?.some(

                answer =>

                String(answer)
                .trim()
                .toLowerCase()

                ===

                String(cell.text)
                .trim()
                .toLowerCase()

            );






            if(cell.isFreeSpace){

                box.classList.add(
                    "audit-correct"
                );

            }

            else if(
                marked &&
                called
            ){

                box.classList.add(
                    "audit-correct"
                );

            }

            else if(marked){

                box.classList.add(
                    "audit-wrong"
                );

            }



            display.appendChild(
                box
            );


        }

    );


}



/*
==========================================
APPROVE DIGITAL WIN
==========================================
*/


function approveDigitalWinner(){


    if(!digitalAuditCard)
        return;



    window.hostSocket.emit(

        "approveWin",

        digitalAuditCard.id

    );


    closeDigitalAudit();


}


/*
==========================================
REJECT DIGITAL WIN
==========================================
*/


function rejectDigitalWinner(){


    if(!digitalAuditCard)
        return;



    window.hostSocket.emit(

        "rejectWin",

        digitalAuditCard.id

    );


    closeDigitalAudit();


}



/*
==========================================
BUTTON CONNECTIONS
==========================================
*/


function setupAuditButtons(){



    const approve =
    document.getElementById(
        "approvePhysicalWin"
    );



    const reject =
    document.getElementById(
        "rejectPhysicalWin"
    );



    if(approve){

        approve.onclick =
        approveDigitalWinner;

    }



    if(reject){

        reject.onclick =
        rejectDigitalWinner;

    }


}



/*
==========================================
CLOSE
==========================================
*/


function closeDigitalAudit(){


    digitalAuditCard =
    null;


    pendingAuditData =
    null;



    const overlay =
    document.getElementById(
        "auditOverlay"
    );



    if(overlay){

        overlay.style.display =
        "none";

    }


}

window.initializeHostAudit =
initializeHostAudit;
