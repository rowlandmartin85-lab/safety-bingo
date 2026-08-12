"use strict";

console.log("HOST.JS LOADED");

let hostMainInitialized = false;
let hostRegistrationStarted = false;

// =====================================================
// DOM READY
// =====================================================

document.addEventListener(
"DOMContentLoaded",
initializeHostMain
);

// =====================================================
// HOST MAIN INITIALIZATION
// =====================================================

function initializeHostMain() {


if (hostMainInitialized) {
    return;
}

hostMainInitialized = true;

console.log("HOST DOM READY");

// =================================================
// REGISTER HOST SOCKET
// =================================================

initializeHostSocket();

// =================================================
// HOST UI
// =================================================

if (
    typeof window.initializeHostUI ===
    "function"
) {

    try {

        window.initializeHostUI();

    } catch (error) {

        console.error(
            "HOST UI INITIALIZATION ERROR:",
            error
        );

    }

} else {

    console.error(
        "HOST UI MISSING"
    );

}

// =================================================
// HOST GAME
// =================================================

if (
    typeof window.initializeHostGame ===
    "function"
) {

    try {

        window.initializeHostGame();

    } catch (error) {

        console.error(
            "HOST GAME INITIALIZATION ERROR:",
            error
        );

    }

} else {

    console.error(
        "HOST GAME MISSING"
    );

}

// =================================================
// HOST PRINTER
// =================================================

if (
    typeof window.initializeHostPrinter ===
    "function"
) {

    try {

        window.initializeHostPrinter();

    } catch (error) {

        console.error(
            "HOST PRINTER INITIALIZATION ERROR:",
            error
        );

    }

}

// =================================================
// HOST CHECKER
// =================================================

if (
    typeof window.initializeHostChecker ===
    "function"
) {

    try {

        window.initializeHostChecker();

    } catch (error) {

        console.error(
            "HOST CHECKER INITIALIZATION ERROR:",
            error
        );

    }

}

// =================================================
// HOST AUDIT
// =================================================

if (
    typeof window.initializeHostAudit ===
    "function"
) {

    try {

        window.initializeHostAudit();

    } catch (error) {

        console.error(
            "HOST AUDIT INITIALIZATION ERROR:",
            error
        );

    }

}

// =================================================
// REFERENCE BUTTONS
// =================================================

initializeHostReferenceButtons();

// =================================================
// HOME BUTTON
// =================================================

initializeHomeButton();

console.log(
    "SAFETY BINGO HOST READY"
);

}

// =====================================================
// HOST SOCKET
// =====================================================

function initializeHostSocket() {

if (
    hostRegistrationStarted
) {
    return;
}

hostRegistrationStarted = true;

// -------------------------------------------------
// SOCKET.IO MUST EXIST
// -------------------------------------------------

if (
    typeof io !== "function"
) {

    console.error(
        "HOST SOCKET.IO NOT AVAILABLE"
    );

    return;
}

// -------------------------------------------------
// REUSE EXISTING HOST SOCKET
// -------------------------------------------------

if (
    window.hostSocket &&
    typeof window.hostSocket.on ===
    "function"
) {

    console.log(
        "USING EXISTING HOST SOCKET:",
        window.hostSocket.id
    );

    registerHostSocket(
        window.hostSocket
    );

    return;
}

// -------------------------------------------------
// CREATE HOST SOCKET
// -------------------------------------------------

console.log(
    "CREATING HOST SOCKET"
);

const socket =
    io();

window.hostSocket =
    socket;

registerHostSocket(
    socket
);

}

// =====================================================
// REGISTER HOST SOCKET
// =====================================================

function registerHostSocket(socket) {


if (!socket) {
    return;
}

// -------------------------------------------------
// CONNECT
// -------------------------------------------------

socket.on(
    "connect",
    () => {

        console.log(
            "HOST SOCKET CONNECTED:",
            socket.id
        );

        console.log(
            "REGISTERING HOST"
        );

        socket.emit(
            "registerHost"
        );

    }
);

// -------------------------------------------------
// HOST REGISTERED
// -------------------------------------------------

socket.on(
    "hostRegistered",
    () => {

        console.log(
            "=========================================="
        );

        console.log(
            "HOST REGISTERED SUCCESSFULLY"
        );

        console.log(
            "HOST SOCKET:",
            socket.id
        );

        console.log(
            "=========================================="
        );

        document.body.classList.add(
            "host-registered"
        );

    }
);

// -------------------------------------------------
// REGISTRATION REJECTED
// -------------------------------------------------

socket.on(
    "hostRegistrationRejected",
    data => {

        console.error(
            "HOST REGISTRATION REJECTED:",
            data
        );

        document.body.classList.remove(
            "host-registered"
        );

        alert(
            "HOST REGISTRATION REJECTED\n\n" +
            (
                data &&
                data.reason
                    ? data.reason
                    : "Another host is already connected."
            )
        );

    }
);

// -------------------------------------------------
// SOCKET ERROR
// -------------------------------------------------

socket.on(
    "connect_error",
    error => {

        console.error(
            "HOST SOCKET CONNECTION ERROR:",
            error
        );

    }
);

// -------------------------------------------------
// DISCONNECT
// -------------------------------------------------

socket.on(
    "disconnect",
    reason => {

        console.warn(
            "HOST SOCKET DISCONNECTED:",
            reason
        );

        document.body.classList.remove(
            "host-registered"
        );

    }
);

// -------------------------------------------------
// SOCKET ALREADY CONNECTED
// -------------------------------------------------

if (
    socket.connected
) {

    console.log(
        "HOST SOCKET ALREADY CONNECTED:",
        socket.id
    );

    socket.emit(
        "registerHost"
    );

}

}

// =====================================================
// REFERENCE BUTTONS
// =====================================================

function initializeHostReferenceButtons() {

const answerKeyBtn =
    document.getElementById(
        "answerKeyBtn"
    );

if (answerKeyBtn) {

    if (
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

}

const cheatSheetBtn =
    document.getElementById(
        "cheatSheetBtn"
    );

if (cheatSheetBtn) {

    if (
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

}

const questionManagerBtn =
    document.getElementById(
        "questionManagerBtn"
    );

if (questionManagerBtn) {

    if (
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

}

}

// =====================================================
// HOME BUTTON
// =====================================================

function initializeHomeButton() {

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

// =================================================
// OPEN HOME MODAL
// =================================================

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

// =================================================
// CANCEL
// =================================================

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

// =================================================
// CONFIRM HOME
// =================================================

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

            console.log(
                "========== HOST LEAVING GAME =========="
            );

            confirmHome.disabled =
                true;

            // -------------------------------------
            // CLOSE MODAL
            // -------------------------------------

            homeModal.style.display =
                "none";

            homeModal.classList.remove(
                "show"
            );

            // -------------------------------------
            // TELL SERVER HOST IS LEAVING
            // -------------------------------------

            const socket =
                window.hostSocket;

            if (
                socket &&
                typeof socket.emit ===
                "function"
            ) {

                console.log(
                    "SENDING hostLeftGame"
                );

                socket.emit(
                    "hostLeftGame"
                );

            }

            // -------------------------------------
            // CLEAR LOCAL GAME DATA
            // -------------------------------------

            try {

                localStorage.removeItem(
                    "safetyBingoState"
                );

            } catch (error) {

                console.warn(
                    "LOCAL STORAGE ERROR:",
                    error
                );

            }

            try {

                sessionStorage.removeItem(
                    "startNewHostGame"
                );

            } catch (error) {

                console.warn(
                    "SESSION STORAGE ERROR:",
                    error
                );

            }

            // -------------------------------------
            // WAIT FOR SERVER
            // -------------------------------------

            setTimeout(
                () => {

                    if (
                        socket &&
                        typeof socket.disconnect ===
                        "function"
                    ) {

                        console.log(
                            "DISCONNECTING HOST SOCKET"
                        );

                        socket.disconnect();

                    }

                    window.location.href =
                        "/index.html";

                },
                400
            );

        }
    );

}

}

// =====================================================
// EXPORTS
// =====================================================

window.initializeHostReferenceButtons =
initializeHostReferenceButtons;

window.initializeHomeButton =
initializeHomeButton;

window.initializeHostMain =
initializeHostMain;

window.initializeHostSocket =
initializeHostSocket;
