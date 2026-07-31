console.log(
    "QUESTION MANAGER LOADED"
);



const list =
document.getElementById(
    "questionList"
);



async function loadQuestions(){


    console.log(
        "LOADING QUESTIONS..."
    );


    try{


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
                " | Answer: " +
                question.a;



                list.appendChild(
                    option
                );


            }
        );

        console.log(
            "QUESTIONS LOADED:",
            questions.length
        );


    }

    catch(error){


        console.error(
            "QUESTION LOAD ERROR:",
            error
        );


    }


}


document.addEventListener(
    "DOMContentLoaded",
    ()=>{


        loadQuestions();


    }
);
