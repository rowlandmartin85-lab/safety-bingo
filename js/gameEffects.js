// =====================================================
// SAFETY STANDDOWN BINGO - VISUAL ANIMATION ENGINE
// Focuses exclusively on visual effects to prevent double audio
// =====================================================

class BingoAnimation {

    constructor() {
        this.active = false;
    }

    // =====================================================
    // 3D BINGO FULLSCREEN OVERLAY & CONFETTI CASCADES
    // =====================================================
    showBingo(options = {}) {

        const {
            title = "B I N G O !",
            subtitle = "WIN CONFIRMED!",
            duration = 5000
        } = options;

        // Prevent stacking duplicate overlays if a winner hits buttons rapidly
        const old = document.getElementById("bingo-overlay");
        if (old) old.remove();

        this.active = true;

        const overlay = document.createElement("div");
        overlay.id = "bingo-overlay";

        // Modern 3D fullscreen overlay styling configuration - SLIGHTLY TRANSLUCENT
        overlay.style.position = "fixed";
        overlay.style.top = "0";
        overlay.style.left = "0";
        overlay.style.width = "100vw";
        overlay.style.height = "100vh";
        overlay.style.background = "rgba(0, 0, 0, 0.75)"; // Premium slight translucency
        overlay.style.zIndex = "999999";
        overlay.style.overflow = "hidden";
        overlay.style.display = "flex";
        overlay.style.flexDirection = "column";
        overlay.style.alignItems = "center";
        overlay.style.justifyContent = "center";

        // TITLE (With high-contrast text rendering shadows)
        const titleEl = document.createElement("div");
        titleEl.textContent = title;
        titleEl.style.fontSize = "110px";
        titleEl.style.fontWeight = "900";
        titleEl.style.color = "#FFD84D";
        titleEl.style.fontFamily = "Arial, sans-serif";
        titleEl.style.textShadow = "0 0 15px #FFD84D, 0 0 30px #ffb400, 0 0 60px #ff8800";
        titleEl.style.animation = "bingoPulse 1.2s ease-in-out infinite alternate";

        // SUBTITLE
        const subEl = document.createElement("div");
        subEl.textContent = subtitle;
        subEl.style.fontSize = "30px";
        subEl.style.marginTop = "15px";
        subEl.style.color = "white";
        subEl.style.fontFamily = "Arial, sans-serif";

        overlay.appendChild(titleEl);
        overlay.appendChild(subEl);
        document.body.appendChild(overlay);

        // GRAVITY CONFETTI GENERATION LOOP (200 high-density particles)
        const colors = ["#FFD84D", "#2ecc71", "#3498db", "#e74c3c", "#9b59b6"];

        for (let i = 0; i < 200; i++) {
            const piece = document.createElement("div");
            const size = Math.random() * 10 + 4;

            piece.style.position = "absolute";
            piece.style.width = size + "px";
            piece.style.height = size + "px";
            piece.style.background = colors[Math.floor(Math.random() * colors.length)];
            piece.style.left = Math.random() * 100 + "vw";
            piece.style.top = "-10px";
            piece.style.opacity = "1";
            piece.style.borderRadius = Math.random() > 0.5 ? "50%" : "2px";
            
            // Fixed connection label to access the built-in css page tumble rules
            piece.style.animation = `fall ${2 + Math.random() * 3}s linear forwards`;

            overlay.appendChild(piece);
        }

        // Automatic overlay removal timeout script
        setTimeout(() => {
            overlay.remove();
            this.active = false;
        }, duration);
    }

    // Safety fallback routing hooks for legacy views looking for old object methods
    show() {
        this.showBingo();
    }

    showBingoVisuals() {
        this.showBingo();
    }
}

// Bind instance to both global tracking names to guarantee cross-compatibility across all pages safely
const activeAnimationInstance = new BingoAnimation();
window.bingoAnimation = activeAnimationInstance;
window.gameEffects = activeAnimationInstance;
