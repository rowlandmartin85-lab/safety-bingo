const socket = io();


socket.on("gameReset", () => {

    console.log("ANSWER KEY RESET RECEIVED");


    window.location.href = "index.html";

});

const questionList = document.getElementById("questionList");

// Holds every question that has been asked this game
let askedQuestions = [];

// When the server resets the game
socket.on("gameReset", () => {

    askedQuestions = [];

    questionList.innerHTML = "<h2>Waiting for game to start...</h2>";

});

// When a new question is asked
socket.on("cheatSheetQuestion", (q) => {

    askedQuestions.push(q);

    renderQuestions();

});

// Build the page
function renderQuestions() {

    questionList.innerHTML = "";

    askedQuestions.forEach((q, index) => {

        questionList.innerHTML += `

        <div class="question current">

            <div class="number">
                Question ${index + 1}
            </div>

            <div class="q">
                ${q.question}
            </div>

            <div class="a">
                Answer: ${q.answer}
            </div>

        </div>

        `;

    });

    // Scroll to the newest question
    window.scrollTo({
        top: document.body.scrollHeight,
        behavior: "smooth"
    });

}

// Initial message
questionList.innerHTML = "<h2>Waiting for game to start...</h2>";