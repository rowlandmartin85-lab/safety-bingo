// =====================================================
// SAFETY STANDDOWN BINGO - CENTRAL NAVIGATION ROUTER
// Handles basic landing page button links cleanly
// =====================================================

document.addEventListener("DOMContentLoaded", () => {
    const hostBtn = document.getElementById("hostBtn");
    const playerBtn = document.getElementById("playerBtn");
    const displayBtn = document.getElementById("displayBtn");

    /* =====================================================
       DASHBOARD ROUTING TRIGGERS
       ===================================================== */
    if (hostBtn) {
        hostBtn.addEventListener("click", () => {
            window.location.href = "host.html";
        });
    }

    if (playerBtn) {
        playerBtn.addEventListener("click", () => {
            window.location.href = "player.html";
        });
    }

    if (displayBtn) {
        displayBtn.addEventListener("click", () => {
            window.open("display.html", "_blank");
        });
    }

    /* =====================================================
       AUTOMATED APP LAUNCH ENVIRONMENT INITIALIZATIONS
       Preloads speech voices to remove runtime lag spikes
       ===================================================== */
    if ('speechSynthesis' in window) {
        window.speechSynthesis.getVoices();
    }
});
