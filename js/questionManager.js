console.log("QUESTION MANAGER LOADED");

document.addEventListener("DOMContentLoaded",()=>{

const list=document.getElementById("questionList");
const questionInput=document.getElementById("newQuestion");
const answerInput=document.getElementById("newAnswer");
const addButton=document.getElementById("addQuestionBtn");
const removeButton=document.getElementById("removeQuestionBtn");
const deleteAllButton=document.getElementById("deleteAllQuestionsBtn");
const questionCount=document.getElementById("questionCount");


async function loadQuestions(){

try{

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


questionCount.textContent=
"Questions Loaded: "+questions.length;


}catch(error){

console.error(
"LOAD QUESTIONS ERROR:",
error
);

}

}



async function addQuestion(){

console.log("ADD QUESTION CLICKED");


const question=
questionInput.value.trim();

const answer=
answerInput.value.trim();


if(!question||!answer){

alert(
"Enter both question and answer"
);

return;

}


try{

const response=
await fetch(
"/api/questions/add",
{

method:"POST",

headers:{
"Content-Type":"application/json"
},

body:JSON.stringify({

q:question,

a:answer,

question:question,

answer:answer

})

}
);


const result=
await response.json();


console.log(
"ADD RESULT:",
result
);


if(result.success){

alert(
"Question Added"
);


questionInput.value="";
answerInput.value="";


loadQuestions();


}else{

alert(
"Error adding question"
);

}


}catch(error){

console.error(
"ADD QUESTION ERROR:",
error
);

alert(
"Server error adding question"
);

}


}



async function removeQuestion(){

const selected=
[...list.selectedOptions];


if(selected.length===0){

alert(
"Select question(s) first"
);

return;

}


if(!confirm(
"Remove selected question(s)?"
))return;


for(const item of selected){

await fetch(
"/api/questions/"+item.value,
{
method:"DELETE"
}
);

}


loadQuestions();

}



async function deleteAllQuestions(){

if(!confirm(
"Delete ALL questions?"
))return;


const response=
await fetch(
"/api/questions/delete-all",
{
method:"DELETE"
}
);


const result=
await response.json();


if(result.success){

loadQuestions();

}else{

alert(
"Delete failed"
);

}

}



if(addButton){

addButton.onclick=
addQuestion;

}else{

console.error(
"ADD BUTTON NOT FOUND"
);

}


if(removeButton){

removeButton.onclick=
removeQuestion;

}


if(deleteAllButton){

deleteAllButton.onclick=
deleteAllQuestions;

}


loadQuestions();


});
