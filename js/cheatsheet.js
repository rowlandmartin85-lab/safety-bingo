const socket=io();

const questionList=document.getElementById("questionList");

let askedQuestions=[];

socket.on("gameReset",()=>{

console.log("ANSWER KEY RESET RECEIVED");

askedQuestions=[];

questionList.innerHTML="<h2>Waiting for game to start...</h2>";

});

socket.on("cheatSheetQuestion",q=>{

askedQuestions.push(q);

renderQuestions();

});

function renderQuestions(){

questionList.innerHTML="";

askedQuestions.forEach(q=>{

questionList.innerHTML+=`

<div class="question current">

<div class="number">
Question ${q.id}
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

window.scrollTo({
top:document.body.scrollHeight,
behavior:"smooth"
});

}

questionList.innerHTML="<h2>Waiting for game to start...</h2>";
