ChatGPT said:
Absolutely. Below are the three full files that need to change. Your existing host.js mute button can stay as you provided it.

These changes make the mute button actually work by synchronizing the mute state through the server and making the display's AudioEngine obey it. The display also starts with the correct mute state after reconnecting.

1. server.js
"use strict";

require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const { pool, initializeDatabase } = require("./database");

initializeDatabase();

if (process.env.MIGRATE_QUESTIONS === "true") {
require("./migrateQuestions");
}

const app = express();
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
cors: {
origin: "*",
methods: ["GET", "POST"]
}
});

app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, "public")));

let safetyQuestionBank = [];

/*

DISPLAY AUDIO MUTE STATE
This is controlled by the host and broadcast to all clients.
The display.js client is responsible for actually muting its
local AudioEngine.
*/
let displayMuted = false;
async function loadQuestionsFromDatabase() {
try {
const result = await pool.query(
"SELECT * FROM questions ORDER BY id ASC"
);

    safetyQuestionBank = result.rows.map(item => ({
        id: Number(item.id),
        category: item.category,
        difficulty: item.difficulty,
        q: item.question,
        a: item.answer
    }));

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

const routes = [
["/", "index.html"],
["/host.html", "host.html"],
["/player.html", "player.html"],
["/display.html", "display.html"],
["/questionManager.html", "questionManager.html"],
["/cheatsheet.html", "cheatsheet.html"],
["/answerkey.html", "answerkey.html"]
];

routes.forEach(([route, file]) => {
app.get(route, (req, res) =>
res.sendFile(path.join(__dirname, file))
);
});

app.get("/api/questions", async (req, res) => {
try {
const result = await pool.query(
"SELECT * FROM questions ORDER BY id ASC"
);

    res.json(result.rows);
} catch (error) {
    console.error(
        "LOAD QUESTIONS ERROR:",
        error
    );

    res.status(500).json({
        success: false,
        error: error.message
    });
}

});

app.post("/api/questions/add", async (req, res) => {
const newQuestion = req.body;

if (!newQuestion.q || !newQuestion.a) {
    return res.status(400).json({
        success: false,
        error: "Question and answer required"
    });
}

try {
    const idResult = await pool.query(
        "SELECT MAX(id) AS maxid FROM questions"
    );

    const nextID =
        Number(idResult.rows[0].maxid || 0) + 1;

    await pool.query(
        `
        INSERT INTO questions
        (id, category, difficulty, question, answer)
        VALUES($1, $2, $3, $4, $5)
        `,
        [
            nextID,
            newQuestion.category || "General",
            newQuestion.difficulty || "Medium",
            newQuestion.q,
            newQuestion.a
        ]
    );

    console.log(
        "QUESTION ADDED:",
        nextID
    );

    res.json({
        success: true,
        id: nextID
    });
} catch (error) {
    console.error(
        "ADD QUESTION ERROR:",
        error
    );

    res.status(500).json({
        success: false,
        error: error.message
    });
}

});

app.delete("/api/questions/:id", async (req, res) => {
const id = Number(req.params.id);

if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({
        success: false,
        error: "Invalid question ID"
    });
}

try {
    const result = await pool.query(
        "DELETE FROM questions WHERE id=$1",
        [id]
    );

    if (result.rowCount === 0) {
        return res.status(404).json({
            success: false,
            error: "Question not found"
        });
    }

    console.log(
        "QUESTION REMOVED:",
        id
    );

    res.json({
        success: true
    });
} catch (error) {
    console.error(
        "DELETE ERROR:",
        error
    );

    res.status(500).json({
        success: false,
        error: error.message
    });
}

});

function createFreshGameState() {
return {
status: "idle",
currentQuestionIndex: -1,
currentQuestion: "",
currentAnswer: "",
currentQuestionID: null,
currentQuestionNumber: null,
currentCategory: "",
currentDifficulty: "",
calledAnswers: [],
askedIndices: [],
gameOrder: [],
selectedQuestionIds: [],
timerSeconds: 30,
noTimer: false,
isPaused: false,
maxWinners: 1,
approvedWinnersCount: 0,
approvedWinnersList: [],
displayMuted: displayMuted
};
}

let gameState = createFreshGameState();

let timer = null;
let countdown = 30;
let gamePosition = -1;

const pendingClaims = new Map();

let hostSocketId = null;

const HOST_RECONNECT_GRACE_MS =
60 * 1000;

let hostReconnectTimer = null;
let hostReconnectPending = false;

function cancelHostReconnectGrace() {
if (hostReconnectTimer) {
clearTimeout(hostReconnectTimer);
hostReconnectTimer = null;
}

hostReconnectPending = false;

console.log(
    "HOST RECONNECTION GRACE PERIOD CANCELLED"
);

}

function startHostReconnectGrace(
disconnectedHostSocketId
) {
if (hostReconnectTimer) {
clearTimeout(hostReconnectTimer);
}

hostReconnectPending = true;

console.log(
    "=========================================="
);
console.log(
    "HOST DISCONNECTED"
);
console.log(
    "STARTING 60 SECOND RECONNECTION GRACE PERIOD"
);
console.log(
    "DISCONNECTED HOST SOCKET:",
    disconnectedHostSocketId
);
console.log(
    "GAME WILL REMAIN ACTIVE DURING GRACE PERIOD"
);
console.log(
    "=========================================="
);

hostReconnectTimer = setTimeout(() => {
    hostReconnectTimer = null;

    if (!hostReconnectPending) {
        return;
    }

    console.log(
        "=========================================="
    );
    console.log(
        "HOST RECONNECTION GRACE PERIOD EXPIRED"
    );
    console.log(
        "RESETTING GAME"
    );
    console.log(
        "=========================================="
    );

    hostReconnectPending = false;

    resetGame(
        "host reconnection grace period expired"
    );

    hostSocketId = null;

    console.log(
        "HOST SLOT RELEASED AFTER 60 SECOND GRACE PERIOD"
    );
}, HOST_RECONNECT_GRACE_MS);

}

function resetGame(reason = "unknown") {
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
    clearInterval(timer);
    timer = null;
}

countdown = 30;

pendingClaims.clear();

gameState =
    createFreshGameState();

gamePosition = -1;

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

/*
 * Make sure every client also knows the
 * current display mute state after reset.
 */
io.emit(
    "displayMuteChanged",
    {
        muted: displayMuted
    }
);

console.log(
    "========== GAME RESET COMPLETE =========="
);

}

function buildGameOrder(
selectedQuestionIds = []
) {
const normalizedIds = [
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

let availableIndices;

if (normalizedIds.length === 0) {
    availableIndices =
        safetyQuestionBank.map(
            (_, index) => index
        );
} else {
    const selectedSet =
        new Set(normalizedIds);

    availableIndices =
        safetyQuestionBank
            .map((q, index) =>
                selectedSet.has(q.id)
                    ? index
                    : null
            )
            .filter(
                index =>
                    index !== null
            );
}

gameState.gameOrder =
    [...availableIndices];

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

console.log(
    "GAME ORDER BUILT:",
    gameState.gameOrder.length,
    "QUESTIONS"
);

}

function sendNextQuestion() {
if (timer) {
clearInterval(timer);
timer = null;
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

    gameState.isPaused =
        false;

    io.emit(
        "gameState",
        gameState
    );

    io.emit(
        "gameEnded",
        {
            reason:
                "questions exhausted"
        }
    );

    return;
}

const index =
    gameState.gameOrder[
        gamePosition
    ];

const question =
    safetyQuestionBank[index];

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
            q.id === question.id
    ) + 1;

gameState.isPaused =
    false;

gameState.displayMuted =
    displayMuted;

if (
    !gameState.calledAnswers.includes(
        question.a
    )
) {
    gameState.calledAnswers.push(
        question.a
    );
}

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
    {
        ...gameState,
        repeatQuestion: false
    }
);

if (!gameState.noTimer) {
    countdown =
        gameState.timerSeconds;

    io.emit(
        "timerUpdate",
        countdown
    );

    startTimer();
} else {
    countdown = 0;

    io.emit(
        "timerUpdate",
        0
    );
}

}

function startTimer() {
if (timer) {
clearInterval(timer);
}

timer = setInterval(() => {
    if (gameState.isPaused) {
        return;
    }

    countdown--;

    io.emit(
        "timerUpdate",
        countdown
    );

    if (countdown <= 0) {
        sendNextQuestion();
    }
}, 1000);

}

io.on("connection", socket => {
console.log(
"CONNECTED:",
socket.id
);

/*
 * Immediately synchronize the new client
 * with the current mute state.
 */
socket.emit(
    "displayMuteChanged",
    {
        muted: displayMuted
    }
);

socket.emit(
    "gameState",
    {
        ...gameState,
        displayMuted: displayMuted
    }
);

gameState.askedIndices.forEach(
    index => {
        const question =
            safetyQuestionBank[index];

        if (!question) return;

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

/*
 * =====================================================
 * DISPLAY MUTE CONTROL
 * =====================================================
 *
 * Only the registered host may change the
 * display audio mute state.
 */
socket.on(
    "setDisplayMute",
    data => {
        if (
            socket.id !==
            hostSocketId
        ) {
            console.warn(
                "DISPLAY MUTE REJECTED FROM NON-HOST:",
                socket.id
            );

            return;
        }

        if (!data) {
            return;
        }

        const muted =
            data.muted === true;

        displayMuted =
            muted;

        gameState.displayMuted =
            displayMuted;

        console.log(
            "DISPLAY AUDIO MUTE:",
            displayMuted
                ? "MUTED"
                : "UNMUTED"
        );

        /*
         * Broadcast to projector and
         * any other connected clients.
         */
        io.emit(
            "displayMuteChanged",
            {
                muted:
                    displayMuted
            }
        );

        /*
         * Also keep gameState synchronized.
         */
        io.emit(
            "gameState",
            {
                ...gameState,
                displayMuted:
                    displayMuted
            }
        );
    }
);

socket.on(
    "registerHost",
    () => {
        console.log(
            "HOST REGISTER REQUEST:",
            socket.id
        );

        if (
            hostReconnectPending
        ) {
            console.log(
                "HOST RECONNECTING DURING GRACE PERIOD:",
                socket.id
            );

            cancelHostReconnectGrace();

            hostSocketId =
                socket.id;

            console.log(
                "HOST RECONNECTED:",
                hostSocketId
            );

            socket.emit(
                "hostRegistered"
            );

            socket.emit(
                "displayMuteChanged",
                {
                    muted:
                        displayMuted
                }
            );

            socket.emit(
                "gameState",
                {
                    ...gameState,
                    displayMuted:
                        displayMuted
                }
            );

            return;
        }

        if (!hostSocketId) {
            hostSocketId =
                socket.id;

            console.log(
                "HOST REGISTERED:",
                hostSocketId
            );

            socket.emit(
                "hostRegistered"
            );

            socket.emit(
                "displayMuteChanged",
                {
                    muted:
                        displayMuted
                }
            );

            socket.emit(
                "gameState",
                {
                    ...gameState,
                    displayMuted:
                        displayMuted
                }
            );

            return;
        }

        if (
            hostSocketId !==
            socket.id
        ) {
            console.log(
                "NEW HOST TAKING OVER:",
                socket.id
            );

            console.log(
                "OLD HOST:",
                hostSocketId
            );

            cancelHostReconnectGrace();

            resetGame(
                "new host connected"
            );

            hostSocketId =
                socket.id;

            console.log(
                "NEW HOST REGISTERED:",
                hostSocketId
            );

            socket.emit(
                "hostRegistered"
            );

            socket.emit(
                "displayMuteChanged",
                {
                    muted:
                        displayMuted
                }
            );

            socket.emit(
                "gameState",
                {
                    ...gameState,
                    displayMuted:
                        displayMuted
                }
            );

            return;
        }

        socket.emit(
            "hostRegistered"
        );

        socket.emit(
            "displayMuteChanged",
            {
                muted:
                    displayMuted
            }
        );

        socket.emit(
            "gameState",
            {
                ...gameState,
                displayMuted:
                    displayMuted
            }
        );
    }
);

socket.on(
    "setTimerSettings",
    data => {
        if (
            socket.id !==
                hostSocketId ||
            !data
        ) {
            return;
        }

        const noTimer =
            data.noTimer === true;

        let seconds =
            Number(data.seconds);

        if (noTimer) {
            seconds = 0;
        } else if (
            !Number.isFinite(
                seconds
            ) ||
            seconds < 1
        ) {
            seconds = 30;
        }

        gameState.timerSeconds =
            seconds;

        gameState.noTimer =
            noTimer;

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

        /*
         * Compatibility event for any
         * existing host/display code.
         */
        io.emit(
            "timerSettingsUpdated",
            {
                seconds:
                    gameState.timerSeconds,

                noTimer:
                    gameState.noTimer
            }
        );
    }
);

socket.on(
    "setWinnerSettings",
    data => {
        if (
            socket.id !==
                hostSocketId ||
            !data
        ) {
            return;
        }

        let maxWinners =
            Number(
                data.maxWinners
            );

        if (
            !Number.isInteger(
                maxWinners
            ) ||
            maxWinners < 1
        ) {
            maxWinners = 1;
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

socket.on(
    "hostStart",
    async data => {
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
                        .map(Number)
                        .filter(
                            id =>
                                Number.isInteger(
                                    id
                                ) &&
                                id > 0
                        );
            }

            selectedQuestionIds = [
                ...new Set(
                    selectedQuestionIds
                )
            ];

            const availableQuestionIds =
                new Set(
                    safetyQuestionBank.map(
                        q => q.id
                    )
                );

            selectedQuestionIds =
                selectedQuestionIds.filter(
                    id =>
                        availableQuestionIds.has(
                            id
                        )
                );

            gameState.selectedQuestionIds =
                [
                    ...selectedQuestionIds
                ];

            if (
                safetyQuestionBank.length ===
                0
            ) {
                socket.emit(
                    "gameStartError",
                    {
                        error:
                            "There are no questions in the database."
                    }
                );

                return;
            }

            pendingClaims.clear();

            gameState.status =
                "running";

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

            gameState.askedIndices =
                [];

            gameState.calledAnswers =
                [];

            gameState.approvedWinnersCount =
                0;

            gameState.approvedWinnersList =
                [];

            gameState.isPaused =
                false;

            gameState.displayMuted =
                displayMuted;

            buildGameOrder(
                gameState.selectedQuestionIds
            );

            if (
                gameState.gameOrder
                    .length === 0
            ) {
                gameState.status =
                    "idle";

                socket.emit(
                    "gameStartError",
                    {
                        error:
                            "None of the selected questions exist in the database."
                    }
                );

                return;
            }

            gamePosition = -1;

            console.log(
                "=========================================="
            );

            console.log(
                "GAME STARTED"
            );

            console.log(
                "SELECTED IDS:",
                gameState.selectedQuestionIds
            );

            console.log(
                "QUESTIONS IN GAME:",
                gameState.gameOrder.length
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
                        "Unable to start game."
                }
            );
        }
    }
);

socket.on(
    "hostNext",
    () => {
        if (
            socket.id !==
                hostSocketId ||
            gameState.status !==
                "running"
        ) {
            return;
        }

        sendNextQuestion();
    }
);

socket.on(
    "hostPrevious",
    () => {
        if (
            socket.id !==
                hostSocketId ||
            gameState.status !==
                "running" ||
            gamePosition <= 0
        ) {
            return;
        }

        if (timer) {
            clearInterval(timer);
            timer = null;
        }

        gamePosition--;

        const index =
            gameState.gameOrder[
                gamePosition
            ];

        const question =
            safetyQuestionBank[index];

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

        gameState.displayMuted =
            displayMuted;

        gameState.isPaused =
            false;

        if (!gameState.noTimer) {
            countdown =
                gameState.timerSeconds;

            io.emit(
                "timerUpdate",
                countdown
            );

            startTimer();
        } else {
            countdown = 0;

            io.emit(
                "timerUpdate",
                0
            );
        }

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
            {
                ...gameState,
                repeatQuestion:
                    false
            }
        );
    }
);

socket.on(
    "hostRepeat",
    () => {
        if (
            socket.id !==
                hostSocketId ||
            gameState.status !==
                "running"
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

socket.on(
    "togglePausePlay",
    () => {
        if (
            socket.id !==
                hostSocketId ||
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
                clearInterval(timer);
                timer = null;
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
            {
                ...gameState,
                displayMuted:
                    displayMuted
            }
        );
    }
);

socket.on(
    "hostReset",
    () => {
        if (
            socket.id !==
            hostSocketId
        ) {
            return;
        }

        console.log(
            "HOST RESET BUTTON:",
            socket.id
        );

        resetGame(
            "host reset button"
        );
    }
);

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
            "========== HOST LEFT GAME =========="
        );

        startHostReconnectGrace(
            socket.id
        );
    }
);

socket.on(
    "claimWin",
    data => {
        if (!data) return;

        const cardId =
            Number(data.cardId);

        if (
            !Number.isInteger(
                cardId
            ) ||
            cardId <= 0
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
            gameState.approvedWinnersCount >=
            gameState.maxWinners
        ) {
            return;
        }

        const claim = {
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
    }
);

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
            Number(cardId);

        if (
            !Number.isInteger(
                id
            ) ||
            id <= 0
        ) {
            return;
        }

        const pendingClaim =
            pendingClaims.get(
                id
            );

        if (!pendingClaim) {
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

        io.emit(
            "winApproved",
            {
                cardId: id
            }
        );

        if (
            gameState.approvedWinnersCount >=
            gameState.maxWinners
        ) {
            gameState.status =
                "ended";

            if (timer) {
                clearInterval(timer);
                timer = null;
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
            {
                ...gameState,
                displayMuted:
                    displayMuted
            }
        );
    }
);

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
            Number(cardId);

        if (
            !Number.isInteger(
                id
            ) ||
            id <= 0
        ) {
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
                cardId: id,
                winningPattern
            }
        );
    }
);

socket.on(
    "approvePhysicalWin",
    data => {
        if (
            socket.id !==
                hostSocketId ||
            !data
        ) {
            return;
        }

        const id =
            Number(data.cardId);

        if (
            !Number.isInteger(
                id
            ) ||
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

        io.emit(
            "physicalWinApproved",
            {
                cardId: id,

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
                clearInterval(timer);
                timer = null;
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
            {
                ...gameState,
                displayMuted:
                    displayMuted
            }
        );
    }
);

socket.on(
    "rejectPhysicalWin",
    data => {
        if (
            socket.id !==
                hostSocketId ||
            !data
        ) {
            return;
        }

        const cardId =
            Number(data.cardId);

        if (
            !Number.isInteger(
                cardId
            ) ||
            cardId <= 0
        ) {
            return;
        }

        io.emit(
            "physicalWinRejected",
            {
                cardId
            }
        );
    }
);

socket.on(
    "loadCard",
    cardId => {
        const id =
            Number(cardId);

        if (
            !Number.isInteger(
                id
            ) ||
            id <= 0
        ) {
            return;
        }

        socket.emit(
            "cardLoaded",
            {
                cardId: id
            }
        );
    }
);

socket.on(
    "markCard",
    data => {
        if (!data) return;

        const cardId =
            Number(data.id);

        const index =
            Number(data.index);

        const marked =
            data.marked === true;

        if (
            !Number.isInteger(
                cardId
            ) ||
            cardId <= 0
        ) {
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
                cardId,
                index,
                marked,
                socketId:
                    socket.id
            }
        );
    }
);

socket.on(
    "requestGameStateSyncFallback",
    () => {
        socket.emit(
            "displayMuteChanged",
            {
                muted:
                    displayMuted
            }
        );

        socket.emit(
            "gameState",
            {
                ...gameState,
                displayMuted:
                    displayMuted
            }
        );
    }
);

socket.on(
    "disconnect",
    () => {
        console.log(
            "DISCONNECTED:",
            socket.id
        );

        for (
            const [
                cardId,
                claim
            ] of pendingClaims.entries()
        ) {
            if (
                claim.playerSocketId ===
                socket.id
            ) {
                pendingClaims.delete(
                    cardId
                );
            }
        }

        if (
            socket.id ===
            hostSocketId
        ) {
            console.log(
                "========== HOST CLOSED/DISCONNECTED =========="
            );

            startHostReconnectGrace(
                socket.id
            );
        }
    }
);

});

const PORT =
process.env.PORT || 3000;

loadQuestionsFromDatabase()
.then(() => {
server.listen(
PORT,
"0.0.0.0",
() => {
console.log(
Safety Bingo running on port ${PORT}
);
}
);
})
.catch(error => {
console.error(
"SERVER STARTUP FAILED:",
error
);

    process.exit(1);
});

2. audioEngine.js
Replace your current audio-engine file with this:

Writing


"use strict";

console.log("SAFETY BINGO AUDIO ENGINE LOADED");

class AudioEngine {
constructor() {
this.voiceEnabled = true;

    /*
     * DISPLAY MUTE STATE
     *
     * This is controlled by the host through
     * the Socket.IO server.
     */
    this.muted = false;

    this.locked = false;
    this.voicesLoaded = false;
    this.selectedVoice = null;

    this.sounds = {
        intro: null,
        whoosh: null,
        ding: null,
        end: null,
        bingo: null
    };

    this.lastSpeech = "";

    this.loadVoices();
}

loadVoices() {
    if (
        !(
            "speechSynthesis" in
            window
        )
    ) {
        console.warn(
            "Speech synthesis unavailable"
        );

        return;
    }

    const load = () => {
        const voices =
            window.speechSynthesis.getVoices();

        if (voices.length) {
            this.voicesLoaded =
                true;

            this.selectedVoice =
                this.findBestVoice(
                    voices
                );

            console.log(
                "VOICE SELECTED:",
                this.selectedVoice?.name
            );
        }
    };

    load();

    window.speechSynthesis.onvoiceschanged =
        load;
}

findBestVoice(voices) {
    const preferred = [
        "Samantha",
        "Ava",
        "Karen",
        "Victoria",
        "Zira",
        "Aria",
        "Jenny",
        "Google US English",
        "Microsoft",
        "Siri"
    ];

    for (
        let name of preferred
    ) {
        const match =
            voices.find(
                voice =>
                    voice.name.includes(
                        name
                    )
            );

        if (match) {
            return match;
        }
    }

    return (
        voices.find(
            v =>
                v.lang ===
                "en-US"
        ) ||
        voices.find(
            v =>
                v.lang.startsWith(
                    "en"
                )
        )
    );
}

/*
 * =====================================================
 * MUTE CONTROL
 * =====================================================
 */

setMuted(muted) {
    this.muted =
        muted === true;

    console.log(
        "DISPLAY AUDIO ENGINE:",
        this.muted
            ? "MUTED"
            : "UNMUTED"
    );

    /*
     * If mute was just activated,
     * immediately stop anything currently speaking.
     */
    if (this.muted) {
        this.stop();
    }
}

isMuted() {
    return this.muted === true;
}

speak(
    text,
    options = {}
) {
    /*
     * MUTE CHECK MUST HAPPEN FIRST.
     *
     * This prevents both normal speech
     * and forced speech from playing.
     */
    if (this.muted) {
        console.log(
            "DISPLAY AUDIO MUTED — SPEECH SUPPRESSED"
        );

        return;
    }

    if (
        !this.voiceEnabled ||
        !text ||
        !(
            "speechSynthesis" in
            window
        )
    ) {
        return;
    }

    if (
        this.locked &&
        !options.force
    ) {
        return;
    }

    this.locked = true;

    window.speechSynthesis.cancel();

    const cleanText =
        text.replace(
            /\s+/g,
            " "
        );

    const speech =
        new SpeechSynthesisUtterance(
            cleanText
        );

    if (
        this.selectedVoice
    ) {
        speech.voice =
            this.selectedVoice;
    }

    speech.rate =
        options.rate ||
        0.82;

    speech.pitch =
        options.pitch ||
        1;

    speech.volume =
        options.volume ||
        1;

    speech.onend = () => {
        this.locked =
            false;
    };

    speech.onerror = () => {
        this.locked =
            false;
    };

    /*
     * Check mute AGAIN immediately before
     * actual playback because the user could
     * have pressed mute during the 150ms delay.
     */
    setTimeout(() => {
        if (this.muted) {
            this.locked =
                false;

            return;
        }

        window.speechSynthesis.speak(
            speech
        );
    }, 150);
}

intro() {
    this.speak(
        "This... is... Safety Standdown Bingo",
        {
            rate: 0.65,
            pitch: 1,
            volume: 1,
            force: true
        }
    );
}

readQuestion(question) {
    if (!question) {
        return;
    }

    this.speak(
        question,
        {
            rate: 0.78,
            pitch: 1,
            force: true
        }
    );
}

readAnswer(answer) {
    if (!answer) {
        return;
    }

    this.speak(
        "The answer is... " +
            answer,
        {
            rate: 0.75,
            pitch: 1,
            force: true
        }
    );
}

gameStart() {
    this.intro();
}

stop() {
    if (
        "speechSynthesis" in
        window
    ) {
        window.speechSynthesis.cancel();
    }

    this.locked =
        false;
}

unlock() {
    /*
     * Do not attempt to create audio
     * while the display is muted.
     */
    if (this.muted) {
        console.log(
            "AUDIO UNLOCK SKIPPED — DISPLAY MUTED"
        );

        return;
    }

    if (
        "speechSynthesis" in
        window
    ) {
        const silent =
            new SpeechSynthesisUtterance(
                ""
            );

        silent.volume =
            0;

        window.speechSynthesis.speak(
            silent
        );
    }

    console.log(
        "AUDIO UNLOCKED"
    );
}

}

window.audioEngine =
new AudioEngine();

document.addEventListener(
"click",
() => {
if (
window.audioEngine
) {
window.audioEngine.unlock();
}
},
{
once: true
}
);

3. display.js
This version removes the incorrect client-side requestNext timer behavior and lets the server remain authoritative for the countdown.

"use strict";

const liveWebsiteAddressUrl =
${window.location.protocol}//${window.location.host};

const socket =
io(liveWebsiteAddressUrl);

let display = null;

let timer = {
max: 30,
current: 30,
interval: null
};

let timerEnabled = true;

let displayMuted = false;

const sweepingColors = [
"#22c55e",
"#fbbf24",
"#f97316",
"#ef4444",
"#3b82f6",
"#a855f7"
];

let continuousColorIndex = 0;
let continuousWaveInterval = null;

let lastQuestion = "";
let lastGameStatus = "";
let lastAudioQuestion = "";
let lastRepeatAudioState = false;

let bingoOverlayActive = false;
let bingoOverlayTimeout = null;

document.addEventListener(
"DOMContentLoaded",
() => {
display =
document.getElementById(
"questionDisplay"
);

    if (!display) {
        console.error(
            "questionDisplay element not found."
        );

        return;
    }

    setupBingoStyles();

    setupDisplayNetworkHandlers();

    setIdleDisplay();
}

);

/* =========================================================
TIMER
========================================================= */

function clearTimer() {
if (timer.interval) {
clearInterval(
timer.interval
);

    timer.interval = null;
}

}

function clearTimerClasses() {
if (!display) return;

display.classList.remove(
    "timer-green",
    "timer-amber",
    "timer-orange",
    "timer-red",
    "timer-dead",
    "timer-paused",
    "swoosh-out",
    "prepare-in",
    "fade-in"
);

}

function forceGreenDisplay() {
if (!display) return;

clearCustomSweepingStyles();

clearTimerClasses();

display.classList.add(
    "timer-green"
);

}

/* =========================================================
DISPLAY AUDIO MUTE
========================================================= */

function setDisplayMuted(
muted
) {
displayMuted =
muted === true;

console.log(
    "PROJECTOR AUDIO:",
    displayMuted
        ? "MUTED"
        : "UNMUTED"
);

if (
    window.audioEngine &&
    typeof window.audioEngine.setMuted ===
        "function"
) {
    window.audioEngine.setMuted(
        displayMuted
    );
} else {
    console.warn(
        "AUDIO ENGINE DOES NOT PROVIDE setMuted()"
    );
}

}

/* =========================================================
IDLE DISPLAY
========================================================= */

function setIdleDisplay() {
if (!display) return;

clearTimer();

lastQuestion = "";
lastAudioQuestion = "";
lastRepeatAudioState =
    false;

clearTimerClasses();

display.className =
    "idle-waiting-mode";

display.textContent =
    "Waiting for host to start...";

startIdleSweepingAnimation();

}

function startIdleSweepingAnimation() {
if (
!display ||
continuousWaveInterval
) {
return;
}

continuousColorIndex =
    0;

applyIdleColor(
    sweepingColors[
        continuousColorIndex
    ]
);

continuousWaveInterval =
    setInterval(() => {
        if (
            !display ||
            !display.classList.contains(
                "idle-waiting-mode"
            )
        ) {
            clearInterval(
                continuousWaveInterval
            );

            continuousWaveInterval =
                null;

            return;
        }

        continuousColorIndex =
            (
                continuousColorIndex +
                1
            ) %
            sweepingColors.length;

        applyIdleColor(
            sweepingColors[
                continuousColorIndex
            ]
        );
    }, 1200);

}

function applyIdleColor(
color
) {
if (!display) return;

display.style.borderColor =
    color;

display.style.boxShadow = `
    0 0 18px ${color},
    0 0 40px ${color},
    0 0 70px ${color},
    0 0 100px ${color},
    inset 0 0 12px ${color},
    0 16px 45px rgba(0,0,0,.6)
`;

}

function clearCustomSweepingStyles() {
if (
continuousWaveInterval
) {
clearInterval(
continuousWaveInterval
);
}

continuousWaveInterval =
    null;

if (display) {
    display.style.borderColor =
        "";

    display.style.boxShadow =
        "";
}

}

/* =========================================================
AUDIO
========================================================= */

function readQuestionOnDisplay(
question
) {
if (!question) return;

if (displayMuted) {
    console.log(
        "DISPLAY MUTED — QUESTION AUDIO SUPPRESSED"
    );

    return;
}

if (!window.audioEngine) {
    console.warn(
        "DISPLAY AUDIO ENGINE NOT AVAILABLE"
    );

    return;
}

if (
    typeof window.audioEngine.readQuestion !==
    "function"
) {
    console.warn(
        "DISPLAY AUDIO ENGINE DOES NOT PROVIDE readQuestion()"
    );

    return;
}

console.log(
    "DISPLAY AUDIO:",
    question
);

window.audioEngine.readQuestion(
    question
);

lastAudioQuestion =
    question;

}

/* =========================================================
SOCKET HANDLERS
========================================================= */

function setupDisplayNetworkHandlers() {

/*
 * DISPLAY MUTE STATE
 */
socket.on(
    "displayMuteChanged",
    data => {
        if (!data) return;

        setDisplayMuted(
            data.muted === true
        );
    }
);

/*
 * TIMER SETTINGS
 */
socket.on(
    "timerSettingsUpdated",
    settings => {
        if (!settings) return;

        timerEnabled =
            !Boolean(
                settings.noTimer
            );

        timer.max =
            Number(
                settings.seconds
            ) || 30;

        if (!timerEnabled) {
            clearTimer();

            forceGreenDisplay();

            return;
        }

        updateTimerUI();
    }
);

/*
 * SERVER TIMER
 *
 * The server is authoritative.
 * display.js does NOT advance the game itself.
 */
socket.on(
    "timerUpdate",
    time => {
        if (
            typeof time !==
            "number"
        ) {
            return;
        }

        timer.current =
            time;

        if (!timerEnabled) {
            forceGreenDisplay();

            return;
        }

        updateTimerUI();
    }
);

/*
 * GAME STATE
 */
socket.on(
    "gameState",
    state => {
        if (
            !state ||
            !display
        ) {
            return;
        }

        /*
         * Always synchronize mute state
         * if it is included in gameState.
         */
        if (
            typeof state.displayMuted ===
            "boolean"
        ) {
            setDisplayMuted(
                state.displayMuted
            );
        }

        if (
            state.status ===
            "idle"
        ) {
            timerEnabled =
                true;

            setIdleDisplay();

            lastGameStatus =
                "idle";

            return;
        }

        if (
            state.status ===
            "running"
        ) {
            if (
                state.noTimer ===
                true
            ) {
                timerEnabled =
                    false;

                clearTimer();

                clearCustomSweepingStyles();

                forceGreenDisplay();
            } else {
                timerEnabled =
                    true;

                if (
                    state.timerSeconds
                ) {
                    timer.max =
                        Number(
                            state.timerSeconds
                        ) || 30;
                }
            }

            const targetText =
                state.currentQuestion ||
                "";

            const questionChanged =
                targetText !==
                lastQuestion;

            const repeatRequested =
                state.repeatQuestion ===
                true;

            /*
             * Audio only occurs when
             * the display is not muted.
             */
            if (
                targetText &&
                (
                    questionChanged ||
                    repeatRequested
                )
            ) {
                readQuestionOnDisplay(
                    targetText
                );
            }

            if (
                questionChanged
            ) {
                lastQuestion =
                    targetText;
            }

            /*
             * PAUSED
             */
            if (
                state.isPaused
            ) {
                clearTimer();

                if (
                    !timerEnabled
                ) {
                    forceGreenDisplay();
                } else {
                    clearCustomSweepingStyles();

                    clearTimerClasses();

                    display.classList.add(
                        "timer-paused"
                    );
                }

                lastGameStatus =
                    "running";

                return;
            }

            /*
             * NEW QUESTION
             */
            if (
                questionChanged
            ) {
                clearCustomSweepingStyles();

                if (
                    state.noTimer ===
                    true
                ) {
                    clearTimer();

                    display.className =
                        "timer-green";

                    display.textContent =
                        targetText;

                    display.style.borderColor =
                        "";

                    display.style.boxShadow =
                        "";

                    display.classList.remove(
                        "timer-red",
                        "timer-dead",
                        "timer-orange",
                        "timer-amber"
                    );

                    display.classList.add(
                        "timer-green"
                    );
                } else {
                    display.className =
                        "timer-green swoosh-out";

                    setTimeout(
                        () => {
                            if (
                                !display
                            ) {
                                return;
                            }

                            display.textContent =
                                targetText;

                            display.className =
                                "timer-green prepare-in";

                            requestAnimationFrame(
                                () => {
                                    requestAnimationFrame(
                                        () => {
                                            if (
                                                !display
                                            ) {
                                                return;
                                            }

                                            display.className =
                                                "timer-green fade-in";

                                            /*
                                             * IMPORTANT:
                                             * Do not start a
                                             * local countdown.
                                             *
                                             * The server owns
                                             * the countdown.
                                             */
                                            if (
                                                !timerEnabled
                                            ) {
                                                forceGreenDisplay();
                                            }
                                        }
                                    );
                                }
                            );
                        },
                        350
                    );
                }
            } else {
                if (
                    state.noTimer ===
                    true
                ) {
                    clearTimer();

                    forceGreenDisplay();
                } else {
                    updateTimerUI();
                }
            }

            lastRepeatAudioState =
                repeatRequested;

            lastGameStatus =
                "running";

            return;
        }

        /*
         * GAME ENDED
         */
        if (
            state.status ===
            "ended"
        ) {
            clearTimer();

            clearCustomSweepingStyles();

            timerEnabled =
                true;

            clearTimerClasses();

            display.className =
                "timer-dead";

            display.textContent =
                "Game Over";

            /*
             * Do not play end audio
             * while display is muted.
             */
            if (
                !displayMuted &&
                window.audioEngine
            ) {
                if (
                    typeof window.audioEngine.play ===
                    "function"
                ) {
                    window.audioEngine.play(
                        "end"
                    );
                }

                if (
                    typeof window.audioEngine.speak ===
                    "function"
                ) {
                    window.audioEngine.speak(
                        "Game over. Thank you for playing Safety Standdown Bingo.",
                        {
                            rate:
                                0.8,
                            force:
                                true
                        }
                    );
                }
            }

            lastGameStatus =
                "ended";

            return;
        }
    }
);

/*
 * SOCKET CONNECTED
 */
socket.on(
    "connect",
    () => {
        console.log(
            "PROJECTOR INTERFACE SYNCHRONIZED TO CENTRAL COMMUNICATOR"
        );

        console.log(
            "DISPLAY SOCKET:",
            liveWebsiteAddressUrl
        );

        /*
         * Ask server for the current
         * game and mute state.
         */
        socket.emit(
            "requestGameStateSyncFallback"
        );
    }
);

/*
 * WIN CELEBRATION
 */
socket.on(
    "winApproved",
    () => {
        showBingoCelebration();
    }
);

socket.on(
    "physicalWinApproved",
    () => {
        showBingoCelebration();
    }
);

}

/* =========================================================
TIMER DISPLAY
========================================================= */

/*

Kept for compatibility with any existing

code that calls startTimer().

The server is now authoritative and this

function does NOT emit requestNext.
*/
function startTimer(
seconds = 30
) {
clearTimer();

if (
!timerEnabled ||
seconds === 0
) {
forceGreenDisplay();

 return;

}

timer.max =
Number(seconds) || 30;

timer.current =
timer.max;

updateTimerUI();

/*

Intentionally no local interval.
The server sends timerUpdate events.
*/
}
function updateTimerUI() {
if (!display) return;

if (!timerEnabled) {
    forceGreenDisplay();

    return;
}

if (
    display.classList.contains(
        "idle-waiting-mode"
    )
) {
    return;
}

clearTimerClasses();

const max =
    Number(timer.max) ||
    30;

const current =
    Number(timer.current) ||
    0;

const ratio =
    current / max;

if (
    ratio > 0.75
) {
    display.classList.add(
        "timer-green"
    );

    return;
}

if (
    ratio > 0.50
) {
    display.classList.add(
        "timer-amber"
    );

    return;
}

if (
    ratio > 0.25
) {
    display.classList.add(
        "timer-orange"
    );

    return;
}

if (
    ratio > 0
) {
    display.classList.add(
        "timer-red"
    );

    return;
}

display.classList.add(
    "timer-dead"
);

}

function pauseDisplay() {
clearTimer();

if (!display) return;

if (!timerEnabled) {
    forceGreenDisplay();

    return;
}

clearCustomSweepingStyles();

clearTimerClasses();

display.classList.add(
    "timer-paused"
);

}

function resumeDisplay() {
if (!display) return;

if (!timerEnabled) {
    forceGreenDisplay();

    return;
}

clearTimerClasses();

display.classList.add(
    "timer-green"
);

/*
 * Do not create a local countdown.
 * The server will continue sending
 * timerUpdate events.
 */

}

/* =========================================================
BINGO CELEBRATION STYLES
========================================================= */

function setupBingoStyles() {
if (
document.getElementById(
"displayBingoStyles"
)
) {
return;
}

const style =
    document.createElement(
        "style"
    );

style.id =
    "displayBingoStyles";

style.textContent = `
    .display-bingo-overlay {
        position: fixed;
        inset: 0;
        width: 100vw;
        height: 100vh;
        height: 100dvh;
        background: radial-gradient(
            circle at center,
            rgba(20,20,20,.70),
            rgba(0,0,0,.94)
        );
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        z-index: 999999;
        overflow: hidden;
        pointer-events: none;
        opacity: 1;
    }

    .display-bingo-title {
        position: relative;
        z-index: 1000000;
        font-family: Arial Black, Impact, Arial, sans-serif;
        font-size: clamp(70px, 12vw, 150px);
        line-height: .9;
        font-weight: 900;
        letter-spacing: .06em;
        color: #FFD84D;
        text-align: center;
        text-shadow:
            0 0 10px #fff3a1,
            0 0 25px #FFD84D,
            0 0 50px #ffae00,
            0 0 90px #ff6a00;
        transform: scale(.55);
        opacity: 0;
        animation:
            bingoTitleEnter .55s cubic-bezier(.2,.9,.3,1.25) forwards,
            bingoTitlePulse 1.1s ease-in-out .55s infinite alternate;
    }

    .display-bingo-sub {
        position: relative;
        z-index: 1000000;
        margin-top: 25px;
        font-family: Arial, sans-serif;
        font-size: clamp(24px, 4vw, 42px);
        font-weight: 900;
        letter-spacing: .12em;
        color: white;
        text-align: center;
        text-shadow:
            0 0 10px white,
            0 0 25px #FFD84D;
        opacity: 0;
        animation: bingoSubEnter .55s ease-out .45s forwards;
    }

    .display-confetti {
        position: absolute;
        top: -30px;
        z-index: 999999;
        pointer-events: none;
        will-change: transform, opacity;
    }

    @keyframes bingoTitleEnter {
        0% {
            opacity: 0;
            transform: scale(.55) rotate(-4deg);
        }

        65% {
            opacity: 1;
            transform: scale(1.12) rotate(1deg);
        }

        100% {
            opacity: 1;
            transform: scale(1) rotate(0deg);
        }
    }

    @keyframes bingoTitlePulse {
        from {
            filter: brightness(1);
        }

        to {
            filter: brightness(1.35);
        }
    }

    @keyframes bingoSubEnter {
        from {
            opacity: 0;
            transform: translateY(15px);
        }

        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    @keyframes displayConfettiFall {
        0% {
            transform: translate3d(0, -5vh, 0) rotate(0deg);
            opacity: 1;
        }

        100% {
            transform: translate3d(0, 105vh, 0) rotate(720deg);
            opacity: 0;
        }
    }
`;

document.head.appendChild(
    style
);

}

/* =========================================================
BINGO CELEBRATION
========================================================= */

function showBingoCelebration() {
if (
bingoOverlayActive
) {
return;
}

bingoOverlayActive =
    true;

if (
    bingoOverlayTimeout
) {
    clearTimeout(
        bingoOverlayTimeout
    );
}

/*
 * Respect display mute for
 * celebration audio as well.
 */
if (
    !displayMuted &&
    window.audioEngine
) {
    if (
        typeof window.audioEngine.play ===
        "function"
    ) {
        window.audioEngine.play(
            "bingo"
        );
    }

    if (
        typeof window.audioEngine.speak ===
        "function"
    ) {
        window.audioEngine.speak(
            "Bingo! We have a winner!",
            {
                rate:
                    0.9,
                force:
                    true
            }
        );
    }
}

const overlay =
    document.createElement(
        "div"
    );

overlay.className =
    "display-bingo-overlay";

const title =
    document.createElement(
        "div"
    );

title.className =
    "display-bingo-title";

title.textContent =
    "BINGO!";

const sub =
    document.createElement(
        "div"
    );

sub.className =
    "display-bingo-sub";

sub.textContent =
    "SAFETY STANDDOWN WINNER!";

overlay.appendChild(
    title
);

overlay.appendChild(
    sub
);

document.body.appendChild(
    overlay
);

const confettiColors = [
    "#FFD84D",
    "#22c55e",
    "#3b82f6",
    "#ef4444",
    "#a855f7",
    "#ffffff",
    "#f97316"
];

for (
    let i = 0;
    i < 90;
    i++
) {
    const confetti =
        document.createElement(
            "div"
        );

    confetti.className =
        "display-confetti";

    const size =
        Math.floor(
            Math.random() *
                10
        ) + 8;

    confetti.style.width =
        `${size}px`;

    confetti.style.height =
        `${size * 0.6}px`;

    confetti.style.backgroundColor =
        confettiColors[
            Math.floor(
                Math.random() *
                    confettiColors.length
            )
        ];

    confetti.style.left =
        `${Math.random() * 100}vw`;

    const duration =
        Math.random() * 2 +
        2.5;

    const delay =
        Math.random() * 1.5;

    confetti.style.animation =
        `displayConfettiFall ${duration}s linear ${delay}s forwards`;

    overlay.appendChild(
        confetti
    );
}

bingoOverlayTimeout =
    setTimeout(() => {
        if (
            overlay &&
            overlay.parentNode
        ) {
            overlay.parentNode.removeChild(
                overlay
            );
        }

        bingoOverlayActive =
            false;
    }, 7000);

}

/* =========================================================
GLOBAL EXPORT
========================================================= */
