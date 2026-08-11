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
        // SAVED QUESTION SELECTION
        // =====================================================

        const SAVED_SELECTION_KEY =
            "safetyBingoSelectedQuestions";


        function getSavedQuestionIDs() {

            try {

                const saved =
                    localStorage.getItem(
                        SAVED_SELECTION_KEY
                    );

                if (!saved) {
                    return [];
                }

                const parsed =
                    JSON.parse(saved);

                if (!Array.isArray(parsed)) {
                    return [];
                }

                return parsed.map(
                    id => String(id)
                );

            } catch (error) {

                console.error(
                    "LOAD SAVED SELECTION ERROR:",
                    error
                );

                return [];

            }

        }


        function saveSelectedQuestionIDs() {

            const selectedIDs =
                [
                    ...list.selectedOptions
                ].map(
                    option =>
                        String(option.value)
                );

            localStorage.setItem(
                SAVED_SELECTION_KEY,
                JSON.stringify(
                    selectedIDs
                )
            );

            console.log(
                "SAVED SELECTED QUESTIONS:",
                selectedIDs
            );

            updateQuestionCount();

        }


        function restoreSelectedQuestions() {

            const savedIDs =
                getSavedQuestionIDs();

            if (
                savedIDs.length === 0
            ) {

                updateQuestionCount();

                return;

            }


            const savedSet =
                new Set(
                    savedIDs
                );


            [
                ...list.options
            ].forEach(
                option => {

                    option.selected =
                        savedSet.has(
                            String(
                                option.value
                            )
                        );

                }
            );


            updateQuestionCount();


            console.log(
                "RESTORED SELECTED QUESTIONS:",
                savedIDs
            );

        }


        function cleanSavedSelection(
            questions
        ) {

            const validIDs =
                new Set(
                    questions.map(
                        question =>
                            String(
                                question.id
                            )
                    )
                );


            const savedIDs =
                getSavedQuestionIDs();


            const cleanedIDs =
                savedIDs.filter(
                    id =>
                        validIDs.has(id)
                );


            localStorage.setItem(
                SAVED_SELECTION_KEY,
                JSON.stringify(
                    cleanedIDs
                )
            );

        }


        // =====================================================
        // QUESTION COUNT
        // =====================================================

        function updateQuestionCount() {

            const selectedCount =
                list
                    ? list.selectedOptions.length
                    : 0;


            questionCount.textContent =
                "Questions Selected: " +
                selectedCount;

        }


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


                list.innerHTML =
                    "";


                // =================================================
                // Remove saved IDs for questions that no longer
                // exist in the database.
                // =================================================

                cleanSavedSelection(
                    questions
                );


                // =================================================
                // Create question options
                // =================================================

                questions.forEach(
                    (
                        question,
                        index
                    ) => {

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


                // =================================================
                // Restore previously selected questions
                // =================================================

                restoreSelectedQuestions();


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
        // SELECTION CHANGE
        // =====================================================

        if (list) {

            list.addEventListener(
                "change",
                () => {

                    console.log(
                        "QUESTION SELECTION CHANGED"
                    );

                    saveSelectedQuestionIDs();

                }
            );

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


                    // =================================================
                    // Remove deleted question from saved selection.
                    // =================================================

                    const savedIDs =
                        getSavedQuestionIDs();


                    const updatedIDs =
                        savedIDs.filter(
                            id =>
                                id !==
                                String(
                                    item.value
                                )
                        );


                    localStorage.setItem(
                        SAVED_SELECTION_KEY,
                        JSON.stringify(
                            updatedIDs
                        )
                    );

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


                // =================================================
                // Delete All means clear saved selections too.
                // =================================================

                localStorage.removeItem(
                    SAVED_SELECTION_KEY
                );


                // =================================================
                // Clear the list WITHOUT refreshing the page.
                // =================================================

                list.innerHTML =
                    "";


                updateQuestionCount();


                alert(
                    "Deleted " +
                    result.deleted +
                    " question(s)."
                );


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
