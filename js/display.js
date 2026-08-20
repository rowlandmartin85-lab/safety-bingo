"use strict";

/*
=========================================================
SAFETY STANDDOWN BINGO
DISPLAY.JS
=========================================================

DISPLAY RESPONSIBILITIES:

- Show the current question.
- Run the timer.
- Read questions aloud.
- Tell the host when reading begins.
- Tell the host when reading finishes.
- Play Bingo announcement.
- Play Game Over announcement.

IMPORTANT:

THE HOST DOES NOT READ QUESTIONS.

THE DISPLAY OWNS QUESTION AUDIO.

AUDIO HANDSHAKE:

DISPLAY receives question
        |
        v
displayQuestionReading
        |
        v
AudioEngine reads question
        |
        v
displayQuestionReadComplete
        |
        v
HOST unlocks NEXT
=========================================================
*/


// =====================================================
// LIVE SOCKET CONNECTION
// =====================================================

const liveWebsiteAddressUrl =
    `${window.location.protocol}//${window.location.host}`;


const socket =
    io(
        liveWebsiteAddressUrl,
        {

            transports: [
                "websocket",
                "polling"
            ],

            reconnection:
                true,

            reconnectionAttempts:
                Infinity,

            reconnectionDelay:
                1000,

            reconnectionDelayMax:
                5000

        }
    );


// =====================================================
// DISPLAY ELEMENT
// =====================================================

let display =
    null;


// =====================================================
// TIMER
// =====================================================

let timer = {

    max:
        30,

    current:
        30,

    interval:
        null

};


// =====================================================
// TIMER ENABLED
// =====================================================

let timerEnabled =
    true;


// =====================================================
// IDLE COLORS
// =====================================================

const sweepingColors = [

    "#22c55e",

    "#fbbf24",

    "#f97316",

    "#ef4444",

    "#3b82f6",

    "#a855f7"

];


let continuousColorIndex =
    0;


let continuousWaveInterval =
    null;


// =====================================================
// GAME TRACKING
// =====================================================

let lastQuestion =
    "";


let lastQuestionId =
    null;


let lastGameStatus =
    "";


let lastRepeatToken =
    null;


// =====================================================
// QUESTION AUDIO STATE
// =====================================================

let questionAudioState = {

    reading:
        false,

    question:
        "",

    questionId:
        null,

    token:
        null

};


// =====================================================
// BINGO
// =====================================================

let bingoOverlayActive =
    false;


let bingoOverlayTimeout =
    null;


// =====================================================
// DOM READY
// =====================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        display =
            document.getElementById(
                "questionDisplay"
            );


        if (
            !display
        ) {

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


// =====================================================
// TIMER CLEANUP
// =====================================================

function clearTimer() {

    if (
        timer.interval
    ) {

        clearInterval(
            timer.interval
        );


        timer.interval =
            null;

    }

}


// =====================================================
// TIMER CLASSES
// =====================================================

function clearTimerClasses() {

    if (
        !display
    ) {

        return;

    }


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


// =====================================================
// FORCE GREEN
// =====================================================

function forceGreenDisplay() {

    if (
        !display
    ) {

        return;

    }


    clearCustomSweepingStyles();


    clearTimerClasses();


    display.classList.add(
        "timer-green"
    );

}


// =====================================================
// IDLE
// =====================================================

function setIdleDisplay() {

    if (
        !display
    ) {

        return;

    }


    clearTimer();


    lastQuestion =
        "";


    lastQuestionId =
        null;


    lastRepeatToken =
        null;


    resetQuestionAudioState();


    clearTimerClasses();


    display.className =
        "idle-waiting-mode";


    display.textContent =
        "Waiting for host to start...";


    startIdleSweepingAnimation();

}


// =====================================================
// IDLE COLOR ANIMATION
// =====================================================

function startIdleSweepingAnimation() {

    if (
        !display
    ) {

        return;

    }


    if (
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
        setInterval(
            () => {

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

            },

            1200
        );

}


// =====================================================
// APPLY IDLE COLOR
// =====================================================

function applyIdleColor(
    color
) {

    if (
        !display
    ) {

        return;

    }


    display.style.borderColor =
        color;


    display.style.boxShadow =
        `
        0 0 18px ${color},
        0 0 40px ${color},
        0 0 70px ${color},
        0 0 100px ${color},
        inset 0 0 12px ${color},
        0 16px 45px rgba(0,0,0,.6)
        `;

}


// =====================================================
// CLEAR IDLE COLOR
// =====================================================

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


    if (
        display
    ) {

        display.style.borderColor =
            "";


        display.style.boxShadow =
            "";

    }

}


// =====================================================
// DISPLAY NETWORK HANDLERS
// =====================================================

function setupDisplayNetworkHandlers() {

    /*
    ==========================================
    TIMER SETTINGS
    ==========================================
    */

    socket.on(
        "timerSettingsUpdated",
        settings => {

            if (
                !settings
            ) {

                return;

            }


            timerEnabled =
                !Boolean(
                    settings.noTimer
                );


            timer.max =
                Number(
                    settings.seconds
                ) ||
                30;


            if (
                !timerEnabled
            ) {

                clearTimer();


                forceGreenDisplay();


                return;

            }


            updateTimerUI();

        }
    );


    /*
    ==========================================
    TIMER UPDATE
    ==========================================
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


            if (
                !timerEnabled
            ) {

                forceGreenDisplay();


                return;

            }


            updateTimerUI();

        }
    );


    /*
    ==========================================
    GAME STATE
    ==========================================
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
            ======================================
            IDLE
            ======================================
            */

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


            /*
            ======================================
            RUNNING
            ======================================
            */

            if (
                state.status ===
                "running"
            ) {

                handleRunningState(
                    state
                );


                lastGameStatus =
                    "running";


                return;

            }


            /*
            ======================================
            ENDED
            ======================================
            */

            if (
                state.status ===
                "ended"
            ) {

                handleGameOver();


                lastGameStatus =
                    "ended";


                return;

            }

        }
    );


    /*
    ==========================================
    SOCKET CONNECT
    ==========================================
    */

    socket.on(
        "connect",
        () => {

            console.log(
                "DISPLAY CONNECTED:",
                socket.id
            );


            console.log(
                "PROJECTOR INTERFACE SYNCHRONIZED"
            );


            socket.emit(
                "requestGameStateSyncFallback"
            );

        }
    );


    /*
    ==========================================
    SOCKET DISCONNECT
    ==========================================
    */

    socket.on(
        "disconnect",
        reason => {

            console.warn(
                "DISPLAY DISCONNECTED:",
                reason
            );

        }
    );


    /*
    ==========================================
    BINGO
    ==========================================
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


// =====================================================
// RUNNING STATE
// =====================================================

function handleRunningState(
    state
) {

    /*
    ==========================================
    TIMER MODE
    ==========================================
    */

    if (
        state.noTimer ===
        true
    ) {

        timerEnabled =
            false;


        clearTimer();


        clearCustomSweepingStyles();


        forceGreenDisplay();

    }

    else {

        timerEnabled =
            true;


        if (
            state.timerSeconds
        ) {

            timer.max =
                Number(
                    state.timerSeconds
                ) ||
                30;

        }

    }


    const targetText =
        state.currentQuestion ||
        "";


    const targetQuestionId =
        state.currentQuestionID ??
        null;


    /*
    ==========================================
    PAUSED
    ==========================================
    */

    if (
        state.isPaused
    ) {

        clearTimer();


        if (
            !timerEnabled
        ) {

            forceGreenDisplay();

        }

        else {

            clearCustomSweepingStyles();


            clearTimerClasses();


            display.classList.add(
                "timer-paused"
            );

        }


        return;

    }


    /*
    ==========================================
    QUESTION CHANGED
    ==========================================
    */

    const questionChanged =
        targetText !==
            lastQuestion ||
        targetQuestionId !==
            lastQuestionId;


    /*
    ==========================================
    REPEAT QUESTION
    ==========================================
    */

    const repeatRequested =
        state.repeatQuestion ===
        true;


    if (
        questionChanged
    ) {

        lastQuestion =
            targetText;


        lastQuestionId =
            targetQuestionId;


        /*
        ------------------------------------------
        Generate a unique audio token.
        ------------------------------------------
        */

        const token =
            `${Date.now()}-${Math.random()}`;


        questionAudioState.token =
            token;


        lastRepeatToken =
            null;


        /*
        ------------------------------------------
        Start reading.
        ------------------------------------------
        */

        readQuestionOnDisplay(
            targetText,
            targetQuestionId,
            token
        );


        /*
        ------------------------------------------
        Visual question transition
        ------------------------------------------
        */

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


            return;

        }


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

                        setTimeout(
                            () => {

                                if (
                                    !display
                                ) {

                                    return;

                                }


                                display.className =
                                    "timer-green fade-in";


                                if (
                                    timerEnabled
                                ) {

                                    startTimer(
                                        state.timerSeconds ||
                                        30
                                    );

                                }

                            },

                            20
                        );

                    }
                );

            },

            350
        );


        return;

    }


    /*
    ==========================================
    REPEAT CURRENT QUESTION
    ==========================================
    */

    if (
        repeatRequested
    ) {

        const repeatToken =
            state.repeatToken ||
            state.repeatTimestamp ||
            state.repeatQuestionID ||
            null;


        /*
        ------------------------------------------
        Prevent duplicate gameState packets from
        causing the same question to be read
        repeatedly.
        ------------------------------------------
        */

        if (
            repeatToken !==
            lastRepeatToken
        ) {

            lastRepeatToken =
                repeatToken;


            const token =
                `${Date.now()}-${Math.random()}`;


            questionAudioState.token =
                token;


            readQuestionOnDisplay(
                targetText,
                targetQuestionId,
                token
            );

        }

    }


    /*
    ==========================================
    SAME QUESTION / TIMER
    ==========================================
    */

    if (
        !state.isPaused
    ) {

        if (
            state.noTimer ===
            true
        ) {

            clearTimer();


            forceGreenDisplay();

        }

        else {

            updateTimerUI();

        }

    }

}


// =====================================================
// READ QUESTION ON DISPLAY
// =====================================================

function readQuestionOnDisplay(
    question,
    questionId,
    token
) {

    if (
        !question
    ) {

        return;

    }


    /*
    ==========================================
    MARK AUDIO AS READING
    ==========================================
    */

    questionAudioState.reading =
        true;


    questionAudioState.question =
        question;


    questionAudioState.questionId =
        questionId;


    questionAudioState.token =
        token;


    /*
    ==========================================
    TELL HOST

    NEXT becomes disabled immediately.
    ==========================================
    */

    socket.emit(
        "displayQuestionReading",
        {

            question:
                question,

            questionId:
                questionId,

            token:
                token

        }
    );


    /*
    ==========================================
    AUDIO ENGINE CHECK
    ==========================================
    */

    if (
        !window.audioEngine
    ) {

        console.warn(
            "AUDIO ENGINE NOT FOUND. QUESTION WILL BE CONSIDERED READ."
        );


        finishQuestionReading(
            question,
            questionId,
            token
        );


        return;

    }


    if (
        typeof window.audioEngine.readQuestion !==
        "function"
    ) {

        console.warn(
            "audioEngine.readQuestion() NOT FOUND."
        );


        finishQuestionReading(
            question,
            questionId,
            token
        );


        return;

    }


    /*
    ==========================================
    START AUDIO

    We need to know when the speech is done.

    The preferred AudioEngine interface is:

        readQuestion(text, options)

    where options.onComplete is called after
    speech finishes.

    The fallback below also watches SpeechSynthesis.
    ==========================================
    */

    let completionHandled =
        false;


    const complete =
        () => {

            if (
                completionHandled
            ) {

                return;

            }


            completionHandled =
                true;


            finishQuestionReading(
                question,
                questionId,
                token
            );

        };


    /*
    ==========================================
    PREFERRED AUDIO ENGINE CALL
    ==========================================
    */

    try {

        const result =
            window.audioEngine.readQuestion(
                question,
                {

                    force:
                        true,

                    onComplete:
                        complete,

                    onEnd:
                        complete,

                    onFinished:
                        complete

                }
            );


        /*
        ------------------------------------------
        If the AudioEngine returns a Promise,
        use it.
        ------------------------------------------
        */

        if (
            result &&
            typeof result.then ===
            "function"
        ) {

            result.then(
                complete
            );

        }


        /*
        ------------------------------------------
        SpeechSynthesis fallback.

        This is intentionally only on DISPLAY.
        ------------------------------------------
        */

        waitForSpeechSynthesisCompletion(
            complete
        );

    }

    catch (
        error
    ) {

        console.error(
            "DISPLAY AUDIO ERROR:",
            error
        );


        complete();

    }

}


// =====================================================
// SPEECH SYNTHESIS COMPLETION FALLBACK
// =====================================================

function waitForSpeechSynthesisCompletion(
    complete
) {

    /*
    ==========================================
    If SpeechSynthesis is unavailable, don't
    block the game permanently.
    ==========================================
    */

    if (
        !window.speechSynthesis
    ) {

        return;

    }


    let checks =
        0;


    const maxChecks =
        1200;


    const check =
        () => {

            checks++;


            /*
            ------------------------------------------
            If speech is no longer speaking, allow
            completion.

            We wait a few checks because some browsers
            briefly report false between utterances.
            ------------------------------------------
            */

            if (
                !window.speechSynthesis.speaking &&
                !window.speechSynthesis.pending
            ) {

                if (
                    checks > 3
                ) {

                    complete();


                    return;

                }

            }


            if (
                checks >=
                maxChecks
            ) {

                console.warn(
                    "Speech completion timeout."
                );


                complete();


                return;

            }


            setTimeout(
                check,
                100
            );

        };


    /*
    ------------------------------------------
    Give the AudioEngine a moment to actually
    start SpeechSynthesis.
    ------------------------------------------
    */

    setTimeout(
        check,
        150
    );

}


// =====================================================
// FINISH QUESTION READING
// =====================================================

function finishQuestionReading(
    question,
    questionId,
    token
) {

    /*
    ==========================================
    IGNORE STALE COMPLETION
    ==========================================
    */

    if (
        questionAudioState.token !==
        token
    ) {

        console.warn(
            "IGNORING STALE AUDIO COMPLETION"
        );


        return;

    }


    if (
        !questionAudioState.reading
    ) {

        return;

    }


    /*
    ==========================================
    MARK COMPLETE
    ==========================================
    */

    questionAudioState.reading =
        false;


    /*
    ==========================================
    TELL HOST

    This unlocks NEXT.
    ==========================================
    */

    socket.emit(
        "displayQuestionReadComplete",
        {

            question:
                question,

            questionId:
                questionId,

            token:
                token

        }
    );


    console.log(
        "DISPLAY FINISHED READING QUESTION"
    );

}


// =====================================================
// RESET AUDIO STATE
// =====================================================

function resetQuestionAudioState() {

    questionAudioState = {

        reading:
            false,

        question:
            "",

        questionId:
            null,

        token:
            null

    };

}


// =====================================================
// TIMER ENGINE
// =====================================================

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
        Number(
            seconds
        ) ||
        30;


    timer.current =
        timer.max;


    updateTimerUI();


    timer.interval =
        setInterval(
            () => {

                if (
                    !timerEnabled
                ) {

                    clearTimer();


                    forceGreenDisplay();


                    return;

                }


                timer.current--;


                updateTimerUI();


                if (
                    timer.current <=
                    0
                ) {

                    clearTimer();


                    if (
                        timerEnabled
                    ) {

                        socket.emit(
                            "requestNext"
                        );

                    }

                }

            },

            1000
        );

}


// =====================================================
// TIMER COLOR ENGINE
// =====================================================

function updateTimerUI() {

    if (
        !display
    ) {

        return;

    }


    if (
        !timerEnabled
    ) {

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
        Number(
            timer.max
        ) ||
        30;


    const current =
        Number(
            timer.current
        ) ||
        0;


    const ratio =
        current /
        max;


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


// =====================================================
// GAME OVER
// =====================================================

function handleGameOver() {

    clearTimer();


    clearCustomSweepingStyles();


    resetQuestionAudioState();


    timerEnabled =
        true;


    clearTimerClasses();


    display.className =
        "timer-dead";


    display.textContent =
        "Game Over";


    /*
    ==========================================
    GAME OVER AUDIO
    ==========================================
    */

    if (
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

}


// =====================================================
// PAUSE DISPLAY
// =====================================================

function pauseDisplay() {

    clearTimer();


    if (
        !display
    ) {

        return;

    }


    if (
        !timerEnabled
    ) {

        forceGreenDisplay();


        return;

    }


    clearCustomSweepingStyles();


    clearTimerClasses();


    display.classList.add(
        "timer-paused"
    );

}


// =====================================================
// RESUME DISPLAY
// =====================================================

function resumeDisplay() {

    if (
        !display
    ) {

        return;

    }


    if (
        !timerEnabled
    ) {

        forceGreenDisplay();


        return;

    }


    clearTimerClasses();


    display.classList.add(
        "timer-green"
    );


    startTimer(
        timer.current ||
        timer.max ||
        30
    );

}


// =====================================================
// BINGO CSS
// =====================================================

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

            background:
                radial-gradient(
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

        }


        .display-bingo-title {

            position: relative;

            z-index: 1000000;

            font-family:
                Arial Black,
                Impact,
                Arial,
                sans-serif;

            font-size:
                clamp(70px, 12vw, 150px);

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

            transform:
                scale(.55);

            opacity: 0;

            animation:
                bingoTitleEnter
                .55s
                cubic-bezier(.2,.9,.3,1.25)
                forwards,
                bingoTitlePulse
                1.1s
                ease-in-out
                .55s
                infinite alternate;

        }


        .display-bingo-sub {

            position: relative;

            z-index: 1000000;

            margin-top: 25px;

            font-family:
                Arial,
                sans-serif;

            font-size:
                clamp(24px, 4vw, 42px);

            font-weight: 900;

            letter-spacing: .12em;

            color: white;

            text-align: center;

            text-shadow:
                0 0 10px white,
                0 0 25px #FFD84D;

            opacity: 0;

            animation:
                bingoSubEnter
                .55s
                ease-out
                .45s
                forwards;

        }


        .display-confetti {

            position: absolute;

            top: -30px;

            z-index: 999999;

            pointer-events: none;

            will-change:
                transform,
                opacity;

        }


        @keyframes bingoTitleEnter {

            0% {

                opacity: 0;

                transform:
                    scale(.55)
                    rotate(-4deg);

            }

            65% {

                opacity: 1;

                transform:
                    scale(1.12)
                    rotate(1deg);

            }

            100% {

                opacity: 1;

                transform:
                    scale(1)
                    rotate(0deg);

            }

        }


        @keyframes bingoTitlePulse {

            from {

                filter:
                    brightness(1);

            }

            to {

                filter:
                    brightness(1.35);

            }

        }


        @keyframes bingoSubEnter {

            from {

                opacity: 0;

                transform:
                    translateY(15px);

            }

            to {

                opacity: 1;

                transform:
                    translateY(0);

            }

        }


        @keyframes displayConfettiFall {

            0% {

                transform:
                    translate3d(
                        0,
                        -5vh,
                        0
                    )
                    rotate(0deg);

                opacity: 1;

            }

            100% {

                transform:
                    translate3d(
                        0,
                        115vh,
                        0
                    )
                    rotate(
                        720deg
                    );

                opacity: 0;

            }

        }

    `;


    document.head.appendChild(
        style
    );

}


// =====================================================
// BINGO CELEBRATION
// =====================================================

function showBingoCelebration() {

    if (
        bingoOverlayActive
    ) {

        return;

    }


    bingoOverlayActive =
        true;


    clearTimer();


    const overlay =
        document.createElement(
            "div"
        );


    overlay.className =
        "display-bingo-overlay";


    overlay.innerHTML = `

        <div class="display-bingo-title">
            B I N G O !
        </div>

        <div class="display-bingo-sub">
            WIN CONFIRMED
        </div>

    `;


    document.body.appendChild(
        overlay
    );


    const colors = [

        "#FFD84D",

        "#22c55e",

        "#3b82f6",

        "#ef4444",

        "#a855f7",

        "#f97316",

        "#ffffff"

    ];


    for (
        let i = 0;
        i < 300;
        i++
    ) {

        const flake =
            document.createElement(
                "div"
            );


        flake.className =
            "display-confetti";


        const size =
            Math.random() * 12 + 6;


        flake.style.width =
            `${size}px`;


        flake.style.height =
            `${size * .65}px`;


        flake.style.background =
            colors[
                Math.floor(
                    Math.random() *
                    colors.length
                )
            ];


        flake.style.left =
            `${Math.random() * 100}vw`;


        const duration =
            3 +
            Math.random() * 3;


        const delay =
            Math.random() * .45;


        flake.style.animation =
            `
            displayConfettiFall
            ${duration}s
            linear
            ${delay}s
            forwards
            `;


        if (
            Math.random() >
            .55
        ) {

            flake.style.borderRadius =
                "50%";

        }


        overlay.appendChild(
            flake
        );

    }


    /*
    ==========================================
    BINGO AUDIO ONLY ON DISPLAY
    ==========================================
    */

    if (
        window.audioEngine &&
        typeof window.audioEngine.speak ===
        "function"
    ) {

        window.audioEngine.speak(

            "Bingo!... Winner... confirmed!",

            {

                rate:
                    0.58,

                pitch:
                    1.05,

                volume:
                    1,

                force:
                    true

            }

        );

    }


    bingoOverlayTimeout =
        setTimeout(
            () => {

                if (
                    overlay &&
                    overlay.parentNode
                ) {

                    overlay.remove();

                }


                bingoOverlayActive =
                    false;


                bingoOverlayTimeout =
                    null;

            },

            10000
        );

}


// =====================================================
// GLOBAL BINGO API
// =====================================================

window.bingoAnimation = {

    show:
        showBingoCelebration

};


// =====================================================
// VISIBILITY SAFETY
// =====================================================

document.addEventListener(
    "visibilitychange",
    () => {

        if (
            document.hidden
        ) {

            return;

        }


        if (
            display &&
            display.classList.contains(
                "idle-waiting-mode"
            )
        ) {

            startIdleSweepingAnimation();


            return;

        }


        if (
            display &&
            !timerEnabled
        ) {

            forceGreenDisplay();

        }

    }
);


// =====================================================
// DEBUG
// =====================================================

console.log(
    "SAFETY STANDDOWN BINGO DISPLAY.JS LOADED"
);


console.log(
    "DISPLAY AUDIO ENABLED"
);


console.log(
    "HOST NEXT-QUESTION AUDIO HANDSHAKE ENABLED"
);
