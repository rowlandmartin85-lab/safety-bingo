console.log("QUESTION MANAGER LOADED");

const list=document.getElementById("questionList");
const questionInput=document.getElementById("newQuestion");
const answerInput=document.getElementById("newAnswer");
const addButton=document.getElementById("addQuestionBtn");
const removeButton=document.getElementById("removeQuestionBtn");
const deleteAllButton=document.getElementById("deleteAllQuestionsBtn");
const questionCount=document.getElementById("questionCount");

async function loadQuestions(){

const response=await fetch("/api/questions");
const questions=await response.json();

list.innerHTML="";

questions.forEach((question,index)=>{

const option=document.createElement("option");

option.value=question.id;

option.textContent=
(index+1)+" - "+
(question.question||question.q)+
" | "+
(question.answer||question.a);

list.appendChild(option);

});

if(questionCount){

questionCount.textContent=
"Questions Loaded: "+questions.length;

}

}


async function addQuestion(){

const question=questionInput.value.trim();
const answer=answerInput.value.trim();

if(!question||!answer){

alert("Enter both question and answer");
return;

}

const response=await fetch("/api/questions/add",{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
question,
answer,
q:question,
a:answer
})
});

const result=await response.json();

if(result.success){

alert("Question Added");

questionInput.value="";
answerInput.value="";

loadQuestions();

}else{

alert("Error adding question");

}

}


async function removeQuestion(){

const selected=[...list.selectedOptions];

if(selected.length===0){

alert("Select question(s) first");
return;

}

if(!confirm("Remove selected question(s)?"))return;

for(const item of selected){

await fetch(
"/api/questions/"+item.value,
{
method:"DELETE"
}
);

}

alert("Question(s) Removed");

loadQuestions();

}


async function deleteAllQuestions(){

if(!confirm("Delete ALL questions?\n\nThis cannot be undone."))return;

const response=await fetch(
"/api/questions/delete-all",
{
method:"DELETE"
}
);

const result=await response.json();

if(result.success){

alert("All Questions Deleted");

loadQuestions();

}else{

alert("Error deleting all questions");

}

}


addButton.addEventListener(
"click",
addQuestion
);

removeButton.addEventListener(
"click",
removeQuestion
);

if(deleteAllButton){

deleteAllButton.addEventListener(
"click",
deleteAllQuestions
);

}

document.addEventListener(
"DOMContentLoaded",
loadQuestions
);
