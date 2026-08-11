"use strict";

console.log("QUESTION MANAGER LOADED");

document.addEventListener("DOMContentLoaded", () => {

    // =====================================================
    // ELEMENTS
    // =====================================================

    const list =
        document.getElementById("questionList");

    const questionInput =
        document.getElementById("newQuestion");

    const answerInput =
        document.getElementById("newAnswer");

    const addButton =
        document.getElementById("addQuestionBtn");

    const removeButton =
        document.getElementById("removeQuestionBtn");

    const deleteAllButton =
        document.getElementById("deleteAllQuestionsBtn");

    const questionCount =
        document.getElementById("questionCount");


    // =====================================================
    // UPDATE COUNT
    // =====================================================

    function updateCount() {

        if (!questionCount) {
            return;
        }

        const count =
            list
                ? list.options.length
                : 0;

        questionCount.textContent =
            "Questions Available: " +
            count;

    }


    // =====================================================
    // LOAD QUESTIONS FROM DATABASE
    // =====================================================

    async function loadQuestions() {

        try {

            const response =
                await fetch(
                    "/api/questions"
                );


            if (!response.ok) {

                throw new Error(
                    "HTTP " +
                    response.status
                );

            }


            const questions =
                await response.json();


            if (!list) {
                return;
            }


            /*
            =================================================
            IMPORTANT:

            Every question in the database is automatically
            part of the question bank.

            There is NO localStorage selection anymore.

            The host does not need to select questions
            before starting a game.
            =================================================
            */

            list.innerHTML =
                "";


            questions.forEach(
                (question, index) => {

                    const option =
                        document.createElement(
                            "option"
                        );


                    /*
                    Database ID is used internally.

                    The visible number remains sequential.
                    */

                    option.value =
                        question.id;


                    option.textContent =
                        (index + 1) +
                        " - " +
                        (
                            question.question ||
                            question.q ||
                            ""
                        ) +
                        " | " +
                        (
                            question.answer ||
                            question.a ||
                            ""
                        );


                    list.appendChild(
                        option
                    );

                }
            );


            updateCount();


            console.log(
                "QUESTIONS LOADED FROM DATABASE:",
                questions.length
            );


        } catch (error) {

            console.error(
                "LOAD QUESTIONS ERROR:",
                error
            );


            if (questionCount) {

                questionCount.textContent =
                    "Unable to load questions";

            }

        }

    }


    // =====================================================
    // ADD QUESTION
    // =====================================================

    async function addQuestion() {

        const question =
            questionInput.value.trim();

        const answer =
            answerInput.value.trim();


        if (
            !question ||
            !answer
        ) {

            alert(
                "Enter both question and answer"
            );

            return;

        }


        try {

            const response =
                await fetch(
                    "/api/questions/add",
                    {

                        method:
                            "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify({

                                q:
                                    question,

                                a:
                                    answer,

                                question:
                                    question,

                                answer:
                                    answer

                            })

                    }
                );


            const result =
                await response.json();


            if (
                !result.success
            ) {

                alert(
                    result.error ||
                    "Error adding question"
                );

                return;

            }


            /*
            Question is now permanently stored
            in the database.
            */

            questionInput.value =
                "";

            answerInput.value =
                "";


            await loadQuestions();


        } catch (error) {

            console.error(
                "ADD QUESTION ERROR:",
                error
            );

            alert(
                "Server error adding question"
            );

        }

    }


    // =====================================================
    // REMOVE SELECTED QUESTIONS
    // =====================================================

    async function removeQuestion() {

        if (!list) {
            return;
        }


        const selected =
            [
                ...list.selectedOptions
            ];


        if (
            selected.length === 0
        ) {

            alert(
                "Select question(s) to delete"
            );

            return;

        }


        if (
            !confirm(
                "Delete selected question(s) permanently?"
            )
        ) {

            return;

        }


        try {

            for (
                const option
                of selected
            ) {

                const response =
                    await fetch(
                        "/api/questions/" +
                        encodeURIComponent(
                            option.value
                        ),
                        {
                            method:
                                "DELETE"
                        }
                    );


                if (
                    !response.ok
                ) {

                    let errorMessage =
                        "Delete failed";


                    try {

                        const result =
                            await response.json();

                        if (
                            result.error
                        ) {

                            errorMessage =
                                result.error;

                        }

                    } catch (error) {

                        // Ignore JSON parsing errors.

                    }


                    console.error(
                        "DELETE FAILED:",
                        option.value,
                        errorMessage
                    );

                }

            }


            /*
            Reload directly from the database.

            There is no local selection to maintain.
            */

            await loadQuestions();


        } catch (error) {

            console.error(
                "REMOVE QUESTION ERROR:",
                error
            );

            alert(
                "Error removing question(s)"
            );

        }

    }


    // =====================================================
    // DELETE ALL QUESTIONS
    // =====================================================

    async function deleteAllQuestions() {

        if (
            !confirm(
                "Delete ALL questions permanently?"
            )
        ) {

            return;

        }


        try {

            const response =
                await fetch(
                    "/api/questions/delete-all",
                    {
                        method:
                            "DELETE"
                    }
                );


            const result =
                await response.json();


            if (
                !result.success
            ) {

                alert(
                    result.error ||
                    "Delete failed"
                );

                return;

            }


            /*
            Database is now empty.

            Reload the question list.
            */

            await loadQuestions();


        } catch (error) {

            console.error(
                "DELETE ALL ERROR:",
                error
            );

            alert(
                "Server error deleting questions"
            );

        }

    }


    // =====================================================
    // BUTTON EVENTS
    // =====================================================

    if (addButton) {

        addButton.onclick =
            addQuestion;

    }


    if (removeButton) {

        removeButton.onclick =
            removeQuestion;

    }


    if (deleteAllButton) {

        deleteAllButton.onclick =
            deleteAllQuestions;

    }


    // =====================================================
    // INITIAL LOAD
    // =====================================================

    loadQuestions();

});
