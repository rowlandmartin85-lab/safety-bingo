"use strict";

/*

* =====================================================
* SAFETY BINGO — HOST MAIN CONTROLLER
* =====================================================
*
* This file is the main bootstrap/controller for the
* Host page.
*
* Module load order in host.html:
*
* socket.io
* cardGenerator.js
* hostState.js
* hostUI.js
* hostGame.js
* hostChecker.js
* hostAudit.js
* hostPrinter.js
* host.js
*
* host.js initializes the modules AFTER the DOM exists.
  */

console.log("HOST.JS LOADED");

let hostMainInitialized = false;

/* =====================================================
DOM READY
===================================================== */

if (document.readyState === "loading") {

```
document.addEventListener(
    "DOMContentLoaded",
    initializeHostMain,
    { once: true }
);
```

} else {

```
initializeHostMain();
```

}

/* =====================================================
HOST MAIN INITIALIZATION
===================================================== */

function initializeHostMain() {

```
if (hostMainInitialized) {
    console.warn(
        "HOST MAIN ALREADY INITIALIZED"
    );
    return;
}

hostMainInitialized = true;

console.log(
    "=========================================="
);

console.log(
    "HOST DOM READY"
);

console.log(
    "INITIALIZING HOST MODULES..."
);

console.log(
    "=========================================="
);


/*
 * -------------------------------------------------
 * VERIFY REQUIRED HOST ELEMENTS
 * -------------------------------------------------
 */

verifyHostElements();


/*
 * -------------------------------------------------
 * HOST STATE
 * -------------------------------------------------
 *
 * hostState must be initialized first because
 * other modules may depend on the socket/state
 * created there.
 */

initializeHostModule(
    "HOST STATE",
    window.initializeHostState
);


/*
 * -------------------------------------------------
 * HOST UI
 * -------------------------------------------------
 */

initializeHostModule(
    "HOST UI",
    window.initializeHostUI
);


/*
 * -------------------------------------------------
 * HOST GAME
 * -------------------------------------------------
 *
 * This module should register:
 *
 * START
 * NEXT
 * PREVIOUS
 * PAUSE
 * REPEAT
 * RESET
 *
 * and the corresponding Socket.IO listeners.
 */

initializeHostModule(
    "HOST GAME",
    window.initializeHostGame
);


/*
 * -------------------------------------------------
 * CARD CHECKER
 * -------------------------------------------------
 */

initializeHostModule(
    "HOST CHECKER",
    window.initializeHostChecker
);


/*
 * -------------------------------------------------
 * WIN AUDIT
 * -------------------------------------------------
 */

initializeHostModule(
    "HOST AUDIT",
    window.initializeHostAudit
);


/*
 * -------------------------------------------------
 * CARD PRINTER
 * -------------------------------------------------
 */

initializeHostModule(
    "HOST PRINTER",
    window.initializeHostPrinter
);


/*
 * -------------------------------------------------
 * REFERENCE BUTTONS
 * -------------------------------------------------
 */

initializeHostReferenceButtons();


/*
 * -------------------------------------------------
 * HOME BUTTON
 * -------------------------------------------------
 */

initializeHomeButton();


/*
 * -------------------------------------------------
 * FINAL STATE
 * -------------------------------------------------
 */

console.log(
    "=========================================="
);

console.log(
    "SAFETY BINGO HOST READY"
);

console.log(
    "=========================================="
);
```

}

/* =====================================================
SAFE MODULE INITIALIZER
===================================================== */

function initializeHostModule(
moduleName,
initializer
) {

```
if (
    typeof initializer !==
    "function"
) {

    /*
     * hostState was not included in some older
     * versions of the project, so don't crash the
     * entire Host page if it is absent.
     */

    if (
        moduleName !==
        "HOST STATE"
    ) {

        console.error(
            `${moduleName} MISSING`
        );

    } else {

        console.warn(
            "HOST STATE INITIALIZER NOT FOUND"
        );

    }

    return false;
}


try {

    initializer();

    console.log(
        `${moduleName} INITIALIZED`
    );

    return true;

} catch (error) {

    console.error(
        `${moduleName} INITIALIZATION ERROR:`,
        error
    );

    return false;
}
```

}

/* =====================================================
VERIFY HOST ELEMENTS
===================================================== */

function verifyHostElements() {

```
const requiredElements = [

    "questionBox",
    "answerBox",

    "timerMode",
    "winLimitMode",

    "startBtn",
    "pausePlayBtn",
    "previousBtn",
    "nextBtn",
    "repeatBtn",
    "resetBtn",

    "checkerCardID",
    "checkCardBtn",

    "startID",
    "totalCards",
    "cardsPerPage",
    "buildCardsBtn",

    "answerKeyBtn",
    "cheatSheetBtn",
    "questionManagerBtn",

    "winPanel",
    "auditWinnerList",

    "auditOverlay",
    "auditCardDisplay",

    "approvePhysicalWin",
    "rejectPhysicalWin",

    "homeBtn",
    "homeModal",
    "cancelHome",
    "confirmHome"

];


const missing = [];


requiredElements.forEach(
    id => {

        if (
            !document.getElementById(id)
        ) {

            missing.push(id);

        }

    }
);


if (
    missing.length > 0
) {

    console.warn(
        "HOST HTML ELEMENTS MISSING:",
        missing
    );

} else {

    console.log(
        "HOST HTML ELEMENT CHECK: OK"
    );

}
```

}

/* =====================================================
REFERENCE BUTTONS
===================================================== */

function initializeHostReferenceButtons() {

```
const answerKeyBtn =
    document.getElementById(
        "answerKeyBtn"
    );


if (
    answerKeyBtn &&
    answerKeyBtn.dataset.hostReady !==
    "true"
) {

    answerKeyBtn.dataset.hostReady =
        "true";

    answerKeyBtn.addEventListener(
        "click",
        () => {

            window.open(
                "/answerkey.html",
                "_blank"
            );

        }
    );

}


const cheatSheetBtn =
    document.getElementById(
        "cheatSheetBtn"
    );


if (
    cheatSheetBtn &&
    cheatSheetBtn.dataset.hostReady !==
    "true"
) {

    cheatSheetBtn.dataset.hostReady =
        "true";

    cheatSheetBtn.addEventListener(
        "click",
        () => {

            window.open(
                "/cheatsheet.html",
                "_blank"
            );

        }
    );

}


const questionManagerBtn =
    document.getElementById(
        "questionManagerBtn"
    );


if (
    questionManagerBtn &&
    questionManagerBtn.dataset.hostReady !==
    "true"
) {

    questionManagerBtn.dataset.hostReady =
        "true";

    questionManagerBtn.addEventListener(
        "click",
        () => {

            window.open(
                "/questionManager.html",
                "_blank"
            );

        }
    );

}
```

}

/* =====================================================
HOME BUTTON
===================================================== */

function initializeHomeButton() {

```
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
 * -------------------------------------------------
 * OPEN HOME MODAL
 * -------------------------------------------------
 */

if (
    homeBtn &&
    homeModal &&
    homeBtn.dataset.homeReady !==
    "true"
) {

    homeBtn.dataset.homeReady =
        "true";

    homeBtn.addEventListener(
        "click",
        () => {

            homeModal.style.display =
                "flex";

            homeModal.classList.add(
                "show"
            );

        }
    );

}


/*
 * -------------------------------------------------
 * CANCEL
 * -------------------------------------------------
 */

if (
    cancelHome &&
    homeModal &&
    cancelHome.dataset.homeReady !==
    "true"
) {

    cancelHome.dataset.homeReady =
        "true";

    cancelHome.addEventListener(
        "click",
        () => {

            homeModal.style.display =
                "none";

            homeModal.classList.remove(
                "show"
            );

        }
    );

}


/*
 * -------------------------------------------------
 * CLICK OUTSIDE MODAL
 * -------------------------------------------------
 */

if (
    homeModal &&
    homeModal.dataset.outsideReady !==
    "true"
) {

    homeModal.dataset.outsideReady =
        "true";

    homeModal.addEventListener(
        "click",
        event => {

            if (
                event.target ===
                homeModal
            ) {

                homeModal.style.display =
                    "none";

                homeModal.classList.remove(
                    "show"
                );

            }

        }
    );

}


/*
 * -------------------------------------------------
 * CONFIRM HOME
 * -------------------------------------------------
 */

if (
    confirmHome &&
    homeModal &&
    confirmHome.dataset.homeReady !==
    "true"
) {

    confirmHome.dataset.homeReady =
        "true";

    confirmHome.addEventListener(
        "click",
        () => {

            leaveHostGame(
                confirmHome,
                homeModal
            );

        }
    );

}
```

}

/* =====================================================
LEAVE HOST GAME
===================================================== */

function leaveHostGame(
confirmHome,
homeModal
) {

```
console.log(
    "=========================================="
);

console.log(
    "HOST LEAVING GAME"
);

console.log(
    "=========================================="
);


/*
 * Prevent double-clicks.
 */

if (confirmHome) {

    confirmHome.disabled =
        true;

    confirmHome.textContent =
        "ENDING GAME...";

}


/*
 * Close modal.
 */

if (homeModal) {

    homeModal.style.display =
        "none";

    homeModal.classList.remove(
        "show"
    );

}


/*
 * Tell server that the host intentionally
 * left the game.
 */

const socket =
    window.hostSocket;


if (
    socket &&
    typeof socket.emit ===
    "function"
) {

    console.log(
        "HOST SOCKET FOUND:",
        socket.id
    );

    console.log(
        "SENDING hostLeftGame"
    );


    try {

        socket.emit(
            "hostLeftGame"
        );

    } catch (error) {

        console.error(
            "HOST LEFT GAME EMIT ERROR:",
            error
        );

    }

} else {

    console.warn(
        "HOST SOCKET NOT AVAILABLE"
    );

}


/*
 * Clear local host/game state.
 */

try {

    localStorage.removeItem(
        "safetyBingoState"
    );

} catch (error) {

    console.warn(
        "LOCAL STORAGE CLEAR ERROR:",
        error
    );

}


try {

    sessionStorage.removeItem(
        "startNewHostGame"
    );

} catch (error) {

    console.warn(
        "SESSION STORAGE CLEAR ERROR:",
        error
    );

}


/*
 * Give Socket.IO enough time to transmit
 * hostLeftGame before disconnecting.
 */

setTimeout(
    () => {

        const currentSocket =
            window.hostSocket;


        if (
            currentSocket &&
            typeof currentSocket.disconnect ===
            "function"
        ) {

            console.log(
                "DISCONNECTING HOST SOCKET"
            );

            try {

                currentSocket.disconnect();

            } catch (error) {

                console.warn(
                    "HOST SOCKET DISCONNECT ERROR:",
                    error
                );

            }

        }


        /*
         * Return to home.
         */

        window.location.replace(
            "/index.html"
        );

    },
    500
);
```

}

/* =====================================================
EXPORTS
===================================================== */

window.initializeHostMain =
initializeHostMain;

window.initializeHostReferenceButtons =
initializeHostReferenceButtons;

window.initializeHomeButton =
initializeHomeButton;
