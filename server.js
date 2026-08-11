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

app.use(express.json());

const server =
    http.createServer(app);

const io =
    new Server(
        server,
        {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        }
    );


// =====================================================
// STATIC FILES
// =====================================================

app.use(
    express.static(__dirname)
);

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);


// =====================================================
// QUESTION DATABASE
// =====================================================

let safetyQuestionBank = [];


/*
=====================================================
LOAD QUESTIONS FROM DATABASE
=====================================================
*/

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


            /*
            Reload the in-memory question bank.
            */

            await loadQuestionsFromDatabase();


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


        if (!Number.isInteger(id) || id <= 0) {

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


            await loadQuestionsFromDatabase();


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
// DELETE ALL QUESTIONS
// =====================================================

app.delete(
    "/api/questions",
    async (req, res) => {

        try {

            await pool.query(
                `
                DELETE FROM questions
                `
            );


            safetyQuestionBank =
                [];


            console.log(
                "ALL QUESTIONS DELETED"
            );


            res.json({

                success:
                    true

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


/*
Pending digital Bingo claims.

cardId -> claim
*/

const pendingClaims =
    new Map();


// =====================================================
// HOST TRACKING
// =====================================================

let hostSocketId =
    null;

let hostDisconnectTimer =
    null;


/*
=====================================================
HOST RECONNECT GRACE PERIOD

This is only used for an unexpected socket
disconnect.

An intentional hostLeftGame releases the
host immediately.
=====================================================
*/

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


    /*
    ==========================================
    STOP SERVER TIMER
    ==========================================
    */

    if (timer) {

        clearInterval(
            timer
        );

        timer =
            null;

    }


    countdown =
        30;


    /*
    ==========================================
    CLEAR PENDING CLAIMS
    ==========================================
    */

    pendingClaims.clear();


    console.log(
        "PENDING DIGITAL CLAIMS CLEARED"
    );


    /*
    ==========================================
    RESET GAME STATE
    ==========================================
    */

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


    /*
    ==========================================
    RESET POSITION
    ==========================================
    */

    gamePosition =
        -1;


    /*
    ==========================================
    TELL EVERY CLIENT
    ==========================================
    */

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
// =====================================================

function buildGameOrder() {

    gameState.gameOrder =
        [];


    /*
    ==========================================
    USE SELECTED QUESTIONS IF PROVIDED
    ==========================================
    */

    let availableIndices = [];


    if (
        Array.isArray(
            gameState.selectedQuestionIds
        ) &&
        gameState.selectedQuestionIds.length > 0
    ) {

        const selectedIds =
            new Set(
                gameState.selectedQuestionIds.map(
                    Number
                )
            );


        for (
            let i = 0;
            i < safetyQuestionBank.length;
            i++
        ) {

            if (
                selectedIds.has(
                    Number(
                        safetyQuestionBank[i].id
                    )
                )
            ) {

                availableIndices.push(
                    i
                );

            }

        }


    } else {

        /*
        ==========================================
        NO SELECTION = ALL QUESTIONS
        ==========================================
        */

        for (
            let i = 0;
            i < safetyQuestionBank.length;
            i++
        ) {

            availableIndices.push(
                i
            );

        }

    }


    /*
    ==========================================
    SHUFFLE
    ==========================================
    */

    for (
        let i =
            availableIndices.length - 1;

        i > 0;

        i--
    ) {

        const j =
            Math.floor(
                Math.random() *
                (i + 1)
            );


        [
            availableIndices[i],
            availableIndices[j]
        ] = [
            availableIndices[j],
            availableIndices[i]
        ];

    }


    gameState.gameOrder =
        availableIndices;


    console.log(
        "GAME ORDER BUILT:",
        gameState.gameOrder.length,
        "QUESTIONS"
    );

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
    ==========================================
    NO MORE QUESTIONS
    ==========================================
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


    /*
    ==========================================
    QUESTION STATE
    ==========================================
    */

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
        gameState.askedIndices.length;


    gameState.isPaused =
        false;


    /*
    ==========================================
    CALLED ANSWERS
    ==========================================
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
    ==========================================
    CHEAT SHEET
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


    /*
    ==========================================
    GAME STATE
    ==========================================
    */

    io.emit(
        "gameState",
        gameState
    );


    /*
    ==========================================
    TIMER
    ==========================================
    */

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

    } else {

        io.emit(
            "timerUpdate",
            0
        );

    }

}


// =====================================================
// SEND PREVIOUS QUESTION
// =====================================================

function sendPreviousQuestion() {

    if (
        gamePosition <= 0
    ) {

        return;

    }


    if (timer) {

        clearInterval(
            timer
        );

        timer =
            null;

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

        console.error(
            "PREVIOUS QUESTION NOT FOUND:",
            index
        );

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


    /*
    The question's position in the shuffled game,
    not its database ID, determines the displayed
    question number.
    */

    gameState.currentQuestionNumber =
        gamePosition + 1;


    gameState.isPaused =
        false;


    io.emit(
        "gameState",
        gameState
    );


    /*
    Restart timer when appropriate.
    */

    if (
        !gameState.noTimer &&
        gameState.status ===
        "running"
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


        /*
        ==========================================
        SEND CURRENT STATE
        ==========================================
        */

        socket.emit(
            "gameState",
            gameState
        );


        /*
        ==========================================
        SEND PREVIOUS QUESTIONS
        ==========================================
        */

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
                            gameState.askedIndices.indexOf(
                                index
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
        // =================================================

        socket.on(
            "registerHost",
            () => {

                console.log(
                    "HOST REGISTER REQUEST:",
                    socket.id
                );


                /*
                ==========================================
                CANCEL PENDING DISCONNECT RESET
                ==========================================
                */

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


                /*
                ==========================================
                HOST TAKEOVER

                A newly connected host becomes the
                active host.

                This is intentional.

                It prevents the old browser session
                from permanently locking the game.
                ==========================================
                */

                if (
                    hostSocketId &&
                    hostSocketId !== socket.id
                ) {

                    console.warn(
                        "REPLACING PREVIOUS HOST:",
                        hostSocketId,
                        "WITH:",
                        socket.id
                    );

                }


                hostSocketId =
                    socket.id;


                console.log(
                    "HOST REGISTERED:",
                    hostSocketId
                );


                /*
                ==========================================
                CONFIRM TO CLIENT
                ==========================================
                */

                socket.emit(
                    "hostRegistered"
                );


                /*
                ==========================================
                SEND CURRENT STATE
                ==========================================
                */

                socket.emit(
                    "gameState",
                    gameState
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


                if (
                    socket.id !==
                    hostSocketId
                ) {

                    console.warn(
                        "TIMER SETTINGS REJECTED - NOT HOST:",
                        socket.id
                    );

                    return;

                }


                const seconds =
                    Number(
                        data.seconds
                    );


                gameState.timerSeconds =
                    Number.isFinite(
                        seconds
                    ) &&
                    seconds > 0
                        ? seconds
                        : 30;


                gameState.noTimer =
                    data.noTimer ===
                    true;


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


                if (
                    socket.id !==
                    hostSocketId
                ) {

                    console.warn(
                        "WINNER SETTINGS REJECTED - NOT HOST:",
                        socket.id
                    );

                    return;

                }


                const maxWinners =
                    Number(
                        data.maxWinners
                    );


                gameState.maxWinners =
                    Number.isInteger(
                        maxWinners
                    ) &&
                    maxWinners > 0
                        ? maxWinners
                        : 1;


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
                ==========================================
                ONLY CURRENT HOST
                ==========================================
                */

                if (
                    socket.id !==
                    hostSocketId
                ) {

                    console.warn(
                        "HOST START REJECTED - NOT HOST:",
                        socket.id
                    );

                    socket.emit(
                        "gameStartError",
                        {
                            error:
                                "This browser is not the registered host."
                        }
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


                    if (
                        safetyQuestionBank.length ===
                        0
                    ) {

                        socket.emit(
                            "gameStartError",
                            {
                                error:
                                    "No questions are loaded in the database."
                            }
                        );

                        return;

                    }


                    /*
                    ==========================================
                    SELECTED QUESTION IDS
                    ==========================================
                    */

                    let selectedQuestionIds =
                        [];


                    if (
                        data &&
                        Array.isArray(
                            data.selectedQuestionIds
                        )
                    ) {

                        selectedQuestionIds =
                            data.selectedQuestionIds
                                .map(
                                    Number
                                )
                                .filter(
                                    id =>
                                        Number.isInteger(id) &&
                                        id > 0
                                );


                        selectedQuestionIds =
                            [
                                ...new Set(
                                    selectedQuestionIds
                                )
                            ];

                    }


                    /*
                    ==========================================
                    VALIDATE SELECTION AGAINST DATABASE
                    ==========================================
                    */

                    if (
                        selectedQuestionIds.length > 0
                    ) {

                        const validIds =
                            new Set(
                                safetyQuestionBank.map(
                                    q =>
                                        Number(
                                            q.id
                                        )
                                )
                            );


                        selectedQuestionIds =
                            selectedQuestionIds.filter(
                                id =>
                                    validIds.has(
                                        id
                                    )
                            );

                    }


                    gameState.selectedQuestionIds =
                        selectedQuestionIds;


                    /*
                    ==========================================
                    CLEAR OLD GAME DATA
                    ==========================================
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


                    gameState.currentQuestion =
                        "";


                    gameState.currentAnswer =
                        "";


                    gameState.currentQuestionID =
                        null;


                    gameState.currentQuestionNumber =
                        null;


                    gameState.currentCategory =
                        "";


                    gameState.currentDifficulty =
                        "";


                    gameState.isPaused =
                        false;


                    buildGameOrder();


                    if (
                        gameState.gameOrder.length ===
                        0
                    ) {

                        gameState.status =
                            "idle";


                        socket.emit(
                            "gameStartError",
                            {
                                error:
                                    "No valid questions were selected."
                            }
                        );


                        return;

                    }


                    gamePosition =
                        -1;


                    console.log(
                        "=========================================="
                    );

                    console.log(
                        "NEW GAME STARTED"
                    );

                    console.log(
                        "HOST:",
                        socket.id
                    );

                    console.log(
                        "QUESTIONS:",
                        gameState.gameOrder.length
                    );

                    console.log(
                        "SELECTED IDS:",
                        gameState.selectedQuestionIds
                    );

                    console.log(
                        "=========================================="
                    );


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
                                error.message ||
                                "Unable to start game."
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


                sendPreviousQuestion();

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


                /*
                IMPORTANT:

                hostReset resets the GAME,
                but does NOT release the host.

                This is correct for the RESET GAME
                button.

                HOME uses hostLeftGame instead.
                */

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

                /*
                ==========================================
                ONLY CURRENT HOST CAN RELEASE HOST ROLE
                ==========================================
                */

                if (
                    socket.id !==
                    hostSocketId
                ) {

                    console.warn(
                        "HOST LEFT REJECTED - NOT CURRENT HOST:",
                        socket.id
                    );

                    return;

                }


                console.log(
                    "=========================================="
                );

                console.log(
                    "HOST LEFT GAME:",
                    socket.id
                );

                console.log(
                    "RELEASING HOST ROLE"
                );

                console.log(
                    "=========================================="
                );


                /*
                ==========================================
                RELEASE HOST IMMEDIATELY
                ==========================================
                */

                hostSocketId =
                    null;


                /*
                ==========================================
                CANCEL PENDING DISCONNECT RESET
                ==========================================
                */

                if (
                    hostDisconnectTimer
                ) {

                    clearTimeout(
                        hostDisconnectTimer
                    );

                    hostDisconnectTimer =
                        null;

                }


                /*
                ==========================================
                RESET GAME
                ==========================================
                */

                resetGame(
                    "hostLeftGame event"
                );


                console.log(
                    "HOST ROLE RELEASED"
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


                if (!Number.isInteger(cardId) || cardId <= 0) {

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


                if (!Number.isInteger(id) || id <= 0) {

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


                if (!Number.isInteger(id) || id <= 0) {

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


                if (!Number.isInteger(id) || id <= 0) {

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


                if (!Number.isInteger(cardId) || cardId <= 0) {

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


                if (!Number.isInteger(id) || id <= 0) {

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
            reason => {

                console.log(
                    "DISCONNECTED:",
                    socket.id,
                    reason
                );


                /*
                ==========================================
                REMOVE DISCONNECTED PLAYER CLAIMS
                ==========================================
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
                ==========================================
                HOST DISCONNECT
                ==========================================
                */

                if (
                    socket.id ===
                    hostSocketId
                ) {

                    console.log(
                        "========== HOST DISCONNECTED =========="
                    );


                    /*
                    Do NOT immediately clear hostSocketId.

                    This allows a temporary network
                    disconnect to reconnect.
                    */

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


                                /*
                                ==================================
                                ONLY RESET IF THIS SAME SOCKET
                                IS STILL THE REGISTERED HOST.

                                A new host may have already taken
                                over during the grace period.
                                ==================================
                                */

                                if (
                                    hostSocketId ===
                                    socket.id
                                ) {

                                    console.log(
                                        "HOST DID NOT RECONNECT - RELEASING HOST"
                                    );


                                    hostSocketId =
                                        null;


                                    resetGame(
                                        "host disconnected"
                                    );


                                } else {

                                    console.log(
                                        "HOST DISCONNECT TIMER FIRED - NEW HOST ALREADY ACTIVE"
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


async function startServer() {

    try {

        /*
        ==========================================
        INITIALIZE DATABASE FIRST
        ==========================================
        */

        await initializeDatabase();


        /*
        ==========================================
        OPTIONAL QUESTION MIGRATION
        ==========================================
        */

        if (
            process.env.MIGRATE_QUESTIONS ===
            "true"
        ) {

            console.log(
                "MIGRATE_QUESTIONS ENABLED"
            );


            /*
            migrateQuestions.js calls initializeDatabase()
            and handles its own pool shutdown in the original
            version, so we intentionally do not automatically
            require it here.

            Run:
                npm run migrate

            separately when migration is needed.
            */

        }


        /*
        ==========================================
        LOAD QUESTION DATABASE
        ==========================================
        */

        await loadQuestionsFromDatabase();


        /*
        ==========================================
        START HTTP/SOCKET SERVER
        ==========================================
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
                    `Questions loaded: ${safetyQuestionBank.length}`
                );

                console.log(
                    "Host registration system: READY"
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
