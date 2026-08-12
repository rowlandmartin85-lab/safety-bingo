"use strict";

// =====================================================
// SAFETY BINGO HOST STATE MANAGER
// =====================================================

console.log(
"HOST STATE LOADED"
);

// =====================================================
// HOST STATE
// =====================================================

const hostState = {

```
/*
==============================
CONNECTION
==============================
*/

connected: false,

registered: false,


/*
==============================
GAME STATUS
==============================
*/

status: "idle",

started: false,

paused: false,


/*
==============================
CURRENT QUESTION
==============================
*/

currentQuestion: "",

currentAnswer: "",

currentCategory: "",

currentDifficulty: "",

currentQuestionID: null,

currentQuestionNumber: null,


/*
==============================
QUESTION TRACKING
==============================
*/

calledAnswers: [],

askedIndices: [],

gameOrder: [],

currentQuestionIndex: -1,


/*
==============================
SETTINGS
==============================
*/

timerSeconds: 30,

noTimer: false,

maxWinners: 1,


/*
==============================
TIMER
==============================
*/

countdown: 0,


/*
==============================
WIN TRACKING
==============================
*/

approvedWinners: [],

approvedWinnersList: [],

approvedWinnersCount: 0,

pendingWinner: null,


/*
==============================
QUESTION SELECTION
==============================
*/

selectedQuestionIds: [],


/*
==============================
REPEAT
==============================
*/

repeatQuestion: false,


/*
==============================
UPDATE FROM SERVER
==============================
*/

updateFromServer(serverState) {

    if (
        !serverState ||
        typeof serverState !== "object"
    ) {

        console.warn(
            "INVALID HOST SERVER STATE"
        );

        return;

    }


    /*
    ==============================
    CONNECTION
    ==============================
    */

    this.connected = true;


    /*
    ==============================
    GAME STATUS
    ==============================
    */

    if (
        typeof serverState.status ===
        "string"
    ) {

        this.status =
            serverState.status;

    }


    this.started =
        this.status === "running";


    /*
    ==============================
    PAUSE
    ==============================
    */

    if (
        typeof serverState.isPaused ===
        "boolean"
    ) {

        this.paused =
            serverState.isPaused;

    }


    /*
    ==============================
    CURRENT QUESTION
    ==============================
    */

    if (
        Object.prototype.hasOwnProperty.call(
            serverState,
            "currentQuestion"
        )
    ) {

        this.currentQuestion =
            serverState.currentQuestion ||
            "";

    }


    if (
        Object.prototype.hasOwnProperty.call(
            serverState,
            "currentAnswer"
        )
    ) {

        this.currentAnswer =
            serverState.currentAnswer ||
            "";

    }


    if (
        Object.prototype.hasOwnProperty.call(
            serverState,
            "currentCategory"
        )
    ) {

        this.currentCategory =
            serverState.currentCategory ||
            "";

    }


    if (
        Object.prototype.hasOwnProperty.call(
            serverState,
            "currentDifficulty"
        )
    ) {

        this.currentDifficulty =
            serverState.currentDifficulty ||
            "";

    }


    if (
        Object.prototype.hasOwnProperty.call(
            serverState,
            "currentQuestionID"
        )
    ) {

        this.currentQuestionID =
            serverState.currentQuestionID;

    }


    if (
        Object.prototype.hasOwnProperty.call(
            serverState,
            "currentQuestionNumber"
        )
    ) {

        this.currentQuestionNumber =
            serverState.currentQuestionNumber;

    }


    /*
    ==============================
    QUESTION TRACKING
    ==============================
    */

    if (
        Array.isArray(
            serverState.calledAnswers
        )
    ) {

        this.calledAnswers = [
            ...serverState.calledAnswers
        ];

    }


    if (
        Array.isArray(
            serverState.askedIndices
        )
    ) {

        this.askedIndices = [
            ...serverState.askedIndices
        ];

    }


    if (
        Array.isArray(
            serverState.gameOrder
        )
    ) {

        this.gameOrder = [
            ...serverState.gameOrder
        ];

    }


    if (
        typeof serverState.currentQuestionIndex ===
        "number"
    ) {

        this.currentQuestionIndex =
            serverState.currentQuestionIndex;

    }


    /*
    ==============================
    SETTINGS
    ==============================
    */

    if (
        typeof serverState.timerSeconds ===
        "number"
    ) {

        this.timerSeconds =
            serverState.timerSeconds;

    }


    if (
        typeof serverState.noTimer ===
        "boolean"
    ) {

        this.noTimer =
            serverState.noTimer;

    }


    if (
        typeof serverState.maxWinners ===
        "number"
    ) {

        this.maxWinners =
            serverState.maxWinners;

    }


    /*
    ==============================
    WIN TRACKING
    ==============================
    */

    if (
        Array.isArray(
            serverState.approvedWinnersList
        )
    ) {

        this.approvedWinnersList = [
            ...serverState.approvedWinnersList
        ];

        /*
         * Keep the old property working.
         */

        this.approvedWinners = [
            ...serverState.approvedWinnersList
        ];

    }


    if (
        typeof serverState.approvedWinnersCount ===
        "number"
    ) {

        this.approvedWinnersCount =
            serverState.approvedWinnersCount;

    }


    /*
    ==============================
    QUESTION SELECTION
    ==============================
    */

    if (
        Array.isArray(
            serverState.selectedQuestionIds
        )
    ) {

        this.selectedQuestionIds = [
            ...serverState.selectedQuestionIds
        ];

    }


    /*
    ==============================
    REPEAT
    ==============================
    */

    this.repeatQuestion =
        serverState.repeatQuestion === true;


    console.log(
        "HOST STATE UPDATED:",
        this
    );


    /*
    ==============================
    NOTIFY OTHER MODULES
    ==============================
    */

    window.dispatchEvent(
        new CustomEvent(
            "hostStateUpdated",
            {
                detail: this
            }
        )
    );

},


/*
==============================
TIMER UPDATE
==============================
*/

updateTimer(seconds) {

    const value =
        Number(seconds);

    if (
        Number.isFinite(value)
    ) {

        this.countdown =
            Math.max(
                0,
                value
            );

    }

    window.dispatchEvent(
        new CustomEvent(
            "hostTimerUpdated",
            {
                detail: {
                    countdown:
                        this.countdown
                }
            }
        )
    );

},


/*
==============================
ADD APPROVED WINNER
==============================
*/

addApprovedWinner(cardId) {

    const id =
        Number(cardId);

    if (!Number.isInteger(id)) {

        return;

    }


    if (
        !this.approvedWinners.includes(id)
    ) {

        this.approvedWinners.push(id);

    }


    if (
        !this.approvedWinnersList.includes(id)
    ) {

        this.approvedWinnersList.push(id);

    }


    this.approvedWinnersCount =
        this.approvedWinnersList.length;


    window.dispatchEvent(
        new CustomEvent(
            "hostWinnersUpdated",
            {
                detail: {
                    cardId: id,
                    winners:
                        [
                            ...this.approvedWinnersList
                        ],
                    count:
                        this.approvedWinnersCount
                }
            }
        )
    );

},


/*
==============================
SET PENDING WINNER
==============================
*/

setPendingWinner(winner) {

    this.pendingWinner =
        winner || null;


    window.dispatchEvent(
        new CustomEvent(
            "hostPendingWinnerUpdated",
            {
                detail:
                    this.pendingWinner
            }
        )
    );

},


/*
==============================
RESET LOCAL STATE
==============================
*/

reset() {

    this.status =
        "idle";

    this.started =
        false;

    this.paused =
        false;

    this.currentQuestion =
        "";

    this.currentAnswer =
        "";

    this.currentCategory =
        "";

    this.currentDifficulty =
        "";

    this.currentQuestionID =
        null;

    this.currentQuestionNumber =
        null;

    this.calledAnswers =
        [];

    this.askedIndices =
        [];

    this.gameOrder =
        [];

    this.currentQuestionIndex =
        -1;

    this.timerSeconds =
        30;

    this.noTimer =
        false;

    this.maxWinners =
        1;

    this.countdown =
        0;

    this.approvedWinners =
        [];

    this.approvedWinnersList =
        [];

    this.approvedWinnersCount =
        0;

    this.pendingWinner =
        null;

    this.selectedQuestionIds =
        [];

    this.repeatQuestion =
        false;


    console.log(
        "HOST LOCAL STATE RESET"
    );


    window.dispatchEvent(
        new CustomEvent(
            "hostStateUpdated",
            {
                detail:
                    this
            }
        )
    );

}
```

};

// =====================================================
// SOCKET STATE LISTENERS
// =====================================================

function initializeHostState() {

```
if (
    window.hostStateInitialized ===
    true
) {

    return;

}


/*
 * host.js may initialize the socket after
 * this file loads, so retry until hostSocket
 * exists.
 */

if (
    !window.hostSocket ||
    typeof window.hostSocket.on !==
    "function"
) {

    setTimeout(
        initializeHostState,
        250
    );

    return;

}


window.hostStateInitialized =
    true;


const socket =
    window.hostSocket;


console.log(
    "HOST STATE SOCKET LISTENERS READY"
);


/*
==============================
CONNECT
==============================
*/

socket.on(
    "connect",
    () => {

        hostState.connected =
            true;

        console.log(
            "HOST SOCKET CONNECTED:",
            socket.id
        );

    }
);


/*
==============================
DISCONNECT
==============================
*/

socket.on(
    "disconnect",
    () => {

        hostState.connected =
            false;

        hostState.registered =
            false;

        console.log(
            "HOST SOCKET DISCONNECTED"
        );

    }
);


/*
==============================
GAME STATE
==============================
*/

socket.on(
    "gameState",
    serverState => {

        hostState.updateFromServer(
            serverState
        );

    }
);


/*
==============================
TIMER
==============================
*/

socket.on(
    "timerUpdate",
    seconds => {

        hostState.updateTimer(
            seconds
        );

    }
);


/*
==============================
GAME RESET
==============================
*/

socket.on(
    "gameReset",
    () => {

        console.log(
            "HOST RECEIVED GAME RESET"
        );

        hostState.reset();

    }
);


/*
==============================
GAME ENDED
==============================
*/

socket.on(
    "gameEnded",
    data => {

        hostState.status =
            "ended";

        hostState.started =
            false;

        hostState.paused =
            false;


        console.log(
            "HOST GAME ENDED:",
            data
        );


        window.dispatchEvent(
            new CustomEvent(
                "hostGameEnded",
                {
                    detail:
                        data || {}
                }
            )
        );

    }
);


/*
==============================
HOST REGISTERED
==============================
*/

socket.on(
    "hostRegistered",
    () => {

        hostState.registered =
            true;

        hostState.connected =
            true;

        console.log(
            "HOST REGISTERED"
        );

        window.dispatchEvent(
            new Event(
                "hostRegistered"
            )
        );

    }
);


/*
==============================
HOST REGISTRATION REJECTED
==============================
*/

socket.on(
    "hostRegistrationRejected",
    data => {

        hostState.registered =
            false;

        console.error(
            "HOST REGISTRATION REJECTED:",
            data
        );

        window.dispatchEvent(
            new CustomEvent(
                "hostRegistrationRejected",
                {
                    detail:
                        data || {}
                }
            )
        );

    }
);


/*
==============================
PHYSICAL WIN REQUEST
==============================
*/

socket.on(
    "physicalWinRequested",
    data => {

        hostState.setPendingWinner(
            {
                type:
                    "physical",

                ...(data || {})
            }
        );

    }
);


/*
==============================
PHYSICAL WIN APPROVED
==============================
*/

socket.on(
    "physicalWinApproved",
    data => {

        if (
            data &&
            data.cardId
        ) {

            hostState.addApprovedWinner(
                data.cardId
            );

        }

    }
);


/*
==============================
PHYSICAL WIN REJECTED
==============================
*/

socket.on(
    "physicalWinRejected",
    data => {

        if (
            hostState.pendingWinner &&
            Number(
                hostState.pendingWinner.cardId
            ) ===
            Number(
                data &&
                data.cardId
            )
        ) {

            hostState.pendingWinner =
                null;

        }

    }
);


/*
==============================
DIGITAL WIN REQUEST
==============================
*/

socket.on(
    "winRequested",
    data => {

        hostState.setPendingWinner(
            {
                type:
                    "digital",

                ...(data || {})
            }
        );

    }
);


/*
==============================
DIGITAL WIN APPROVED
==============================
*/

socket.on(
    "winApproved",
    data => {

        if (
            data &&
            data.cardId
        ) {

            hostState.addApprovedWinner(
                data.cardId
            );

        }

    }
);


/*
==============================
DIGITAL WIN REJECTED
==============================
*/

socket.on(
    "winRejected",
    data => {

        if (
            hostState.pendingWinner &&
            Number(
                hostState.pendingWinner.cardId
            ) ===
            Number(
                data &&
                data.cardId
            )
        ) {

            hostState.pendingWinner =
                null;

        }

    }
);


console.log(
    "HOST STATE INITIALIZED"
);
```

}

// =====================================================
// EXPORT
// =====================================================

window.hostState =
hostState;

window.initializeHostState =
initializeHostState;

// =====================================================
// START
// =====================================================

if (
document.readyState ===
"loading"
) {

```
document.addEventListener(
    "DOMContentLoaded",
    initializeHostState
);
```

} else {

```
initializeHostState();
```

}

console.log(
"HOST STATE READY"
);
