"use strict";
console.log("HOST.JS LOADED");

let hostMainInitialized = false;

document.addEventListener(
"DOMContentLoaded",
initializeHostMain
);

function initializeHostMain() {

if (hostMainInitialized) {
    return;
}

hostMainInitialized = true;

console.log("HOST DOM READY");

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

initializeHostReferenceButtons();
initializeHomeButton();

console.log(
    "SAFETY BINGO HOST READY"
);

}
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

if (
    confirmHome &&
    confirmHome.dataset.homeReady !==
    "true"
) {

    confirmHome.dataset.homeReady =
        "true";

    confirmHome.addEventListener(
        "click",
        () => {

            confirmHome.disabled =
                true;

            if (homeModal) {

                homeModal.style.display =
                    "none";

                homeModal.classList.remove(
                    "show"
                );

            }

            if (
                window.hostSocket &&
                typeof window.hostSocket.emit ===
                "function"
            ) {

                window.hostSocket.emit(
                    "hostReset"
                );

            }

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

            setTimeout(
                () => {

                    window.location.href =
                        "/index.html";

                },
                100
            );

        }
    );

}

}
window.initializeHostReferenceButtons =
initializeHostReferenceButtons;

window.initializeHomeButton =
initializeHomeButton;

window.initializeHostMain =
initializeHostMain;
