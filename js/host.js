// =====================================================
// HOME BUTTON SYSTEM (EXPLICITLY ENDS & RESETS GAME)
// =====================================================
function initializeHomeButton() {
  console.log("INITIALIZING HOME BUTTON SYSTEM");

  const homeBtn = document.getElementById("homeBtn");
  const homeModal = document.getElementById("homeModal");
  const cancelHome = document.getElementById("cancelHome");
  const confirmHome = document.getElementById("confirmHome");

  if (homeBtn && homeModal) {
    homeBtn.onclick = () => {
      console.log("HOME CLICK RECEIVED");
      homeModal.style.display = "flex";
      homeModal.classList.add("show");
    };
  }

  if (cancelHome && homeModal) {
    cancelHome.onclick = () => {
      homeModal.style.display = "none";
      homeModal.classList.remove("show");
    };
  }

  if (confirmHome) {
    confirmHome.onclick = () => {
      console.log("SENDING GAME RESET TO SERVER...");

      // Clear local storage and session data first
      localStorage.removeItem("safetyBingoState");
      sessionStorage.clear();

      if (window.hostSocket && window.hostSocket.connected) {
        // Emit with a callback so we ONLY navigate once the server acknowledges reset
        window.hostSocket.emit("hostResetGame", () => {
          console.log("Server confirmed game reset. Navigating home...");
          window.location.href = "/index.html";
        });

        // Safety fallback: if server doesn't respond in 800ms, force redirect anyway
        setTimeout(() => {
          window.location.href = "/index.html";
        }, 800);
      } else {
        // Fallback if socket is disconnected
        window.location.href = "/index.html";
      }
    };
  }

  console.log("HOME BUTTON SYSTEM READY");
}
