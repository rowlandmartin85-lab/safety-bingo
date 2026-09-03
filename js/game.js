"use strict";

/** Safety Bingo Client State Mirror */
const Game = {
state: "home",
currentQuestionIndex: -1,
currentQuestion: "",
currentAnswer: ""
};

socket?.on("gameState", (serverState) => {
if (!serverState) return;

Game.state = serverState.status;
Game.currentQuestionIndex = serverState.currentQuestionIndex;
Game.currentQuestion = serverState.currentQuestion || "";
Game.currentAnswer = serverState.currentAnswer || "";

const questionDisplay = document.getElementById("questionDisplay") || document.getElementById("questionBox");
if (questionDisplay) {
questionDisplay.textContent =
Game.state === "idle" ? "Waiting for host to start..." :
Game.state === "ended" ? "GAME OVER" :
Game.currentQuestion;
}

document.getElementById("answerBox") && (document.getElementById("answerBox").textContent = Game.currentAnswer);
});

No file chosen
Ask anything privately...
