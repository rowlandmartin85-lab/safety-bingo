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
// SERVER SETUP
// =====================================================

const app = express();

app.use(
    express.json()
);

const server =
    http.createServer(app);

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


// =====================================================
// LOAD QUESTIONS FROM DATABASE
// =====================================================

async function loadQuestionsFromDatabase() {

    try {

        const result =
            await pool.query(`
                SELECT
                    id,
                    category,
                    difficulty,
                    question,
                    answer
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


        return safetyQuestionBank;


    } catch (error) {

        console.error(
            "DATABASE QUESTION LOAD ERROR:",
            error
        );

        throw error;

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

    /*
    Store the actual selected database IDs
    used for this game.
    */

    selectedQuestionIds:
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
// QUESTION API
// =====================================================

// -----------------------------------------------------
// GET ALL QUESTIONS
// -----------------------------------------------------

app.get(
    "/api/questions",
    async (req, res) => {

        try {

            const result =
                await pool.query(`
                    SELECT
                        id,
                        category,
                        difficulty,
                        question,
                        answer
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


// -----------------------------------------------------
// ADD QUESTION
// -----------------------------------------------------

app.post(
    "/api/questions/add",
    async (req, res) => {

        if (
            gameState.status ===
            "running"
        ) {

            return res.status(409).json({

                success:
                    false,

                error:
                    "Questions cannot be added while a game is running."

            });

        }


        const newQuestion =
            req.body || {};


        const question =
            String(
                newQuestion.q ||
                newQuestion.question ||
                ""
            ).trim();


        const answer =
            String(
                newQuestion.a ||
                newQuestion.answer ||
                ""
            ).trim();


        if (
            !question ||
            !answer
        ) {

            return res.status(400).json({

                success:
                    false,

                error:
                    "Question and answer required"

            });

        }


        const category =
            String(
                newQuestion.category ||
                "General"
            ).trim();


        const difficulty =
            String(
                newQuestion.difficulty ||
                "Medium"
            ).trim();


        let client;


        try {

            client =
                await pool.connect();


            await client.query(
                "BEGIN"
            );


            /*
            Prevent simultaneous MAX(id)+1
            calculations.
            */

            await client.query(`
                SELECT pg_advisory_xact_lock(
                    748392
                )
            `);


            const idResult =
                await client.query(`
                    SELECT
                        COALESCE(
                            MAX(id),
                            0
                        ) + 1 AS next_id
                    FROM questions
                `);


            const nextID =
                Number(
                    idResult.rows[0].next_id
                );


            const insertResult =
                await client.query(`
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
                    RETURNING
                        id,
                        category,
                        difficulty,
                        question,
                        answer
                `, [

                    nextID,

                    category,

                    difficulty,

                    question,

                    answer

                ]);


            await client.query(
                "COMMIT"
            );


            const inserted =
                insertResult.rows[0];


            console.log(
                "QUESTION ADDED:",
                inserted.id
            );


            await loadQuestionsFromDatabase();


            res.json({

                success:
                    true,

                id:
                    inserted.id,

                question:
                    inserted

            });


        } catch (error) {

            if (client) {

                try {

                    await client.query(
                        "ROLLBACK"
                    );

                } catch (rollbackError) {

                    console.error(
                        "ROLLBACK ERROR:",
                        rollbackError
                    );

                }

            }


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


        } finally {

            if (client) {

                client.release();

            }

        }

    }
);


// -----------------------------------------------------
// DELETE ALL QUESTIONS
// -----------------------------------------------------

app.delete(
    "/api/questions/delete-all",
    async (req, res) => {

        if (
            gameState.status ===
            "running"
        ) {

            return res.status(409).json({

                success:
                    false,

                error:
                    "Questions cannot be deleted while a game is running."

            });

        }


        try {

            const result =
                await pool.query(`
                    DELETE FROM questions
                `);


            safetyQuestionBank =
                [];


            gameState.gameOrder =
                [];

            gameState.selectedQuestionIds =
                [];

            gameState.askedIndices =
                [];

            gameState.calledAnswers =
                [];


            pendingClaims.clear();


            console.log(
                "ALL QUESTIONS REMOVED:",
                result.rowCount
            );


            res.json({

                success:
                    true,

                deleted:
                    result.rowCount

            });


        } catch (error) {

            console.error(
                "DELETE ALL QUESTIONS ERROR:",
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


// -----------------------------------------------------
// DELETE SINGLE QUESTION
// -----------------------------------------------------

app.delete(
    "/api/questions/:id",
    async (req, res) => {

        const id =
            Number(
                req.params.id
            );


        if (
            !Number.isInteger(id) ||
            id <= 0
        ) {

            return res.status(400).json({

                success:
                    false,

                error:
                    "Invalid question ID"

            });

        }


        if (
            gameState.status ===
            "running"
        ) {

            return res.status(409).json({

                success:
                    false,

                error:
                    "Questions cannot be deleted while a game is running."

            });

        }


        try {

            const result =
                await pool.query(`
                    DELETE FROM questions
                    WHERE id = $1
                `, [
                    id
                ]);


            if (
                result.rowCount ===
                0
            ) {

                return res.status(404).json({

                    success:
                        false,

                    error:
                        "Question not found"

                });

            }


            await loadQuestionsFromDatabase();


            console.log(
                "QUESTION REMOVED:",
                id
            );


            res.json({

                success:
                    true,

                id:
                    id

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


    if (timer) {

        clearInterval(
            timer
        );

        timer =
            null;

    }


    countdown =
        30;


    pendingClaims.clear();


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

        selectedQuestionIds:
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


    gamePosition =
        -1;


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
// BUILD GAME ORDER
// ONLY SELECTED QUESTIONS ARE USED
// =====================================================

function buildGameOrder(
    selectedQuestionIds = []
) {

    /*
    =====================================================
    CLEAN IDS
    =====================================================
    */

    const selectedIds = [
        ...new Set(
            selectedQuestionIds
                .map(Number)
                .filter(
                    id =>
                        Number.isInteger(id) &&
                        id > 0
                )
        )
    ];


    /*
    =====================================================
    FIND DATABASE INDEXES FOR SELECTED QUESTIONS
    =====================================================
    */

    const selectedIndexes =
        safetyQuestionBank
            .map(
                (
                    question,
                    index
                ) => ({

                    question,
                    index

                })
            )
            .filter(
                item =>
                    selectedIds.includes(
                        Number(
                            item.question.id
                        )
                    )
            )
            .map(
                item =>
                    item.index
            );


    /*
    =====================================================
    DON'T BUILD EMPTY GAME
    =====================================================
    */

    if (
        selectedIndexes.length ===
        0
    ) {

        console.warn(
            "BUILD GAME ORDER: NO SELECTED QUESTIONS FOUND"
        );


        gameState.gameOrder =
            [];


        gameState.selectedQuestionIds =
            [];


        return false;

    }


    /*
    =====================================================
    STORE SELECTED IDS
    =====================================================
    */

    gameState.selectedQuestionIds =
        selectedIndexes.map(
            index =>
                Number(
                    safetyQuestionBank[
                        index
                    ].id
                )
        );


    /*
    =====================================================
    GAME ORDER IS ONLY SELECTED QUESTIONS
    =====================================================
    */

    gameState.gameOrder =
        selectedIndexes;


    /*
    =====================================================
    FISHER-YATES SHUFFLE
    =====================================================
    */

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


    /*
    =====================================================
    LOG EXACTLY WHAT WILL BE PLAYED
    =====================================================
    */

    console.log(
        "=========================================="
    );

    console.log(
        "SELECTED QUESTION IDS:",
        selectedIds
    );

    console.log(
        "VALID QUESTION IDS:",
        gameState.selectedQuestionIds
    );

    console.log(
        "QUESTIONS ACTUALLY IN GAME:",
        gameState.gameOrder.map(
            index =>
                safetyQuestionBank[
                    index
                ].id
        )
    );

    console.log(
        "TOTAL SELECTED QUESTIONS:",
        gameState.gameOrder.length
    );

    console.log(
        "=========================================="
    );


    return true;

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


    /*
    =====================================================
    GAME COMPLETE
    =====================================================
    */

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


        io.emit(
            "gameEnded",
            {
                reason:
                    "all questions completed"
            }
        );


        return;

    }


    const index =
        gameState.gameOrder[
            gamePosition
        ];


    /*
    =====================================================
    PROTECT AGAINST INVALID INDEX
    =====================================================
    */

    if (
        !Number.isInteger(index) ||
        index < 0 ||
        index >= safetyQuestionBank.length
    ) {

        console.error(
            "INVALID GAME QUESTION INDEX:",
            index
        );


        resetGame(
            "invalid game question index"
        );


        return;

    }


    const question =
        safetyQuestionBank[
            index
        ];


    if (!question) {

        console.error(
            "QUESTION NOT FOUND:",
            index
        );


        resetGame(
            "question not found"
        );


        return;

    }


    console.log(
        "SENDING QUESTION:",
        question.id,
        question.q
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
        gamePosition + 1;


    gameState.isPaused =
        false;


    /*
    =====================================================
    TRACK CALLED ANSWER
    =====================================================
    */

    if (
        !gameState.calledAnswers.includes(
            question.a
        )
    ) {

        gameState.calledAnswers.push(
            question.a
        );

    }


    /*
    =====================================================
    CHEAT SHEET
    =====================================================
    */

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


    /*
    =====================================================
    GAME STATE
    =====================================================
    */

    io.emit(
        "gameState",
        gameState
    );


    /*
    =====================================================
    TIMER
    =====================================================
    */

    if (
        !gameState.noTimer
    ) {

        countdown =
            Math.max(
                Number(
                    gameState.timerSeconds
                ) || 30,
                1
            );


        io.emit(
            "timerUpdate",
            countdown
        );


        startTimer();

    } else {

        io.emit(
            "timerUpdate",
            0
        );

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
// SEND CURRENT QUESTION TO SOCKET
// =====================================================

function sendQuestionToSocket(
    socket,
    index
) {

    if (
        !Number.isInteger(index) ||
        index < 0 ||
        index >= safetyQuestionBank.length
    ) {

        return;

    }


    const question =
        safetyQuestionBank[
            index
        ];


    if (!question) {
        return;
    }


    /*
    Find the question's position inside
    the selected game order when possible.
    */

    const gameNumber =
        gameState.gameOrder.indexOf(
            index
        );


    socket.emit(
        "cheatSheetQuestion",
        {

            number:
                gameNumber >= 0
                    ? gameNumber + 1
                    : safetyQuestionBank.findIndex(
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


        /*
        =================================================
        SEND CURRENT STATE
        =================================================
        */

        socket.emit(
            "gameState",
            gameState
        );


        /*
        =================================================
        SEND PREVIOUS QUESTIONS
        =================================================
        */

        gameState.askedIndices.forEach(
            index => {

                sendQuestionToSocket(
                    socket,
                    index
                );

            }
        );


        // =================================================
        // REGISTER HOST
        // =================================================

        socket.on(
            "registerHost",
            () => {

                console.log(
                    "HOST REGISTER REQUEST:",
                    socket.id
                );


                if (
                    hostDisconnectTimer
                ) {

                    clearTimeout(
                        hostDisconnectTimer
                    );

                    hostDisconnectTimer =
                        null;

                    console.log(
                        "HOST RECONNECTED - RESET CANCELLED"
                    );

                }


                if (
                    hostSocketId &&
                    hostSocketId !== socket.id
                ) {

                    console.warn(
                        "HOST REGISTRATION REJECTED - HOST ALREADY REGISTERED:",
                        socket.id
                    );


                    socket.emit(
                        "hostRegistrationRejected",
                        {
                            reason:
                                "Another host is already registered."
                        }
                    );


                    return;

                }


                hostSocketId =
                    socket.id;


                console.log(
                    "HOST REGISTERED:",
                    hostSocketId
                );


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

                if (
                    socket.id !==
                    hostSocketId
                ) {

                    return;

                }


                if (!data) {
                    return;
                }


                const seconds =
                    Number(
                        data.seconds
                    );


                /*
                Allow zero when No Timer is selected.
                */

                if (
                    data.noTimer === true
                ) {

                    gameState.timerSeconds =
                        0;

                    gameState.noTimer =
                        true;

                } else {

                    if (
                        !Number.isFinite(seconds) ||
                        seconds <= 0
                    ) {

                        return;

                    }


                    gameState.timerSeconds =
                        Math.floor(
                            seconds
                        );

                    gameState.noTimer =
                        false;

                }


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

                if (
                    socket.id !==
                    hostSocketId
                ) {

                    return;

                }


                if (!data) {
                    return;
                }


                const maxWinners =
                    Number(
                        data.maxWinners
                    );


                if (
                    !Number.isInteger(maxWinners) ||
                    maxWinners < 1
                ) {

                    return;

                }


                gameState.maxWinners =
                    maxWinners;


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
            async data => {

                /*
                =================================================
                ONLY REGISTERED HOST MAY START
                =================================================
                */

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

                    /*
                    ==============================================
                    GET SELECTED QUESTION IDS SENT BY HOST
                    ==============================================
                    */

                    const selectedQuestionIds =
                        Array.isArray(
                            data?.selectedQuestionIds
                        )
                            ? [
                                ...new Set(
                                    data.selectedQuestionIds
                                        .map(Number)
                                        .filter(
                                            id =>
                                                Number.isInteger(id) &&
                                                id > 0
                                        )
                                )
                            ]
                            : [];


                    console.log(
                        "=========================================="
                    );

                    console.log(
                        "HOST SENT SELECTED QUESTION IDS:",
                        selectedQuestionIds
                    );


                    /*
                    ==============================================
                    DON'T START WITH ZERO SELECTED QUESTIONS
                    ==============================================
                    */

                    if (
                        selectedQuestionIds.length ===
                        0
                    ) {

                        console.warn(
                            "GAME START REJECTED: NO QUESTIONS SELECTED"
                        );


                        socket.emit(
                            "gameStartError",
                            {
                                error:
                                    "Please select at least one question before starting the game."
                            }
                        );


                        return;

                    }


                    /*
                    ==============================================
                    ALWAYS LOAD LATEST DATABASE QUESTIONS
                    ==============================================
                    */

                    await loadQuestionsFromDatabase();


                    /*
                    ==============================================
                    VERIFY SELECTED IDS STILL EXIST
                    ==============================================
                    */

                    const validSelectedIds =
                        selectedQuestionIds.filter(
                            selectedId =>
                                safetyQuestionBank.some(
                                    question =>
                                        Number(
                                            question.id
                                        ) ===
                                        Number(
                                            selectedId
                                        )
                                )
                        );


                    console.log(
                        "VALID SELECTED QUESTION IDS:",
                        validSelectedIds
                    );


                    /*
                    ==============================================
                    IF NONE EXIST, DO NOT START
                    ==============================================
                    */

                    if (
                        validSelectedIds.length ===
                        0
                    ) {

                        console.warn(
                            "GAME START REJECTED: SELECTED QUESTIONS DO NOT EXIST"
                        );


                        socket.emit(
                            "gameStartError",
                            {
                                error:
                                    "None of the selected questions still exist."
                            }
                        );


                        return;

                    }


                    /*
                    ==============================================
                    CLEAR OLD GAME DATA
                    ==============================================
                    */

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


                    gameState.currentQuestionIndex =
                        -1;


                    gameState.currentQuestionID =
                        null;


                    gameState.currentQuestion =
                        "";


                    gameState.currentAnswer =
                        "";


                    gameState.currentQuestionNumber =
                        null;


                    /*
                    ==============================================
                    BUILD GAME USING ONLY SELECTED QUESTIONS
                    ==============================================
                    */

                    const built =
                        buildGameOrder(
                            validSelectedIds
                        );


                    if (!built) {

                        console.error(
                            "GAME START FAILED: COULD NOT BUILD SELECTED QUESTION ORDER"
                        );


                        gameState.status =
                            "idle";


                        gameState.gameOrder =
                            [];


                        gameState.selectedQuestionIds =
                            [];


                        socket.emit(
                            "gameStartError",
                            {
                                error:
                                    "Unable to build the selected question list."
                            }
                        );


                        return;

                    }


                    /*
                    ==============================================
                    START AT FIRST QUESTION
                    ==============================================
                    */

                    gamePosition =
                        -1;


                    console.log(
                        "GAME STARTING WITH",
                        gameState.gameOrder.length,
                        "SELECTED QUESTIONS"
                    );


                    console.log(
                        "GAME QUESTION IDS:",
                        gameState.gameOrder.map(
                            index =>
                                safetyQuestionBank[
                                    index
                                ].id
                        )
                    );


                    /*
                    ==============================================
                    SEND FIRST QUESTION
                    ==============================================
                    */

                    sendNextQuestion();


                } catch (error) {

                    console.error(
                        "START GAME ERROR:",
                        error
                    );


                    gameState.status =
                        "idle";


                    socket.emit(
                        "gameStartError",
                        {
                            error:
                                error.message
                        }
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
                    "running"
                ) {

                    return;

                }


                if (
                    gamePosition <= 0
                ) {

                    return;

                }


                /*
                ==========================================
                MOVE BACK ONE POSITION
                ==========================================
                */

                gamePosition--;


                const index =
                    gameState.gameOrder[
                        gamePosition
                    ];


                if (
                    !Number.isInteger(index) ||
                    index < 0 ||
                    index >= safetyQuestionBank.length
                ) {

                    console.error(
                        "PREVIOUS QUESTION INDEX INVALID:",
                        index
                    );


                    return;

                }


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
                    gamePosition + 1;


                gameState.isPaused =
                    false;


                /*
                ==========================================
                STOP OLD TIMER
                ==========================================
                */

                if (timer) {

                    clearInterval(
                        timer
                    );

                    timer =
                        null;

                }


                /*
                ==========================================
                SEND PREVIOUS QUESTION
                ==========================================
                */

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


                io.emit(
                    "gameState",
                    gameState
                );


                /*
                ==========================================
                RESTART TIMER
                ==========================================
                */

                if (
                    !gameState.noTimer
                ) {

                    countdown =
                        Math.max(
                            Number(
                                gameState.timerSeconds
                            ) || 30,
                            1
                        );


                    io.emit(
                        "timerUpdate",
                        countdown
                    );


                    startTimer();

                } else {

                    io.emit(
                        "timerUpdate",
                        0
                    );

                }

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


                if (
                    gameState.status !==
                    "running"
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
                    !gameState.noTimer
                ) {

                    countdown =
                        Math.max(
                            countdown,
                            1
                        );


                    io.emit(
                        "timerUpdate",
                        countdown
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
        // HOST RESET BUTTON
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
        // LEGACY RESET EVENT
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
        // DIGITAL CLAIM WIN
        // =================================================

        socket.on(
            "claimWin",
            data => {

                console.log(
                    "========== BINGO CLAIM RECEIVED ==========",
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


                if (
                    !Number.isInteger(cardId) ||
                    cardId <= 0
                ) {

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


                if (
                    pendingClaims.has(
                        cardId
                    )
                ) {

                    console.log(
                        "BINGO CLAIM IGNORED: CLAIM ALREADY PENDING",
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
                    "WIN REQUEST SENT TO HOST:",
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


                if (
                    !Number.isInteger(id) ||
                    id <= 0
                ) {

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

                    console.log(
                        "CARD ALREADY APPROVED:",
                        id
                    );


                    pendingClaims.delete(
                        id
                    );


                    return;

                }


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


                pendingClaims.delete(
                    id
                );


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


                io.emit(
                    "winApproved",
                    {
                        cardId:
                            id
                    }
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

                }


                io.emit(
                    "gameState",
                    gameState
                );

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


                if (
                    !Number.isInteger(id) ||
                    id <= 0
                ) {

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


                io.emit(
                    "winRejected",
                    {

                        cardId:
                            id,

                        winningPattern:
                            winningPattern

                    }
                );

            }
        );


        // =================================================
        // APPROVE PHYSICAL WIN
        // =================================================

        socket.on(
            "approvePhysicalWin",
            data => {

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


                if (
                    !Number.isInteger(id) ||
                    id <= 0
                ) {

                    return;

                }


                if (
                    gameState.approvedWinnersList.includes(
                        id
                    )
                ) {

                    return;

                }


                if (
                    gameState.approvedWinnersCount >=
                    gameState.maxWinners
                ) {

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

                        cardId:
                            id,

                        winnerCount:
                            gameState.approvedWinnersCount

                    }
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


                if (
                    !Number.isInteger(cardId) ||
                    cardId <= 0
                ) {

                    return;

                }


                console.log(
                    "PHYSICAL WIN REJECTED:",
                    cardId
                );


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


                if (
                    !Number.isInteger(id) ||
                    id <= 0
                ) {

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
                    data.marked === true;


                if (
                    !Number.isInteger(cardId) ||
                    cardId <= 0
                ) {

                    return;

                }


                if (
                    !Number.isInteger(index) ||
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


                /*
                ==============================================
                REMOVE CLAIMS BELONGING TO THIS PLAYER
                ==============================================
                */

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


                /*
                ==============================================
                HOST DISCONNECT
                ==============================================
                */

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


// =====================================================
// START DATABASE FIRST
// =====================================================

async function startServer() {

    try {

        /*
        =================================================
        INITIALIZE DATABASE
        =================================================
        */

        await Promise.resolve(
            initializeDatabase()
        );


        /*
        =================================================
        OPTIONAL QUESTION MIGRATION
        =================================================
        */

        if (
            process.env.MIGRATE_QUESTIONS ===
            "true"
        ) {

            await Promise.resolve(
                require("./migrateQuestions")
            );

        }


        /*
        =================================================
        LOAD QUESTIONS
        =================================================
        */

        await loadQuestionsFromDatabase();


        /*
        =================================================
        START SERVER
        =================================================
        */

        server.listen(
            PORT,
            "0.0.0.0",
            () => {

                console.log(
                    "=========================================="
                );

                console.log(
                    `Safety Bingo running on port ${PORT}`
                );

                console.log(
                    `Questions available: ${safetyQuestionBank.length}`
                );

                console.log(
                    "=========================================="
                );

            }
        );


    } catch (error) {

        console.error(
            "SERVER STARTUP FAILED:",
            error
        );


        process.exit(1);

    }

}


startServer();
