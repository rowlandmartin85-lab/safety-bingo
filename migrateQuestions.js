const fs = require("fs");
const path = require("path");

const {
    db,
    initializeDatabase
}
=
require("./database");


const questionFile =
path.join(
    __dirname,
    "questions.json"
);



initializeDatabase();



const questions =
JSON.parse(
    fs.readFileSync(
        questionFile,
        "utf8"
    )
);



db.serialize(()=>{


    const statement =
    db.prepare(`

        INSERT OR REPLACE INTO questions
        (
            id,
            category,
            difficulty,
            question,
            answer
        )

        VALUES
        (
            ?,
            ?,
            ?,
            ?,
            ?
        )

    `);



    questions.forEach(q=>{


        statement.run(

            q.id,

            q.category,

            q.difficulty,

            q.question,

            q.answer

        );


    });



    statement.finalize();



    console.log(
        "QUESTIONS MIGRATED:",
        questions.length
    );


});
