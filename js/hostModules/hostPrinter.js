/*
==========================================
SAFETY BINGO HOST PRINTER ENGINE
==========================================
*/


console.log(
    "HOST PRINTER MODULE LOADED"
);





/*
==========================================
INITIALIZE PRINTER
==========================================
*/


function initializeHostPrinter(){


    console.log(
        "INITIALIZING HOST PRINTER"
    );



    if(hostUI.buildCardsBtn){


        hostUI.buildCardsBtn.addEventListener(

            "click",

            buildCardsForPrinting

        );


    }



    console.log(
        "HOST PRINTER READY"
    );


}








/*
==========================================
BUILD CARD REQUEST
==========================================
*/


function buildCardsForPrinting(){



    console.log(
        "BUILDING PRINT CARDS"
    );





    if(
        typeof window.generateBingoCards !== "function"
    ){


        console.error(
            "generateBingoCards() missing"
        );


        alert(
            "Card generator is not loaded."
        );


        return;


    }







    const startID =

    Number(

        document.getElementById(
            "startID"
        )?.value

        ||

        1

    );






    const totalCards =

    Number(

        document.getElementById(
            "totalCards"
        )?.value

        ||

        1

    );







    const cardsPerPage =

    Number(

        document.getElementById(
            "cardsPerPage"
        )?.value

        ||

        4

    );








    const cards =

    window.generateBingoCards(

        startID,

        totalCards

    );






    if(!cards || !cards.length){


        alert(
            "No cards generated."
        );


        return;


    }






    buildPrintableCards(

        cards,

        cardsPerPage

    );

setTimeout(()=>{

    openPrintPreview();


},500);


}

/*
==========================================
BUILD PRINT PREVIEW
==========================================
*/


function buildPrintableCards(
    cards,
    cardsPerPage
){



    const output =

    hostUI.printOutputZone;



    if(!output){


        console.error(
            "PRINT OUTPUT AREA MISSING"
        );


        return;


    }






    output.innerHTML =
    "";





    let sheet = null;







    cards.forEach(
        (card,index)=>{





            if(
                index % cardsPerPage === 0
            ){



                sheet =
                document.createElement(
                    "div"
                );


sheet.className =
"sheet-page-break cards-" +
cardsPerPage;




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


<h3>
SAFETY STANDDOWN BINGO
</h3>



<div class="paper-grid-matrix">


${
    card.grid.map(

        cell =>

        `

<div class="paper-cell ${cell.text.length > 25 ? "small-text" : ""}">
    ${formatCardText(cell.text)}

</div>
        `

    ).join("")
}


</div>





<div class="paper-footer-bar">


<span class="card-id-marker">

Card ID: #${card.id}

</span>




<div

class="qr-box-container"

id="qr_${card.id}">

</div>



</div>



`;







            sheet.appendChild(
                paper
            );



        }
    );



    buildQR(
        cards
    );



setTimeout(
    ()=>{


        output.scrollIntoView({

            behavior:"smooth",

            block:"start"

        });


        console.log(
            "PRINT PREVIEW READY"
        );


    },

    700

);


}




/*
==========================================
QR BUILDER
==========================================
*/


function buildQR(cards){



    if(
        typeof QRCode === "undefined"
    ){


        console.warn(
            "QR CODE LIBRARY NOT FOUND"
        );


        return;


    }






    cards.forEach(
        card=>{



            const box =

            document.getElementById(

                "qr_" + card.id

            );



            if(!box){

                return;

            }





            box.innerHTML =
            "";





            new QRCode(

                box,

                {


                    text:

                    String(card.id),



                    width:90,



                    height:90



                }

            );



        }

    );



}

function formatCardText(text){


    if(!text)
        return "";


    const words =
    text.split(" ");


    let lines = [];

    let line = "";


    words.forEach(word=>{


       if(
    (line + " " + word).length > 18
){

            lines.push(line);

            line = word;

        }
        else{

            line += 
            (line ? " " : "") +
            word;

        }


    });



    if(line){

        lines.push(line);

    }



    return lines.join("<br>");

}

/*
==========================================
OPEN PRINT PREVIEW WINDOW
==========================================
*/

function openPrintPreview(){

    const cards =
    document.getElementById(
        "printOutputZone"
    );

    if(!cards){

        alert("Print area not found.");

        return;

    }

    const printWindow =
    window.open(
        "",
        "_blank"
    );

    if(!printWindow){

        alert(
            "Pop-up blocked. Please allow pop-ups."
        );

        return;

    }

    printWindow.document.write(`

<!DOCTYPE html>

<html>

<head>

<title>Safety Standdown Bingo Cards</title>

<style>

body{

    margin:20px;

    background:white;

    font-family:Arial,sans-serif;

}

.sheet-page-break{

    page-break-after:always;

    margin-bottom:30px;

}

.sheet-page-break.cards-1{

    display:block;

}

.sheet-page-break.cards-2{

    display:grid;

    grid-template-columns:repeat(1,1fr);

    gap:15px;

}

.sheet-page-break.cards-3{

    display:grid;

    grid-template-columns:repeat(2,1fr);

    gap:12px;

}

.sheet-page-break.cards-4{

    display:grid;

    grid-template-columns:repeat(2,1fr);

    grid-template-rows:repeat(2,1fr);

    gap:12px;

    page-break-after:always;

    break-after:page;

}


.paper-card{

    width:100%;

    margin:0;

    padding:8px;

    border:2px solid black;

    box-sizing:border-box;

    background:white;

}

.paper-card h3{

    text-align:center;

    margin-bottom:10px;

}

.paper-grid-matrix{

    display:grid;

    grid-template-columns:repeat(5,1fr);

    gap:3px;

}

.paper-cell{

    border:1px solid #000;

    min-height:68px;

    padding:6px;

    display:flex;

    align-items:center;

    justify-content:center;

    text-align:center;

    font-family:Arial, Helvetica, sans-serif;

    font-weight:700;

    font-size:12px;

    line-height:1.2;

    white-space:normal;

    word-break:normal;

    overflow-wrap:break-word;

    hyphens:none;

    box-sizing:border-box;

}

.paper-footer-bar{

    margin-top:10px;

    display:flex;

    justify-content:space-between;

    align-items:center;

}

@media print{

    body{

        margin:0;

    }

    .sheet-page-break{

        page-break-after:always;

    }

}

</style>

</head>

<body>

${cards.innerHTML}

<script>

window.onload=function(){

    setTimeout(function(){

        window.print();

        window.close();

    },500);

};

<\/script>

</body>

</html>

`);

    printWindow.document.close();

}

window.initializeHostPrinter =
initializeHostPrinter;