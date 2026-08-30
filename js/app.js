// =====================================================
// SAFETY STANDDOWN BINGO - CENTRAL NAVIGATION ROUTER
// =====================================================

document.addEventListener("DOMContentLoaded", () => {
    const hostBtn = document.getElementById("hostBtn");
    const playerBtn = document.getElementById("playerBtn");
    const displayBtn = document.getElementById("displayBtn");

    /* =====================================================
       HOST GAME
       ===================================================== */
    if (hostBtn) {
        hostBtn.addEventListener("click", () => {
            console.log("NEW HOST GAME REQUESTED");
            sessionStorage.setItem("startNewHostGame", "true");
            window.location.href = "host.html";
        });
    }

    /* =====================================================
       PLAYER - Opens in NEW TAB
       ===================================================== */
    if (playerBtn) {
        playerBtn.addEventListener("click", (e) => {
            e.preventDefault();
            window.open("player.html", "_blank");
        });
    }

    /* =====================================================
       DISPLAY - Opens in NEW TAB
       ===================================================== */
    if (displayBtn) {
        displayBtn.addEventListener("click", (e) => {
            e.preventDefault();
            window.open("display.html", "_blank");
        });
    }

    /* =====================================================
       PRELOAD SPEECH VOICES
       ===================================================== */
    if ('speechSynthesis' in window) {
        window.speechSynthesis.getVoices();
    }
});
