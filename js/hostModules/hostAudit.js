/*
==========================================
SAFETY BINGO DIGITAL HOST AUDITOR
FULL REBUILD
==========================================
*/

"use strict";


console.log(
    "HOST DIGITAL AUDIT MODULE LOADED"
);



let digitalAuditCard = null;

let pendingAuditData = null;

let auditButtons = [];



/*
==========================================
INITIALIZE
==========================================
*/


function initializeHostAudit(){


    console.log(
        "INITIALIZING DIGITAL AUDITOR"
    );


    waitForHostSocket();


}






/*
==========================================
WAIT FOR SOCKET
==========================================
*/


function waitForHostSocket(){


    if(!window.hostSocket){


        console.log(
            "WAITING FOR HOST SOCKET..."
        );


        setTimeout(
            waitForHostSocket,
            500
        );


        return;

    }



    console.log(
        "HOST SOCKET READY FOR AUDIT"
    );



    setupDigitalAudit();


}







/*
==========================================
SETUP DIGITAL AUDIT
==========================================
*/


function setupDigitalAudit(){


    window.hostSocket.on(

        "winRequested",

        data=>{


            console.log(
                "DIGITAL WIN REQUEST RECEIVED:",
                data
            );


            createAuditButton(
                data
            );


        }

    );



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
CREATE AUDIT BUTTON
==========================================
*/


function createAuditButton(data){


    const list =
    document.getElementById(
        "auditWinnerList"
    );



    if(!list){

        console.error(
            "auditWinnerList not found"
        );

        return;

    }



    /*
    Prevent duplicates
    */


    if(
        auditButtons.includes(
            Number(data.cardId)
        )
    ){

        console.log(
            "Audit button already exists"
        );

        return;

    }



    auditButtons.push(
        Number(data.cardId)
    );



    const button =
    document.createElement(
        "button"
    );



    button.className =
    "audit-list-button";



    button.textContent =
    "AUDIT BINGO CARD #" +
    data.cardId;



    button.onclick =
    ()=>{


        openDigitalAudit(
            data
        );


    };



    list.appendChild(
        button
    );



    console.log(
        "AUDIT BUTTON CREATED FOR CARD:",
        data.cardId
    );


}








/*
==========================================
OPEN AUDIT WINDOW
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







    renderAuditCard();


}







/*
==========================================
RENDER CARD
==========================================
*/


function renderAuditCard(){


    const grid =
    document.getElementById(
        "auditCardDisplay"
    );



    if(!grid){

        console.error(
            "auditCardDisplay missing"
        );

        return;

    }



    grid.innerHTML =
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

            pendingAuditData.markedIndices?.includes(
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





            if(
                cell.isFreeSpace
            ){

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



            grid.appendChild(
                box
            );


        }

    );


}







/*
==========================================
APPROVE
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
REJECT
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
