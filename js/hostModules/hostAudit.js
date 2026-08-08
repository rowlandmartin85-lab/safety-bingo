"use strict";

console.log("HOST DIGITAL AUDIT MODULE LOADED");

let digitalAuditCard=null;
let digitalAuditData=null;

/* =====================================================
INITIALIZE
===================================================== */

function initializeHostAudit(){

```
console.log("INITIALIZING DIGITAL AUDITOR");

waitForHostSocket();
```

}

/* =====================================================
WAIT FOR SOCKET
===================================================== */

function waitForHostSocket(){

```
if(!window.hostSocket){

    console.log("WAITING FOR HOST SOCKET...");

    setTimeout(
        waitForHostSocket,
        500
    );

    return;

}

console.log("DIGITAL AUDITOR CONNECTED");

setupDigitalAuditSocket();
```

}

/* =====================================================
SOCKET LISTENER
===================================================== */

function setupDigitalAuditSocket(){

```
if(window.hostAuditSocketReady){

    return;

}

window.hostAuditSocketReady=true;

window.hostSocket.on(
    "winRequested",
    data=>{

        console.log(
            "========== WIN REQUEST RECEIVED ==========",
            data
        );

        if(!data){

            console.error(
                "WIN REQUEST DATA MISSING"
            );

            return;

        }

        createAuditButton(data);

    }
);
```

}

/* =====================================================
CREATE AUDIT BUTTON
===================================================== */

function createAuditButton(data){

```
const list=
document.getElementById(
    "auditWinnerList"
);

if(!list){

    console.error(
        "Missing auditWinnerList"
    );

    return;

}

const cardId=
Number(data.cardId);

if(!cardId){

    console.error(
        "Invalid audit card ID",
        data
    );

    return;

}

const existing=
list.querySelector(
    `[data-card="${cardId}"]`
);

if(existing){

    console.log(
        "Audit request already exists for card:",
        cardId
    );

    return;

}

const button=
document.createElement(
    "button"
);

button.className=
"audit-list-button";

button.dataset.card=
cardId;

button.type=
"button";

button.textContent=
"AUDIT CARD #"+cardId;

button.onclick=
()=>{

    openDigitalAudit(data);

};

list.appendChild(
    button
);

console.log(
    "AUDIT BUTTON CREATED:",
    cardId
);
```

}

/* =====================================================
OPEN DIGITAL AUDIT
===================================================== */

function openDigitalAudit(data){

```
if(
    typeof window.generateCard!=="function"
){

    console.error(
        "Card generator missing"
    );

    return;

}

const cardId=
Number(data.cardId);

digitalAuditCard=
window.generateCard(
    cardId
);

digitalAuditData=
data;

if(!digitalAuditCard){

    console.error(
        "Unable to generate card:",
        cardId
    );

    return;

}

const overlay=
document.getElementById(
    "auditOverlay"
);

if(overlay){

    overlay.style.display=
    "flex";

}

const title=
document.getElementById(
    "auditTitle"
);

if(title){

    title.textContent=
    "DIGITAL AUDIT CARD #"+
    cardId;

}

const grid=
document.getElementById(
    "auditCardDisplay"
);

if(!grid){

    console.error(
        "Missing auditCardDisplay"
    );

    return;

}

grid.innerHTML="";

const calledAnswers=
window.hostState &&
Array.isArray(
    window.hostState.calledAnswers
)
?
window.hostState.calledAnswers
:
[];

const markedIndices=
Array.isArray(
    data.markedIndices
)
?
data.markedIndices
:
[];

const winningPattern=
Array.isArray(
    data.winningPattern
)
?
data.winningPattern
:
[];

digitalAuditCard.grid.forEach(
    (cell,index)=>{

        const box=
        document.createElement(
            "div"
        );

        box.className=
        "audit-cell";

        box.textContent=
        cell.text;

        const isFree=
        cell.isFreeSpace ||
        cell.text==="FREE" ||
        cell.text==="FREE SPACE";

        const called=
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

        const marked=
        markedIndices.includes(
            index
        );

        if(isFree){

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
        else if(
            marked &&
            !called
        ){

            box.classList.add(
                "audit-wrong"
            );

        }
        else if(
            winningPattern.includes(
                index
            )
        ){

            box.classList.add(
                "audit-missed"
            );

        }

        grid.appendChild(
            box
        );

    }
);
```

}

/* =====================================================
APPROVE
===================================================== */

function approveDigitalWinner(){

```
if(!digitalAuditCard){

    return;

}

const cardId=
Number(
    digitalAuditCard.id
);

if(!cardId){

    return;

}

window.hostSocket.emit(
    "approveWin",
    cardId
);

removeAuditButton(
    cardId
);

closeDigitalAudit();
```

}

/* =====================================================
REJECT
===================================================== */

function rejectDigitalWinner(){

```
if(!digitalAuditCard){

    return;

}

const cardId=
Number(
    digitalAuditCard.id
);

if(!cardId){

    return;

}

window.hostSocket.emit(
    "rejectWin",
    cardId
);

removeAuditButton(
    cardId
);

closeDigitalAudit();
```

}

/* =====================================================
REMOVE AUDIT BUTTON
===================================================== */

function removeAuditButton(cardId){

```
const list=
document.getElementById(
    "auditWinnerList"
);

if(!list){

    return;

}

const button=
list.querySelector(
    `[data-card="${cardId}"]`
);

if(button){

    button.remove();

}
```

}

/* =====================================================
CLOSE
===================================================== */

function closeDigitalAudit(){

```
digitalAuditCard=
null;

digitalAuditData=
null;

const overlay=
document.getElementById(
    "auditOverlay"
);

if(overlay){

    overlay.style.display=
    "none";

}
```

}

/* =====================================================
START MODULE
===================================================== */

window.initializeHostAudit=
initializeHostAudit;

window.approveDigitalWinner=
approveDigitalWinner;

window.rejectDigitalWinner=
rejectDigitalWinner;

window.closeDigitalAudit=
closeDigitalAudit;
