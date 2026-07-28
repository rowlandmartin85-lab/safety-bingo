document.addEventListener(
"DOMContentLoaded",
()=>{


const homeBtn =
document.getElementById("homeBtn");


const homeModal =
document.getElementById("homeModal");


const cancelHome =
document.getElementById("cancelHome");


const confirmHome =
document.getElementById("confirmHome");



if(homeBtn){

homeBtn.onclick = ()=>{

homeModal.classList.add("show");

};

}



if(cancelHome){

cancelHome.onclick = ()=>{

homeModal.classList.remove("show");

};

}



if(confirmHome){

confirmHome.onclick = ()=>{


if(window.hostSocket){

window.hostSocket.emit(
"hostReset"
);

}


window.location.href =
"/index.html";


};

}



});