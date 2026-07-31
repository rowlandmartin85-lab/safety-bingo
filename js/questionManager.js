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
            question.q +
            " | " +
            question.a;


            list.appendChild(
                option
            );


        }
    );


}


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

                q:
                question,


                a:
                answer


            })

        }
    );



    const result =
    await response.json();


    if(
        result.success
    ){

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


addButton.addEventListener(
    "click",
    addQuestion
);


document.addEventListener(
    "DOMContentLoaded",
    ()=>{


        loadQuestions();


    }
);
