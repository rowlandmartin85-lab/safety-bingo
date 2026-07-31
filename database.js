const sqlite3 = require("sqlite3").verbose();
const path = require("path");


const dbPath =
path.join(
    __dirname,
    "questions.db"
);


const db =
new sqlite3.Database(
    dbPath
);



function initializeDatabase(){

    db.serialize(()=>{


        db.run(`

            CREATE TABLE IF NOT EXISTS questions (

                id INTEGER PRIMARY KEY,

                category TEXT,

                difficulty TEXT,

                question TEXT,

                answer TEXT

            )

        `);


    });


}



module.exports = {

    db,

    initializeDatabase

};
