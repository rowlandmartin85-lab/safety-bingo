"use strict";

console.log("QUESTION MANAGER LOADED");

document.addEventListener("DOMContentLoaded", () => {
    const list = document.getElementById("questionList");
    const questionInput = document.getElementById("newQuestion");
    const answerInput = document.getElementById("newAnswer");
    const addButton = document.getElementById("addQuestionBtn");
    const removeButton = document.getElementById("removeQuestionBtn");
    const deleteAllButton = document.getElementById("deleteAllQuestionsBtn");
    const questionCount = document.getElementById("questionCount");

    let storedQuestionIds = [];

    async function loadQuestions() {
        try {
            console.log("LOADING QUESTIONS FROM DATABASE...");
            const response = await fetch("/api/questions");
            if (!response.ok) {
                throw new Error("Failed to load questions. HTTP " + response.status);
            }
            const questions = await response.json();
            console.log("QUESTIONS RECEIVED:", questions);
            list.innerHTML = "";
            storedQuestionIds = questions.map(question => Number(question.id));
            console.log("STORED QUESTION IDS:", storedQuestionIds);
            questions.forEach((question, index) => {
                const option = document.createElement("option");
                option.value = question.id;
                option.textContent = (index + 1) + " - " + (question.question || question.q || "") + " | " + (question.answer || question.a || "");
                option.selected = true;
                list.appendChild(option);
            });
            questionCount.textContent = "Questions Stored: " + questions.length;
            console.log("QUESTION MANAGER NOW HAS " + questions.length + " STORED QUESTIONS");
            updateStoredQuestionIds();
        } catch (error) {
            console.error("LOAD QUESTIONS ERROR:", error);
            questionCount.textContent = "Questions Stored: 0";
        }
    }

    function updateStoredQuestionIds() {
        if (!list) return;
        storedQuestionIds = [...new Set([...list.selectedOptions].map(option => Number(option.value)).filter(id => Number.isInteger(id) && id > 0))];
        console.log("CURRENT STORED QUESTION IDS:", storedQuestionIds);
    }

    if (list) {
        list.addEventListener("change", () => {
            updateStoredQuestionIds();
            console.log("QUESTION SELECTION UPDATED:", storedQuestionIds);
        });
    }

    async function addQuestion() {
        console.log("ADD QUESTION CLICKED");
        const question = questionInput.value.trim();
        const answer = answerInput.value.trim();
        if (!question || !answer) {
            alert("Enter both question and answer");
            return;
        }
        if (addButton) addButton.disabled = true;
        try {
            console.log("ADDING QUESTION TO DATABASE...");
            const response = await fetch("/api/questions/add", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ q: question, a: answer, question: question, answer: answer })
            });
            const result = await response.json();
            console.log("ADD RESULT:", result);
            if (!response.ok || !result.success) {
                alert(result.error || "Error adding question");
                return;
            }
            console.log("QUESTION SUCCESSFULLY STORED:", result);
            questionInput.value = "";
            answerInput.value = "";
            await loadQuestions();
            alert("Question Added");
        } catch (error) {
            console.error("ADD QUESTION ERROR:", error);
            alert("Server error adding question");
        } finally {
            if (addButton) addButton.disabled = false;
        }
    }

    async function removeQuestion() {
        updateStoredQuestionIds();
        const selected = [...list.selectedOptions];
        if (selected.length === 0) {
            alert("Select question(s) first");
            return;
        }
        if (!confirm("Remove selected question(s)?")) return;
        try {
            for (const item of selected) {
                console.log("REMOVING QUESTION:", item.value);
                const response = await fetch("/api/questions/" + item.value, { method: "DELETE" });
                const result = await response.json();
                if (!response.ok || !result.success) {
                    console.error("QUESTION DELETE FAILED:", item.value, result);
                }
            }
            await loadQuestions();
        } catch (error) {
            console.error("REMOVE QUESTION ERROR:", error);
            alert("Error removing question(s)");
        }
    }

    async function deleteAllQuestions() {
        if (!confirm("Delete ALL questions?")) return;
        try {
            console.log("DELETING ALL QUESTIONS...");
            const response = await fetch("/api/questions/delete-all", { method: "DELETE" });
            const result = await response.json();
            console.log("DELETE ALL RESULT:", result);
            if (response.ok && result.success) {
                storedQuestionIds = [];
                await loadQuestions();
            } else {
                alert(result.error || "Delete failed");
            }
        } catch (error) {
            console.error("DELETE ALL QUESTIONS ERROR:", error);
            alert("Server error deleting questions");
        }
    }

    if (addButton) addButton.onclick = addQuestion;
    else console.error("ADD BUTTON NOT FOUND");

    if (removeButton) removeButton.onclick = removeQuestion;
    else console.error("REMOVE BUTTON NOT FOUND");

    if (deleteAllButton) deleteAllButton.onclick = deleteAllQuestions;
    else console.error("DELETE ALL BUTTON NOT FOUND");

    loadQuestions();
});
