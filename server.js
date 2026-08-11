app.delete("/api/questions/delete-all", async (req, res) => {
    try {
        const result = await pool.query(`
            DELETE FROM questions
        `);

        console.log(
            "ALL QUESTIONS REMOVED:",
            result.rowCount
        );

        res.json({
            success: true,
            deleted: result.rowCount
        });

    } catch (error) {

        console.error(
            "DELETE ALL QUESTIONS ERROR:",
            error
        );

        res.status(500).json({
            success: false,
            error: error.message
        });

    }
});
