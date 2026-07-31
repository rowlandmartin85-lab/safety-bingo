const fs = require("fs");
const path = require("path");

const {
    pool,
    initializeDatabase
} = require("./database");


const questionFile =
path.join(
    __dirname,
    "questions.json"
);



async function migrate(){


    await initializeDatabase();



    const questions =
    JSON.parse(
        fs.readFileSync(
            questionFile,
            "utf8"
        )
    );



    for(const q of questions){


        await pool.query(

            `
            INSERT INTO questions
            (
                id,
                category,
                difficulty,
                question,
                answer
            )

            VALUES
            ($1,$2,$3,$4,$5)

            ON CONFLICT(id)
            DO UPDATE SET

                category=$2,
                difficulty=$3,
                question=$4,
                answer=$5

            `,

            [

                q.id,

                q.category ||
                "General",

                q.difficulty ||
                "Medium",

                q.question,

                q.answer

            ]

        );


    }



    console.log(

        "QUESTIONS MIGRATED:",
        questions.length

    );


    await pool.end();


}



migrate();
