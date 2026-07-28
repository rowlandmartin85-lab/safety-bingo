/*
==========================================
SAFETY BINGO HOST AUDIT SYSTEM
CLEAN BUILD
==========================================
*/


console.log(
    "HOST AUDIT MODULE LOADED"
);


let auditCard = null;



function initializeHostAudit(){


    console.log(
        "INITIALIZING HOST AUDIT"
    );



    if(!window.hostSocket){

        console.error(
            "AUDIT WAITING FOR HOST SOCKET"
        );

        return;

    }



    hostUI.approveBtn?.addEventListener(
        "click",
        approveWinner
    );


    hostUI.rejectBtn?.addEventListener(
        "click",
        rejectWinner
    );


    hostUI.closeAuditBtn?.addEventListener(
        "click",
        closeAudit
    );



    window.hostSocket.on(
        "winRequested",
        data=>{


            console.log(
                "WIN REQUEST RECEIVED",
                data
            );



            createAuditButton(
                data
            );


        }
    );



    hideAuditOverlay();



    console.log(
        "HOST AUDIT READY"
    );


}






function createAuditButton(data){


    const list =
    document.getElementById(
        "auditWinnerList"
    );



    if(!list){

        console.error(
            "Missing #auditWinnerList in host.html"
        );

        return;

    }



    const button =
    document.createElement(
        "button"
    );


    button.textContent =
    "AUDIT BINGO CARD #" +
    data.cardId;



    button.className =
    "audit-list-button";



    button.onclick =
    ()=>{

        openAuditWindow(
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






function openAuditWindow(data){


    auditCard =
    window.generateCard(
        Number(data.cardId)
    );



    if(!auditCard){

        console.error(
            "CARD GENERATION FAILED"
        );

        return;

    }



    hostUI.auditOverlay.style.display =
    "flex";



    hostUI.auditTitle.textContent =
    "CARD AUDIT #" +
    auditCard.id;



    hostUI.auditGrid.innerHTML =
    "";



    auditCard.grid.forEach(
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
            hostState.calledAnswers.some(
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
            data.markedIndices.includes(
                index
            );



            if(
                cell.isFreeSpace ||
                (marked && called)
            ){

                box.classList.add(
                    "audit-correct"
                );

            }


            else if(
                marked &&
                !called
            ){

                box.classList.add(
                    "audit-wrong"
                );

            }



            hostUI.auditGrid.appendChild(
                box
            );


        }
    );


}






function approveWinner(){


    if(!auditCard)
        return;


    window.hostSocket.emit(
        "approveWin",
        auditCard.id
    );


    closeAudit();


}






function rejectWinner(){


    if(!auditCard)
        return;


    window.hostSocket.emit(
        "rejectWin",
        auditCard.id
    );


    closeAudit();


}






function closeAudit(){


    auditCard=null;


    hideAuditOverlay();


}






function hideAuditOverlay(){


    if(hostUI.auditOverlay){

        hostUI.auditOverlay.style.display =
        "none";

    }


}





window.initializeHostAudit =
initializeHostAudit;