/*
==========================================
SAFETY BINGO DIGITAL AUDIT SYSTEM
REBUILD
==========================================
*/

console.log(
"HOST AUDIT MODULE LOADED"
);


let auditCard = null;
let auditData = null;



function initializeHostAudit(){

console.log(
"INITIALIZING DIGITAL AUDIT"
);


if(!window.hostSocket){

console.error(
"NO HOST SOCKET"
);

return;

}



window.hostSocket.on(
"winRequested",
data=>{


console.log(
"DIGITAL WIN REQUEST:",
data
);


createAuditButton(data);


});


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
approveWinner;

}


if(reject){

reject.onclick =
rejectWinner;

}


hideAuditOverlay();


console.log(
"DIGITAL AUDIT READY"
);


}





function createAuditButton(data){


const list =
document.getElementById(
"auditWinnerList"
);



if(!list){

console.error(
"auditWinnerList missing"
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
"AUDIT BINGO CARD #" +
data.cardId;



button.onclick =
()=>{


openAuditWindow(data);


};



list.appendChild(button);



console.log(
"AUDIT BUTTON CREATED"
);


}






function openAuditWindow(data){


auditData=data;


auditCard =
window.generateCard(
Number(data.cardId)
);



if(!auditCard){

alert(
"Unable to generate card"
);

return;

}



const overlay =
document.getElementById(
"auditOverlay"
);



overlay.style.display =
"flex";



document.getElementById(
"auditTitle"
).textContent =
"CARD AUDIT #" +
auditCard.id;



const grid =
document.getElementById(
"auditCardDisplay"
);



grid.innerHTML="";



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



const marked =
data.markedIndices.includes(
index
);



const called =
window.hostState.calledAnswers.some(
answer=>

String(answer)
.toLowerCase()
.trim()

===

String(cell.text)
.toLowerCase()
.trim()

);



if(cell.isFreeSpace){

box.classList.add(
"audit-correct"
);

}

else if(marked && called){

box.classList.add(
"audit-correct"
);

}

else if(marked && !called){

box.classList.add(
"audit-wrong"
);

}



grid.appendChild(box);


});


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

auditData=null;


hideAuditOverlay();


}



function hideAuditOverlay(){


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
