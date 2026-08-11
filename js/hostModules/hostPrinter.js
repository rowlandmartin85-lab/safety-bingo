"use strict";

/*
=====================================================
SAFETY BINGO HOST PRINTER ENGINE
=====================================================
*/

console.log(
    "HOST PRINTER MODULE LOADED"
);


/*
=====================================================
INITIALIZE HOST PRINTER
=====================================================
*/

function initializeHostPrinter() {

    console.log(
        "INITIALIZING HOST PRINTER"
    );


    const buildBtn =
        document.getElementById(
            "buildCardsBtn"
        ) ||
        (
            typeof hostUI !== "undefined"
                ? hostUI.buildCardsBtn
                : null
        );


    if (buildBtn) {

        buildBtn.addEventListener(
            "click",
            buildCardsForPrinting
        );

    } else {

        console.warn(
            "Build Cards Button not found in DOM"
        );

    }


    console.log(
        "HOST PRINTER READY"
    );

}


/*
=====================================================
BUILD CARDS
=====================================================
*/

function buildCardsForPrinting() {

    console.log(
        "BUILDING PRINT CARDS"
    );


    if (
        typeof window.generateBingoCards !==
        "function"
    ) {

        console.error(
            "generateBingoCards() missing"
        );


        alert(
            "Card generator script (js/bingoGenerator.js) is not loaded."
        );


        return;

    }


    const startID =
        Number(
            document.getElementById(
                "startID"
            )?.value ||
            1
        );


    const totalCards =
        Number(
            document.getElementById(
                "totalCards"
            )?.value ||
            1
        );


    const cardsPerPage =
        Number(
            document.getElementById(
                "cardsPerPage"
            )?.value ||
            1
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
            "PRINT OUTPUT AREA MISSING (#printOutputZone)"
        );


        return;

    }


    output.innerHTML = "";


    let sheet = null;


    const layoutConfig =
        getGridDimensions(
            cardsPerPage
        );


    cards.forEach(
        (card, index) => {

            if (
                index %
                cardsPerPage ===
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
                                    cell.text ||
                                    "";


                                const upperText =
                                    cleanText.toUpperCase();


                                const isFreeSpace =
                                    upperText === "FREE" ||
                                    upperText === "FREE SPACE" ||
                                    idx === 12;


                                const dynamicFontSize =
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
                                            min-height:
                                                ${layoutConfig.cellHeight}px;

                                            max-height:
                                                ${layoutConfig.cellHeight}px;
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
                                                            font-size:
                                                            ${dynamicFontSize}px;
                                                        "
                                                    >
                                                        ${formatCardText(
                                                            cleanText
                                                        )}
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


    setTimeout(
        () => {

            output.scrollIntoView(
                {
                    behavior: "smooth",
                    block: "start"
                }
            );


            openPrintPreview(
                cardsPerPage
            );

        },
        400
    );

}


/*
=====================================================
GRID DIMENSIONS
=====================================================
*/

function getGridDimensions(
    cardsPerPage
) {

    switch (
        cardsPerPage
    ) {

        case 2:

            return {
                cellHeight: 82,
                qrSize: 42
            };


        case 3:
        case 4:

            return {
                cellHeight: 56,
                qrSize: 36
            };


        case 1:
        default:

            return {
                cellHeight: 128,
                qrSize: 52
            };

    }

}


/*
=====================================================
FIT TEXT TO CELL
=====================================================
*/

function fitTextToCell(
    text,
    cellHeight
) {

    const len =
        text.length;


    if (
        cellHeight <= 60
    ) {

        if (
            len > 45
        ) {

            return 7.5;

        }


        if (
            len > 30
        ) {

            return 8.5;

        }


        if (
            len > 18
        ) {

            return 9.5;

        }


        return 11;

    }


    if (
        cellHeight <= 85
    ) {

        if (
            len > 50
        ) {

            return 9;

        }


        if (
            len > 30
        ) {

            return 10.5;

        }


        return 12;

    }


    if (
        len > 50
    ) {

        return 12;

    }


    if (
        len > 30
    ) {

        return 14;

    }


    return 16;

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
        text.split(" ");


    const lines = [];


    let line = "";


    words.forEach(
        word => {

            if (
                (
                    line +
                    " " +
                    word
                ).length > 15
            ) {

                if (line) {

                    lines.push(
                        line
                    );

                }


                line =
                    word;

            } else {

                line +=
                    (
                        line
                            ? " "
                            : ""
                    ) +
                    word;

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
BUILD QR CODES
=====================================================
*/

function buildQR(
    cards,
    qrSize = 42
) {

    if (
        typeof QRCode ===
        "undefined"
    ) {

        console.warn(
            "QRCode library missing. Please load qrcode.min.js in host.html"
        );


        return;

    }


    cards.forEach(
        card => {

            const box =
                document.getElementById(
                    "qr_" +
                    card.id
                );


            if (!box) {

                return;

            }


            box.innerHTML =
                "";


            new QRCode(
                box,
                {
                    text:
                        String(
                            card.id
                        ),

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
            "Pop-up window blocked! Please allow pop-ups for this site to print."
        );


        return;

    }


    /*
    =================================================
    CALCULATE MOBILE SCALE
    =================================================

    Desktop Letter width:
    8.5 inches × 96px = 816px

    JavaScript measures the actual device width
    and scales the complete sheet proportionally.
    =================================================
    */

    const viewportWidth =
        Math.max(
            window.innerWidth ||
            document.documentElement.clientWidth ||
            390,

            320
        );


    const baseSheetWidth =
        816;


    const horizontalPadding =
        20;


    let mobileScale =
        (
            viewportWidth -
            horizontalPadding
        ) /
        baseSheetWidth;


    /*
    Keep the preview readable.
    */

    mobileScale =
        Math.max(
            0.42,
            Math.min(
                mobileScale,
                1
            )
        );


    /*
    =================================================
    WRITE PRINT DOCUMENT
    =================================================
    */

    printWindow.document.write(`

<!DOCTYPE html>

<html lang="en">

<head>

<meta charset="UTF-8">

<meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
>

<title>
Safety Standdown Bingo - Printable Cards
</title>


<style>

* {

    box-sizing:
        border-box;

    margin:
        0;

    padding:
        0;

}


html,
body {

    width:
        100%;

    min-height:
        100%;

}


body {

    background:
        #e2e8f0;

    font-family:
        "Segoe UI",
        -apple-system,
        BlinkMacSystemFont,
        Roboto,
        sans-serif;

    color:
        #0f172a;

    padding:
        15px 0;

    overflow-x:
        hidden;

}


/*
=================================================
SHEET
=================================================
*/

.sheet-page-break {

    width:
        8.5in;

    height:
        11in;

    padding:
        0.25in;

    margin:
        0 auto 20px auto;

    background:
        #ffffff;

    box-shadow:
        0 10px 25px
        rgba(0,0,0,0.15);

    page-break-after:
        always;

    break-after:
        page;

    display:
        grid;

    transform-origin:
        top center;

}


/*
=================================================
ONE CARD PER PAGE
=================================================
*/

.sheet-page-break.cards-1 {

    grid-template-columns:
        1fr;

    grid-template-rows:
        1fr;

}


/*
=================================================
TWO CARDS PER PAGE
=================================================
*/

.sheet-page-break.cards-2 {

    grid-template-columns:
        1fr;

    grid-template-rows:
        1fr 1fr;

    gap:
        0.15in;

}


/*
=================================================
THREE / FOUR CARDS
=================================================
*/

.sheet-page-break.cards-3,
.sheet-page-break.cards-4 {

    grid-template-columns:
        1fr 1fr;

    grid-template-rows:
        1fr 1fr;

    gap:
        0.1in;

}


/*
=================================================
OUTER CARD
=================================================
*/

.paper-card {

    border:
        2px solid #0f172a;

    border-radius:
        6px;

    padding:
        4px;

    background:
        #ffffff;

    height:
        100%;

    overflow:
        hidden;

}


/*
=================================================
INNER CARD
=================================================
*/

.card-inner-border {

    border:
        1px solid #94a3b8;

    border-radius:
        4px;

    padding:
        8px;

    height:
        100%;

    display:
        flex;

    flex-direction:
        column;

    justify-content:
        space-between;

    background:
        linear-gradient(
            180deg,
            #f8fafc 0%,
            #ffffff 100%
        );

}


/*
=================================================
HEADER
=================================================
*/

.card-header.textured-header {

    background:

        radial-gradient(
            circle at 20% 20%,
            rgba(
                251,
                191,
                36,
                0.15
            )
            0%,
            transparent 40%
        ),

        radial-gradient(
            circle at 80% 80%,
            rgba(
                251,
                191,
                36,
                0.15
            )
            0%,
            transparent 40%
        ),

        repeating-linear-gradient(
            45deg,
            #0f172a,
            #0f172a 10px,
            #1e293b 10px,
            #1e293b 20px
        );

    color:
        #ffffff;

    text-align:
        center;

    padding:
        8px;

    border-radius:
        4px;

    margin-bottom:
        6px;

    border:
        1.5px solid #fbbf24;

    box-shadow:
        inset 0 0 10px
        rgba(0,0,0,0.8),

        0 2px 4px
        rgba(0,0,0,0.3);

}


.header-badge {

    font-size:
        8.5px;

    font-weight:
        800;

    color:
        #fbbf24;

    letter-spacing:
        1px;

    text-transform:
        uppercase;

}


.textured-title {

    font-size:
        ${cardsPerPage === 1
            ? "20px"
            : "15px"};

    font-weight:
        900;

    letter-spacing:
        1px;

    text-transform:
        uppercase;

    margin:
        2px 0;

    color:
        #fef08a;

    text-shadow:
        1px 1px 0 #000,
        -1px -1px 0 #000,
        1px -1px 0 #000,
        -1px 1px 0 #000;

}


.header-sub {

    font-size:
        8px;

    color:
        #e2e8f0;

    letter-spacing:
        0.5px;

    text-transform:
        uppercase;

    font-weight:
        600;

}


/*
=================================================
BINGO HEADER
=================================================
*/

.bingo-header-row {

    display:
        grid;

    grid-template-columns:
        repeat(
            5,
            1fr
        );

    gap:
        2px;

    margin-bottom:
        4px;

}


.bingo-header-row span {

    background:
        #1e293b;

    color:
        #fbbf24;

    font-size:
        ${cardsPerPage === 1
            ? "18px"
            : "13px"};

    font-weight:
        900;

    text-align:
        center;

    padding:
        3px 0;

    border-radius:
        2px;

    letter-spacing:
        0.5px;

}


/*
=================================================
BINGO GRID
=================================================
*/

.paper-grid-matrix {

    display:
        grid;

    grid-template-columns:
        repeat(
            5,
            1fr
        );

    gap:
        2px;

    background:
        #475569;

    padding:
        2px;

    border-radius:
        3px;

    border:
        1.5px solid #0f172a;

    flex-grow:
        1;

}


.paper-cell {

    background:
        #ffffff;

    padding:
        2px 3px;

    display:
        flex;

    align-items:
        center;

    justify-content:
        center;

    text-align:
        center;

    font-weight:
        700;

    line-height:
        1.15;

    color:
        #0f172a;

    overflow:
        hidden;

    border-radius:
        1px;

    border:
        1px solid #cbd5e1;

    word-break:
        break-word;

}


.paper-cell.free-space-cell {

    background:
        linear-gradient(
            135deg,
            #fef3c7 0%,
            #fde68a 100%
        );

    border:
        1.5px dashed #d97706;

}


.free-space-content {

    font-size:
        ${cardsPerPage === 1
            ? "13px"
            : "10px"};

    font-weight:
        900;

    color:
        #92400e;

    line-height:
        1.1;

}


.free-sub {

    font-size:
        ${cardsPerPage === 1
            ? "8.5px"
            : "6.5px"};

    font-weight:
        800;

    color:
        #b45309;

}


/*
=================================================
FOOTER
=================================================
*/

.paper-footer-bar {

    margin-top:
        6px;

    display:
        flex;

    justify-content:
        space-between;

    align-items:
        center;

    padding-top:
        4px;

    border-top:
        1px solid #e2e8f0;

}


.footer-left {

    display:
        flex;

    flex-direction:
        column;

    gap:
        2px;

}


.card-id-marker {

    font-size:
        ${cardsPerPage === 1
            ? "12px"
            : "9.5px"};

    color:
        #334155;

}


.verification-tag {

    font-size:
        ${cardsPerPage === 1
            ? "8.5px"
            : "6.5px"};

    font-weight:
        800;

    color:
        #166534;

    background:
        #dcfce7;

    padding:
        2px 6px;

    border-radius:
        2px;

    display:
        inline-block;

    width:
        fit-content;

}


.qr-frame {

    border:
        1px solid #cbd5e1;

    padding:
        2px;

    background:
        #ffffff;

    border-radius:
        2px;

}


.qr-box-container img,
.qr-box-container canvas {

    display:
        block;

}


/*
=================================================
MOBILE PREVIEW
=================================================
*/

@media screen and (max-width: 850px) {

    body {

        padding:
            10px 0 30px 0;

        overflow-x:
            hidden;

    }


    .sheet-page-break {

        transform:
            scale(${mobileScale});

        transform-origin:
            top center;

        margin-left:
            auto;

        margin-right:
            auto;

        /*
        Compensate for the visual
        height created by transform.
        */

        margin-bottom:
            calc(
                20px +
                (
                    11in *
                    ${mobileScale}
                )
            );

    }

}


/*
=================================================
PRINT
=================================================
*/

@media print {

    @page {

        size:
            letter portrait;

        margin:
            0;

    }


    html,
    body {

        width:
            100%;

        height:
            100%;

    }


    body {

        background:
            none;

        padding:
            0;

        overflow:
            visible;

    }


    .sheet-page-break {

        width:
            100%;

        height:
            100vh;

        margin:
            0;

        box-shadow:
            none;

        transform:
            none !important;

        page-break-after:
            always;

        break-after:
            page;

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

${cardsOutput.innerHTML}


<script>

window.addEventListener(
    "load",
    function() {

        setTimeout(
            function() {

                window.print();

                setTimeout(
                    function() {

                        window.close();

                    },
                    300
                );

            },
            700
        );

    }
);

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
