"use strict";

console.log("HOST.JS LOADED");

/*
==========================================
SAFETY BINGO HOST MAIN CONTROLLER
==========================================
*/

console.log("HOST MAIN LOADER START");

// =====================================================
// GLOBAL SOCKET INITIALIZATION & RECONNECT LOGIC
// =====================================================
//
// IMPORTANT:
// hostGame.js owns the actual Socket.IO connection.
//
// Do NOT create another socket here.
// Keeping this function available preserves the
// existing structure without creating duplicate
// host connections.
// =====================================================

function initializeHostSocket() {

  /*
  -----------------------------------------------------
  SOCKET OWNERSHIP
  -----------------------------------------------------

  hostGame.js is responsible for:

  - Creating the Socket.IO connection
  - Registering the host
  - Handling game socket events
  - Starting the game
  - Next / Previous
  - Pause / Play
  - Reset
  - Game state

  Therefore host.js must NOT call io() here.
  -----------------------------------------------------
  */

  console.log(
    "HOST SOCKET INITIALIZATION IS OWNED BY HOST GAME MODULE"
  );

}


// =====================================================
// MAIN DOM LOAD INITIALIZATION
// =====================================================

document.addEventListener(
  "DOMContentLoaded",
  () => {

    console.log(
      "HOST DOM READY"
    );


    /*
    =====================================================
    IMPORTANT CHANGE

    DO NOT call initializeHostSocket() here.

    hostGame.js creates and owns the single Socket.IO
    connection.

    Calling initializeHostSocket() here previously caused
    host.js and hostGame.js to compete for socket ownership.
    =====================================================
    */


    // =================================================
    // 1. LOAD UI
    // =================================================

    if (
      typeof initializeHostUI ===
      "function"
    ) {

      initializeHostUI();

    } else {

      console.error(
        "HOST UI MISSING"
      );

    }


    // =================================================
    // 2. START GAME MODULE
    // =================================================

    /*
    =====================================================
    hostGame.js owns:

    - Socket.IO connection
    - Host registration
    - Game buttons
    - Game state
    - Start game
    - Next question
    - Previous question
    - Pause / play
    - Repeat
    - Reset
    =====================================================
    */

    if (
      typeof initializeHostGame ===
      "function"
    ) {

      initializeHostGame();

    } else {

      console.error(
        "HOST GAME MISSING"
      );

    }


    // =================================================
    // 3. START PRINTER
    // =================================================

    if (
      typeof initializeHostPrinter ===
      "function"
    ) {

      initializeHostPrinter();

    } else {

      console.warn(
        "HOST PRINTER NOT FOUND"
      );

    }


    // =================================================
    // 4. START CARD CHECKER
    // =================================================

    if (
      typeof initializeHostChecker ===
      "function"
    ) {

      initializeHostChecker();

    } else {

      console.warn(
        "HOST CHECKER NOT FOUND"
      );

    }


    // =================================================
    // 5. START DIGITAL AUDIT
    // =================================================

    if (
      typeof initializeHostAudit ===
      "function"
    ) {

      initializeHostAudit();

    } else {

      console.warn(
        "HOST AUDIT NOT FOUND"
      );

    }


    // =================================================
    // 6. NAVIGATION AND MODAL CONTROLS
    // =================================================

    initializeHostReferenceButtons();

    initializeHomeButton();


    console.log(
      "SAFETY BINGO HOST READY"
    );

  }
);


// =====================================================
// HOST REFERENCE BUTTONS
// =====================================================

function initializeHostReferenceButtons() {

  console.log(
    "INITIALIZING HOST REFERENCE BUTTONS"
  );


  // ===================================================
  // HOST ANSWER KEY
  // ===================================================

  const answerKeyBtn =
    document.getElementById(
      "answerKeyBtn"
    );


  if (
    answerKeyBtn
  ) {

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
      "answerKeyBtn not found"
    );

  }


  // ===================================================
  // QUESTION KEY / CHEAT SHEET
  // ===================================================

  const cheatSheetBtn =
    document.getElementById(
      "cheatSheetBtn"
    );


  if (
    cheatSheetBtn
  ) {

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
      "cheatSheetBtn not found"
    );

  }


  // ===================================================
  // QUESTION MANAGER
  // ===================================================

  const questionManagerBtn =
    document.getElementById(
      "questionManagerBtn"
    );


  if (
    questionManagerBtn
  ) {

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
      "questionManagerBtn not found"
    );

  }

}


// =====================================================
// HOME BUTTON SYSTEM
// EXPLICITLY ENDS & RESETS GAME
// =====================================================

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


  const resetAndHome =
    document.getElementById(
      "resetAndHome"
    );


  // ===================================================
  // OPEN HOME CONFIRMATION
  // ===================================================

  if (
    homeBtn &&
    homeModal
  ) {

    homeBtn.onclick =
      () => {

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


  // ===================================================
  // CANCEL HOME
  // ===================================================

  if (
    cancelHome &&
    homeModal
  ) {

    cancelHome.onclick =
      () => {

        homeModal.style.display =
          "none";


        homeModal.classList.remove(
          "show"
        );

      };

  }


  // ===================================================
  // CONFIRM RETURN TO HOME
  // ===================================================

  if (
    confirmHome
  ) {

    confirmHome.onclick =
      () => {

        console.log(
          "EMITTING GAME RESET AND NAVIGATING TO INDEX"
        );


        /*
        =================================================
        HOST SOCKET IS OWNED BY hostGame.js.

        We simply use the existing global socket here
        if it exists.
        =================================================
        */

        if (
          window.hostSocket
        ) {

          window.hostSocket.emit(
            "hostReset"
          );

        }


        // =================================================
        // CLEAR LOCAL STORAGE / SESSION CACHE
        // =================================================

        localStorage.removeItem(
          "safetyBingoState"
        );


        sessionStorage.clear();


        // =================================================
        // RETURN HOME
        // =================================================

        window.location.href =
          "/index.html";

      };

  }


  // ===================================================
  // OPTIONAL SECONDARY RESET + HOME
  // ===================================================

  if (
    resetAndHome
  ) {

    resetAndHome.onclick =
      () => {

        console.log(
          "HOST EXPLICITLY RESETTING GAME BEFORE LEAVING"
        );


        if (
          window.hostSocket
        ) {

          /*
          -------------------------------------------------
          Legacy event retained exactly as before.
          -------------------------------------------------
          */

          window.hostSocket.emit(
            "hostResetGame"
          );


          window.hostSocket.emit(
            "resetGame"
          );

        }


        localStorage.removeItem(
          "safetyBingoState"
        );


        sessionStorage.clear();


        window.location.href =
          "/index.html";

      };

  }


  console.log(
    "HOME BUTTON SYSTEM READY"
  );

}
