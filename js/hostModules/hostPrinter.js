/*
==========================================
SAFETY BINGO HOST PRINTER ENGINE
==========================================
*/

console.log("HOST PRINTER MODULE LOADED");

/*
==========================================
INITIALIZE PRINTER
==========================================
*/
function initializeHostPrinter() {
    console.log("INITIALIZING HOST PRINTER");

    // Fallback UI selector if hostUI global object is missing key references
    const buildBtn = document.getElementById("buildCardsBtn") || (typeof hostUI !== "undefined" ? hostUI.buildCardsBtn : null);

    if (buildBtn) {
        buildBtn.addEventListener("click", buildCardsForPrinting);
    } else {
        console.warn("Build Cards Button not found in DOM");
    }

    console.log("HOST PRINTER READY");
}

/*
==========================================
BUILD CARD REQUEST
==========================================
*/
function buildCardsForPrinting() {
    console.log("BUILDING PRINT CARDS");

    if (typeof window.generateBingoCards !== "function") {
        console.error("generateBingoCards() missing");
        alert("Card generator script (js/bingoGenerator.js) is not loaded.");
        return;
    }

    const startID = Number(document.getElementById("startID")?.value || 1);
    const totalCards = Number(document.getElementById("totalCards")?.value || 1);
    const cardsPerPage = Number(document.getElementById("cardsPerPage")?.value || 4);

    const cards = window.generateBingoCards(startID, totalCards);

    if (!cards || !cards.length) {
        alert("No cards generated. Please verify your question list.");
        return;
    }

    buildPrintableCards(cards, cardsPerPage);
}

/*
==========================================
BUILD PRINT PREVIEW (SCREEN & PRINT MATH)
==========================================
*/
function buildPrintableCards(cards, cardsPerPage) {
    const output = document.getElementById("printOutputZone") || (typeof hostUI !== "undefined" ? hostUI.printOutputZone : null);

    if (!output) {
        console.error("PRINT OUTPUT AREA MISSING (#printOutputZone)");
        return;
    }

    output.innerHTML = "";
    let sheet = null;

    // Get specific layout configuration based on cards-per-page choice
    const layoutConfig = getGridDimensions(cardsPerPage);

    cards.forEach((card, index) => {
        // Create new page break sheet
        if (index % cardsPerPage === 0) {
            sheet = document.createElement("div");
            sheet.className = `sheet-page-break cards-${cardsPerPage}`;
            output.appendChild(sheet);
        }

        const paper = document.createElement("div");
        paper.className = "paper-card";

        // Render card framework
        paper.innerHTML = `
            <div class="card-header">
                <h3>SAFETY STANDDOWN BINGO</h3>
            </div>
            
            <div class="paper-grid-matrix" style="grid-template-columns: repeat(5, 1fr);">
                ${card.grid.map(cell => {
                    const cleanText = cell.text || "";
                    const dynamicFontSize = fitTextToCell(cleanText, layoutConfig.cellHeight);
                    return `
                        <div class="paper-cell" style="min-height: ${layoutConfig.cellHeight}px; max-height: ${layoutConfig.cellHeight}px; font-size: ${dynamicFontSize}px;">
                            <span>${formatCardText(cleanText)}</span>
                        </div>
                    `;
                }).join("")}
            </div>

            <div class="paper-footer-bar">
                <span class="card-id-marker">Card ID: #${card.id}</span>
                <div class="qr-box-container" id="qr_${card.id}"></div>
            </div>
        `;

        sheet.appendChild(paper);
    });

    // Render QR codes onto generated cards
    buildQR(cards);

    // Give browser brief tick to complete DOM rendering before firing print modal
    setTimeout(() => {
        output.scrollIntoView({ behavior: "smooth", block: "start" });
        openPrintPreview();
    }, 400);
}

/*
==========================================
DYNAMIC GRID DIMENSIONS MATH
==========================================
*/
function getGridDimensions(cardsPerPage) {
    // Calculates pixel bounds so 1, 2, 3, or 4 cards fit cleanly on standard Letter/A4 paper
    switch (cardsPerPage) {
        case 1:
            return { cellHeight: 110 };
        case 2:
            return { cellHeight: 78 };
        case 3:
        case 4:
        default:
            return { cellHeight: 52 };
    }
}

/*
==========================================
FONT AUTO-SCALER LOGIC
==========================================
*/
function fitTextToCell(text, cellHeight) {
    const len = text.length;
    
    // Scale down text incrementally based on length & cell height
    if (cellHeight <= 55) { // 4-Card or 3-Card layout
        if (len > 45) return 8;
        if (len > 30) return 9.5;
        if (len > 18) return 10.5;
        return 12;
    } else if (cellHeight <= 80) { // 2-Card layout
        if (len > 50) return 9.5;
        if (len > 30) return 11;
        return 13;
    } else { // 1-Card full page layout
        if (len > 50) return 11;
        if (len > 30) return 13;
        return 15;
    }
}

/*
==========================================
TEXT FORMATTER (WORD WRAPPING)
==========================================
*/
function formatCardText(text) {
    if (!text) return "";
    const words = text.split(" ");
    let lines = [];
    let line = "";

    words.forEach(word => {
        if ((line + " " + word).length > 16) {
            lines.push(line);
            line = word;
        } else {
            line += (line ? " " : "") + word;
        }
    });

    if (line) lines.push(line);
    return lines.join("<br>");
}

/*
==========================================
QR BUILDER
==========================================
*/
function buildQR(cards) {
    if (typeof QRCode === "undefined") {
        console.warn("QRCode library is missing. Skipping QR build.");
        return;
    }

    cards.forEach(card => {
        const box = document.getElementById("qr_" + card.id);
        if (!box) return;

        box.innerHTML = "";

        new QRCode(box, {
            text: String(card.id),
            width: 54,
            height: 54,
            correctLevel: QRCode.CorrectLevel.L
        });
    });
}

/*
==========================================
OPEN PRINT PREVIEW WINDOW
==========================================
*/
function openPrintPreview() {
    const cardsOutput = document.getElementById("printOutputZone");

    if (!cardsOutput || !cardsOutput.innerHTML.trim()) {
        alert("Print preview is empty. Please generate cards first.");
        return;
    }

    const printWindow = window.open("", "_blank");

    if (!printWindow) {
        alert("Pop-up window blocked! Please allow pop-ups for this site to print.");
        return;
    }

    printWindow.document.write(`
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Safety Standdown Bingo Cards</title>
<style>
    * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
    }

    body {
        background: #ffffff;
        font-family: Arial, Helvetica, sans-serif;
        color: #000000;
        padding: 0;
    }

    /* Page container setup */
    .sheet-page-break {
        width: 8.5in;
        height: 11in;
        padding: 0.4in;
        margin: 0 auto 20px auto;
        background: white;
        box-shadow: 0 0 10px rgba(0,0,0,0.15);
        page-break-after: always;
        break-after: page;
        display: grid;
    }

    /* Layout Configurations */
    .sheet-page-break.cards-1 {
        grid-template-columns: 1fr;
        grid-template-rows: 1fr;
        gap: 0;
    }

    .sheet-page-break.cards-2 {
        grid-template-columns: 1fr;
        grid-template-rows: 1fr 1fr;
        gap: 0.3in;
    }

    .sheet-page-break.cards-3,
    .sheet-page-break.cards-4 {
        grid-template-columns: 1fr 1fr;
        grid-template-rows: 1fr 1fr;
        gap: 0.25in;
    }

    /* Individual Bingo Paper Cards */
    .paper-card {
        border: 2px solid #000000;
        padding: 10px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        background: #ffffff;
        height: 100%;
        overflow: hidden;
    }

    .card-header h3 {
        text-align: center;
        font-size: 14px;
        font-weight: 900;
        letter-spacing: 0.5px;
        margin-bottom: 6px;
        text-transform: uppercase;
    }

    /* 5x5 Bingo Matrix */
    .paper-grid-matrix {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 2px;
        background: #000000;
        border: 1px solid #000000;
        flex-grow: 1;
    }

    .paper-cell {
        background: #ffffff;
        padding: 2px;
        display: flex;
        align-items: center;
        justify-content: center;
        text-align: center;
        font-weight: bold;
        line-height: 1.15;
        overflow: hidden;
        word-break: break-word;
    }

    /* Footer Info Section */
    .paper-footer-bar {
        margin-top: 6px;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .card-id-marker {
        font-size: 11px;
        font-weight: bold;
    }

    .qr-box-container img, 
    .qr-box-container canvas {
        display: block;
        width: 46px !important;
        height: 46px !important;
    }

    /* Print Driver Media Rules */
    @media print {
        @page {
            size: letter portrait;
            margin: 0;
        }

        body {
            background: none;
        }

        .sheet-page-break {
            box-shadow: none;
            margin: 0;
            width: 100%;
            height: 100vh;
        }
    }
</style>
</head>
<body>

${cardsOutput.innerHTML}

<script>
window.onload = function() {
    setTimeout(function() {
        window.print();
        window.close();
    }, 500);
};
<\/script>

</body>
</html>
    `);

    printWindow.document.close();
}

// Bind to window object for global module execution
window.initializeHostPrinter = initializeHostPrinter;
