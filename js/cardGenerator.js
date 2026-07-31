/**
 * Safety Bingo - SQLite Card Generator Engine
 * -------------------------------------------
 * Deterministic 5x5 bingo layouts.
 * Same Card ID = Same Bingo Card.
 */

(function () {


console.log(
    "CARD GENERATOR LOADED"
);



let safetyQuestions = [];

let questionsLoaded = false;





/*
====================================
LOAD QUESTIONS FROM SQLITE
====================================
*/


async function loadQuestions(){


    try{


        const response =
        await fetch(
            "/api/questions"
        );



        if(!response.ok){

            throw new Error(
                "Could not load questions"
            );

        }



        safetyQuestions =
        await response.json();



        questionsLoaded = true;



        console.log(
            "Loaded SQLite Questions:",
            safetyQuestions.length
        );


    }

    catch(error){


        console.error(
            "QUESTION LOAD FAILED:",
            error
        );


    }


}



loadQuestions();





/*
====================================
SEE IF QUESTIONS ARE READY
====================================
*/


window.cardsReady =
function(){

    return questionsLoaded;

};





/*
====================================
SEEDED RANDOM
====================================
*/


function createSeededRandom(seed){


    let currentSeed =
    parseInt(seed,10);



    if(
        isNaN(currentSeed)
        ||
        currentSeed < 1
    ){

        currentSeed = 1;

    }



    return function(){


        currentSeed =
        (
            currentSeed *
            1664525 +
            1013904223
        )
        %
        4294967296;



        return (
            currentSeed /
            4294967296
        );


    };


}





/*
====================================
HTML SAFETY
====================================
*/


function escapeHTML(value){


    return String(value)

    .replace(
        /&/g,
        "&amp;"
    )

    .replace(
        /</g,
        "&lt;"
    )

    .replace(
        />/g,
        "&gt;"
    )

    .replace(
        /"/g,
        "&quot;"
    )

    .replace(
        /'/g,
        "&#039;"
    );


}






/*
====================================
GENERATE ONE CARD
====================================
*/


window.generateCard =
function(cardId){



    if(!questionsLoaded){


        console.error(
            "Questions not loaded yet"
        );


        return null;


    }





    const numericID =
    parseInt(cardId,10);



    const safeID =
    (
        isNaN(numericID)
        ||
        numericID < 1
    )

    ?

    1

    :

    numericID;





    if(
        safetyQuestions.length < 24
    ){


        console.error(
            "Not enough questions"
        );


        return null;


    }





    const random =
    createSeededRandom(
        safeID
    );





    let shuffled =
    [
        ...safetyQuestions
    ];





    /*
    Deterministic Shuffle
    */


    for(
        let i =
        shuffled.length - 1;

        i > 0;

        i--
    ){


        const j =
        Math.floor(
            random() *
            (i+1)
        );



        [
            shuffled[i],
            shuffled[j]
        ]

        =
        [

            shuffled[j],
            shuffled[i]

        ];


    }





    const grid = [];

    let pointer = 0;





    for(
        let row=0;
        row<5;
        row++
    ){


        for(
            let col=0;
            col<5;
            col++
        ){



            if(
                row===2
                &&
                col===2
            ){


                grid.push({

                    text:
                    "FREE SPACE",

                    safeText:
                    "FREE SPACE",

                    marked:true,

                    isFreeSpace:true


                });


            }

            else {



                const item =
                shuffled[pointer];



                grid.push({


                    id:
                    item.id,



                    text:
                    item.answer,



                    safeText:
                    escapeHTML(
                        item.answer
                    ),



                    question:
                    item.question,



                    category:
                    item.category,



                    difficulty:
                    item.difficulty,



                    marked:false,



                    isFreeSpace:false



                });



                pointer++;


            }


        }


    }





    return {


        id:
        safeID,


        grid:grid


    };



};






/*
====================================
GENERATE MANY CARDS
====================================
*/


window.generateBingoCards =
function(
    startId,
    totalCount
){


    const firstID =
    parseInt(startId,10)
    ||
    1;



    const amount =
    parseInt(totalCount,10)
    ||
    1;




    const cards=[];



    for(
        let i=0;
        i<amount;
        i++
    ){


        cards.push(

            window.generateCard(
                firstID+i
            )

        );


    }



    return cards;


};




})();
