console.log("HOST.JS LOADED");
/*
==========================================
SAFETY BINGO HOST MAIN CONTROLLER
==========================================
*/


console.log(
    "HOST MAIN LOADER START"
);

document.addEventListener(
    "DOMContentLoaded",
    ()=>{


        console.log(
            "HOST DOM READY"
        );



        /*
        ==============================
        LOAD UI
        ==============================
        */


        if(
            typeof initializeHostUI === "function"
        ){

            initializeHostUI();

        }
        else{

            console.error(
                "HOST UI MISSING"
            );

        }


        /*
        ==============================
        START GAME MODULE
        ==============================
        */


        if(
            typeof initializeHostGame === "function"
        ){

            initializeHostGame();

        }
        else{

            console.error(
                "HOST GAME MISSING"
            );

        }


        /*
        ==============================
        START PRINTER
        ==============================
        */


        if(
            typeof initializeHostPrinter === "function"
        ){

            initializeHostPrinter();

        }
        else{

            console.warn(
                "HOST PRINTER NOT FOUND"
            );

        }

        /*
        ==============================
        START CARD CHECKER
        ==============================
        */


        if(
            typeof initializeHostChecker === "function"
        ){

            initializeHostChecker();

        }
        else{

            console.warn(
                "HOST CHECKER NOT FOUND"
            );

        }

        /*
        ==============================
        START DIGITAL AUDIT
        ==============================
        */


        if(
            typeof initializeHostAudit === "function"
        ){

            initializeHostAudit();

        }
        else{

            console.warn(
                "HOST AUDIT NOT FOUND"
            );

        }

        console.log(
            "SAFETY BINGO HOST READY"
        );


    }
);

// =====================================================
// HOST REFERENCE BUTTONS
// =====================================================

function initializeHostReferenceButtons(){

    console.log(
        "INITIALIZING HOST REFERENCE BUTTONS"
    );


    const answerKeyBtn =
    document.getElementById(
        "answerKeyBtn"
    );


    if(answerKeyBtn){

        answerKeyBtn.addEventListener(
            "click",
            ()=>{

                window.open(
                    "/answerkey.html",
                    "_blank"
                );

            }
        );

    }
    else{

        console.warn(
            "answerKeyBtn not found"
        );

    }



    const cheatSheetBtn =
    document.getElementById(
        "cheatSheetBtn"
    );


    if(cheatSheetBtn){

        cheatSheetBtn.addEventListener(
            "click",
            ()=>{

                window.open(
                    "/cheatsheet.html",
                    "_blank"
                );

            }
        );

    }
    else{

        console.warn(
            "cheatSheetBtn not found"
        );

    }


}


document.addEventListener(
    "DOMContentLoaded",
    ()=>{

        initializeHostReferenceButtons();

    }
);

// =====================================================
// HOME BUTTON
// =====================================================

function initializeHomeButton(){


    console.log(
        "INITIALIZING HOME BUTTON"
    );


    const homeBtn =
    document.getElementById(
        "homeBtn"
    );


    const homeModal =
    document.getElementById(
        "homeModal"
    );


    const cancelHome =
    document.getElementById(
        "cancelHome"
    );


    const confirmHome =
    document.getElementById(
        "confirmHome"
    );



    if(homeBtn && homeModal){

        homeBtn.addEventListener(
            "click",
            ()=>{

                homeModal.classList.add(
                    "show"
                );

            }
        );

    }



    if(cancelHome){

        cancelHome.addEventListener(
            "click",
            ()=>{

                homeModal.classList.remove(
                    "show"
                );

            }
        );

    }



    if(confirmHome){

        confirmHome.addEventListener(
            "click",
            ()=>{


                if(window.hostSocket){

                    window.hostSocket.emit(
                        "hostReset"
                    );

                }


                window.location.href =
                "/index.html";


            }
        );

    }



    console.log(
        "HOME BUTTON READY"
    );

}



document.addEventListener(
    "DOMContentLoaded",
    ()=>{

        initializeHomeButton();

    }
);

/*
==========================================
HOME BUTTON SYSTEM
==========================================
*/

document.addEventListener(
    "DOMContentLoaded",
    ()=>{


        const homeBtn =
        document.getElementById(
            "homeBtn"
        );


        const homeModal =
        document.getElementById(
            "homeModal"
        );


        const cancelHome =
        document.getElementById(
            "cancelHome"
        );


        const confirmHome =
        document.getElementById(
            "confirmHome"
        );



        console.log(
            "HOME ELEMENTS",
            {
                homeBtn,
                homeModal,
                cancelHome,
                confirmHome
            }
        );



        if(homeBtn){


            homeBtn.onclick = ()=>{


                console.log(
                    "HOME CLICK RECEIVED"
                );


                if(homeModal){


                    homeModal.style.display =
                    "flex";


                    console.log(
                        "HOME MODAL OPENED"
                    );


                }
                else{


                    console.log(
                        "HOME MODAL NOT FOUND"
                    );


                }


            };


        }




        if(cancelHome){


            cancelHome.onclick = ()=>{


                homeModal.style.display =
                "none";


            };


        }





        if(confirmHome){


            confirmHome.onclick = ()=>{


                if(window.hostSocket){


                    window.hostSocket.emit(
                        "hostReset"
                    );


                }


                window.location.href =
                "/index.html";


            };


        }



    }
);