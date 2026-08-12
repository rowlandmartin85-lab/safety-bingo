"use strict";

// =====================================================
// SAFETY BINGO SERVER
// FULL CONSOLIDATED SERVER.JS
// =====================================================

require("dotenv").config();

const express = require("express");
const http = require("http");
const crypto = require("crypto");
const { Server } = require("socket.io");
const path = require("path");

const {
pool,
initializeDatabase
} = require("./database");

// =====================================================
// DATABASE STARTUP
// =====================================================

initializeDatabase();

if (process.env.MIGRATE_QUESTIONS === "true") {
require("./migrateQuestions");
}

// =====================================================
// SERVER SETUP
// =====================================================

const app = express();

app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
cors: {
origin: "*",
methods: ["GET", "POST"]
}
});

// =====================================================
// STATIC FILES
// =====================================================

app.use(express.static(__dirname));

app.use(
express.static(
path.join(__dirname, "public")
)
);

// =====================================================
// HOST SESSION COOKIE
// =====================================================
//
// This prevents a returning Host Control page from
// being treated as a completely different host.
//
// The cookie is created when /host.html is opened.
// It survives leaving Host Control and coming back.
//
// =====================================================

const HOST_COOKIE_NAME = "safetyBingoHostSession";

function createHostSessionId() {
return crypto.randomBytes(32).toString("hex");
}

function getCookieValue(req, name) {

```
const cookieHeader =
    req.headers.cookie;

if (!cookieHeader) {
    return null;
}

const cookies =
    cookieHeader.split(";");

for (const cookie of cookies) {

    const parts =
        cookie.trim().split("=");

    const key =
        parts.shift();

    const value =
        parts.join("=");

    if (key === name) {
        return decodeURIComponent(value || "");
    }
}

return null;
```

}

// =====================================================
// QUESTION DATABASE
// =====================================================

let safetyQuestionBank = [];

async function loadQuestionsFromDatabase() {

```
try {

    const result =
        await pool.query(`
            SELECT *
            FROM questions
            ORDER BY id ASC
        `);

    safetyQuestionBank =
        result.rows.map(item => ({
            id: item.id,
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
```

}

// =====================================================
// PAGE ROUTES
// =====================================================

app.get("/", (req, res) => {

```
res.sendFile(
    path.join(
        __dirname,
        "index.html"
    )
);
```

});

app.get("/host.html", (req, res) => {

```
/*
-----------------------------------------------------
Give this browser a persistent host session ID.
-----------------------------------------------------
*/

let hostSession =
    getCookieValue(
        req,
        HOST_COOKIE_NAME
    );

if (!hostSession) {

    hostSession =
        createHostSessionId();

    res.cookie(
        HOST_COOKIE_NAME,
        hostSession,
        {
            httpOnly: true,
            secure: true,
            sameSite: "lax",
            maxAge:
                1000 *
                60 *
                60 *
                24 *
                30,
            path: "/"
        }
    );

    console.log(
        "NEW HOST SESSION CREATED"
    );

} else {

    console.log(
        "EXISTING HOST SESSION RETURNED"
    );

}

res.sendFile(
    path.join(
        __dirname,
        "host.html"
    )
);
```

});

app.get("/player.html", (req, res) => {

```
res.sendFile(
    path.join(
        __dirname,
        "player.html"
    )
);
```

});

app.get("/display.html", (req, res) => {

```
res.sendFile(
    path.join(
        __dirname,
        "display.html"
    )
);
```

});

app.get("/questionManager.html", (req, res) => {

```
res.sendFile(
    path.join(
        __dirname,
        "questionManager.html"
    )
);
```

});

app.get("/cheatsheet.html", (req, res) => {

```
res.sendFile(
    path.join(
        __dirname,
        "cheatsheet.html"
    )
);
```

});

// =====================================================
// QUESTION API
// =====================================================

app.get(
"/api/questions",
async (req, res) => {

```
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
            success: false,
            error: error.message
        });

    }

}
```

);

// =====================================================
// ADD QUESTION
// =====================================================

app.post(
"/api/questions/add",
async (req, res) => {

```
    const newQuestion =
        req.body;

    if (
        !newQuestion.q ||
        !newQuestion.a
    ) {

        return res.status(400).json({
            success: false,
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

        await pool.query(`
            INSERT INTO questions
            (
                id,
                category,
                difficulty,
                question,
                answer
            )
            VALUES($1,$2,$3,$4,$5)
        `, [

            nextID,

            newQuestion.category ||
                "General",

            newQuestion.difficulty ||
                "Medium",

            newQuestion.q,

            newQuestion.a

        ]);

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

}
```

);

// =====================================================
// DELETE QUESTION
// =====================================================

app.delete(
"/api/questions/:id",
async (req, res) => {

```
    const id =
        Number(
            req.params.id
        );

    if (!id) {

        return res.status(400).json({
            success: false,
            error:
                "Invalid question ID"
        });

    }

    try {

        const result =
            await pool.query(`
                DELETE FROM questions
                WHERE id=$1
            `, [
                id
            ]);

        if (
            result.rowCount === 0
        ) {

            return res.status(404).json({
                success: false,
                error:
                    "Question not found"
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

}
```

);

// =====================================================
// GAME STATE
// =====================================================

let gameState = {

```
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

timerSeconds: 30,

noTimer: false,

isPaused: false,

maxWinners: 1,

approvedWinnersCount: 0,

approvedWinnersList: [],

selectedQuestionIds: []
```

};

// =====================================================
// SERVER GAME VARIABLES
// =====================================================

let timer = null;

let countdown = 30;

let gamePosition = -1;

const pendingClaims = new Map();

// =====================================================
// HOST TRACKING
// =====================================================

let hostSocketId = null;

let hostSessionId = null;

let hostDisconnectTimer = null;

const HOST_RECONNECT_GRACE_PERIOD = 10000;

// =====================================================
// PHYSICAL QR CLAIM TRACKING
// =====================================================

const pendingPhysicalClaims =
new Map();

// =====================================================
// RESET GAME
// =====================================================

function resetGame(
reason = "unknown"
) {

```
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

    timer = null;

}

countdown = 30;

pendingClaims.clear();

pendingPhysicalClaims.clear();

gameState = {

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

    timerSeconds: 30,

    noTimer: false,

    isPaused: false,

    maxWinners: 1,

    approvedWinnersCount: 0,

    approvedWinnersList: [],

    selectedQuestionIds: []

};

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

console.log(
    "========== GAME RESET COMPLETE =========="
);
```

}

// =====================================================
// BUILD GAME ORDER
// =====================================================

function buildGameOrder() {

```
gameState.gameOrder = [];

const selectedIds =
    Array.isArray(
        gameState.selectedQuestionIds
    )
        ? gameState.selectedQuestionIds
        : [];

if (
    selectedIds.length > 0
) {

    selectedIds.forEach(
        id => {

            const index =
                safetyQuestionBank.findIndex(
                    q =>
                        Number(q.id) ===
                        Number(id)
                );

            if (
                index >= 0
            ) {

                gameState.gameOrder.push(
                    index
                );

            }

        }
    );

}

if (
    gameState.gameOrder.length === 0
) {

    for (
        let i = 0;
        i < safetyQuestionBank.length;
        i++
    ) {

        gameState.gameOrder.push(
            i
        );

    }

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

console.log(
    "GAME ORDER BUILT:",
    gameState.gameOrder
);
```

}

// =====================================================
// SEND NEXT QUESTION
// =====================================================

function sendNextQuestion() {

```
if (timer) {

    clearInterval(
        timer
    );

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
```

}

// =====================================================
// START TIMER
// =====================================================

function startTimer() {

```
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
```

}

// =====================================================
// PHYSICAL QR CLAIM PAGE
// =====================================================
//
// QR example:
//
// https://safety-bingo.onrender.com/physical-claim?card=27
//
// =====================================================

app.get(
"/physical-claim",
(req, res) => {

```
    const cardId =
        Number(
            req.query.card
        );

    if (
        !Number.isInteger(cardId) ||
        cardId <= 0
    ) {

        return res.status(400).send(`
```

<!DOCTYPE html>

<html>
<head>
<meta charset="UTF-8">
<meta name="viewport"
content="width=device-width,initial-scale=1.0">
<title>Safety Bingo</title>
</head>

<body style="
margin:0;
min-height:100vh;
display:flex;
justify-content:center;
align-items:center;
background:#050914;
color:white;
font-family:Arial,sans-serif;
text-align:center;
">

<div>

<h1>Invalid Bingo Card</h1>

<p>
This QR code does not contain a valid Card ID.
</p>

</div>

</body>
</html>

```
        `);

    }

    console.log(
        "=========================================="
    );

    console.log(
        "PHYSICAL QR SCAN RECEIVED:",
        cardId
    );

    console.log(
        "=========================================="
    );

    if (
        !hostSocketId
    ) {

        console.warn(
            "PHYSICAL CLAIM REJECTED: NO HOST"
        );

        return res.status(503).send(`
```

<!DOCTYPE html>

<html>
<head>
<meta charset="UTF-8">
<meta name="viewport"
content="width=device-width,initial-scale=1.0">
<title>Safety Bingo</title>
</head>

<body style="
margin:0;
min-height:100vh;
display:flex;
justify-content:center;
align-items:center;
background:#050914;
color:white;
font-family:Arial,sans-serif;
text-align:center;
">

<div>

<h1 style="color:#FFD700;">
HOST NOT AVAILABLE
</h1>

<p>
The Bingo host is not currently connected.
</p>

<p>
Please notify the host and try again.
</p>

</div>

</body>
</html>

```
        `);

    }

    if (
        gameState.status !==
        "running"
    ) {

        console.warn(
            "PHYSICAL CLAIM REJECTED: GAME NOT RUNNING"
        );

        return res.status(409).send(`
```

<!DOCTYPE html>

<html>
<head>
<meta charset="UTF-8">
<meta name="viewport"
content="width=device-width,initial-scale=1.0">
<title>Safety Bingo</title>
</head>

<body style="
margin:0;
min-height:100vh;
display:flex;
justify-content:center;
align-items:center;
background:#050914;
color:white;
font-family:Arial,sans-serif;
text-align:center;
">

<div>

<h1 style="color:#FFD700;">
GAME NOT ACTIVE
</h1>

<p>
There is no active Bingo game right now.
</p>

</div>

</body>
</html>

```
        `);

    }

    const claim = {

        cardId:
            cardId,

        timestamp:
            Date.now(),

        status:
            "pending"

    };

    pendingPhysicalClaims.set(
        cardId,
        claim
    );

    console.log(
        "PHYSICAL CLAIM STORED:",
        claim
    );

    io.to(
        hostSocketId
    ).emit(
        "physicalWinRequested",
        {

            cardId:
                cardId,

            timestamp:
                claim.timestamp

        }
    );

    console.log(
        "PHYSICAL BINGO CLAIM SENT TO HOST:",
        cardId
    );

    return res.send(`
```

<!DOCTYPE html>

<html>

<head>

<meta charset="UTF-8">

<meta name="viewport"
content="width=device-width,initial-scale=1.0">

<title>Safety Bingo</title>

</head>

<body style="
margin:0;
min-height:100vh;
display:flex;
justify-content:center;
align-items:center;
background:radial-gradient(
circle at top,
#0b1b3a,
#050914
);
color:white;
font-family:Arial,sans-serif;
text-align:center;
">

<div style="
width:min(90%,500px);
padding:40px 25px;
border-radius:20px;
background:rgba(17,24,39,.95);
border:2px solid rgba(255,215,0,.35);
box-shadow:
0 20px 45px rgba(0,0,0,.55);
">

<div style="
font-size:60px;
color:#22c55e;
margin-bottom:15px;
">
✓
</div>

<h1 style="
color:#FFD700;
margin-bottom:15px;
">
BINGO CLAIM SENT
</h1>

<p style="
font-size:24px;
font-weight:bold;
">
CARD #${cardId}
</p>

<p style="
color:#cbd5e1;
font-size:18px;
line-height:1.5;
">
Your Bingo claim has been sent to the host.
</p>

<p style="
color:#22c55e;
font-weight:bold;
margin-top:25px;
">
Please wait while your card is checked.
</p>

</div>

</body>
</html>

```
    `);

}
```

);

// =====================================================
// SOCKET CONNECTION
// =====================================================

io.on(
"connection",
socket => {

```
    console.log(
        "CONNECTED:",
        socket.id
    );

    // -------------------------------------------------
    // GET HOST SESSION FROM SOCKET HANDSHAKE
    // -------------------------------------------------

    const cookieHeader =
        socket.handshake.headers.cookie ||
        "";

    let socketHostSessionId = null;

    const cookieParts =
        cookieHeader.split(";");

    for (
        const cookie of cookieParts
    ) {

        const parts =
            cookie.trim().split("=");

        const key =
            parts.shift();

        const value =
            parts.join("=");

        if (
            key ===
            HOST_COOKIE_NAME
        ) {

            socketHostSessionId =
                decodeURIComponent(
                    value || ""
                );

            break;
        }
    }

    socket.hostSessionId =
        socketHostSessionId;

    console.log(
        "SOCKET HOST SESSION:",
        socket.hostSessionId
            ? "PRESENT"
            : "NONE"
    );

    // -------------------------------------------------
    // SEND CURRENT STATE
    // -------------------------------------------------

    socket.emit(
        "gameState",
        gameState
    );

    // -------------------------------------------------
    // SEND PREVIOUS QUESTIONS
    // -------------------------------------------------

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
    // =================================================

    socket.on(
        "registerHost",
        () => {

            console.log(
                "HOST REGISTER REQUEST:",
                socket.id
            );

            // -----------------------------------------
            // CANCEL PENDING DISCONNECT RESET
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
            // NO CURRENT HOST
            // -----------------------------------------

            if (
                !hostSocketId
            ) {

                hostSocketId =
                    socket.id;

                hostSessionId =
                    socket.hostSessionId ||
                    null;

                console.log(
                    "HOST REGISTERED:",
                    hostSocketId
                );

                socket.emit(
                    "hostRegistered"
                );

                return;
            }

            // -----------------------------------------
            // SAME SOCKET
            // -----------------------------------------

            if (
                hostSocketId ===
                socket.id
            ) {

                console.log(
                    "HOST ALREADY REGISTERED ON SAME SOCKET"
                );

                socket.emit(
                    "hostRegistered"
                );

                return;
            }

            // -----------------------------------------
            // SAME BROWSER HOST SESSION
            // -----------------------------------------
            //
            // This is the important fix.
            //
            // If the old socket is still known by the
            // server but the returning Host Control has
            // the same host session cookie, allow the
            // new socket to take over.
            //
            // -----------------------------------------

            if (
                hostSessionId &&
                socket.hostSessionId &&
                hostSessionId ===
                socket.hostSessionId
            ) {

                const oldHostSocketId =
                    hostSocketId;

                console.log(
                    "SAME HOST SESSION RETURNED."
                );

                console.log(
                    "REPLACING OLD HOST SOCKET:",
                    oldHostSocketId
                );

                hostSocketId =
                    socket.id;

                hostSessionId =
                    socket.hostSessionId;

                // Tell old socket it has been replaced.

                const oldSocket =
                    io.sockets.sockets.get(
                        oldHostSocketId
                    );

                if (oldSocket) {

                    oldSocket.emit(
                        "hostSessionReplaced"
                    );

                    oldSocket.disconnect(
                        true
                    );

                }

                socket.emit(
                    "hostRegistered"
                );

                console.log(
                    "HOST SESSION SUCCESSFULLY RECONNECTED:",
                    socket.id
                );

                return;
            }

            // -----------------------------------------
            // DIFFERENT HOST
            // -----------------------------------------

            console.warn(
                "ANOTHER HOST IS ALREADY REGISTERED:",
                hostSocketId
            );

            socket.emit(
                "hostRegistrationRejected",
                {
                    reason:
                        "Another host is already registered."
                }
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
                hostSocketId !==
                socket.id
            ) {

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

            if (
                hostSocketId !==
                socket.id
            ) {

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
        async data => {

            if (
                socket.id !==
                hostSocketId
            ) {

                console.warn(
                    "HOST START REJECTED:",
                    socket.id
                );

                socket.emit(
                    "gameStartError",
                    {
                        error:
                            "This socket is not the registered host."
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

                pendingClaims.clear();

                pendingPhysicalClaims.clear();

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

                const selectedIds =
                    data &&
                    Array.isArray(
                        data.selectedQuestionIds
                    )
                        ? data.selectedQuestionIds
                            .map(Number)
                            .filter(
                                id =>
                                    Number.isInteger(id) &&
                                    id > 0
                            )
                        : [];

                gameState.selectedQuestionIds =
                    [
                        ...new Set(
                            selectedIds
                        )
                    ];

                buildGameOrder();

                gamePosition =
                    -1;

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
                return;
            }

            const cardId =
                Number(
                    data.cardId
                );

            if (!cardId) {
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

                pendingPhysicalClaims.clear();

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

        }
    );

    // =================================================
    // APPROVE PHYSICAL QR / PAPER WIN
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

            if (!id) {
                return;
            }

            if (
                gameState.approvedWinnersList.includes(
                    id
                )
            ) {

                pendingPhysicalClaims.delete(
                    id
                );

                return;
            }

            if (
                gameState.approvedWinnersCount >=
                gameState.maxWinners
            ) {

                return;
            }

            pendingPhysicalClaims.delete(
                id
            );

            gameState.approvedWinnersList.push(
                id
            );

            gameState.approvedWinnersCount++;

            const winnerNumber =
                gameState.approvedWinnersCount;

            console.log(
                "PHYSICAL WIN APPROVED:",
                id,
                "WINNER:",
                winnerNumber
            );

            io.emit(
                "physicalWinApproved",
                {

                    cardId:
                        id,

                    winnerCount:
                        winnerNumber,

                    winnerNumber:
                        winnerNumber,

                    totalRequired:
                        gameState.maxWinners

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

                pendingPhysicalClaims.clear();

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
    // REJECT PHYSICAL QR / PAPER WIN
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

            if (!cardId) {
                return;
            }

            console.log(
                "PHYSICAL WIN REJECTED:",
                cardId
            );

            pendingPhysicalClaims.delete(
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
                data.marked === true;

            if (!cardId) {
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

            // -----------------------------------------
            // REMOVE DIGITAL CLAIMS
            // -----------------------------------------

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

                }

            }

            // -----------------------------------------
            // HOST DISCONNECT
            // -----------------------------------------

            if (
                socket.id ===
                hostSocketId
            ) {

                console.log(
                    "========== HOST DISCONNECTED =========="
                );

                /*
                -------------------------------------------------
                Do NOT immediately erase the host.
                Give the browser time to reconnect.
                -------------------------------------------------
                */

                hostDisconnectTimer =
                    setTimeout(
                        () => {

                            hostDisconnectTimer =
                                null;

                            /*
                            Check that another host has not
                            taken over during the grace period.
                            */

                            if (
                                hostSocketId ===
                                socket.id
                            ) {

                                console.log(
                                    "HOST RECONNECT TIME EXPIRED"
                                );

                                hostSocketId =
                                    null;

                                hostSessionId =
                                    null;

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
```

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

```
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
```
