"use strict";

console.log("HOST DIGITAL AUDIT MODULE LOADED");

let digitalAuditCard=null;
let digitalAuditData=null;
let auditInitialized=false;

/* =====================================================
INITIALIZE DIGITAL AUDIT
===================================================== */

function initializeHostAudit(){

```
if(auditInitialized){

    return;

}

auditInitialized=true;

console.log(
    "INITIALIZING DIGITAL AUDITOR"
);

setupAuditButtons();

waitForHostSocket();
```

}

/* =====================================================
AUDIT BUTTONS
===================================================== */

function setupAuditButtons(){

```
const approveButton=
document.getElementById(
    "approvePhysicalWin"
);

const rejectButton=
document.getElementById(
    "rejectPhysicalWin"
);

if(approveButton){

    approveButton.addEventListener(
        "click",
        approveDigitalWinner
    );

}
else{

    console.error(
        "APPROVE WIN BUTTON NOT FOUND"
    );

}

if(rejectButton){

    rejectButton.addEventListener(
        "click",
        rejectDigitalWinner
    );

}
else{

    console.error(
        "REJECT WIN BUTTON NOT FOUND"
    );

}
```

}

/* =====================================================
WAIT FOR HOST SOCKET
===================================================== */

function waitForHostSocket(){

```
if(!window.hostSocket){

    console.log(
        "WAITING FOR HOST SOCKET..."
    );

    setTimeout(
        waitForHostSocket,
        250
    );

    return;

}

console.log(
    "DIGITAL AUDITOR CONNECTED"
);

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

        const cardId=
        Number(
            data.cardId
        );

        if(!cardId){

            console.error(
                "INVALID BINGO CARD ID",
                data
            );

            return;

        }

        createAuditButton(
            data
        );

    }
);
```

}

/* =====================================================
CREATE AUDIT CARD BUTTON
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
Number(
    data.cardId
);

const existing=
list.querySelector(
    `[data-card="${cardId}"]`
);

if(existing){

    console.log(
        "AUDIT REQUEST ALREADY EXISTS:",
        cardId
    );

    return;

}

const button=
document.createElement(
    "button"
);

button.type=
"button";

button.className=
"audit-list-button";

button.dataset.card=
cardId;

button.textContent=
"AUDIT CARD #"+cardId;

button.addEventListener(
    "click",
    ()=>{

        openDigitalAudit(
            data
        );

    }
);

list.appendChild(
    button
);

console.log(
    "AUDIT BUTTON CREATED:",
    "CARD #"+cardId
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
        "CARD GENERATOR MISSING"
    );

    return;

}

const cardId=
Number(
    data.cardId
);

if(!cardId){

    return;

}

digitalAuditCard=
window.generateCard(
    cardId
);

digitalAuditData=
data;

if(!digitalAuditCard){

    console.error(
        "UNABLE TO GENERATE AUDIT CARD:",
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

renderDigitalAudit(
    data
);
```

}

/* =====================================================
RENDER DIGITAL AUDIT CARD
===================================================== */

function renderDigitalAudit(data){

```
const grid=
document.getElementById(
    "auditCardDisplay"
);

if(!grid){

    console.error(
        "MISSING auditCardDisplay"
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

        const claimed=
        winningPattern.includes(
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
            claimed
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
APPROVE DIGITAL WINNER
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

if(!window.hostSocket){

    console.error(
        "HOST SOCKET NOT AVAILABLE"
    );

    return;

}

console.log(
    "APPROVING DIGITAL BINGO:",
    cardId
);

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
REJECT DIGITAL WINNER
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

if(!window.hostSocket){

    console.error(
        "HOST SOCKET NOT AVAILABLE"
    );

    return;

}

console.log(
    "REJECTING DIGITAL BINGO:",
    cardId
);

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
REMOVE AUDIT REQUEST
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
CLOSE AUDIT
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
PUBLIC FUNCTIONS
===================================================== */

window.initializeHostAudit=
initializeHostAudit;

window.approveDigitalWinner=
approveDigitalWinner;

window.rejectDigitalWinner=
rejectDigitalWinner;

window.closeDigitalAudit=
closeDigitalAudit;
