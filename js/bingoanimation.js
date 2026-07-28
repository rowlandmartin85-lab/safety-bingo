/* ====================================================================
   OFFICIAL 50-PHRASE REPOSITORY MATCHING THE CENTRAL SERVER MODEL
   Enforces uniform structural alignment across all layout modules
   ==================================================================== */
const safetyPhrasesPool = [
    "Lockout Tagout", "Red", "SDS", "Four Feet", "Class C",
    "Personal Protective Equipment", "Blue", "Inspect It", "Pull Aim Squeeze Sweep", "Hot Work Permit",
    "Apply Pressure", "Instability", "Earplugs", "Confined Space", "GFCI",
    "Yellow Triangle", "Three Points", "Safety Data Sheet", "Blue Sign", "Face Shield",
    "Four To One", "Clear It Instantly", "Cave In", "Steel Toe Boots", "The Needle Is In Green",
    "Green", "Full Body Harness", "Three Feet", "GHS", "Remove From Service",
    "Flush For Fifteen Minutes", "Lift With Your Legs", "Warning", "Job Hazard Analysis", "Store Materials",
    "Class D", "Test Atmosphere", "Arc Flash", "Swing Radius", "Flammability",
    "Lockout Hasp", "N95 Respirator", "Eight Hours", "Orange", "Occupational Safety Health Admin",
    "Class A", "Five Miles Per Hour", "Danger Tag", "Report It To Supervisor", "Safety Meeting"
];

/* ====================================================================
   MASTER DETERMINISTIC SEED CARD GENERATOR ENGINE
   Guarantees that identical Card IDs compile the exact same structural matrix
   ==================================================================== */
function generateCard(cardId) {
    let seed = parseInt(cardId, 10) || 1;

    // Local deterministic pseudo-random index generator algorithm matching your baseline math
    function rand() {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
    }

    const pool = [...safetyPhrasesPool];
    const cardGridSelectionArray = [];

    // Shuffle the phrases pool deterministically based on seed rules parameters
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        const temp = pool[i];
        pool[i] = pool[j];
        pool[j] = temp;
    }

    // Build perfect 5x5 layout matrix blocks
    let indexTracker = 0;
    for (let i = 0; i < 25; i++) {
        if (i === 12) {
            // FIX: Center cell is structured as a compliant object node
            cardGridSelectionArray.push({ text: "FREE SPACE", marked: true });
        } else {
            // FIX: Wraps text keys into objects to align seamlessly with .text property lookups
            cardGridSelectionArray.push({
                text: pool[indexTracker],
                marked: false
            });
            indexTracker++;
        }
    }

    // FIX: Returns a complete, unified data model matching backend payloads
    return {
        id: cardId,
        grid: cardGridSelectionArray
    };
}

window.generateCard = generateCard;

/* ====================================================================
   UNIFIED ALIGNMENT MATHEMATICS CHECKER MODULE
   Checks columns, rows, and diagonals for a complete horizontal/vertical trace win
   ==================================================================== */
function checkBingo(marked, grid) {
    const size = 5;

    function hasIndex(i) {
        return marked.includes(i);
    }

    const isWin = (line) => line.every(hasIndex);

    // 1. Process Horizontal Rows
    for (let r = 0; r < size; r++) {
        const row = [];
        for (let c = 0; c < size; c++) {
            row.push(r * size + c);
        }
        if (isWin(row)) return true;
    }

    // 2. Process Vertical Columns
    for (let c = 0; c < size; c++) {
        const col = [];
        for (let r = 0; r < size; r++) {
            col.push(r * size + c);
        }
        if (isWin(col)) return true;
    }

    // 3. Process Symmetric Diagonal Intersections
     const d1 = [0, 6, 12, 18, 24];
    const d2 = [4, 8, 12, 16, 20];

    if (isWin(diag1) || isWin(diag2)) return true;

    return false;
}

window.checkBingo = checkBingo;

/* ====================================================================
   CINEMATIC 3D CELEBRATION EFFECTS ENGINE
   Generates a falling cascade of gold dust particles when a victory fires
   ==================================================================== */
class BingoAnimationEngine {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.particles = [];
        this.animationFrame = null;
        this.active = false;
        
        document.addEventListener("DOMContentLoaded", () => {
            this.initCanvas();
        });
    }

    initCanvas() {
        this.canvas = document.createElement("canvas");
        this.canvas.id = "victoryConfettiCanvas";
        this.canvas.style.cssText = "position: fixed !important; top: 0 !important; left: 0 !important; width: 100vw !important; height: 100vh !important; z-index: 999999 !important; pointer-events: none !important; display: none;";
        document.body.appendChild(this.canvas);
        this.ctx = this.canvas.getContext("2d");

        window.addEventListener("resize", () => {
            if (this.canvas && this.active) {
                this.canvas.width = window.innerWidth;
                this.canvas.height = window.innerHeight;
            }
        });
    }

    show() {
        if (!this.canvas || this.active) return;
        this.active = true;
        this.canvas.style.display = "block";
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.particles = [];

        // Seed 150 shining metallic particles
        for (let i = 0; i < 150; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * -this.canvas.height - 20,
                size: Math.random() * 6 + 4,
                speedY: Math.random() * 3 + 2,
                speedX: Math.random() * 2 - 1,
                rotation: Math.random() * 360,
                rotationSpeed: Math.random() * 4 - 2,
                color: `hsl(${Math.random() * 15 + 40}, 100%, ${Math.random() * 20 + 50}%)` // Pure Gold 3D Matrix
            });
        }

        this.loop();
        
        // Stop automatically after 6 seconds to save system processing bounds
        setTimeout(() => {
            this.stop();
        }, 6000);
    }

    loop() {
        if (!this.active || !this.ctx) return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        let activeParticles = 0;

        this.particles.forEach(p => {
            p.y += p.speedY;
            p.x += p.speedX;
            p.rotation += p.rotationSpeed;

            if (p.y < this.canvas.height) {
                activeParticles++;
            } else {
                // Wrap top loop back into context bounds to sustain cascade momentum
                p.y = -20;
                p.x = Math.random() * this.canvas.width;
            }

            this.ctx.save();
            this.ctx.translate(p.x, p.y);
            this.ctx.rotate((p.rotation * Math.PI) / 180);
            this.ctx.fillStyle = p.color;
            this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
            this.ctx.restore();
        });

        this.animationFrame = requestAnimationFrame(() => this.loop());
    }

    stop() {
        this.active = false;
        if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
        if (this.canvas) {
            this.canvas.style.display = "none";
            if (this.ctx) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
    }
}

// Instantiate globally to intercept win responses across clients
window.bingoAnimation = new BingoAnimationEngine();
