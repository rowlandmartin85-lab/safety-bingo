"use strict";

const Game = { state: "home", currentQuestionIndex: -1, currentQuestion: "", currentAnswer: "" };

socket?.on("gameState", (s) => {
if (!s) return;

Object.assign(Game, {
state: s.status,
currentQuestionIndex: s.currentQuestionIndex,
currentQuestion: s.currentQuestion || "",
currentAnswer: s.currentAnswer || ""
});

const qBox = document.getElementById("questionDisplay") || document.getElementById("questionBox");
if (qBox) qBox.textContent = Game.state === "idle" ? "Waiting..." : Game.state === "ended" ? "GAME OVER" : Game.currentQuestion;

const aBox = document.getElementById("answerBox");
if (aBox) aBox.textContent = Game.currentAnswer;
});

