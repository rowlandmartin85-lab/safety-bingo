"use strict";

console.log("ANSWER KEY LOADED");

const socket = io();

const questionList =
    document.getElementById("questionList");

const questionCounter =
    document.getElementById("questionCounter");

let askedQuestions = [];

let currentQuestionNumber = 0;

let totalQuestions = 0;


/* =====================================================
   UPDATE COUNTER
   ===================================================== */

function updateQuestionCounter() {

    if (!questionCounter) {
        return;
    }

    if (
        currentQuestionNumber <= 0 ||
        totalQuestions <= 0
    ) {

        questionCounter.textContent =
            "Question 0 / 0";

        return;
    }

    questionCounter.textContent =
        `Question ${currentQuestionNumber} / ${totalQuestions}`;

}


/* =====================================================
   GAME RESET
   ===================================================== */

socket.on(
    "gameReset",
    () => {

        console.log(
            "ANSWER KEY RESET RECEIVED"
        );

        askedQuestions = [];

        currentQuestionNumber = 0;

        totalQuestions = 0;

        updateQuestionCounter();

        questionList.innerHTML =
            "<h2>Waiting for game to start...</h2>";

    }
);


/* =====================================================
   GAME STATE
   ===================================================== */

socket.on(
    "gameState",
    state => {

        console.log(
            "ANSWER KEY GAME STATE:",
            state
        );

        if (!state) {
            return;
        }


        /* ---------------------------------------------
           TOTAL QUESTIONS
           --------------------------------------------- */

        if (
            Number.isFinite(
                Number(
                    state.totalQuestions
                )
            )
        ) {

            totalQuestions =
                Number(
                    state.totalQuestions
                );

        }


        /* ---------------------------------------------
           CURRENT QUESTION
           --------------------------------------------- */

        if (
            Number.isFinite(
                Number(
                    state.currentQuestionNumber
                )
            )
        ) {

            currentQuestionNumber =
                Number(
                    state.currentQuestionNumber
                );

        }


        updateQuestionCounter();

    }
);


/* =====================================================
   QUESTION RECEIVED
   ===================================================== */

socket.on(
    "cheatSheetQuestion",
    q => {

        console.log(
            "ANSWER KEY QUESTION RECEIVED:",
            q
        );

        if (!q) {
            return;
        }


        /* ---------------------------------------------
           TOTAL QUESTIONS
           --------------------------------------------- */

        if (
            Number.isFinite(
                Number(
                    q.totalQuestions
                )
            )
        ) {

            totalQuestions =
                Number(
                    q.totalQuestions
                );

        }


        /* ---------------------------------------------
           CURRENT QUESTION NUMBER
           --------------------------------------------- */

        if (
            Number.isFinite(
                Number(
                    q.currentQuestionNumber
                )
            )
        ) {

            currentQuestionNumber =
                Number(
                    q.currentQuestionNumber
                );

        } else if (
            Number.isFinite(
                Number(
                    q.questionPosition
                )
            )
        ) {

            currentQuestionNumber =
                Number(
                    q.questionPosition
                );

        } else if (
            Number.isFinite(
                Number(
                    q.number
                )
            )
        ) {

            currentQuestionNumber =
                Number(
                    q.number
                );

        }


        updateQuestionCounter();


        /* ---------------------------------------------
           DUPLICATE CHECK
           --------------------------------------------- */

        const questionID =
            q.id ??
            q.questionID ??
            q.number;


        const alreadyExists =
            askedQuestions.some(
                existing => {

                    const existingID =
                        existing.id ??
                        existing.questionID ??
                        existing.number;

                    return (
                        existingID ===
                        questionID
                    );

                }
            );


        if (
            alreadyExists
        ) {

            console.log(
                "DUPLICATE QUESTION IGNORED:",
                questionID
            );

            renderQuestions();

            return;

        }


        /* ---------------------------------------------
           SAVE QUESTION
           --------------------------------------------- */

        askedQuestions.push(
            q
        );


        renderQuestions();

    }
);


/* =====================================================
   RENDER QUESTIONS
   ===================================================== */

function renderQuestions() {

    questionList.innerHTML = "";


    if (
        askedQuestions.length === 0
    ) {

        questionList.innerHTML =
            "<h2>Waiting for game to start...</h2>";

        return;

    }


    askedQuestions.forEach(
        (
            q,
            index
        ) => {

            const questionNumber =
                q.currentQuestionNumber ??
                q.number ??
                index + 1;


            const questionText =
                q.question ??
                "";


            const answerText =
                q.answer ??
                "";


            questionList.innerHTML += `

                <div class="question current">

                    <div class="number">
                        Question ${escapeHTML(
                            questionNumber
                        )}
                    </div>

                    <div class="q">
                        ${escapeHTML(
                            questionText
                        )}
                    </div>

                    <div class="a">
                        Answer:
                        ${escapeHTML(
                            answerText
                        )}
                    </div>

                </div>

            `;

        }
    );


    window.scrollTo({
        top:
            document.body.scrollHeight,

        behavior:
            "smooth"
    });

}


/* =====================================================
   HTML ESCAPE
   ===================================================== */

function escapeHTML(
    value
) {

    return String(
        value
    )
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


/* =====================================================
   INITIAL DISPLAY
   ===================================================== */

updateQuestionCounter();

questionList.innerHTML =
    "<h2>Waiting for game to start...</h2>";
