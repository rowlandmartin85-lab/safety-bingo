console.log(
    "QUESTION MANAGER LOADED"
);


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


const questionCount =
document.getElementById(
    "questionCount"
);




// =====================================
// LOAD QUESTIONS
// =====================================

async function loadQuestions(){


    const response =
    await fetch(
        "/api/questions"
    );


    const questions =
    await response.json();



    list.innerHTML="";



    questions.forEach(
        question=>{


            const option =
            document.createElement(
                "option"
            );


            option.value =
            question.id;



            option.textContent =

            question.id +
            " - " +

            (
                question.question ||
                question.q
            )

            +

            " | " +

            (
                question.answer ||
                question.a
            );


            list.appendChild(
                option
            );


        }
    );



    if(questionCount){

        questionCount.textContent =
        "Questions Loaded: " +
        questions.length;

    }


}


// =====================================
// ADD QUESTION
// =====================================

async function addQuestion(){


    const question =
    questionInput.value.trim();



    const answer =
    answerInput.value.trim();



    if(
        !question ||
        !answer
    ){

        alert(
            "Enter both question and answer"
        );

        return;

    }



    const response =
    await fetch(
        "/api/questions/add",
        {

            method:"POST",

            headers:{

                "Content-Type":
                "application/json"

            },


            body:JSON.stringify({

                question:
                question,

                answer:
                answer,

                q:
                question,

                a:
                answer

            })

        }
    );



    const result =
    await response.json();



    if(result.success){


        alert(
            "Question Added"
        );


        questionInput.value="";
        answerInput.value="";


        loadQuestions();


    }

    else{


        alert(
            "Error adding question"
        );


    }


}






// =====================================
// REMOVE QUESTION
// =====================================

async function removeQuestion(){


    const id =
    list.value;



    if(!id){

        alert(
            "Select a question first"
        );

        return;

    }



    const selectedText =
    list.options[
        list.selectedIndex
    ].text;



    const confirmDelete =
    confirm(

        "Remove this question?\n\n" +
        selectedText

    );



    if(!confirmDelete){

        return;

    }




    const response =
    await fetch(

        "/api/questions/" + id,

        {

            method:"DELETE"

        }

    );



    const result =
    await response.json();



    if(result.success){


        alert(
            "Question Removed"
        );


        loadQuestions();


    }

    else{


        alert(
            "Error removing question"
        );


    }


}


// =====================================
// BUTTONS
// =====================================


addButton.addEventListener(
    "click",
    addQuestion
);



removeButton.addEventListener(
    "click",
    removeQuestion
);



document.addEventListener(
    "DOMContentLoaded",
    ()=>{

        loadQuestions();

    }
);
