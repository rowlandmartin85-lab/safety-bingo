"use strict";

// =====================================================
// SAFETY BINGO SERVER
// FULL CONSOLIDATED SERVER.JS
// =====================================================

require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const {
    pool,
    initializeDatabase
} = require("./database");


// =====================================================
// DATABASE INITIALIZATION
// =====================================================

initializeDatabase();


// =====================================================
// OPTIONAL QUESTION MIGRATION
// =====================================================

if (
    process.env.MIGRATE_QUESTIONS === "true"
) {

    require("./migrateQuestions");

}


// =====================================================
// SERVER SETUP
// =====================================================

const app =
    express();

app.use(
    express.json()
);

const server =
    http.createServer(
        app
    );

const io =
    new Server(
        server,
        {
            cors: {
                origin: "*",
                methods: [
                    "GET",
                    "POST"
                ]
            }
        }
    );


// =====================================================
// STATIC FILES
// =====================================================

app.use(
    express.static(
        __dirname
    )
);

app.use(
    express.static(
        path.join(
            __dirname,
            "public"
        )
    )
);


// =====================================================
// QUESTION DATABASE
// =====================================================

let safetyQuestionBank = [];


async function loadQuestionsFromDatabase() {

    try {

        const result =
            await pool.query(`
                SELECT *
                FROM questions
                ORDER BY id ASC
            `);


        safetyQuestionBank =
            result.rows.map(
                item => ({

                    id:
                        item.id,

                    category:
                        item.category,

                    difficulty:
                        item.difficulty,

                    q:
                        item.question,

                    a:
                        item.answer

                })
            );


        console.log(
            `Loaded ${safetyQuestionBank.length} questions from database`
        );


    } catch (error) {

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

app.get(
    "/",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "index.html"
            )
        );

    }
);


app.get(
    "/host.html",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "host.html"
            )
        );

    }
);


app.get(
    "/player.html",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "player.html"
            )
        );

    }
);


app.get(
    "/display.html",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "display.html"
            )
        );

    }
);


app.get(
    "/questionManager.html",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "questionManager.html"
            )
        );

    }
);


app.get(
    "/cheatsheet.html",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "cheatsheet.html"
            )
        );

    }
);


// =====================================================
// PHYSICAL BINGO QR PAGE
// =====================================================

app.get(
    "/physical-bingo.html",
    (req, res) => {

        res.sendFile(
            path.join(
                __dirname,
                "physical-bingo.html"
            )
        );

    }
);


// =====================================================
// QUESTION API
// =====================================================

app.get(
    "/api/questions",
    async (req, res) => {

        try {

            const result =
                await pool.query(`
                    SELECT *
                    FROM questions
                    ORDER BY id ASC
                `);


            res.json(
                result.rows
            );


        } catch (error) {

            console.error(
                "LOAD QUESTIONS ERROR:",
                error
            );


            res.status(500).json({

                success:
                    false,

                error:
                    error.message

            });

        }

    }
);


// =====================================================
// ADD QUESTION
// =====================================================

app.post(
    "/api/questions/add",
    async (req, res) => {

        const newQuestion =
            req.body;


        if (
            !newQuestion.q ||
            !newQuestion.a
        ) {

            return res.status(400).json({

                success:
                    false,

                error:
                    "Question and answer required"

            });

        }


        try {

            const idResult =
                await pool.query(`
                    SELECT MAX(id) AS maxid
                    FROM questions
                `);


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
                (
                    $1,
                    $2,
                    $3,
                    $4,
                    $5
                )
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

                success:
                    true,

                id:
                    nextID

            });


        } catch (error) {

            console.error(
                "ADD QUESTION ERROR:",
                error
            );


            res.status(500).json({

                success:
                    false,

                error:
                    error.message

            });

        }

    }
);


// =====================================================
// DELETE QUESTION
// =====================================================

app.delete(
    "/api/questions/:id",
    async (req, res) => {

        const id =
            Number(
                req.params.id
            );


        if (!id) {

            return res.status(400).json({

                success:
                    false,

                error:
                    "Invalid question ID"

            });

        }


        try {

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


            if (
                result.rowCount === 0
            ) {

                return res.status(404).json({

                    success:
                        false,

                    error:
                        "Question not found"

                });

            }


            console.log(
                "QUESTION REMOVED:",
                id
            );


            res.json({

                success:
                    true

            });


        } catch (error) {

            console.error(
                "DELETE ERROR:",
                error
            );


            res.status(500).json({

                success:
                    false,

                error:
                    error.message

            });

        }

    }
);


// =====================================================
// GAME STATE
// =====================================================

let gameState = {

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

    calledAnswers:
        [],

    askedIndices:
        [],

    gameOrder:
        [],

    timerSeconds:
        30,

    noTimer:
        false,

    isPaused:
        false,

    maxWinners:
        1,

    approvedWinnersCount:
        0,

    approvedWinnersList:
        []

};


// =====================================================
// SERVER GAME VARIABLES
// =====================================================

let timer =
    null;

let countdown =
    30;

let gamePosition =
    -1;


// =====================================================
// PENDING CLAIMS
//
// Digital claims and physical QR claims both use
// this map.
//
// Physical claims look like:
//
// {
//     cardId,
//     timestamp,
//     playerSocketId,
//     physical: true
// }
// =====================================================

const pendingClaims =
    new Map();


// =====================================================
// HOST TRACKING
// =====================================================

let hostSocketId =
    null;

let hostDisconnectTimer =
    null;


const HOST_RECONNECT_GRACE_PERIOD =
    3000;


// =====================================================
// RESET GAME
// =====================================================

function resetGame(
    reason = "unknown"
) {

    console.log(
        "=========================================="
    );

    console.log(
        "RESETTING GAME:",
        reason
    );

    console.log(
        "=========================================="
    );


    // =================================================
    // STOP TIMER
    // =================================================

    if (timer) {

        clearInterval(
            timer
        );

        timer =
            null;

    }


    countdown =
        30;


    // =================================================
    // CLEAR CLAIMS
    // =================================================

    pendingClaims.clear();


    console.log(
        "PENDING DIGITAL/PHYSICAL CLAIMS CLEARED"
    );


    // =================================================
    // RESET STATE
    // =================================================

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

        calledAnswers:
            [],

        askedIndices:
            [],

        gameOrder:
            [],

        timerSeconds:
            30,

        noTimer:
            false,

        isPaused:
            false,

        maxWinners:
            1,

        approvedWinnersCount:
            0,

        approvedWinnersList:
            []

    };


    // =================================================
    // RESET POSITION
    // =================================================

    gamePosition =
        -1;


    // =================================================
    // TELL CLIENTS
    // =================================================

    io.emit(
        "gameReset"
    );


    io.emit(
        "gameState",
        gameState
    );


    io.emit(
        "timerUpdate",
        0
    );


    console.log(
        "========== GAME RESET COMPLETE =========="
    );

}


// =====================================================
// BUILD RANDOM QUESTION ORDER
// =====================================================

function buildGameOrder() {

    gameState.gameOrder =
        [];


    for (
        let i = 0;
        i < safetyQuestionBank.length;
        i++
    ) {

        gameState.gameOrder.push(
            i
        );

    }


    for (
        let i =
            gameState.gameOrder.length - 1;

        i > 0;

        i--
    ) {

        const j =
            Math.floor(
                Math.random() *
                (i + 1)
            );


        [
            gameState.gameOrder[i],
            gameState.gameOrder[j]
        ] = [

            gameState.gameOrder[j],
            gameState.gameOrder[i]

        ];

    }

}


// =====================================================
// SEND NEXT QUESTION
// =====================================================

function sendNextQuestion() {

    if (timer) {

        clearInterval(
            timer
        );

        timer =
            null;

    }


    gamePosition++;


    if (
        gamePosition >=
        gameState.gameOrder.length
    ) {

        gameState.status =
            "ended";


        gameState.currentQuestion =
            "";


        gameState.currentAnswer =
            "";


        io.emit(
            "gameState",
            gameState
        );


        return;

    }


    const index =
        gameState.gameOrder[
            gamePosition
        ];


    const question =
        safetyQuestionBank[
            index
        ];


    if (!question) {

        console.error(
            "QUESTION NOT FOUND:",
            index
        );

        return;

    }


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


    gameState.currentQuestionNumber =
        safetyQuestionBank.findIndex(
            q =>
                q.id ===
                question.id
        ) + 1;


    gameState.isPaused =
        false;


    if (
        !gameState.calledAnswers.includes(
            question.a
        )
    ) {

        gameState.calledAnswers.push(
            question.a
        );

    }


    // =================================================
    // CHEAT SHEET
    // =================================================

    io.emit(
        "cheatSheetQuestion",
        {

            number:
                gameState.currentQuestionNumber,

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


    // =================================================
    // GAME STATE
    // =================================================

    io.emit(
        "gameState",
        gameState
    );


    // =================================================
    // TIMER
    // =================================================

    if (
        !gameState.noTimer
    ) {

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
// START TIMER
// =====================================================

function startTimer() {

    if (timer) {

        clearInterval(
            timer
        );

    }


    timer =
        setInterval(
            () => {

                if (
                    gameState.isPaused
                ) {

                    return;

                }


                countdown--;


                io.emit(
                    "timerUpdate",
                    countdown
                );


                if (
                    countdown <= 0
                ) {

                    sendNextQuestion();

                }

            },
            1000
        );

}


// =====================================================
// SOCKET CONNECTION
// =====================================================

io.on(
    "connection",
    socket => {

        console.log(
            "CONNECTED:",
            socket.id
        );


        // =================================================
        // SEND CURRENT STATE
        // =================================================

        socket.emit(
            "gameState",
            gameState
        );


        // =================================================
        // SEND PREVIOUS QUESTIONS
        // =================================================

        gameState.askedIndices.forEach(
            index => {

                const question =
                    safetyQuestionBank[
                        index
                    ];


                if (!question) {
                    return;
                }


                socket.emit(
                    "cheatSheetQuestion",
                    {

                        number:
                            safetyQuestionBank.findIndex(
                                q =>
                                    q.id ===
                                    question.id
                            ) + 1,

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

            }
        );


        // =================================================
        // REGISTER HOST
        //
        // IMPORTANT:
        //
        // A new host is allowed to take over the host
        // role. This prevents the old:
        //
        // "Another host is already registered"
        //
        // problem when returning from HOME.
        // =================================================

        socket.on(
            "registerHost",
            () => {

                console.log(
                    "HOST REGISTER REQUEST:",
                    socket.id
                );


                // -----------------------------------------
                // CANCEL PENDING OLD HOST DISCONNECT
                // -----------------------------------------

                if (
                    hostDisconnectTimer
                ) {

                    clearTimeout(
                        hostDisconnectTimer
                    );

                    hostDisconnectTimer =
                        null;


                    console.log(
                        "HOST RECONNECT - RESET CANCELLED"
                    );

                }


                // -----------------------------------------
                // NEW SOCKET BECOMES HOST
                // -----------------------------------------

                const previousHost =
                    hostSocketId;


                hostSocketId =
                    socket.id;


                console.log(
                    "HOST REGISTERED:",
                    hostSocketId
                );


                if (
                    previousHost &&
                    previousHost !==
                    socket.id
                ) {

                    console.log(
                        "PREVIOUS HOST REPLACED:",
                        previousHost
                    );

                }


                socket.emit(
                    "hostRegistered"
                );

            }
        );


        // =================================================
        // TIMER SETTINGS
        // =================================================

        socket.on(
            "setTimerSettings",
            data => {

                if (!data) {
                    return;
                }


                gameState.timerSeconds =
                    Number(
                        data.seconds
                    ) || 30;


                gameState.noTimer =
                    data.noTimer === true;


                console.log(
                    "TIMER SETTINGS:",
                    {

                        seconds:
                            gameState.timerSeconds,

                        noTimer:
                            gameState.noTimer

                    }
                );


                io.emit(
                    "gameState",
                    gameState
                );

            }
        );


        // =================================================
        // WINNER SETTINGS
        // =================================================

        socket.on(
            "setWinnerSettings",
            data => {

                if (!data) {
                    return;
                }


                gameState.maxWinners =
                    Number(
                        data.maxWinners
                    ) || 1;


                console.log(
                    "MAX WINNERS:",
                    gameState.maxWinners
                );


                io.emit(
                    "gameState",
                    gameState
                );

            }
        );


        // =================================================
        // START GAME
        // =================================================

        socket.on(
            "hostStart",
            async () => {

                if (
                    socket.id !==
                    hostSocketId
                ) {

                    console.warn(
                        "HOST START REJECTED:",
                        socket.id
                    );

                    return;

                }


                if (
                    gameState.status ===
                    "running"
                ) {

                    return;

                }


                try {

                    await loadQuestionsFromDatabase();


                    pendingClaims.clear();


                    gameState.status =
                        "running";


                    gameState.askedIndices =
                        [];


                    gameState.calledAnswers =
                        [];


                    gameState.approvedWinnersCount =
                        0;


                    gameState.approvedWinnersList =
                        [];


                    buildGameOrder();


                    gamePosition =
                        -1;


                    sendNextQuestion();


                } catch (error) {

                    console.error(
                        "START GAME ERROR:",
                        error
                    );

                }

            }
        );


        // =================================================
        // NEXT QUESTION
        // =================================================

        socket.on(
            "hostNext",
            () => {

                if (
                    socket.id !==
                    hostSocketId
                ) {

                    return;

                }


                if (
                    gameState.status !==
                    "running"
                ) {

                    return;

                }


                sendNextQuestion();

            }
        );


        // =================================================
        // PREVIOUS QUESTION
        // =================================================

        socket.on(
            "hostPrevious",
            () => {

                if (
                    socket.id !==
                    hostSocketId
                ) {

                    return;

                }


                if (
                    gameState.status !==
                        "running" ||
                    gamePosition <= 0
                ) {

                    return;

                }


                gamePosition--;


                const index =
                    gameState.gameOrder[
                        gamePosition
                    ];


                const question =
                    safetyQuestionBank[
                        index
                    ];


                if (!question) {
                    return;
                }


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


                gameState.currentQuestionNumber =
                    safetyQuestionBank.findIndex(
                        q =>
                            q.id ===
                            question.id
                    ) + 1;


                if (timer) {

                    clearInterval(
                        timer
                    );

                    timer =
                        null;

                }


                io.emit(
                    "gameState",
                    gameState
                );

            }
        );


        // =================================================
        // REPEAT QUESTION
        // =================================================

        socket.on(
            "hostRepeat",
            () => {

                if (
                    socket.id !==
                    hostSocketId
                ) {

                    return;

                }


                io.emit(
                    "gameState",
                    {

                        ...gameState,

                        repeatQuestion:
                            true

                    }
                );

            }
        );


        // =================================================
        // PAUSE / RESUME
        // =================================================

        socket.on(
            "togglePausePlay",
            () => {

                if (
                    socket.id !==
                    hostSocketId
                ) {

                    return;

                }


                gameState.isPaused =
                    !gameState.isPaused;


                console.log(
                    "PAUSE:",
                    gameState.isPaused
                );


                if (
                    gameState.isPaused
                ) {

                    if (timer) {

                        clearInterval(
                            timer
                        );

                        timer =
                            null;

                    }

                } else if (
                    gameState.status ===
                        "running" &&
                    !gameState.noTimer
                ) {

                    countdown =
                        Math.max(
                            countdown,
                            1
                        );


                    startTimer();

                }


                io.emit(
                    "gameState",
                    gameState
                );

            }
        );


        // =================================================
        // HOST RESET
        // =================================================

        socket.on(
            "hostReset",
            () => {

                if (
                    socket.id !==
                    hostSocketId
                ) {

                    console.warn(
                        "RESET REJECTED - NOT HOST:",
                        socket.id
                    );

                    return;

                }


                resetGame(
                    "host reset button"
                );

            }
        );


        // =================================================
        // LEGACY RESET
        // =================================================

        socket.on(
            "resetGame",
            () => {

                if (
                    socket.id !==
                    hostSocketId
                ) {

                    return;

                }


                resetGame(
                    "legacy resetGame event"
                );

            }
        );


        // =================================================
        // HOST LEFT GAME
        // =================================================

        socket.on(
            "hostLeftGame",
            () => {

                if (
                    socket.id !==
                    hostSocketId
                ) {

                    return;

                }


                console.log(
                    "HOST LEFT GAME EVENT RECEIVED:",
                    socket.id
                );


                resetGame(
                    "hostLeftGame event"
                );

            }
        );


        // =================================================
        // DIGITAL BINGO CLAIM
        // =================================================

        socket.on(
            "claimWin",
            data => {

                console.log(
                    "========== DIGITAL BINGO CLAIM RECEIVED ==========",
                    data
                );


                if (!data) {

                    console.warn(
                        "BINGO CLAIM REJECTED: NO DATA"
                    );

                    return;

                }


                const cardId =
                    Number(
                        data.cardId
                    );


                if (!cardId) {

                    console.warn(
                        "BINGO CLAIM REJECTED: INVALID CARD ID",
                        data
                    );

                    return;

                }


                if (
                    gameState.status !==
                    "running"
                ) {

                    console.warn(
                        "BINGO CLAIM REJECTED: GAME NOT RUNNING",
                        cardId
                    );

                    return;

                }


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
                        socket.id,

                    physical:
                        false

                };


                pendingClaims.set(
                    cardId,
                    claim
                );


                console.log(
                    "DIGITAL CLAIM STORED:",
                    claim
                );


                io.emit(
                    "winRequested",
                    {

                        cardId:
                            claim.cardId,

                        markedIndices:
                            claim.markedIndices,

                        winningPattern:
                            claim.winningPattern,

                        timestamp:
                            claim.timestamp

                    }
                );


                console.log(
                    "DIGITAL WIN REQUEST SENT TO HOST:",
                    cardId
                );

            }
        );


        // =================================================
        // PHYSICAL BINGO QR CLAIM
        //
        // THIS IS THE NEW SYSTEM
        //
        // QR:
        //
        // /physical-bingo.html?card=27
        //
        // becomes:
        //
        // PHYSICAL BINGO CLAIM
        // CARD #27
        //
        // sent to the host.
        // =================================================

        socket.on(
            "physicalBingoClaim",
            data => {

                console.log(
                    "========== PHYSICAL BINGO CLAIM =========="
                );


                console.log(
                    "PHYSICAL CLAIM DATA:",
                    data
                );


                if (!data) {

                    socket.emit(
                        "physicalBingoClaimError",
                        {

                            error:
                                "No card information received."

                        }
                    );

                    return;

                }


                const cardId =
                    Number(
                        data.cardId
                    );


                if (
                    !Number.isInteger(
                        cardId
                    ) ||
                    cardId <= 0
                ) {

                    socket.emit(
                        "physicalBingoClaimError",
                        {

                            error:
                                "Invalid Bingo card number."

                        }
                    );

                    return;

                }


                // =================================================
                // GAME MUST BE RUNNING
                // =================================================

                if (
                    gameState.status !==
                    "running"
                ) {

                    console.log(
                        "PHYSICAL CLAIM REJECTED - GAME NOT RUNNING:",
                        cardId
                    );


                    socket.emit(
                        "physicalBingoClaimError",
                        {

                            error:
                                "The Bingo game is not currently running."

                        }
                    );

                    return;

                }


                // =================================================
                // WINNER LIMIT
                // =================================================

                if (
                    gameState.approvedWinnersCount >=
                    gameState.maxWinners
                ) {

                    socket.emit(
                        "physicalBingoClaimError",
                        {

                            error:
                                "The winner limit has already been reached."

                        }
                    );

                    return;

                }


                // =================================================
                // ALREADY APPROVED WINNER
                // =================================================

                if (
                    gameState.approvedWinnersList.includes(
                        cardId
                    )
                ) {

                    socket.emit(
                        "physicalBingoClaimError",
                        {

                            error:
                                "This card has already been approved as a winner."

                        }
                    );

                    return;

                }


                // =================================================
                // CHECK EXISTING CLAIM
                // =================================================

                const existingClaim =
                    pendingClaims.get(
                        cardId
                    );


                if (
                    existingClaim
                ) {

                    socket.emit(
                        "physicalBingoClaimReceived",
                        {

                            cardId:
                                cardId

                        }
                    );

                    return;

                }


                // =================================================
                // CREATE PHYSICAL CLAIM
                // =================================================

                const claim = {

                    cardId:
                        cardId,

                    timestamp:
                        data.timestamp ||
                        Date.now(),

                    playerSocketId:
                        socket.id,

                    physical:
                        true

                };


                // =================================================
                // STORE CLAIM
                // =================================================

                pendingClaims.set(
                    cardId,
                    claim
                );


                console.log(
                    "PHYSICAL BINGO CLAIM STORED:",
                    claim
                );


                // =================================================
                // TELL PLAYER
                // =================================================

                socket.emit(
                    "physicalBingoClaimReceived",
                    {

                        cardId:
                            cardId

                    }
                );


                // =================================================
                // TELL HOST
                // =================================================

                io.emit(
                    "physicalBingoClaim",
                    {

                        cardId:
                            cardId,

                        timestamp:
                            claim.timestamp

                    }
                );


                console.log(
                    "PHYSICAL BINGO AUDIT SENT TO HOST:",
                    cardId
                );

            }
        );


        // =================================================
        // APPROVE DIGITAL WIN
        // =================================================

        socket.on(
            "approveWin",
            cardId => {

                if (
                    socket.id !==
                    hostSocketId
                ) {

                    return;

                }


                const id =
                    Number(
                        cardId
                    );


                if (!id) {

                    console.warn(
                        "APPROVE WIN FAILED: INVALID CARD ID",
                        cardId
                    );

                    return;

                }


                const pendingClaim =
                    pendingClaims.get(
                        id
                    );


                if (!pendingClaim) {

                    console.warn(
                        "APPROVE WIN FAILED: NO PENDING CLAIM",
                        id
                    );

                    return;

                }


                if (
                    gameState.approvedWinnersList.includes(
                        id
                    )
                ) {

                    pendingClaims.delete(
                        id
                    );

                    return;

                }


                if (
                    gameState.approvedWinnersCount >=
                    gameState.maxWinners
                ) {

                    pendingClaims.delete(
                        id
                    );

                    return;

                }


                pendingClaims.delete(
                    id
                );


                gameState.approvedWinnersList.push(
                    id
                );


                gameState.approvedWinnersCount++;


                console.log(
                    "DIGITAL WIN APPROVED:",
                    id
                );


                io.emit(
                    "winApproved",
                    {

                        cardId:
                            id

                    }
                );


                io.emit(
                    "gameState",
                    gameState
                );


                if (
                    gameState.approvedWinnersCount >=
                    gameState.maxWinners
                ) {

                    gameState.status =
                        "ended";


                    if (timer) {

                        clearInterval(
                            timer
                        );

                        timer =
                            null;

                    }


                    pendingClaims.clear();


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


        // =================================================
        // REJECT DIGITAL WIN
        // =================================================

        socket.on(
            "rejectWin",
            cardId => {

                if (
                    socket.id !==
                    hostSocketId
                ) {

                    return;

                }


                const id =
                    Number(
                        cardId
                    );


                if (!id) {

                    return;

                }


                const pendingClaim =
                    pendingClaims.get(
                        id
                    );


                const winningPattern =
                    pendingClaim &&
                    Array.isArray(
                        pendingClaim.winningPattern
                    )
                        ? [
                            ...pendingClaim.winningPattern
                        ]
                        : [];


                pendingClaims.delete(
                    id
                );


                io.emit(
                    "winRejected",
                    {

                        cardId:
                            id,

                        winningPattern:
                            winningPattern

                    }
                );


                console.log(
                    "DIGITAL WIN REJECTED:",
                    id
                );

            }
        );


        // =================================================
        // APPROVE PHYSICAL WIN
        // =================================================

        socket.on(
            "approvePhysicalWin",
            data => {

                // -----------------------------------------
                // ONLY HOST
                // -----------------------------------------

                if (
                    socket.id !==
                    hostSocketId
                ) {

                    return;

                }


                if (!data) {
                    return;
                }


                const id =
                    Number(
                        data.cardId
                    );


                if (!id) {
                    return;
                }


                // -----------------------------------------
                // ALREADY WINNER
                // -----------------------------------------

                if (
                    gameState.approvedWinnersList.includes(
                        id
                    )
                ) {

                    pendingClaims.delete(
                        id
                    );

                    return;

                }


                // -----------------------------------------
                // WINNER LIMIT
                // -----------------------------------------

                if (
                    gameState.approvedWinnersCount >=
                    gameState.maxWinners
                ) {

                    return;

                }


                // -----------------------------------------
                // REMOVE PENDING CLAIM
                // -----------------------------------------

                pendingClaims.delete(
                    id
                );


                // -----------------------------------------
                // APPROVE WINNER
                // -----------------------------------------

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


                // -----------------------------------------
                // TELL EVERYONE
                // -----------------------------------------

                io.emit(
                    "physicalWinApproved",
                    {

                        cardId:
                            id,

                        winnerCount:
                            gameState.approvedWinnersCount

                    }
                );


                // -----------------------------------------
                // END GAME IF WINNER LIMIT REACHED
                // -----------------------------------------

                if (
                    gameState.approvedWinnersCount >=
                    gameState.maxWinners
                ) {

                    gameState.status =
                        "ended";


                    if (timer) {

                        clearInterval(
                            timer
                        );

                        timer =
                            null;

                    }


                    pendingClaims.clear();


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

            }
        );


        // =================================================
        // REJECT PHYSICAL WIN
        // =================================================

        socket.on(
            "rejectPhysicalWin",
            data => {

                // -----------------------------------------
                // ONLY HOST
                // -----------------------------------------

                if (
                    socket.id !==
                    hostSocketId
                ) {

                    return;

                }


                if (!data) {
                    return;
                }


                const cardId =
                    Number(
                        data.cardId
                    );


                if (!cardId) {
                    return;
                }


                console.log(
                    "PHYSICAL WIN REJECTED:",
                    cardId
                );


                // -----------------------------------------
                // REMOVE PENDING CLAIM
                // -----------------------------------------

                pendingClaims.delete(
                    cardId
                );


                // -----------------------------------------
                // TELL CLIENTS
                // -----------------------------------------

                io.emit(
                    "physicalWinRejected",
                    {

                        cardId:
                            cardId

                    }
                );

            }
        );


        // =================================================
        // LOAD PLAYER CARD
        // =================================================

        socket.on(
            "loadCard",
            cardId => {

                const id =
                    Number(
                        cardId
                    );


                if (!id) {
                    return;
                }


                console.log(
                    "CARD LOADED BY PLAYER:",
                    id,
                    socket.id
                );


                socket.emit(
                    "cardLoaded",
                    {

                        cardId:
                            id

                    }
                );

            }
        );


        // =================================================
        // PLAYER MARK CARD
        // =================================================

        socket.on(
            "markCard",
            data => {

                if (!data) {
                    return;
                }


                const cardId =
                    Number(
                        data.id
                    );


                const index =
                    Number(
                        data.index
                    );


                const marked =
                    data.marked ===
                    true;


                if (!cardId) {
                    return;
                }


                if (
                    !Number.isInteger(
                        index
                    ) ||
                    index < 0 ||
                    index > 24
                ) {

                    return;

                }


                console.log(
                    "CARD MARK:",
                    {

                        cardId:
                            cardId,

                        index:
                            index,

                        marked:
                            marked,

                        socketId:
                            socket.id

                    }
                );

            }
        );


        // =================================================
        // GAME STATE SYNC FALLBACK
        // =================================================

        socket.on(
            "requestGameStateSyncFallback",
            () => {

                socket.emit(
                    "gameState",
                    gameState
                );

            }
        );


        // =================================================
        // DISCONNECT
        // =================================================

        socket.on(
            "disconnect",
            () => {

                console.log(
                    "DISCONNECTED:",
                    socket.id
                );


                // =========================================
                // REMOVE CLAIMS BELONGING TO SOCKET
                // =========================================

                for (
                    const [
                        cardId,
                        claim
                    ]
                    of pendingClaims.entries()
                ) {

                    if (
                        claim.playerSocketId ===
                        socket.id
                    ) {

                        pendingClaims.delete(
                            cardId
                        );


                        console.log(
                            "REMOVED CLAIM FROM DISCONNECTED PLAYER:",
                            cardId
                        );

                    }

                }


                // =========================================
                // HOST DISCONNECT
                // =========================================

                if (
                    socket.id ===
                    hostSocketId
                ) {

                    console.log(
                        "========== HOST DISCONNECTED =========="
                    );


                    hostSocketId =
                        null;


                    if (
                        hostDisconnectTimer
                    ) {

                        clearTimeout(
                            hostDisconnectTimer
                        );

                    }


                    hostDisconnectTimer =
                        setTimeout(
                            () => {

                                hostDisconnectTimer =
                                    null;


                                if (
                                    hostSocketId ===
                                    null
                                ) {

                                    resetGame(
                                        "host disconnected"
                                    );

                                }

                            },
                            HOST_RECONNECT_GRACE_PERIOD
                        );

                }

            }
        );

    }
);


// =====================================================
// SERVER STARTUP
// =====================================================

const PORT =
    process.env.PORT ||
    3000;


loadQuestionsFromDatabase()
    .then(
        () => {

            server.listen(
                PORT,
                "0.0.0.0",
                () => {

                    console.log(
                        `Safety Bingo running on port ${PORT}`
                    );

                }
            );

        }
    )
    .catch(
        error => {

            console.error(
                "SERVER STARTUP FAILED:",
                error
            );

            process.exit(1);

        }
    );
