"use strict";

/*
=====================================================
SAFETY BINGO HOST PRINTER ENGINE
=====================================================

IMPORTANT:
- Uses physical paper dimensions instead of viewport sizes.
- Designed for US Letter 8.5 x 11 inch paper.
- Desktop and mobile print output use the same layout.
- Mobile browser width does NOT control card dimensions.
- 1, 2, 3, and 4 cards per sheet are supported.
=====================================================
*/

console.log("HOST PRINTER MODULE LOADED");


// =====================================================
// INITIALIZATION
// =====================================================

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


    if (
        buildBtn &&
        buildBtn.dataset.printerReady !== "true"
    ) {

        buildBtn.dataset.printerReady =
            "true";


        buildBtn.addEventListener(
            "click",
            buildCardsForPrinting
        );

    } else if (!buildBtn) {

        console.warn(
            "Build Cards Button not found in DOM"
        );

    }


    console.log(
        "HOST PRINTER READY"
    );

}


// =====================================================
// BUILD CARDS
// =====================================================

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
            "Card generator script is not loaded."
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


    if (
        !Number.isInteger(
            startID
        ) ||
        startID < 1
    ) {

        alert(
            "Starting Card ID must be 1 or greater."
        );

        return;

    }


    if (
        !Number.isInteger(
            totalCards
        ) ||
        totalCards < 1
    ) {

        alert(
            "Total Cards must be 1 or greater."
        );

        return;

    }


    if (
        ![
            1,
            2,
            3,
            4
        ].includes(
            cardsPerPage
        )
    ) {

        alert(
            "Cards per page must be between 1 and 4."
        );

        return;

    }


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


// =====================================================
// BUILD PRINTABLE CARDS
// =====================================================

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
        (
            card,
            index
        ) => {


            /*
            ==========================================
            CREATE NEW PAPER SHEET
            ==========================================
            */

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


            /*
            ==========================================
            CREATE CARD
            ==========================================
            */

            const paper =
                document.createElement(
                    "div"
                );


            paper.className =
                "paper-card";


            /*
            IMPORTANT:

            We do NOT depend on the mobile viewport.

            The print stylesheet controls the actual
            physical card dimensions.
            */

            paper.innerHTML = `

                <div class="card-inner-border">


                    <!-- ==============================
                         HEADER
                    =============================== -->

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


                    <!-- ==============================
                         BINGO HEADER
                    =============================== -->

                    <div class="bingo-header-row">

                        <span>B</span>
                        <span>I</span>
                        <span>N</span>
                        <span>G</span>
                        <span>O</span>

                    </div>


                    <!-- ==============================
                         BINGO GRID
                    =============================== -->

                    <div class="paper-grid-matrix">

                        ${
                            card.grid
                                .map(
                                    (
                                        cell,
                                        idx
                                    ) => {

                                        const cleanText =
                                            cell.text ||
                                            "";


                                        const upperText =
                                            cleanText
                                                .toUpperCase();


                                        const isFreeSpace =
                                            upperText ===
                                                "FREE" ||
                                            upperText ===
                                                "FREE SPACE" ||
                                            idx === 12;


                                        const dynamicFontSize =
                                            fitTextToCell(
                                                cleanText,
                                                layoutConfig.cellHeight
                                            );


                                        return `

                                            <div
                                                class="
                                                    paper-cell
                                                    ${
                                                        isFreeSpace
                                                            ? "free-space-cell"
                                                            : ""
                                                    }
                                                "
                                                style="
                                                    --cell-font-size:
                                                        ${dynamicFontSize}px;
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

                                                            <span class="cell-text">
                                                                ${formatCardText(
                                                                    cleanText
                                                                )}
                                                            </span>

                                                        `
                                                }

                                            </div>

                                        `;

                                    }
                                )
                                .join("")
                        }

                    </div>


                    <!-- ==============================
                         FOOTER
                    =============================== -->

                    <div class="paper-footer-bar">


                        <div class="footer-left">

                            <span class="card-id-marker">

                                CARD ID #

                                <strong>
                                    ${String(
                                        card.id
                                    ).padStart(
                                        4,
                                        "0"
                                    )}
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


    /*
    ==========================================
    BUILD QR CODES
    ==========================================
    */

    buildQR(
        cards,
        layoutConfig.qrSize
    );


    /*
    ==========================================
    OPEN PRINT PREVIEW
    ==========================================
    */

    setTimeout(
        () => {

            output.scrollIntoView({
                behavior:
                    "smooth",

                block:
                    "start"
            });


            openPrintPreview(
                cardsPerPage
            );

        },
        500
    );

}


// =====================================================
// PAPER LAYOUT CONFIGURATION
// =====================================================

function getGridDimensions(
    cardsPerPage
) {

    switch (
        cardsPerPage
    ) {

        case 2:

            return {

                cellHeight:
                    82,

                qrSize:
                    44

            };


        case 3:
        case 4:

            return {

                cellHeight:
                    56,

                qrSize:
                    36

            };


        case 1:

        default:

            return {

                cellHeight:
                    128,

                qrSize:
                    54

            };

    }

}


// =====================================================
// FIT TEXT
// =====================================================

function fitTextToCell(
    text,
    cellHeight
) {

    const len =
        String(
            text ||
            ""
        ).length;


    if (
        cellHeight <=
        60
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
        cellHeight <=
        85
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


    /*
    ==========================================
    LARGE ONE-CARD-PER-SHEET
    ==========================================
    */

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


// =====================================================
// FORMAT CARD TEXT
// =====================================================

function formatCardText(
    text
) {

    if (
        !text
    ) {

        return "";

    }


    const words =
        String(
            text
        ).split(
            /\s+/
        );


    const lines =
        [];


    let line =
        "";


    words.forEach(
        word => {

            const testLine =
                line
                    ? `${line} ${word}`
                    : word;


            if (
                testLine.length >
                15
            ) {

                if (
                    line
                ) {

                    lines.push(
                        line
                    );

                }


                line =
                    word;

            } else {

                line =
                    testLine;

            }

        }
    );


    if (
        line
    ) {

        lines.push(
            line
        );

    }


    return lines.join(
        "<br>"
    );

}


// =====================================================
// BUILD QR CODES
// =====================================================

function buildQR(
    cards,
    qrSize = 42
) {

    if (
        typeof QRCode ===
        "undefined"
    ) {

        console.warn(
            "QRCode library missing."
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


// =====================================================
// OPEN PRINT PREVIEW
// =====================================================

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


    /*
    ==========================================
    OPEN PRINT WINDOW
    ==========================================
    */

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
    ==========================================
    PRINT DOCUMENT
    ==========================================

    IMPORTANT:

    Everything below uses physical paper units.

    8.5in x 11in

    NOT:

    100vw
    100vh
    device pixels
    mobile viewport dimensions

    This is what makes mobile and desktop
    produce the same printed layout.
    ==========================================
    */

    printWindow.document.write(`

<!DOCTYPE html>

<html lang="en">

<head>

<meta charset="UTF-8">

<meta
    name="viewport"
    content="width=device-width, initial-scale=1"
>

<title>
    Safety Standdown Bingo - Printable Cards
</title>


<style>

/* =====================================================
   GLOBAL RESET
===================================================== */

* {

    box-sizing:
        border-box;

    margin:
        0;

    padding:
        0;

}


/* =====================================================
   PAPER BODY
===================================================== */

html,
body {

    width:
        100%;

    min-height:
        100%;

    margin:
        0;

    padding:
        0;

}


body {

    background:
        #e2e8f0;

    font-family:
        "Segoe UI",
        -apple-system,
        BlinkMacSystemFont,
        Roboto,
        Arial,
        sans-serif;

    color:
        #0f172a;

    /*
    Prevent mobile browsers from changing
    text dimensions.
    */

    -webkit-text-size-adjust:
        100%;

    text-size-adjust:
        100%;

}


/* =====================================================
   PHYSICAL LETTER SHEET
===================================================== */

.sheet-page-break {

    /*
    EXACT US LETTER SIZE
    */

    width:
        8.5in;

    height:
        11in;


    /*
    Physical print margins inside the page.
    */

    padding:
        0.20in;


    margin:
        0 auto 0.20in auto;


    background:
        #ffffff;


    /*
    IMPORTANT:

    The layout is determined by the paper,
    NOT the phone/tablet/desktop viewport.
    */

    display:
        grid;


    box-sizing:
        border-box;


    page-break-after:
        always;

    break-after:
        page;


    overflow:
        hidden;

}


/* =====================================================
   ONE CARD PER SHEET
===================================================== */

.sheet-page-break.cards-1 {

    grid-template-columns:
        1fr;

    grid-template-rows:
        1fr;

    gap:
        0;

}


/* =====================================================
   TWO CARDS PER SHEET
===================================================== */

.sheet-page-break.cards-2 {

    grid-template-columns:
        1fr;

    grid-template-rows:
        1fr 1fr;

    gap:
        0.12in;

}


/* =====================================================
   THREE / FOUR CARDS PER SHEET
===================================================== */

.sheet-page-break.cards-3,
.sheet-page-break.cards-4 {

    grid-template-columns:
        1fr 1fr;

    grid-template-rows:
        1fr 1fr;

    gap:
        0.10in;

}


/* =====================================================
   CARD
===================================================== */

.paper-card {

    width:
        100%;

    height:
        100%;

    min-width:
        0;

    min-height:
        0;

    border:
        2px solid #0f172a;

    border-radius:
        6px;

    padding:
        0.04in;

    background:
        #ffffff;

    overflow:
        hidden;

    box-sizing:
        border-box;

}


/* =====================================================
   INNER CARD BORDER
===================================================== */

.card-inner-border {

    width:
        100%;

    height:
        100%;

    min-width:
        0;

    min-height:
        0;

    border:
        1px solid #94a3b8;

    border-radius:
        4px;

    padding:
        0.08in;

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

    overflow:
        hidden;

}


/* =====================================================
   HEADER
===================================================== */

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
            transparent
            40%
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
            transparent
            40%
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
        0.08in;

    border-radius:
        4px;

    margin-bottom:
        0.06in;

    border:
        1.5px solid #fbbf24;

    box-shadow:
        inset
        0
        0
        10px
        rgba(
            0,
            0,
            0,
            0.8
        ),
        0
        2px
        4px
        rgba(
            0,
            0,
            0,
            0.3
        );

    flex-shrink:
        0;

}


/* =====================================================
   HEADER BADGE
===================================================== */

.header-badge {

    font-size:
        ${
            cardsPerPage === 1
                ? "8.5pt"
                : "6.5pt"
        };

    font-weight:
        800;

    color:
        #fbbf24;

    letter-spacing:
        1px;

    text-transform:
        uppercase;

}


/* =====================================================
   TITLE
===================================================== */

.textured-title {

    font-size:
        ${
            cardsPerPage === 1
                ? "20pt"
                : "14pt"
        };

    line-height:
        1.1;

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


/* =====================================================
   HEADER SUBTITLE
===================================================== */

.header-sub {

    font-size:
        ${
            cardsPerPage === 1
                ? "8pt"
                : "6pt"
        };

    line-height:
        1.1;

    color:
        #e2e8f0;

    letter-spacing:
        0.5px;

    text-transform:
        uppercase;

    font-weight:
        600;

}


/* =====================================================
   BINGO HEADER
===================================================== */

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
        3px;

    flex-shrink:
        0;

}


.bingo-header-row span {

    background:
        #1e293b;

    color:
        #fbbf24;

    font-size:
        ${
            cardsPerPage === 1
                ? "18pt"
                : "11pt"
        };

    line-height:
        1;

    font-weight:
        900;

    text-align:
        center;

    padding:
        4px 0;

    border-radius:
        2px;

    letter-spacing:
        0.5px;

}


/* =====================================================
   BINGO MATRIX
===================================================== */

.paper-grid-matrix {

    /*
    This grid fills the available physical
    card area.
    */

    display:
        grid;

    grid-template-columns:
        repeat(
            5,
            minmax(
                0,
                1fr
            )
        );

    grid-template-rows:
        repeat(
            5,
            minmax(
                0,
                1fr
            )
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

    flex:
        1 1 auto;

    min-height:
        0;

    overflow:
        hidden;

}


/* =====================================================
   INDIVIDUAL CELL
===================================================== */

.paper-cell {

    min-width:
        0;

    min-height:
        0;

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
        1.12;

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

    overflow-wrap:
        anywhere;

}


/* =====================================================
   CELL TEXT
===================================================== */

.cell-text {

    display:
        block;

    width:
        100%;

    max-width:
        100%;

    font-size:
        var(--cell-font-size);

    line-height:
        1.12;

    text-align:
        center;

}


/* =====================================================
   FREE SPACE
===================================================== */

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
        ${
            cardsPerPage === 1
                ? "13pt"
                : "8pt"
        };

    font-weight:
        900;

    color:
        #92400e;

    line-height:
        1.1;

}


.free-sub {

    font-size:
        ${
            cardsPerPage === 1
                ? "8pt"
                : "5.5pt"
        };

    font-weight:
        800;

    color:
        #b45309;

}


/* =====================================================
   FOOTER
===================================================== */

.paper-footer-bar {

    margin-top:
        0.05in;

    display:
        flex;

    justify-content:
        space-between;

    align-items:
        center;

    padding-top:
        0.04in;

    border-top:
        1px solid #e2e8f0;

    flex-shrink:
        0;

}


/* =====================================================
   FOOTER LEFT
===================================================== */

.footer-left {

    display:
        flex;

    flex-direction:
        column;

    gap:
        2px;

    min-width:
        0;

}


/* =====================================================
   CARD ID
===================================================== */

.card-id-marker {

    font-size:
        ${
            cardsPerPage === 1
                ? "11pt"
                : "7pt"
        };

    line-height:
        1.1;

    color:
        #334155;

}


/* =====================================================
   VERIFIED TAG
===================================================== */

.verification-tag {

    font-size:
        ${
            cardsPerPage === 1
                ? "7pt"
                : "5pt"
        };

    line-height:
        1;

    font-weight:
        800;

    color:
        #166534;

    background:
        #dcfce7;

    padding:
        2px 5px;

    border-radius:
        2px;

    display:
        inline-block;

    width:
        fit-content;

}


/* =====================================================
   QR FRAME
===================================================== */

.qr-frame {

    border:
        1px solid #cbd5e1;

    padding:
        2px;

    background:
        #ffffff;

    border-radius:
        2px;

    flex-shrink:
        0;

}


.qr-box-container {

    display:
        block;

}


.qr-box-container img,
.qr-box-container canvas {

    display:
        block;

}


/* =====================================================
   SCREEN PREVIEW
===================================================== */

/*
The screen preview also uses the exact same
physical paper dimensions.

This means a phone does NOT redesign the card.
It simply scales the 8.5 x 11 sheet visually.
*/

@media screen {

    body {

        padding:
            0.20in 0;

        background:
            #e2e8f0;

    }


    .sheet-page-break {

        box-shadow:
            0
            10px
            25px
            rgba(
                0,
                0,
                0,
                0.15
            );

    }

}


/* =====================================================
   PRINT SETTINGS
===================================================== */

@media print {

    @page {

        size:
            Letter
            portrait;

        margin:
            0;

    }


    html,
    body {

        width:
            8.5in;

        min-width:
            8.5in;

        margin:
            0;

        padding:
            0;

        background:
            #ffffff;

    }


    body {

        /*
        Prevent browser from trying to
        resize text on mobile.
        */

        -webkit-text-size-adjust:
            none;

        text-size-adjust:
            none;

    }


    .sheet-page-break {

        width:
            8.5in;

        height:
            11in;

        min-width:
            8.5in;

        min-height:
            11in;

        max-width:
            8.5in;

        max-height:
            11in;

        margin:
            0;

        padding:
            0.20in;

        box-shadow:
            none;

        background:
            #ffffff;

        page-break-after:
            always;

        break-after:
            page;

        overflow:
            hidden;

    }


    .sheet-page-break:last-child {

        page-break-after:
            auto;

        break-after:
            auto;

    }


    /*
    Force exact colors when printing.
    */

    .card-header.textured-header,
    .paper-grid-matrix,
    .paper-cell,
    .free-space-cell,
    .bingo-header-row span,
    .verification-tag {

        -webkit-print-color-adjust:
            exact;

        print-color-adjust:
            exact;

    }


    /*
    Remove browser link decorations if
    any appear in the generated card.
    */

    a {

        color:
            inherit;

        text-decoration:
            none;

    }

}


/* =====================================================
   MOBILE SCREEN

   IMPORTANT:
   DO NOT CHANGE THE PRINT SIZE.

   The paper remains 8.5 x 11 inches.
===================================================== */

@media screen and (max-width: 600px) {

    body {

        /*
        Keep physical page size.
        Allow the browser to horizontally
        scroll instead of reflowing the paper.
        */

        overflow-x:
            auto;

    }


    .sheet-page-break {

        margin-left:
            auto;

        margin-right:
            auto;

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

        /*
        Give the browser time to finish
        rendering QR codes and fonts.
        */

        setTimeout(
            function() {

                window.print();

            },
            700
        );

    }
);


/*
=====================================================
CLOSE WINDOW AFTER PRINT
=====================================================

Some mobile browsers do not reliably fire
afterprint.

Therefore we use a delayed fallback.

The window will close after the print dialog
has had time to open.
*/

window.addEventListener(
    "afterprint",
    function() {

        setTimeout(
            function() {

                try {

                    window.close();

                } catch (error) {

                    console.log(
                        "PRINT WINDOW CLOSE:",
                        error
                    );

                }

            },
            300
        );

    }
);

</script>


</body>

</html>

    `);


    printWindow.document.close();

}


// =====================================================
// EXPORT
// =====================================================

window.initializeHostPrinter =
    initializeHostPrinter;
