"use strict";

console.log("HOST.JS LOADED");

let hostMainInitialized = false;

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
    // BUTTONS
    // =================================================

    initializeHostReferenceButtons();
    initializeHomeButton();


    console.log(
        "SAFETY BINGO HOST READY"
    );

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
    // OPEN HOME CONFIRMATION
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
    // CANCEL HOME
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

                if (homeModal) {

                    homeModal.style.display =
                        "none";

                    homeModal.classList.remove(
                        "show"
                    );

                }


                // -------------------------------------
                // TELL SERVER HOST IS LEAVING
                // -------------------------------------

                if (
                    window.hostSocket &&
                    typeof window.hostSocket.emit ===
                    "function"
                ) {

                    console.log(
                        "SENDING hostLeftGame"
                    );

                    window.hostSocket.emit(
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
                // DISCONNECT HOST SOCKET
                // -------------------------------------
                /*
                 * Give the server a short moment to
                 * receive hostLeftGame.
                 *
                 * The SERVER must release hostSocketId
                 * when it receives hostLeftGame.
                 */

                setTimeout(
                    () => {

                        if (
                            window.hostSocket &&
                            typeof window.hostSocket.disconnect ===
                            "function"
                        ) {

                            console.log(
                                "DISCONNECTING OLD HOST SOCKET"
                            );

                            window.hostSocket.disconnect();

                        }


                        // ---------------------------------
                        // RETURN HOME
                        // ---------------------------------

                        window.location.href =
                            "/index.html";

                    },
                    250
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
