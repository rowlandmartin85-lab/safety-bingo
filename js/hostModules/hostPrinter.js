"use strict";

/*"use strict";

/*
=====================================================
SAFETY BINGO HOST PRINTER ENGINE
STABLE DESKTOP + MOBILE PRINT PREVIEW
=====================================================

DESKTOP:
- Uses exact 8.5 x 11 inch page
- Preserves original card layout
- Prints at full page size

MOBILE:
- JavaScript scales the COMPLETE page proportionally
- No horizontal clipping
- No bottom clipping
- Card proportions remain identical to desktop

PRINT:
- Screen scaling is disabled
- Exact 8.5 x 11 page is printed
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

    if (!buildBtn) {

        console.warn(
            "Build Cards Button not found in DOM"
        );

        return;
    }

    /*
    Prevent duplicate click handlers
    if this module is initialized more than once.
    */

    if (buildBtn.dataset.printerInitialized === "true") {

        return;

    }

    buildBtn.dataset.printerInitialized = "true";

    buildBtn.addEventListener(
        "click",
        buildCardsForPrinting
    );

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
            "PRINT OUTPUT AREA MISSING (#printOutputZone)"
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

            /*
            =========================================
            START NEW PAGE
            =========================================
            */

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


            /*
            =========================================
            CREATE CARD
            =========================================
            */

            const paper =
                document.createElement(
                    "div"
                );


            paper.className =
                "paper-card";


            paper.innerHTML = `

                <div class="card-inner-border">

                    <!-- HEADER -->

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


                    <!-- BINGO HEADER -->

                    <div class="bingo-header-row">

                        <span>B</span>
                        <span>I</span>
                        <span>N</span>
                        <span>G</span>
                        <span>O</span>

                    </div>


                    <!-- BINGO GRID -->

                    <div class="paper-grid-matrix">

                        ${
                            card.grid.map(
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
                            ).join("")
                        }

                    </div>


                    <!-- FOOTER -->

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


    /*
    =================================================
    BUILD QR CODES
    =================================================
    */

    buildQR(
        cards,
        layoutConfig.qrSize
    );


    /*
    =================================================
    WAIT FOR DOM + QR
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
        Number(cardsPerPage)
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
        cellHeight <= 60
    ) {

        if (length > 45) return 7.5;
        if (length > 30) return 8.5;
        if (length > 18) return 9.5;

        return 11;
    }


    if (
        cellHeight <= 85
    ) {

        if (length > 50) return 9;
        if (length > 30) return 10.5;

        return 12;
    }


    if (length > 50) return 12;
    if (length > 30) return 14;

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
    EXACT LETTER PAGE
    =================================================

    816px x 1056px is used as the fixed design
    coordinate system.

    This DOES NOT change between desktop and mobile.

    Mobile JavaScript only scales the complete page.
    =================================================
    */

    const PAGE_WIDTH = 816;
    const PAGE_HEIGHT = 1056;


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

/*
=====================================================
GLOBAL RESET
=====================================================
*/

* {

    box-sizing: border-box;

    margin: 0;

    padding: 0;

}


/*
=====================================================
DOCUMENT
=====================================================
*/

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
PREVIEW STAGE
=====================================================

JavaScript controls the width/height of this
container on mobile.

The actual page remains 816 x 1056.
=====================================================
*/

#print-stage {

    width: 100%;

    min-height: 100vh;

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
PRINT PAGE
=====================================================

IMPORTANT:

This remains the exact desktop page.

Do NOT use percentages here.
Do NOT use viewport units here.
=====================================================
*/

.sheet-page-break {

    position: relative;

    width: ${PAGE_WIDTH}px;

    height: ${PAGE_HEIGHT}px;

    flex:
        0
        0
        ${PAGE_HEIGHT}px;

    padding: 24px;

    margin:
        0
        auto
        24px
        auto;

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
ONE CARD
=====================================================
*/

.sheet-page-break.cards-1 {

    grid-template-columns:
        1fr;

    grid-template-rows:
        1fr;

}


/*
=====================================================
TWO CARDS
=====================================================
*/

.sheet-page-break.cards-2 {

    grid-template-columns:
        1fr;

    grid-template-rows:
        1fr
        1fr;

    gap: 0.15in;

}


/*
=====================================================
THREE / FOUR CARDS
=====================================================
*/

.sheet-page-break.cards-3,
.sheet-page-break.cards-4 {

    grid-template-columns:
        1fr
        1fr;

    grid-template-rows:
        1fr
        1fr;

    gap: 0.1in;

}


/*
=====================================================
CARD FRAME
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


/*
=====================================================
INNER CARD
=====================================================
*/

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

    text-transform: uppercase;

}


.textured-title {

    font-size:
        ${cardsPerPage === 1
            ? "20px"
            : "15px"};

    font-weight: 900;

    letter-spacing: 1px;

    text-transform: uppercase;

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

    text-transform: uppercase;

    font-weight: 600;

}


/*
=====================================================
BINGO LETTERS
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

    letter-spacing: .5px;

}


/*
=====================================================
BINGO GRID
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


/*
=====================================================
CELLS
=====================================================
*/

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

    font-weight: 800;

    color: #b45309;

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

    padding:
        2px
        6px;

    border-radius: 2px;

    display: inline-block;

    width: fit-content;

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
SCREEN PREVIEW ONLY
=====================================================

The JavaScript below controls scaling.

No mobile CSS changes the card itself.

This is critical because mobile must visually
match desktop.
=====================================================
*/

@media screen {

    #print-stage {

        overflow: visible;

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

        overflow: visible;

    }


    #print-stage {

        display: block;

        width: 100%;

        min-height: 0;

        padding: 0;

        margin: 0;

    }


    .sheet-page-break {

        width: 100%;

        height: 100vh;

        flex: none;

        margin: 0;

        padding: 24px;

        box-shadow: none;

        transform: none !important;

        page-break-after: always;

        break-after: page;

    }


    .card-header.textured-header,
    .paper-grid-matrix,
    .paper-cell,
    .verification-tag {

        -webkit-print-color-adjust:
            exact;

        print-color-adjust:
            exact;

    }

}

</style>

</head>


<body>


<!--
=====================================================
PREVIEW STAGE
=====================================================
-->

<div id="print-stage">

    ${cardsOutput.innerHTML}

</div>


<script>

/*
=====================================================
MOBILE / DESKTOP PREVIEW ENGINE
=====================================================

IMPORTANT:

The actual bingo page NEVER changes size.

Base size:
816 x 1056

Desktop:
Scale = 1

Mobile:
Scale = available width / 816

This keeps the exact same proportions.

The page's layout space is also corrected so the
bottom of the page cannot be clipped.
=====================================================
*/

(function () {

    const PAGE_WIDTH =
        ${PAGE_WIDTH};


    const PAGE_HEIGHT =
        ${PAGE_HEIGHT};


    const SIDE_MARGIN =
        12;


    const PAGE_GAP =
        24;


    /*
    =================================================
    GET SAFE AVAILABLE WIDTH
    =================================================
    */

    function getAvailableWidth() {

        const viewportWidth =
            window.innerWidth ||
            document.documentElement.clientWidth ||
            PAGE_WIDTH;


        return Math.max(
            viewportWidth - (
                SIDE_MARGIN * 2
            ),
            280
        );

    }


    /*
    =================================================
    CALCULATE SCALE
    =================================================
    */

    function getPageScale() {

        const availableWidth =
            getAvailableWidth();


        /*
        Desktop stays at 100%.

        Mobile scales down only as much as needed.
        */

        return Math.min(
            availableWidth /
                PAGE_WIDTH,

            1
        );

    }


    /*
    =================================================
    APPLY PREVIEW SCALE
    =================================================
    */

    function scalePreview() {

        /*
        Do nothing while printing.
        */

        if (
            window.matchMedia(
                "print"
            ).matches
        ) {

            return;

        }


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


        if (!pages.length) {

            return;

        }


        const scale =
            getPageScale();


        const scaledWidth =
            PAGE_WIDTH *
            scale;


        const scaledHeight =
            PAGE_HEIGHT *
            scale;


        /*
        =================================================
        STAGE WIDTH

        This prevents the mobile browser from trying
        to display an 816px-wide layout outside the
        viewport.
        =================================================
        */

        stage.style.width =
            scaledWidth + "px";


        stage.style.maxWidth =
            scaledWidth + "px";


        stage.style.marginLeft =
            "auto";


        stage.style.marginRight =
            "auto";


        stage.style.paddingTop =
            "20px";


        stage.style.paddingBottom =
            "40px";


        /*
        =================================================
        SCALE EACH PAGE
        =================================================
        */

        pages.forEach(
            page => {

                /*
                The page itself remains exactly
                816 x 1056.
                */

                page.style.width =
                    PAGE_WIDTH + "px";


                page.style.height =
                    PAGE_HEIGHT + "px";


                /*
                Scale from the TOP LEFT.

                This is more reliable on mobile
                than top-center because the page
                cannot shift outside the viewport.
                */

                page.style.transformOrigin =
                    "top left";


                page.style.transform =
                    "scale(" +
                    scale +
                    ")";


                /*
                =================================================
                CORRECT THE LAYOUT HEIGHT

                CSS normally still reserves the original
                1056px height even after transform.

                This negative margin removes the unused
                unscaled portion.

                This is the key fix for the bottom of the
                card/page being clipped or creating huge gaps.
                =================================================
                */

                page.style.marginBottom =
                    (
                        PAGE_GAP -
                        (
                            PAGE_HEIGHT -
                            scaledHeight
                        )
                    ) +
                    "px";


                /*
                =================================================
                HORIZONTAL POSITION

                Keep the scaled page perfectly centered.
                =================================================
                */

                page.style.marginLeft =
                    "0";


                page.style.marginRight =
                    "0";

            }
        );

    }


    /*
    =================================================
    INITIAL LOAD
    =================================================
    */

    function initializePreview() {

        /*
        Give the browser time to calculate:
        - fonts
        - QR codes
        - layout
        - viewport dimensions
        */

        requestAnimationFrame(
            function () {

                requestAnimationFrame(
                    function () {

                        scalePreview();

                    }
                );

            }
        );

    }


    /*
    =================================================
    RESIZE
    =================================================
    */

    window.addEventListener(
        "resize",
        function () {

            scalePreview();

        }
    );


    /*
    =================================================
    ORIENTATION CHANGE
    =================================================
    */

    window.addEventListener(
        "orientationchange",
        function () {

            setTimeout(
                scalePreview,
                250
            );

        }
    );


    /*
    =================================================
    VISUAL VIEWPORT CHANGE

    Important for mobile Safari / Chrome where
    the visual viewport can change independently.
    =================================================
    */

    if (
        window.visualViewport
    ) {

        window.visualViewport.addEventListener(
            "resize",
            function () {

                scalePreview();

            }
        );

    }


    /*
    =================================================
    PRINT START
    =================================================

    Remove screen scaling before the browser
    creates the physical print layout.
    =================================================
    */

    window.addEventListener(
        "beforeprint",
        function () {

            const stage =
                document.getElementById(
                    "print-stage"
                );


            if (stage) {

                stage.style.width =
                    "100%";

                stage.style.maxWidth =
                    "none";

                stage.style.padding =
                    "0";

            }


            document
                .querySelectorAll(
                    ".sheet-page-break"
                )
                .forEach(
                    page => {

                        page.style.transform =
                            "none";

                        page.style.margin =
                            "0";

                        page.style.width =
                            "100%";

                        page.style.height =
                            "100vh";

                    }
                );

        }
    );


    /*
    =================================================
    AFTER PRINT
    =================================================
    */

    window.addEventListener(
        "afterprint",
        function () {

            setTimeout(
                scalePreview,
                100
            );

        }
    );


    /*
    =================================================
    START PREVIEW
    =================================================
    */

    if (
        document.readyState ===
        "complete"
    ) {

        initializePreview();

    } else {

        window.addEventListener(
            "load",
            initializePreview
        );

    }


    /*
    =================================================
    AUTOMATIC PRINT

    Wait until the preview has been fully laid out.
    =================================================
    */

    setTimeout(
        function () {

            window.print();

        },
        900
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

SAFETY BINGO HOST PRINTER
*/
console.log("HOST PRINTER MODULE LOADED");

/*
INITIALIZE
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
-------------------------------------------------
DEFAULT TOTAL CARDS
-------------------------------------------------
*/

const totalCardsInput =
    document.getElementById("totalCards");

if (totalCardsInput) {

    totalCardsInput.value = "1";

}


/*
-------------------------------------------------
BUILD BUTTON
-------------------------------------------------
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
BUILD CARDS
*/
function buildCardsForPrinting() {

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
    Math.max(
        1,
        Number(
            document.getElementById(
                "startID"
            )?.value || 1
        )
    );


const totalCards =
    Math.max(
        1,
        Number(
            document.getElementById(
                "totalCards"
            )?.value || 1
        )
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
    !Array.isArray(cards) ||
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
BUILD PRINTABLE CARDS
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


const layout =
    getGridDimensions(
        cardsPerPage
    );


let sheet = null;


cards.forEach(
    (card, index) => {

        /*
        -------------------------------------------------
        NEW SHEET
        -------------------------------------------------
        */

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


        /*
        -------------------------------------------------
        CARD
        -------------------------------------------------
        */

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
                        (cell, index) => {

                            const text =
                                String(
                                    cell?.text || ""
                                );


                            const upper =
                                text.toUpperCase();


                            const isFree =
                                upper === "FREE" ||
                                upper === "FREE SPACE" ||
                                index === 12;


                            const fontSize =
                                fitTextToCell(
                                    text,
                                    layout.cellHeight
                                );


                            return `

                                <div
                                    class="paper-cell ${
                                        isFree
                                            ? "free-space-cell"
                                            : ""
                                    }"
                                    style="
                                        min-height:${layout.cellHeight}px;
                                        max-height:${layout.cellHeight}px;
                                    "
                                >

                                    ${
                                        isFree

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
                                                    ${formatCardText(text)}
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


/*
-------------------------------------------------
QR CODES
-------------------------------------------------
*/

buildQR(
    cards,
    layout.qrSize
);


/*
-------------------------------------------------
OPEN PREVIEW AFTER DOM UPDATE
-------------------------------------------------
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
    300
);

}
/*
CARD DIMENSIONS
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


    default:

        return {
            cellHeight: 116,
            qrSize: 46
        };

}

}
/*
FIT TEXT
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
FORMAT TEXT
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

        const candidate =
            line
                ? `${line} ${word}`
                : word;


        if (
            candidate.length > 15 &&
            line
        ) {

            lines.push(
                line
            );

            line =
                word;

        } else {

            line =
                candidate;

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
QR CODES
*/
function buildQR(
cards,
qrSize
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
                `qr_${card.id}`
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
OPEN PRINT PREVIEW
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
FIXED LETTER DESIGN
=================================================

816 x 1056 CSS pixels represents the
complete 8.5 x 11 inch design.
=================================================
*/

const PAGE_WIDTH = 816;

const PAGE_HEIGHT = 1056;


printWindow.document.write(`

<!DOCTYPE html> <html lang="en"> <head> <meta charset="UTF-8">
<meta
name="viewport"
content="
width=device-width,
initial-scale=1.0,
maximum-scale=1.0,
user-scalable=no
"
<title> Safety Standdown Bingo </title> <style> /* ================================================== RESET ================================================== */
{
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

color: #0f172a;

font-family:
    "Segoe UI",
    -apple-system,
    BlinkMacSystemFont,
    Roboto,
    sans-serif;

overflow-x: hidden;

}
/* ==================================================
PREVIEW STAGE
================================================== */

#print-stage {

width: 100%;

min-height: 100vh;

display: flex;

flex-direction: column;

align-items: center;

padding:
    20px
    0
    40px;

overflow: visible;

}
/* ==================================================
JAVASCRIPT PAGE WRAPPER
IMPORTANT:
This wrapper receives the ACTUAL scaled
dimensions of the page.

This is what prevents the mobile browser
from clipping the bottom.
================================================== */

.print-page-wrapper {

position: relative;

display: block;

flex-shrink: 0;

overflow: visible;

}
/* ==================================================
FIXED 8.5 x 11 PAGE
================================================== */

.sheet-page-break {

position: relative;

width: ${PAGE_WIDTH}px;

height: ${PAGE_HEIGHT}px;

padding: 24px;

margin: 0;

flex-shrink: 0;

background: #ffffff;

box-shadow:
    0
    10px
    25px
    rgba(0,0,0,.15);

display: grid;

page-break-after: always;

break-after: page;

}
/* ==================================================
PAGE LAYOUT
================================================== */

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
    1fr 1fr;

grid-template-rows:
    1fr 1fr;

gap: 8px;

}
/* ==================================================
CARD
================================================== */

.paper-card {

width: 100%;

height: 100%;

padding: 4px;

background: #ffffff;

border:
    2px solid
    #0f172a;

border-radius: 6px;

overflow: hidden;

}
.card-inner-border {

width: 100%;

height: 100%;

padding: 8px;

display: flex;

flex-direction: column;

justify-content: space-between;

border:
    1px solid
    #94a3b8;

border-radius: 4px;

background:
    linear-gradient(
        180deg,
        #f8fafc 0%,
        #ffffff 100%
    );

}
/* ==================================================
HEADER
================================================== */

.card-header.textured-header {

padding: 8px;

margin-bottom: 6px;

text-align: center;

color: #ffffff;

border:
    1.5px solid
    #fbbf24;

border-radius: 4px;

background:

    radial-gradient(
        circle at 20% 20%,
        rgba(251,191,36,.15),
        transparent 40%
    ),

    radial-gradient(
        circle at 80% 80%,
        rgba(251,191,36,.15),
        transparent 40%
    ),

    repeating-linear-gradient(
        45deg,
        #0f172a,
        #0f172a 10px,
        #1e293b 10px,
        #1e293b 20px
    );

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

color: #fbbf24;

font-size: 8.5px;

font-weight: 800;

letter-spacing: 1px;

}
.textured-title {

margin: 2px 0;

color: #fef08a;

font-size:
    ${cardsPerPage === 1
        ? "20px"
        : "15px"};

font-weight: 900;

letter-spacing: 1px;

text-shadow:
    1px 1px 0 #000,
    -1px -1px 0 #000,
    1px -1px 0 #000,
    -1px 1px 0 #000;

}
.header-sub {

color: #e2e8f0;

font-size: 8px;

font-weight: 600;

letter-spacing: .5px;

}
/* ==================================================
BINGO LETTERS
================================================== */

.bingo-header-row {

display: grid;

grid-template-columns:
    repeat(5, 1fr);

gap: 2px;

margin-bottom: 4px;

}
.bingo-header-row span {

padding: 3px 0;

color: #fbbf24;

background: #1e293b;

border-radius: 2px;

font-size:
    ${cardsPerPage === 1
        ? "18px"
        : "13px"};

font-weight: 900;

text-align: center;

}
/* ==================================================
BINGO GRID
================================================== */

.paper-grid-matrix {

display: grid;

grid-template-columns:
    repeat(5, 1fr);

gap: 2px;

min-height: 0;

flex: 1 1 auto;

padding: 2px;

background: #475569;

border:
    1.5px solid
    #0f172a;

border-radius: 3px;

}
.paper-cell {

display: flex;

align-items: center;

justify-content: center;

padding:
    2px
    3px;

color: #0f172a;

background: #ffffff;

border:
    1px solid
    #cbd5e1;

border-radius: 1px;

font-weight: 700;

line-height: 1.15;

text-align: center;

overflow: hidden;

word-break: break-word;

}
.paper-cell.free-space-cell {

background:
    linear-gradient(
        135deg,
        #fef3c7,
        #fde68a
    );

border:
    1.5px dashed
    #d97706;

}
.free-space-content {

color: #92400e;

font-size:
    ${cardsPerPage === 1
        ? "13px"
        : "10px"};

font-weight: 900;

line-height: 1.1;

}
.free-sub {

font-size:
    ${cardsPerPage === 1
        ? "8.5px"
        : "6.5px"};

}
/* ==================================================
FOOTER
================================================== */

.paper-footer-bar {

display: flex;

align-items: center;

justify-content: space-between;

flex-shrink: 0;

margin-top: 6px;

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

color: #334155;

font-size:
    ${cardsPerPage === 1
        ? "12px"
        : "9.5px"};

}
.verification-tag {

display: inline-block;

padding: 2px 6px;

color: #166534;

background: #dcfce7;

border-radius: 2px;

font-size:
    ${cardsPerPage === 1
        ? "8.5px"
        : "6.5px"};

font-weight: 800;

}
.qr-frame {

flex-shrink: 0;

padding: 2px;

background: #ffffff;

border:
    1px solid
    #cbd5e1;

border-radius: 2px;

}
.qr-box-container img,
.qr-box-container canvas {

display: block;

}
/* ==================================================
PRINT
================================================== */

@media print {

@page {

    size: letter portrait;

    margin: 0;

}

html,
body {

    width: 100%;

    min-height: 100%;

    background: #ffffff;

}

#print-stage {

    display: block;

    width: 100%;

    min-height: 0;

    padding: 0;

    margin: 0;

}

.print-page-wrapper {

    width: 100% !important;

    height: 100vh !important;

    margin: 0 !important;

    overflow: visible !important;

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
</style> </head> <body> <div id="print-stage">
${cardsOutput.innerHTML}

</div> <script>
/*
MOBILE-SAFE JAVASCRIPT PAGE SCALER
IMPORTANT:
The page itself remains:

816 x 1056

JavaScript creates a wrapper around it.

The wrapper is resized to:

816 x scale
1056 x scale

The page is transformed by exactly the same
scale.

Therefore the browser reserves the correct
amount of vertical space.

This prevents the bottom of the bingo card
from being clipped on mobile.
*/
(function () {

const PAGE_WIDTH =
    ${PAGE_WIDTH};

const PAGE_HEIGHT =
    ${PAGE_HEIGHT};

const PAGE_GAP =
    24;

/*
=================================================
GET VIEWPORT WIDTH
=================================================
*/

function getViewportWidth() {

    return Math.max(
        document.documentElement.clientWidth ||
        window.innerWidth ||
        PAGE_WIDTH,
        1
    );

}

/*
=================================================
CALCULATE SCALE
=================================================
*/

function getScale() {

    const viewportWidth =
        getViewportWidth();

    /*
    Keep 12px total breathing room.
    */

    const availableWidth =
        Math.max(
            viewportWidth - 12,
            1
        );

    let scale =
        availableWidth /
        PAGE_WIDTH;

    /*
    Never enlarge the page.
    */

    scale =
        Math.min(
            scale,
            1
        );

    /*
    Prevent an invalid scale.
    */

    scale =
        Math.max(
            scale,
            0.25
        );

    return scale;

}

/*
=================================================
CREATE PAGE WRAPPERS
=================================================
*/

function createPageWrappers() {

    const stage =
        document.getElementById(
            "print-stage"
        );

    if (!stage) {

        return [];

    }

    const pages =
        Array.from(
            stage.querySelectorAll(
                ":scope > .sheet-page-break"
            )
        );

    pages.forEach(
        page => {

            const wrapper =
                document.createElement(
                    "div"
                );

            wrapper.className =
                "print-page-wrapper";

            wrapper.style.width =
                PAGE_WIDTH + "px";

            wrapper.style.height =
                PAGE_HEIGHT + "px";

            wrapper.style.flexShrink =
                "0";

            wrapper.style.position =
                "relative";

            wrapper.style.overflow =
                "visible";

            stage.replaceChild(
                wrapper,
                page
            );

            wrapper.appendChild(
                page
            );

        }
    );

    return Array.from(
        stage.querySelectorAll(
            ".print-page-wrapper"
        )
    );

}

/*
=================================================
GET EXISTING WRAPPERS
=================================================
*/

function getPageWrappers() {

    const stage =
        document.getElementById(
            "print-stage"
        );

    if (!stage) {

        return [];

    }

    return Array.from(
        stage.querySelectorAll(
            ".print-page-wrapper"
        )
    );

}

/*
=================================================
SCALE ALL PAGES
=================================================
*/

function updatePreview() {

    const stage =
        document.getElementById(
            "print-stage"
        );

    if (!stage) {

        return;

    }

    let wrappers =
        getPageWrappers();

    /*
    Create wrappers if necessary.
    */

    if (!wrappers.length) {

        wrappers =
            createPageWrappers();

    }

    const scale =
        getScale();

    const scaledWidth =
        Math.round(
            PAGE_WIDTH * scale
        );

    const scaledHeight =
        Math.round(
            PAGE_HEIGHT * scale
        );

    /*
    -------------------------------------------------
    STAGE
    -------------------------------------------------
    */

    stage.style.width =
        "100%";

    stage.style.minHeight =
        "0";

    stage.style.display =
        "flex";

    stage.style.flexDirection =
        "column";

    stage.style.alignItems =
        "center";

    stage.style.paddingTop =
        "16px";

    stage.style.paddingBottom =
        "32px";

    stage.style.overflow =
        "visible";

    /*
    -------------------------------------------------
    EACH PAGE
    -------------------------------------------------
    */

    wrappers.forEach(
        wrapper => {

            const page =
                wrapper.querySelector(
                    ".sheet-page-break"
                );

            if (!page) {
                return;
            }

            /*
            =========================================
            WRAPPER = TRUE DISPLAYED PAGE SIZE
            =========================================
            */

            wrapper.style.width =
                scaledWidth + "px";

            wrapper.style.height =
                scaledHeight + "px";

            wrapper.style.margin =
                "0 0 " +
                PAGE_GAP +
                "px 0";

            wrapper.style.padding =
                "0";

            wrapper.style.overflow =
                "visible";

            /*
            =========================================
            PAGE = ORIGINAL DESIGN SIZE
            =========================================
            */

            page.style.width =
                PAGE_WIDTH + "px";

            page.style.height =
                PAGE_HEIGHT + "px";

            page.style.margin =
                "0";

            page.style.transformOrigin =
                "top left";

            page.style.transform =
                "scale(" +
                scale +
                ")";

            page.style.overflow =
                "hidden";

        }
    );

}

/*
=================================================
WAIT FOR PAGE TO FULLY RENDER
=================================================
*/

function initialize() {

    requestAnimationFrame(
        () => {

            requestAnimationFrame(
                () => {

                    updatePreview();

                }
            );

        }
    );

}

/*
=================================================
LOAD
=================================================
*/

if (
    document.readyState ===
    "complete"
) {

    initialize();

} else {

    window.addEventListener(
        "load",
        initialize,
        {
            once: true
        }
    );

}

/*
=================================================
RESIZE
=================================================
*/

let resizeTimer = null;

window.addEventListener(
    "resize",
    () => {

        clearTimeout(
            resizeTimer
        );

        resizeTimer =
            setTimeout(
                updatePreview,
                100
            );

    }
);

/*
=================================================
ROTATION
=================================================
*/

window.addEventListener(
    "orientationchange",
    () => {

        setTimeout(
            updatePreview,
            250
        );

    }
);

/*
=================================================
BEFORE PRINT
=================================================

Remove JavaScript preview scaling.

The printer receives the original Letter
page instead of the mobile-scaled version.
=================================================
*/

window.addEventListener(
    "beforeprint",
    () => {

        const stage =
            document.getElementById(
                "print-stage"
            );

        const wrappers =
            document.querySelectorAll(
                ".print-page-wrapper"
            );

        const pages =
            document.querySelectorAll(
                ".sheet-page-break"
            );

        if (stage) {

            stage.style.display =
                "block";

            stage.style.width =
                "100%";

            stage.style.padding =
                "0";

            stage.style.margin =
                "0";

        }

        wrappers.forEach(
            wrapper => {

                wrapper.style.width =
                    "100%";

                wrapper.style.height =
                    "100vh";

                wrapper.style.margin =
                    "0";

                wrapper.style.overflow =
                    "visible";

            }
        );

        pages.forEach(
            page => {

                page.style.width =
                    "100%";

                page.style.height =
                    "100vh";

                page.style.margin =
                    "0";

                page.style.transform =
                    "none";

            }
        );

    }
);

/*
=================================================
AFTER PRINT
=================================================
*/

window.addEventListener(
    "afterprint",
    () => {

        updatePreview();

    }
);

/*
=================================================
AUTO PRINT
=================================================
*/

setTimeout(
    () => {

        window.print();

    },
    700
);

})();
</script>

</body> 
</html>
`);

printWindow.document.close();

}
/*
EXPORT
*/
window.initializeHostPrinter =
initializeHostPrinter;
