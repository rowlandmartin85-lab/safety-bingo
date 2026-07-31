const { Pool } = require("pg");


const pool = new Pool({

    connectionString:
    process.env.DATABASE_URL,


    ssl:
    {
        rejectUnauthorized:false
    }

});



async function initializeDatabase(){


    try{


        await pool.query(`

            CREATE TABLE IF NOT EXISTS questions (

                id SERIAL PRIMARY KEY,

                category TEXT DEFAULT 'General',

                difficulty TEXT DEFAULT 'Medium',

                question TEXT NOT NULL,

                answer TEXT NOT NULL

            );

        `);



        console.log(
            "DATABASE READY"
        );


    }

    catch(error){


        console.error(
            "DATABASE ERROR:",
            error.message
        );


        process.exit(1);


    }


}



module.exports = {

    pool,

    initializeDatabase

};
