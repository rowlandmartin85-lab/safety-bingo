"use strict";
/*
SAFETY BINGO HOST MAIN CONTROLLER
IMPORTANT ARCHITECTURE
host.js
Main loader and navigation only.
hostGame.js
Owns the ONE Socket.IO connection and all game controls.
This file MUST NOT create another Socket.IO connection.
*/
console.log("HOST.JS LOADED");
console.log("HOST MAIN LOADER START");

/*
MAIN DOM INITIALIZATION
*/
document.addEventListener("DOMContentLoaded", () => {

console.log("HOST DOM READY");


/*
=================================================
1. HOST UI
=================================================
*/

if (
    typeof initializeHostUI === "function"
) {

    initializeHostUI();

} else {

    console.error(
        "HOST UI MISSING"
    );

}


/*
=================================================
2. HOST GAME

hostGame.js owns the Socket.IO connection.
=================================================
*/

if (
    typeof initializeHostGame === "function"
) {

    initializeHostGame();

} else {

    console.error(
        "HOST GAME MISSING"
    );

}


/*
=================================================
3. HOST PRINTER
=================================================
*/

if (
    typeof initializeHostPrinter === "function"
) {

    initializeHostPrinter();

} else {

    console.warn(
        "HOST PRINTER NOT FOUND"
    );

}


/*
=================================================
4. HOST CARD CHECKER
=================================================
*/

if (
    typeof initializeHostChecker === "function"
) {

    initializeHostChecker();

} else {

    console.warn(
        "HOST CHECKER NOT FOUND"
    );

}


/*
=================================================
5. HOST DIGITAL AUDIT
=================================================
*/

if (
    typeof initializeHostAudit === "function"
) {

    initializeHostAudit();

} else {

    console.warn(
        "HOST AUDIT NOT FOUND"
    );

}


/*
=================================================
6. NAVIGATION
=================================================
*/

initializeHostReferenceButtons();

initializeHomeButton();


console.log(
    "SAFETY BINGO HOST READY"
);
});
/*
HOST REFERENCE BUTTONS
*/
function initializeHostReferenceButtons() {

console.log(
    "INITIALIZING HOST REFERENCE BUTTONS"
);


/*
=================================================
ANSWER KEY
=================================================
*/

const answerKeyBtn =
    document.getElementById(
        "answerKeyBtn"
    );


if (answerKeyBtn) {

    answerKeyBtn.addEventListener(
        "click",
        () => {

            window.open(
                "/answerkey.html",
                "_blank"
            );

        }
    );

} else {

    console.warn(
        "answerKeyBtn NOT FOUND"
    );

}


/*
=================================================
QUESTION KEY
=================================================
*/

const cheatSheetBtn =
    document.getElementById(
        "cheatSheetBtn"
    );


if (cheatSheetBtn) {

    cheatSheetBtn.addEventListener(
        "click",
        () => {

            window.open(
                "/cheatsheet.html",
                "_blank"
            );

        }
    );

} else {

    console.warn(
        "cheatSheetBtn NOT FOUND"
    );

}


/*
=================================================
QUESTION MANAGER
=================================================
*/

const questionManagerBtn =
    document.getElementById(
        "questionManagerBtn"
    );


if (questionManagerBtn) {

    questionManagerBtn.addEventListener(
        "click",
        () => {

            window.open(
                "/questionManager.html",
                "_blank"
            );

        }
    );

} else {

    console.warn(
        "questionManagerBtn NOT FOUND"
    );

}
}
/*
HOME BUTTON SYSTEM
*/
function initializeHomeButton() {

console.log(
    "INITIALIZING HOME BUTTON SYSTEM"
);


const homeBtn =
    document.getElementById(
        "homeBtn"
    );


const homeModal =
    document.getElementById(
        "homeModal"
    );


const cancelHome =
    document.getElementById(
        "cancelHome"
    );


const confirmHome =
    document.getElementById(
        "confirmHome"
    );


/*
=================================================
OPEN HOME MODAL
=================================================
*/

if (
    homeBtn &&
    homeModal
) {

    homeBtn.onclick = () => {

        console.log(
            "HOME CLICK RECEIVED"
        );


        homeModal.style.display =
            "flex";


        homeModal.classList.add(
            "show"
        );

    };

}


/*
=================================================
CANCEL HOME
=================================================
*/

if (
    cancelHome &&
    homeModal
) {

    cancelHome.onclick = () => {

        homeModal.style.display =
            "none";


        homeModal.classList.remove(
            "show"
        );

    };

}


/*
=================================================
CONFIRM HOME
=================================================
*/

if (confirmHome) {

    confirmHome.onclick = () => {

        console.log(
            "ENDING GAME AND RETURNING HOME"
        );


        /*
        =========================================
        USE THE SOCKET OWNED BY hostGame.js
        =========================================
        */

        if (
            window.hostSocket &&
            typeof window.hostSocket.emit ===
            "function"
        ) {

            window.hostSocket.emit(
                "hostReset"
            );

        } else {

            console.warn(
                "HOST SOCKET NOT AVAILABLE DURING HOME RESET"
            );

        }


        /*
        =========================================
        CLEAR LOCAL GAME CACHE
        =========================================
        */

        localStorage.removeItem(
            "safetyBingoState"
        );


        sessionStorage.clear();


        /*
        =========================================
        RETURN HOME
        =========================================
        */

        window.location.href =
            "/index.html";

    };

}


console.log(
    "HOME BUTTON SYSTEM READY"
);
}
/*
EXPORT
*/
window.initializeHostReferenceButtons =
initializeHostReferenceButtons;

window.initializeHomeButton =
initializeHomeButton;
