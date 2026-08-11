"use strict";

console.log("QUESTION MANAGER LOADED");

document.addEventListener(
    "DOMContentLoaded",
    () => {

        const list =
            document.getElementById(
                "questionList"
            );

        const questionInput =
            document.getElementById(
                "newQuestion"
            );

        const answerInput =
            document.getElementById(
                "newAnswer"
            );

        const addButton =
            document.getElementById(
                "addQuestionBtn"
            );

        const removeButton =
            document.getElementById(
                "removeQuestionBtn"
            );

        const deleteAllButton =
            document.getElementById(
                "deleteAllQuestionsBtn"
            );

        const questionCount =
            document.getElementById(
                "questionCount"
            );


        // =====================================================
        // LOAD QUESTIONS
        // =====================================================

        async function loadQuestions() {

            console.log(
                "LOADING QUESTIONS"
            );

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

                list.innerHTML = "";


                questions.forEach(
                    (question, index) => {

                        const option =
                            document.createElement(
                                "option"
                            );

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


                questionCount.textContent =
                    "Questions Loaded: " +
                    questions.length;


                console.log(
                    "QUESTIONS LOADED:",
                    questions.length
                );


            } catch (error) {

                console.error(
                    "LOAD QUESTIONS ERROR:",
                    error
                );

                questionCount.textContent =
                    "Unable to load questions";

            }

        }


        // =====================================================
        // ADD QUESTION
        // =====================================================

        async function addQuestion() {

            console.log(
                "ADD QUESTION CLICKED"
            );


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


                console.log(
                    "ADD RESULT:",
                    result
                );


                if (
                    !response.ok ||
                    !result.success
                ) {

                    throw new Error(
                        result.error ||
                        "Error adding question"
                    );

                }


                alert(
                    "Question Added"
                );


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
                    "Server error adding question:\n" +
                    error.message
                );

            }

        }


        // =====================================================
        // REMOVE SELECTED QUESTIONS
        // =====================================================

        async function removeQuestion() {

            const selected =
                [
                    ...list.selectedOptions
                ];


            if (
                selected.length === 0
            ) {

                alert(
                    "Select question(s) first"
                );

                return;

            }


            if (
                !confirm(
                    "Remove selected question(s)?"
                )
            ) {

                return;

            }


            try {

                for (
                    const item of selected
                ) {

                    console.log(
                        "REMOVING QUESTION:",
                        item.value
                    );


                    const response =
                        await fetch(
                            "/api/questions/" +
                            item.value,
                            {
                                method:
                                    "DELETE"
                            }
                        );


                    const result =
                        await response.json();


                    console.log(
                        "REMOVE RESULT:",
                        result
                    );


                    if (
                        !response.ok ||
                        !result.success
                    ) {

                        throw new Error(
                            result.error ||
                            "Failed to remove question " +
                            item.value
                        );

                    }

                }


                await loadQuestions();


            } catch (error) {

                console.error(
                    "REMOVE QUESTION ERROR:",
                    error
                );

                alert(
                    "Unable to remove question(s):\n" +
                    error.message
                );

            }

        }


        // =====================================================
        // DELETE ALL QUESTIONS
        // =====================================================

        async function deleteAllQuestions() {

            console.log(
                "DELETE ALL BUTTON CLICKED"
            );


            if (
                !confirm(
                    "Delete ALL questions?\n\nThis cannot be undone."
                )
            ) {

                console.log(
                    "DELETE ALL CANCELLED"
                );

                return;

            }


            try {

                console.log(
                    "SENDING DELETE ALL REQUEST"
                );


                const response =
                    await fetch(
                        "/api/questions/delete-all",
                        {
                            method:
                                "DELETE"
                        }
                    );


                console.log(
                    "DELETE ALL HTTP STATUS:",
                    response.status
                );


                const result =
                    await response.json();


                console.log(
                    "DELETE ALL RESULT:",
                    result
                );


                if (
                    !response.ok ||
                    !result.success
                ) {

                    throw new Error(
                        result.error ||
                        "Delete failed"
                    );

                }


                alert(
                    "Deleted " +
                    result.deleted +
                    " question(s)."
                );


                await loadQuestions();


            } catch (error) {

                console.error(
                    "DELETE ALL QUESTIONS ERROR:",
                    error
                );

                alert(
                    "Unable to delete questions:\n" +
                    error.message
                );

            }

        }


        // =====================================================
        // BUTTON CONNECTIONS
        // =====================================================

        if (addButton) {

            addButton.onclick =
                addQuestion;

        } else {

            console.error(
                "ADD BUTTON NOT FOUND"
            );

        }


        if (removeButton) {

            removeButton.onclick =
                removeQuestion;

        } else {

            console.error(
                "REMOVE BUTTON NOT FOUND"
            );

        }


        if (deleteAllButton) {

            deleteAllButton.onclick =
                deleteAllQuestions;

        } else {

            console.error(
                "DELETE ALL BUTTON NOT FOUND"
            );

        }


        // =====================================================
        // INITIAL LOAD
        // =====================================================

        loadQuestions();

    }
);
