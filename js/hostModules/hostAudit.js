/*
==========================================
SAFETY BINGO DIGITAL HOST AUDITOR
REBUILD
==========================================
*/

"use strict";

console.log(
    "HOST DIGITAL AUDIT MODULE LOADED"
);


let digitalAuditCard = null;


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
        "DIGITAL AUDITOR CONNECTED"
    );


    setupDigitalAuditSocket();


}






/*
==========================================
SOCKET LISTENER
==========================================
*/

function setupDigitalAuditSocket(){


    window.hostSocket.on(

        "winRequested",

        data=>{


            console.log(
                "DIGITAL WIN REQUEST:",
                data
            );


            createAuditButton(
                data
            );


        }

    );


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
            "Missing auditWinnerList"
        );


        return;

    }



    const button =
    document.createElement(
        "button"
    );



    button.className =
    "audit-list-button";



    button.textContent =
    "AUDIT CARD #" + data.cardId;



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
        "AUDIT BUTTON CREATED"
    );


}







/*
==========================================
OPEN DIGITAL AUDIT
==========================================
*/


function openDigitalAudit(data){



    if(
        typeof window.generateCard !== "function"
    ){

        console.error(
            "Card generator missing"
        );


        return;

    }



    digitalAuditCard =
    window.generateCard(
        Number(data.cardId)
    );



    if(!digitalAuditCard){

        console.error(
            "Unable to generate card"
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





    const grid =
    document.getElementById(
        "auditCardDisplay"
    );


    if(!grid){

        console.error(
            "Missing auditCardDisplay"
        );

        return;

    }



    grid.innerHTML = "";




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



            const called =

            window.hostState.calledAnswers.some(

                answer=>

                String(answer)
                .trim()
                .toLowerCase()

                ===

                String(cell.text)
                .trim()
                .toLowerCase()

            );



            const marked =

            data.markedIndices?.includes(
                index
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


    digitalAuditCard = null;



    const overlay =
    document.getElementById(
        "auditOverlay"
    );


    if(overlay){

        overlay.style.display =
        "none";

    }


}






/*
==========================================
START MODULE
==========================================
*/


window.initializeHostAudit =
initializeHostAudit;
