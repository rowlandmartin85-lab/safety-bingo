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
    // LOCAL STORAGE
    // =====================================================

    const STORAGE_KEY =
        "safetyBingoSelectedQuestions";


    function getSavedSelection() {

        try {

            const saved =
                localStorage.getItem(
                    STORAGE_KEY
                );

            if (!saved) {
                return [];
            }

            const parsed =
                JSON.parse(saved);

            if (!Array.isArray(parsed)) {
                return [];
            }

            return [
                ...new Set(
                    parsed
                        .map(Number)
                        .filter(
                            id =>
                                Number.isInteger(id) &&
                                id > 0
                        )
                )
            ];

        } catch (error) {

            console.error(
                "READ SAVED SELECTION ERROR:",
                error
            );

            return [];

        }

    }


    function saveSelection(ids) {

        const cleanIds =
            [
                ...new Set(
                    ids
                        .map(Number)
                        .filter(
                            id =>
                                Number.isInteger(id) &&
                                id > 0
                        )
                )
            ];

        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(cleanIds)
        );

        console.log(
            "SAVED QUESTION SELECTION:",
            cleanIds
        );

    }


    function clearSelection() {

        localStorage.removeItem(
            STORAGE_KEY
        );

        console.log(
            "QUESTION SELECTION CLEARED"
        );

    }


    // =====================================================
    // GET SELECTED QUESTION IDS
    // =====================================================

    function getSelectedIds() {

        if (!list) {
            return [];
        }

        return [
            ...list.selectedOptions
        ].map(
            option =>
                Number(
                    option.value
                )
        );

    }


    // =====================================================
    // UPDATE COUNT
    // =====================================================

    function updateCount() {

        if (!questionCount) {
            return;
        }

        const count =
            getSelectedIds().length;

        questionCount.textContent =
            "Questions Selected: " +
            count;

    }


    // =====================================================
    // SAVE CURRENT SELECTION
    // =====================================================

    function saveCurrentSelection() {

        const ids =
            getSelectedIds();

        saveSelection(
            ids
        );

        updateCount();

    }


    // =====================================================
    // LOAD QUESTIONS
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


            /*
            Get previously selected IDs.
            */

            const savedIds =
                getSavedSelection();


            /*
            Only restore IDs that still
            exist in the database.
            */

            const validIds =
                savedIds.filter(
                    savedId =>
                        questions.some(
                            question =>
                                Number(
                                    question.id
                                ) ===
                                Number(
                                    savedId
                                )
                        )
                );


            /*
            Remove deleted questions from
            localStorage.
            */

            if (
                validIds.length !==
                savedIds.length
            ) {

                saveSelection(
                    validIds
                );

            }


            list.innerHTML =
                "";


            // =================================================
            // BUILD QUESTION LIST
            // =================================================

            questions.forEach(
                (question, index) => {

                    const option =
                        document.createElement(
                            "option"
                        );


                    /*
                    IMPORTANT:

                    Database ID is NOT the visible
                    question number.

                    The visible number is based on
                    the current list position.

                    Therefore:

                    1
                    2
                    3
                    4
                    5

                    always stays sequential.
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


                    /*
                    Restore selection after
                    browser reload.
                    */

                    if (
                        validIds.includes(
                            Number(
                                question.id
                            )
                        )
                    ) {

                        option.selected =
                            true;

                    }


                    list.appendChild(
                        option
                    );

                }
            );


            updateCount();


            console.log(
                "QUESTIONS LOADED:",
                questions.length
            );

            console.log(
                "RESTORED QUESTIONS:",
                validIds
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
    // SELECTION CHANGE
    // =====================================================

    if (list) {

        list.addEventListener(
            "change",
            () => {

                /*
                Save immediately whenever
                the user selects/deselects.
                */

                saveCurrentSelection();

            }
        );

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


            questionInput.value =
                "";

            answerInput.value =
                "";


            /*
            Reload list.

            Existing selections remain
            because they are stored in
            localStorage.
            */

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


        const deletedIds =
            selected.map(
                option =>
                    Number(
                        option.value
                    )
            );


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

                    console.error(
                        "DELETE FAILED:",
                        option.value
                    );

                }

            }


            /*
            Remove deleted questions from
            the persistent selection.
            */

            const currentIds =
                getSavedSelection();


            const remainingIds =
                currentIds.filter(
                    id =>
                        !deletedIds.includes(
                            Number(id)
                        )
                );


            saveSelection(
                remainingIds
            );


            /*
            Reload the list.

            Remaining selections are restored.
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
                "Delete ALL questions?"
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
            Database is empty.

            Therefore clear the persistent
            selection too.
            */

            clearSelection();


            list.innerHTML =
                "";


            updateCount();


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
