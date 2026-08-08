// =====================================================
// SAFETY BINGO SERVER
// CLEAN REBUILD
// PART 1 / 3
// =====================================================
require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const fs = require("fs");
const {
    pool,
    initializeDatabase
} = require("./database");

initializeDatabase();

if (process.env.MIGRATE_QUESTIONS === "true") {

    require("./migrateQuestions");

}

const questionFile =
path.join(
    __dirname,
    "questions.json"
);

// =====================================================
// SERVER SETUP
// =====================================================

const app = express();

app.use(
    express.json()
);

const server = http.createServer(app);


const io = new Server(server,{
    cors:{
        origin:"*",
        methods:["GET","POST"]
    }
});


// =====================================================
// STATIC FILES
// =====================================================

app.use(
    express.static(__dirname)
);


app.use(
    express.static(
        path.join(__dirname,"public")
    )
);


// =====================================================
// QUESTION DATABASE
// =====================================================

let safetyQuestionBank = [];



async function loadQuestionsFromDatabase(){


    try{


        const result =
        await pool.query(
            `
            SELECT *
            FROM questions
            ORDER BY id ASC
            `
        );



        safetyQuestionBank =
        result.rows.map(item=>({

            id:item.id,

            category:item.category,

            difficulty:item.difficulty,

            q:item.question,

            a:item.answer

        }));



        console.log(
            `Loaded ${safetyQuestionBank.length} questions from database`
        );


    }

    catch(error){


        console.error(
            "DATABASE QUESTION LOAD ERROR:",
            error
        );


        process.exit(1);


    }


}

// =====================================================
// PAGE ROUTES
// =====================================================


app.get("/",(req,res)=>{

    res.sendFile(
        path.join(
            __dirname,
            "index.html"
        )
    );

});



app.get("/host.html",(req,res)=>{

    res.sendFile(
        path.join(
            __dirname,
            "host.html"
        )
    );

});



app.get("/player.html",(req,res)=>{

    res.sendFile(
        path.join(
            __dirname,
            "player.html"
        )
    );

});



app.get("/display.html",(req,res)=>{

    res.sendFile(
        path.join(
            __dirname,
            "display.html"
        )
    );

});

app.get("/questionManager.html",(req,res)=>{

    res.sendFile(
        path.join(
            __dirname,
            "questionManager.html"
        )
    );

});

app.get("/cheatsheet.html",(req,res)=>{

    res.sendFile(
        path.join(
            __dirname,
            "cheatsheet.html"
        )
    );

});



// =====================================================
// GAME STATE
// =====================================================


let gameState = {


    status:"idle",


    currentQuestionIndex:-1,


    currentQuestion:"",

    currentAnswer:"",


    currentQuestionID:null,


    currentCategory:"",

    currentDifficulty:"",



    calledAnswers:[],


    askedIndices:[],


    gameOrder:[],


    timerSeconds:30,


    noTimer:false,


    isPaused:false,



    maxWinners:1,


    approvedWinnersCount:0,


    approvedWinnersList:[]


};



// =====================================================
// GAME VARIABLES
// =====================================================


let timer = null;


let countdown = 30;


let gamePosition = -1;

// =====================================================
// PENDING DIGITAL WIN CLAIMS
// =====================================================
//
// Key   = card ID
// Value = most recent Bingo claim for that card
//

const pendingClaims =
    new Map();

// =====================================================
// QUESTION ENGINE
// =====================================================


function buildGameOrder(){

    gameState.gameOrder=[];


    for(
        let i=0;
        i<safetyQuestionBank.length;
        i++
    ){

        gameState.gameOrder.push(i);

    }



    // Fisher-Yates Shuffle

    for(
        let i=gameState.gameOrder.length-1;
        i>0;
        i--
    ){

        const j =
        Math.floor(
            Math.random()*(i+1)
        );


        [
            gameState.gameOrder[i],
            gameState.gameOrder[j]
        ] =
        [
            gameState.gameOrder[j],
            gameState.gameOrder[i]
        ];

    }

}




function sendNextQuestion(){


    clearInterval(timer);

    timer=null;



    gamePosition++;



    if(
        gamePosition >=
        gameState.gameOrder.length
    ){

        gameState.status="ended";


        gameState.currentQuestion="";

        gameState.currentAnswer="";


        io.emit(
            "gameState",
            gameState
        );


        return;

    }



    const index =
    gameState.gameOrder[gamePosition];



    const question =
    safetyQuestionBank[index];

    console.log(
    "SENDING QUESTION:",
    question
);



    gameState.currentQuestionIndex =
    index;



    gameState.askedIndices.push(
        index
    );



    gameState.currentQuestionID =
    question.id;


    gameState.currentQuestion =
    question.q;


    gameState.currentAnswer =
    question.a;



    gameState.currentCategory =
    question.category;


    gameState.currentDifficulty =
    question.difficulty;



    if(
        !gameState.calledAnswers.includes(
            question.a
        )
    ){

        gameState.calledAnswers.push(
            question.a
        );

    }




    gameState.isPaused=false;


const questionNumber =
safetyQuestionBank.findIndex(
    q=>q.id===question.id
)+1;


io.emit(
    "cheatSheetQuestion",
    {

        number:
        questionNumber,


        id:
        question.id,


        category:
        question.category,


        difficulty:
        question.difficulty,


        question:
        question.q,


        answer:
        question.a

    }
);
    
    io.emit(
        "gameState",
        gameState
    );



    if(
        !gameState.noTimer
    ){

        countdown =
        gameState.timerSeconds;



        io.emit(
            "timerUpdate",
            countdown
        );


        startTimer();

    }


}




// =====================================================
// TIMER
// =====================================================


function startTimer(){


    clearInterval(timer);



    timer =
    setInterval(()=>{


        if(
            gameState.isPaused
        )
            return;



        countdown--;



        io.emit(
            "timerUpdate",
            countdown
        );



        if(
            countdown<=0
        ){

            sendNextQuestion();

        }



    },1000);


}

// =====================================================
// QUESTION MANAGER API (POSTGRESQL)
// =====================================================


app.get("/api/questions", async (req,res)=>{

    try{

        const result =
        await pool.query(
            `
            SELECT *
            FROM questions
            ORDER BY id ASC
            `
        );


        res.json(
            result.rows
        );


    }
    catch(error){

        console.error(
            "LOAD QUESTIONS ERROR:",
            error
        );


        res.status(500).json({

            success:false,

            error:error.message

        });

    }

});





// =====================================================
// ADD QUESTION
// =====================================================


app.post("/api/questions/add", async (req,res)=>{


    const newQuestion =
    req.body;



    if(
        !newQuestion.q ||
        !newQuestion.a
    ){

        return res.status(400).json({

            success:false,

            error:
            "Question and answer required"

        });

    }


    try{


        const idResult =
        await pool.query(

            `
            SELECT MAX(id) AS maxid
            FROM questions
            `

        );


        const nextID =
        Number(
            idResult.rows[0].maxid || 0
        ) + 1;



        await pool.query(

            `
            INSERT INTO questions

            (
                id,
                category,
                difficulty,
                question,
                answer
            )

            VALUES
            ($1,$2,$3,$4,$5)

            `,

            [

                nextID,

                newQuestion.category ||
                "General",

                newQuestion.difficulty ||
                "Medium",

                newQuestion.q,

                newQuestion.a

            ]

        );



        console.log(
            "QUESTION ADDED:",
            nextID
        );



        res.json({

            success:true,

            id:nextID

        });


    }
    catch(error){


        console.error(
            "ADD QUESTION ERROR:",
            error
        );


        res.status(500).json({

            success:false,

            error:error.message

        });


    }


});





// =====================================================
// DELETE QUESTION
// =====================================================


app.delete("/api/questions/:id", async (req,res)=>{


    const id =
    Number(req.params.id);



    try{


        const result =
        await pool.query(

            `
            DELETE FROM questions
            WHERE id=$1
            `,

            [
                id
            ]

        );



        if(result.rowCount===0){

            return res.status(404).json({

                success:false,

                error:
                "Question not found"

            });

        }



        console.log(
            "QUESTION REMOVED:",
            id
        );



        res.json({

            success:true

        });


    }
    catch(error){


        console.error(
            "DELETE ERROR:",
            error
        );


        res.status(500).json({

            success:false,

            error:error.message

        });


    }


});


// =====================================================
// SOCKET CONNECTION
// =====================================================


io.on(
"connection",
socket=>{


console.log(
"CONNECTED:",
socket.id
);



socket.emit(
"gameState",
gameState
);

// Send previous questions to newly connected keys

gameState.askedIndices.forEach(
(index, i)=>{


    const question =
    safetyQuestionBank[index];


    if(question){


        socket.emit(
            "cheatSheetQuestion",
            {

                number:
                safetyQuestionBank.findIndex(
                q=>q.id===question.id
                )+1,

                id:question.id,

                category:question.category,

                difficulty:question.difficulty,

                question:question.q,

                answer:question.a

            }
        );


    }


});




// =====================================================
// TIMER SETTINGS
// =====================================================

socket.on(
"setTimerSettings",
data=>{


    gameState.timerSeconds =
    Number(data.seconds);



    gameState.noTimer =
    data.noTimer === true;



    console.log(
        "TIMER SETTINGS:",
        {
            seconds: gameState.timerSeconds,
            noTimer: gameState.noTimer
        }
    );


});




// =====================================================
// WINNER SETTINGS
// =====================================================


socket.on(
"setWinnerSettings",
data=>{


    gameState.maxWinners =
    Number(data.maxWinners) || 1;


});





// =====================================================
// START GAME
// =====================================================

socket.on("hostStart", async () => {

    if (gameState.status === "running") return;

    await loadQuestionsFromDatabase();   // <-- reload from PostgreSQL

    gameState.status = "running";
    gameState.askedIndices = [];
    gameState.calledAnswers = [];
    gameState.approvedWinnersCount = 0;
    gameState.approvedWinnersList = [];

    buildGameOrder();
    gamePosition = -1;
    sendNextQuestion();
});

// =====================================================
// NEXT QUESTION
// =====================================================


socket.on(
"hostNext",
()=>{


    if(
        gameState.status!=="running"
    )
        return;


    sendNextQuestion();


});






// =====================================================
// PREVIOUS QUESTION
// =====================================================


socket.on(
"hostPrevious",
()=>{


    if(
        gameState.status!=="running"
    )
        return;



    if(
        gamePosition<=0
    )
        return;



    gamePosition--;



    const index =
    gameState.gameOrder[gamePosition];



    const question =
    safetyQuestionBank[index];



    gameState.currentQuestionIndex =
    index;


    gameState.currentQuestionID =
    question.id;


    gameState.currentQuestion =
    question.q;


    gameState.currentAnswer =
    question.a;


    gameState.currentCategory =
    question.category;


    gameState.currentDifficulty =
    question.difficulty;



    io.emit(
        "gameState",
        gameState
    );


});






// =====================================================
// REPEAT QUESTION
// =====================================================


socket.on(
"hostRepeat",
()=>{


    io.emit(
        "gameState",
        {
            ...gameState,
            repeatQuestion:true
        }
    );


});







// =====================================================
// PAUSE / RESUME
// =====================================================


socket.on("togglePausePlay",()=>{

    gameState.isPaused=!gameState.isPaused;

    console.log("PAUSE:",gameState.isPaused);

    if(gameState.isPaused){
        clearInterval(timer);
    }else{
        startTimer();
    }

    io.emit("gameState",gameState);

});

// =====================================================
// RESET GAME
// =====================================================

socket.on(
    "hostReset",
    () => {

        console.log(
            "========== RESETTING GAME =========="
        );

        // -------------------------------------------------
        // STOP TIMER
        // -------------------------------------------------

        clearInterval(timer);

        timer = null;

        countdown = 30;


        // -------------------------------------------------
        // CLEAR PENDING DIGITAL WIN CLAIMS
        // -------------------------------------------------
        // This allows all players to start fresh
        // after the host resets the game.

        if (
            typeof pendingClaims !== "undefined" &&
            pendingClaims &&
            typeof pendingClaims.clear === "function"
        ) {

            pendingClaims.clear();

            console.log(
                "PENDING DIGITAL CLAIMS CLEARED"
            );

        }


        // -------------------------------------------------
        // RESET GAME STATE
        // -------------------------------------------------

        gameState = {

            status:
                "idle",

            currentQuestionIndex:
                -1,

            currentQuestion:
                "",

            currentAnswer:
                "",

            currentQuestionID:
                null,

            currentQuestionNumber:
                null,

            currentCategory:
                "",

            currentDifficulty:
                "",


            // ---------------------------------------------
            // QUESTION HISTORY
            // ---------------------------------------------

            calledAnswers:
                [],

            askedIndices:
                [],

            gameOrder:
                [],


            // ---------------------------------------------
            // TIMER
            // ---------------------------------------------

            timerSeconds:
                0,

            noTimer:
                true,

            isPaused:
                false,


            // ---------------------------------------------
            // WINNER SETTINGS
            // ---------------------------------------------

            maxWinners:
                1,

            approvedWinnersCount:
                0,

            approvedWinnersList:
                []

        };


        // -------------------------------------------------
        // RESET QUESTION POSITION
        // -------------------------------------------------

        gamePosition =
            -1;


        // -------------------------------------------------
        // RESET TIMER VARIABLES
        // -------------------------------------------------

        countdown =
            30;


        // -------------------------------------------------
        // TELL ALL CLIENTS GAME WAS RESET
        // -------------------------------------------------

        io.emit(
            "gameReset"
        );


        // -------------------------------------------------
        // SEND FRESH RESET GAME STATE
        // -------------------------------------------------

        io.emit(
            "gameState",
            gameState
        );


        console.log(
            "========== GAME RESET COMPLETE =========="
        );

    }
);

// =====================================================
// PENDING DIGITAL WIN CLAIMS
// =====================================================

const pendingClaims =
    new Map();

// =====================================================
// GAME VARIABLES
// =====================================================

let timer = null;

let countdown = 30;

let gamePosition = -1;


// =====================================================
// PENDING DIGITAL WIN CLAIMS
// =====================================================

const pendingClaims =
    new Map();

// =====================================================
// WIN SYSTEMS
// PART 3 / 3
// =====================================================

// =====================================================
// WIN SYSTEMS
// DIGITAL BINGO WIN MANAGEMENT
// =====================================================


// =====================================================
// DIGITAL BINGO WIN REQUEST
// =====================================================

socket.on(
    "claimWin",
    data => {

        console.log(
            "========== BINGO CLAIM RECEIVED ==========",
            data
        );


        // -------------------------------------------------
        // VALIDATE CLAIM
        // -------------------------------------------------

        if (!data) {

            console.warn(
                "BINGO CLAIM REJECTED: NO DATA"
            );

            return;

        }


        const cardId =
            Number(data.cardId);


        if (!cardId) {

            console.warn(
                "BINGO CLAIM REJECTED: INVALID CARD ID",
                data
            );

            return;

        }


        // -------------------------------------------------
        // DO NOT ACCEPT NEW CLAIMS AFTER WIN LIMIT
        // -------------------------------------------------

        if (
            gameState.approvedWinnersCount >=
            gameState.maxWinners
        ) {

            console.log(
                "BINGO CLAIM IGNORED: WINNER LIMIT REACHED",
                cardId
            );

            return;

        }


        // -------------------------------------------------
        // STORE THE CLAIM
        // -------------------------------------------------
        //
        // If this card already has a pending claim,
        // the newest claim replaces the old one.
        //
        // This allows the same player/card to submit
        // another claim after being rejected.
        //

        const claim = {

            cardId:
                cardId,

            markedIndices:
                Array.isArray(
                    data.markedIndices
                )
                    ? [
                        ...data.markedIndices
                    ]
                    : [],

            winningPattern:
                Array.isArray(
                    data.winningPattern
                )
                    ? [
                        ...data.winningPattern
                    ]
                    : [],

            timestamp:
                data.timestamp ||
                Date.now(),

            playerSocketId:
                socket.id

        };


        pendingClaims.set(
            cardId,
            claim
        );


        console.log(
            "DIGITAL CLAIM STORED:",
            claim
        );


        // -------------------------------------------------
        // SEND CLAIM TO HOST
        // -------------------------------------------------

        io.emit(
            "winRequested",
            {

                cardId:
                    cardId,

                markedIndices:
                    claim.markedIndices,

                winningPattern:
                    claim.winningPattern,

                timestamp:
                    claim.timestamp

            }
        );


        console.log(
            "WIN REQUEST SENT TO HOST:",
            cardId
        );

    }
);


// =====================================================
// DIGITAL WIN APPROVAL
// =====================================================

socket.on(
    "approveWin",
    cardId => {

        const id =
            Number(cardId);


        if (!id) {

            console.warn(
                "APPROVE WIN FAILED: INVALID CARD ID",
                cardId
            );

            return;

        }


        // -------------------------------------------------
        // MAKE SURE THIS CARD HAS A PENDING CLAIM
        // -------------------------------------------------

        const pendingClaim =
            pendingClaims.get(id);


        if (!pendingClaim) {

            console.warn(
                "APPROVE WIN FAILED: NO PENDING CLAIM",
                id
            );

            return;

        }


        // -------------------------------------------------
        // PREVENT DUPLICATE WINNER
        // -------------------------------------------------

        if (
            gameState.approvedWinnersList.includes(
                id
            )
        ) {

            console.log(
                "CARD ALREADY APPROVED:",
                id
            );

            pendingClaims.delete(
                id
            );

            return;

        }


        // -------------------------------------------------
        // CHECK WINNER LIMIT
        // -------------------------------------------------

        if (
            gameState.approvedWinnersCount >=
            gameState.maxWinners
        ) {

            console.log(
                "APPROVAL IGNORED: WINNER LIMIT REACHED",
                id
            );

            pendingClaims.delete(
                id
            );

            return;

        }


        // -------------------------------------------------
        // REMOVE PENDING CLAIM
        // -------------------------------------------------

        pendingClaims.delete(
            id
        );


        // -------------------------------------------------
        // ADD APPROVED WINNER
        // -------------------------------------------------

        gameState.approvedWinnersList.push(
            id
        );


        gameState.approvedWinnersCount++;


        console.log(
            "DIGITAL WIN APPROVED:",
            id,

            "WINNERS:",
            gameState.approvedWinnersCount,

            "/",

            gameState.maxWinners
        );


        // -------------------------------------------------
        // TELL PLAYER THE WIN WAS APPROVED
        // -------------------------------------------------

        io.emit(
            "winApproved",
            {
                cardId:
                    id
            }
        );


        // -------------------------------------------------
        // SEND UPDATED GAME STATE
        // -------------------------------------------------

        io.emit(
            "gameState",
            gameState
        );


        // -------------------------------------------------
        // END GAME WHEN WINNER LIMIT IS REACHED
        // -------------------------------------------------

        if (
            gameState.approvedWinnersCount >=
            gameState.maxWinners
        ) {

            console.log(
                "WINNER LIMIT REACHED"
            );


            gameState.status =
                "ended";


            clearInterval(
                timer
            );


            timer =
                null;


            io.emit(
                "gameEnded",
                {
                    reason:
                        "winner limit reached"
                }
            );


            io.emit(
                "gameState",
                gameState
            );

        }

    }
);


// =====================================================
// DIGITAL WIN REJECTION
// =====================================================
//
// IMPORTANT:
//
// Rejecting a claim does NOT reject the player.
//
// It only removes the current pending claim.
//
// The player can continue playing and submit
// another Bingo claim.
//
// This can happen repeatedly.
//

socket.on(
    "rejectWin",
    cardId => {

        const id =
            Number(cardId);


        if (!id) {

            console.warn(
                "REJECT WIN FAILED: INVALID CARD ID",
                cardId
            );

            return;

        }


        console.log(
            "========== DIGITAL WIN REJECTED ==========",
            id
        );


        // -------------------------------------------------
        // REMOVE THE PENDING CLAIM
        // -------------------------------------------------

        const removed =
            pendingClaims.delete(
                id
            );


        console.log(
            "PENDING CLAIM REMOVED:",
            removed,
            "CARD:",
            id
        );


        // -------------------------------------------------
        // TELL PLAYER TO CONTINUE PLAYING
        // -------------------------------------------------

        io.emit(
            "winRejected",
            {
                cardId:
                    id
            }
        );


        console.log(
            "PLAYER MAY CONTINUE PLAYING:",
            id
        );

    }
);


// =====================================================
// PHYSICAL CARD CHECKER SYSTEM
// APPROVE / REJECT MANAGEMENT
// =====================================================

socket.on(
"approvePhysicalWin",
data=>{


    if(!data)
        return;


    const id =
    Number(data.cardId);


    if(!id)
        return;



    if(
        gameState.approvedWinnersList.includes(id)
    ){

        return;

    }



    gameState.approvedWinnersList.push(
        id
    );


    gameState.approvedWinnersCount++;



    console.log(
        "PHYSICAL WIN APPROVED:",
        id,
        "WINNERS:",
        gameState.approvedWinnersCount,
        "/",
        gameState.maxWinners
    );



    io.emit(
        "physicalWinApproved",
        {
            cardId:id,

            winnerCount:
            gameState.approvedWinnersCount
        }
    );



    /*
    STOP GAME WHEN WIN LIMIT REACHED
    */

    if(
        gameState.approvedWinnersCount
        >=
        gameState.maxWinners
    ){

        gameState.status =
        "ended";


        clearInterval(timer);


        io.emit(
            "gameEnded",
            {
                reason:
                "winner limit reached"
            }
        );

    }



    io.emit(
        "gameState",
        gameState
    );


});

// =====================================================
// PHYSICAL REJECT
// DOES NOT REMOVE PLAYER
// PLAYER CAN WIN AGAIN
// =====================================================


socket.on(
"rejectPhysicalWin",
data=>{


    if(!data || !data.cardId){

        return;

    }



    const cardId =
    Number(data.cardId);



    console.log(
        "PHYSICAL WIN REJECTED:",
        cardId
    );



    io.emit(
        "physicalWinRejected",
        {

            cardId:cardId

        }
    );


});

// =====================================================
// DISCONNECT
// =====================================================


socket.on(
"disconnect",
()=>{


    console.log(
        "DISCONNECTED:",
        socket.id
    );


});



});


// =====================================================
// START SERVER
// =====================================================


const PORT =
process.env.PORT || 3000;


loadQuestionsFromDatabase()
.then(()=>{


    server.listen(
    PORT,
    "0.0.0.0",
    ()=>{


        console.log(
        `Safety Bingo running on port ${PORT}`
        );


    });


});
