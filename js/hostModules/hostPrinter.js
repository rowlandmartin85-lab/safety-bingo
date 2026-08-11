"use strict";

/*
=====================================================
SAFETY BINGO HOST PRINTER ENGINE
JAVASCRIPT-SCALED PRINT PREVIEW
=====================================================
*/

console.log("HOST PRINTER MODULE LOADED");


/*
=====================================================
INITIALIZE
=====================================================
*/

function initializeHostPrinter() {

    console.log("INITIALIZING HOST PRINTER");

    const buildBtn =
        document.getElementById("buildCardsBtn") ||
        (
            typeof hostUI !== "undefined"
                ? hostUI.buildCardsBtn
                : null
        );

    /*
    =================================================
    DEFAULT TOTAL CARDS
    =================================================

    Set Total Cards to 1 when the printer loads.
    =================================================
    */

    const totalCardsInput =
        document.getElementById("totalCards");

    if (totalCardsInput) {

        totalCardsInput.value = 1;

    }


    /*
    =================================================
    BUILD BUTTON
    =================================================
    */

    if (buildBtn) {

        buildBtn.addEventListener(
            "click",
            buildCardsForPrinting
        );

    } else {

        console.warn(
            "Build Cards Button not found"
        );

    }

    console.log("HOST PRINTER READY");
}


/*
=====================================================
BUILD CARDS
=====================================================
*/

function buildCardsForPrinting() {

    console.log("BUILDING PRINT CARDS");

    if (
        typeof window.generateBingoCards !==
        "function"
    ) {

        console.error(
            "generateBingoCards() missing"
        );

        alert(
            "Card generator script is not loaded."
        );

        return;
    }


    const startID =
        Number(
            document.getElementById(
                "startID"
            )?.value || 1
        );


    /*
    =================================================
    TOTAL CARDS
    =================================================

    Defaults to 1 instead of 12.
    =================================================
    */

    const totalCards =
        Number(
            document.getElementById(
                "totalCards"
            )?.value || 1
        );


    const cardsPerPage =
        Number(
            document.getElementById(
                "cardsPerPage"
            )?.value || 1
        );


    const cards =
        window.generateBingoCards(
            startID,
            totalCards
        );


    if (
        !cards ||
        !cards.length
    ) {

        alert(
            "No cards generated. Please verify your question list."
        );

        return;
    }


    buildPrintableCards(
        cards,
        cardsPerPage
    );
}


/*
=====================================================
BUILD PRINTABLE CARDS
=====================================================
*/

function buildPrintableCards(
    cards,
    cardsPerPage
) {

    const output =
        document.getElementById(
            "printOutputZone"
        ) ||
        (
            typeof hostUI !== "undefined"
                ? hostUI.printOutputZone
                : null
        );


    if (!output) {

        console.error(
            "PRINT OUTPUT AREA MISSING"
        );

        return;
    }


    output.innerHTML = "";


    const layoutConfig =
        getGridDimensions(
            cardsPerPage
        );


    let sheet = null;


    cards.forEach(
        (card, index) => {

            if (
                index % cardsPerPage ===
                0
            ) {

                sheet =
                    document.createElement(
                        "div"
                    );

                sheet.className =
                    `sheet-page-break cards-${cardsPerPage}`;

                output.appendChild(
                    sheet
                );
            }


            const paper =
                document.createElement(
                    "div"
                );


            paper.className =
                "paper-card";


            paper.innerHTML = `

                <div class="card-inner-border">

                    <div class="card-header textured-header">

                        <div class="header-badge">
                            🛡️ SAFETY FIRST
                        </div>

                        <h3 class="textured-title">
                            SAFETY STANDDOWN BINGO
                        </h3>

                        <div class="header-sub">
                            OFFICIAL TRAINING & COMPLIANCE CARD
                        </div>

                    </div>


                    <div class="bingo-header-row">

                        <span>B</span>
                        <span>I</span>
                        <span>N</span>
                        <span>G</span>
                        <span>O</span>

                    </div>


                    <div class="paper-grid-matrix">

                        ${card.grid.map(
                            (cell, idx) => {

                                const cleanText =
                                    cell.text || "";


                                const upperText =
                                    cleanText.toUpperCase();


                                const isFreeSpace =
                                    upperText === "FREE" ||
                                    upperText === "FREE SPACE" ||
                                    idx === 12;


                                const fontSize =
                                    fitTextToCell(
                                        cleanText,
                                        layoutConfig.cellHeight
                                    );


                                return `

                                    <div
                                        class="paper-cell ${
                                            isFreeSpace
                                                ? "free-space-cell"
                                                : ""
                                        }"
                                        style="
                                            min-height:${layoutConfig.cellHeight}px;
                                            max-height:${layoutConfig.cellHeight}px;
                                        "
                                    >

                                        ${
                                            isFreeSpace

                                                ? `

                                                    <div class="free-space-content">

                                                        ★ FREE ★

                                                        <br>

                                                        <span class="free-sub">
                                                            SAFETY SPACE
                                                        </span>

                                                    </div>

                                                `

                                                : `

                                                    <span
                                                        style="
                                                            font-size:${fontSize}px;
                                                        "
                                                    >
                                                        ${formatCardText(cleanText)}
                                                    </span>

                                                `
                                        }

                                    </div>

                                `;

                            }
                        ).join("")}

                    </div>


                    <div class="paper-footer-bar">

                        <div class="footer-left">

                            <span class="card-id-marker">

                                CARD ID #

                                <strong>
                                    ${String(card.id).padStart(4, "0")}
                                </strong>

                            </span>


                            <span class="verification-tag">
                                VERIFIED COMPLIANT
                            </span>

                        </div>


                        <div class="qr-frame">

                            <div
                                class="qr-box-container"
                                id="qr_${card.id}"
                            ></div>

                        </div>

                    </div>

                </div>
            `;


            sheet.appendChild(
                paper
            );

        }
    );


    buildQR(
        cards,
        layoutConfig.qrSize
    );


    /*
    =================================================
    WAIT FOR QR + DOM
    =================================================
    */

    setTimeout(
        () => {

            output.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });


            openPrintPreview(
                cardsPerPage
            );

        },
        500
    );
}


/*
=====================================================
LAYOUT DIMENSIONS
=====================================================
*/

function getGridDimensions(
    cardsPerPage
) {

    switch (
        Number(cardsPerPage)
    ) {

        case 2:

            return {
                cellHeight: 76,
                qrSize: 38
            };


        case 3:
        case 4:

            return {
                cellHeight: 52,
                qrSize: 32
            };


        case 1:
        default:

            return {
                cellHeight: 116,
                qrSize: 46
            };

    }
}


/*
=====================================================
TEXT SIZE
=====================================================
*/

function fitTextToCell(
    text,
    cellHeight
) {

    const length =
        String(text || "").length;


    if (
        cellHeight <= 55
    ) {

        if (length > 45) return 7;
        if (length > 30) return 7.8;
        if (length > 18) return 8.8;

        return 10;
    }


    if (
        cellHeight <= 80
    ) {

        if (length > 50) return 8;
        if (length > 30) return 9;
        if (length > 18) return 10;

        return 11;
    }


    if (length > 50) return 10.5;
    if (length > 30) return 12;
    if (length > 18) return 13;

    return 14;
}


/*
=====================================================
FORMAT CARD TEXT
=====================================================
*/

function formatCardText(
    text
) {

    if (!text) {

        return "";

    }


    const words =
        String(text).split(/\s+/);


    const lines = [];

    let line = "";


    words.forEach(
        word => {

            const test =
                line
                    ? `${line} ${word}`
                    : word;


            if (
                test.length > 15
            ) {

                if (line) {

                    lines.push(
                        line
                    );

                }

                line =
                    word;

            } else {

                line =
                    test;

            }

        }
    );


    if (line) {

        lines.push(
            line
        );

    }


    return lines.join(
        "<br>"
    );
}


/*
=====================================================
QR CODES
=====================================================
*/

function buildQR(
    cards,
    qrSize = 40
) {

    if (
        typeof QRCode ===
        "undefined"
    ) {

        console.warn(
            "QRCode library missing"
        );

        return;
    }


    cards.forEach(
        card => {

            const box =
                document.getElementById(
                    "qr_" + card.id
                );


            if (!box) {

                return;

            }


            box.innerHTML = "";


            new QRCode(
                box,
                {
                    text:
                        String(card.id),

                    width:
                        qrSize,

                    height:
                        qrSize,

                    correctLevel:
                        QRCode.CorrectLevel.M
                }
            );

        }
    );
}


/*
=====================================================
OPEN PRINT PREVIEW
=====================================================
*/

function openPrintPreview(
    cardsPerPage
) {

    const cardsOutput =
        document.getElementById(
            "printOutputZone"
        );


    if (
        !cardsOutput ||
        !cardsOutput.innerHTML.trim()
    ) {

        alert(
            "Print preview is empty. Please generate cards first."
        );

        return;
    }


    const printWindow =
        window.open(
            "",
            "_blank"
        );


    if (!printWindow) {

        alert(
            "Pop-up window blocked! Please allow pop-ups for this site."
        );

        return;
    }


    /*
    =================================================
    DESKTOP BASE SIZE
    =================================================

    Everything is designed against this exact
    8.5 x 11 inch coordinate system.

    JavaScript then scales the complete page
    proportionally on smaller screens.
    =================================================
    */


    const PAGE_WIDTH =
        816;


    const PAGE_HEIGHT =
        1056;


    const DESKTOP_CARD_SCALE =
        1;


    printWindow.document.write(`

<!DOCTYPE html>

<html lang="en">

<head>

<meta charset="UTF-8">

<meta
    name="viewport"
    content="
        width=device-width,
        initial-scale=1.0,
        maximum-scale=1.0,
        user-scalable=no
    "
>

<title>
    Safety Standdown Bingo
</title>


<style>

* {

    box-sizing: border-box;

    margin: 0;

    padding: 0;

}


html,
body {

    width: 100%;

    min-height: 100%;

}


body {

    background: #e2e8f0;

    font-family:
        "Segoe UI",
        -apple-system,
        BlinkMacSystemFont,
        Roboto,
        sans-serif;

    color: #0f172a;

    overflow-x: hidden;

}


/*
=====================================================
PREVIEW AREA
=====================================================
*/

#print-stage {

    width: 100%;

    display: flex;

    flex-direction: column;

    align-items: center;

    padding:
        20px
        0
        40px;

}


/*
=====================================================
FIXED DESIGN PAGE
=====================================================
*/

.sheet-page-break {

    position: relative;

    width: ${PAGE_WIDTH}px;

    height: ${PAGE_HEIGHT}px;

    flex-shrink: 0;

    padding: 24px;

    margin: 0 auto 24px;

    background: #ffffff;

    box-shadow:
        0
        10px
        25px
        rgba(0,0,0,0.15);

    page-break-after: always;

    break-after: page;

    display: grid;

}


/*
=====================================================
PAGE LAYOUTS
=====================================================
*/

.sheet-page-break.cards-1 {

    grid-template-columns: 1fr;

    grid-template-rows: 1fr;

}


.sheet-page-break.cards-2 {

    grid-template-columns: 1fr;

    grid-template-rows: 1fr 1fr;

    gap: 12px;

}


.sheet-page-break.cards-3,
.sheet-page-break.cards-4 {

    grid-template-columns:
        1fr
        1fr;

    grid-template-rows:
        1fr
        1fr;

    gap: 8px;

}


/*
=====================================================
CARD
=====================================================
*/

.paper-card {

    width: 100%;

    height: 100%;

    border:
        2px solid
        #0f172a;

    border-radius: 6px;

    padding: 4px;

    background: #ffffff;

    overflow: hidden;

}


.card-inner-border {

    width: 100%;

    height: 100%;

    border:
        1px solid
        #94a3b8;

    border-radius: 4px;

    padding: 8px;

    display: flex;

    flex-direction: column;

    justify-content: space-between;

    background:
        linear-gradient(
            180deg,
            #f8fafc 0%,
            #ffffff 100%
        );

}


/*
=====================================================
HEADER
=====================================================
*/

.card-header.textured-header {

    background:

        radial-gradient(
            circle at 20% 20%,
            rgba(251,191,36,.15) 0%,
            transparent 40%
        ),

        radial-gradient(
            circle at 80% 80%,
            rgba(251,191,36,.15) 0%,
            transparent 40%
        ),

        repeating-linear-gradient(
            45deg,
            #0f172a,
            #0f172a 10px,
            #1e293b 10px,
            #1e293b 20px
        );

    color: #ffffff;

    text-align: center;

    padding: 8px;

    border-radius: 4px;

    margin-bottom: 6px;

    border:
        1.5px solid
        #fbbf24;

    box-shadow:
        inset
        0
        0
        10px
        rgba(0,0,0,.8),

        0
        2px
        4px
        rgba(0,0,0,.3);

}


.header-badge {

    font-size: 8.5px;

    font-weight: 800;

    color: #fbbf24;

    letter-spacing: 1px;

}


.textured-title {

    font-size:
        ${cardsPerPage === 1
            ? "20px"
            : "15px"};

    font-weight: 900;

    letter-spacing: 1px;

    margin: 2px 0;

    color: #fef08a;

    text-shadow:
        1px 1px 0 #000,
        -1px -1px 0 #000,
        1px -1px 0 #000,
        -1px 1px 0 #000;

}


.header-sub {

    font-size: 8px;

    color: #e2e8f0;

    letter-spacing: .5px;

    font-weight: 600;

}


/*
=====================================================
BINGO HEADER
=====================================================
*/

.bingo-header-row {

    display: grid;

    grid-template-columns:
        repeat(5,1fr);

    gap: 2px;

    margin-bottom: 4px;

}


.bingo-header-row span {

    background: #1e293b;

    color: #fbbf24;

    font-size:
        ${cardsPerPage === 1
            ? "18px"
            : "13px"};

    font-weight: 900;

    text-align: center;

    padding: 3px 0;

    border-radius: 2px;

}


/*
=====================================================
GRID
=====================================================
*/

.paper-grid-matrix {

    display: grid;

    grid-template-columns:
        repeat(5,1fr);

    gap: 2px;

    background: #475569;

    padding: 2px;

    border-radius: 3px;

    border:
        1.5px solid
        #0f172a;

    flex-grow: 1;

}


.paper-cell {

    background: #ffffff;

    padding:
        2px
        3px;

    display: flex;

    align-items: center;

    justify-content: center;

    text-align: center;

    font-weight: 700;

    line-height: 1.15;

    color: #0f172a;

    overflow: hidden;

    border-radius: 1px;

    border:
        1px solid
        #cbd5e1;

    word-break: break-word;

}


.paper-cell.free-space-cell {

    background:
        linear-gradient(
            135deg,
            #fef3c7 0%,
            #fde68a 100%
        );

    border:
        1.5px dashed
        #d97706;

}


.free-space-content {

    font-size:
        ${cardsPerPage === 1
            ? "13px"
            : "10px"};

    font-weight: 900;

    color: #92400e;

    line-height: 1.1;

}


.free-sub {

    font-size:
        ${cardsPerPage === 1
            ? "8.5px"
            : "6.5px"};

}


/*
=====================================================
FOOTER
=====================================================
*/

.paper-footer-bar {

    margin-top: 6px;

    display: flex;

    justify-content: space-between;

    align-items: center;

    padding-top: 4px;

    border-top:
        1px solid
        #e2e8f0;

}


.footer-left {

    display: flex;

    flex-direction: column;

    gap: 2px;

}


.card-id-marker {

    font-size:
        ${cardsPerPage === 1
            ? "12px"
            : "9.5px"};

    color: #334155;

}


.verification-tag {

    font-size:
        ${cardsPerPage === 1
            ? "8.5px"
            : "6.5px"};

    font-weight: 800;

    color: #166534;

    background: #dcfce7;

    padding: 2px 6px;

    border-radius: 2px;

}


.qr-frame {

    border:
        1px solid
        #cbd5e1;

    padding: 2px;

    background: #ffffff;

    border-radius: 2px;

}


.qr-box-container img,
.qr-box-container canvas {

    display: block;

}


/*
=====================================================
JAVASCRIPT MOBILE SCALING
=====================================================
*/

@media screen {

    #print-stage {

        overflow: visible;

    }

    .sheet-page-break {

        transform-origin:
            top center;

        margin-bottom:
            calc(
                24px +
                (
                    ${PAGE_HEIGHT}px *
                    var(--page-scale, 1)
                )
            );

    }

}


/*
=====================================================
PRINT
=====================================================
*/

@media print {

    @page {

        size: letter portrait;

        margin: 0;

    }


    html,
    body {

        width: 100%;

        height: 100%;

        background: #ffffff;

    }


    #print-stage {

        display: block;

        padding: 0;

        width: 100%;

    }


    .sheet-page-break {

        width: 100%;

        height: 100vh;

        margin: 0;

        padding: 24px;

        box-shadow: none;

        transform: none !important;

        page-break-after: always;

        break-after: page;

    }


    .card-header.textured-header,
    .paper-grid-matrix,
    .paper-cell {

        -webkit-print-color-adjust:
            exact;

        print-color-adjust:
            exact;

    }

}

</style>

</head>


<body>

<div id="print-stage">

    ${cardsOutput.innerHTML}

</div>


<script>

/*
=====================================================
JAVASCRIPT PRINT PREVIEW SCALER
=====================================================

The card itself always stays at the exact same
base size.

Only the screen preview is scaled.

This prevents mobile from changing the actual
card proportions.
=====================================================
*/

(function () {

    const PAGE_WIDTH = ${PAGE_WIDTH};
    const PAGE_HEIGHT = ${PAGE_HEIGHT};


    function scalePreview() {

        const stage =
            document.getElementById(
                "print-stage"
            );


        if (!stage) {

            return;

        }


        const pages =
            stage.querySelectorAll(
                ".sheet-page-break"
            );


        const availableWidth =
            Math.max(
                window.innerWidth,
                1
            );


        /*
        =============================================
        MOBILE / DESKTOP SCALE
        =============================================
        */

        let scale =
            availableWidth /
            PAGE_WIDTH;


        /*
        Never enlarge the page beyond its
        original desktop size.
        */

        scale =
            Math.min(
                scale,
                1
            );


        /*
        Small safety reduction so the entire
        card has a tiny amount of breathing room
        on narrow phones.
        */

        if (
            availableWidth <
            PAGE_WIDTH
        ) {

            scale =
                Math.max(
                    scale - 0.015,
                    0.25
                );

        }


        pages.forEach(
            page => {

                page.style.transform =
                    "scale(" +
                    scale +
                    ")";


                page.style.setProperty(
                    "--page-scale",
                    scale
                );


                /*
                =====================================
                CENTER PAGE
                =====================================
                */

                page.style.marginLeft =
                    "auto";

                page.style.marginRight =
                    "auto";

            }
        );


        /*
        =============================================
        FIX VERTICAL SPACE AFTER SCALED PAGE
        =============================================
        */

        pages.forEach(
            page => {

                const scaledHeight =
                    PAGE_HEIGHT *
                    scale;


                page.style.marginBottom =
                    (
                        24 +
                        (
                            PAGE_HEIGHT -
                            scaledHeight
                        )
                    ) +
                    "px";

            }
        );

    }


    /*
    =============================================
    INITIAL
    =============================================
    */

    window.addEventListener(
        "load",
        function () {

            setTimeout(
                scalePreview,
                100
            );

        }
    );


    /*
    =============================================
    ROTATION / RESIZE
    =============================================
    */

    window.addEventListener(
        "resize",
        scalePreview
    );


    window.addEventListener(
        "orientationchange",
        function () {

            setTimeout(
                scalePreview,
                150
            );

        }
    );


    /*
    =============================================
    PRINT
    =============================================
    */

    window.addEventListener(
        "beforeprint",
        function () {

            document
                .querySelectorAll(
                    ".sheet-page-break"
                )
                .forEach(
                    page => {

                        page.style.transform =
                            "none";

                    }
                );

        }
    );


    window.addEventListener(
        "afterprint",
        function () {

            scalePreview();

        }
    );


    /*
    =============================================
    AUTO PRINT
    =============================================
    */

    setTimeout(
        function () {

            window.print();

        },
        700
    );

})();

<\/script>

</body>

</html>

    `);


    printWindow.document.close();
}


/*
=====================================================
EXPORT
=====================================================
*/

window.initializeHostPrinter =
    initializeHostPrinter;
