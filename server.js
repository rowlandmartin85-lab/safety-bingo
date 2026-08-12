// =====================================================
// PHYSICAL QR BINGO CLAIM
// =====================================================
//
// A physical-card QR scan sends a Card ID to the server.
// The server forwards the claim to the registered host.
//
// This does NOT affect the digital Bingo claim system.
// =====================================================

app.get("/physical-claim", (req, res) => {

    const cardId = Number(req.query.card);

    if (!Number.isInteger(cardId) || cardId <= 0) {

        return res.status(400).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport"
                      content="width=device-width,initial-scale=1.0">
                <title>Safety Bingo</title>
            </head>

            <body style="
                font-family:Arial,sans-serif;
                text-align:center;
                padding:40px;
                background:#050914;
                color:white;
            ">

                <h1>Invalid Bingo Card</h1>

                <p>
                    This QR code does not contain a valid
                    Bingo Card ID.
                </p>

            </body>
            </html>
        `);

    }

    console.log(
        "PHYSICAL QR CLAIM:",
        cardId
    );

    // Make sure a host is currently connected.
    if (!hostSocketId) {

        return res.status(503).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport"
                      content="width=device-width,initial-scale=1.0">
                <title>Safety Bingo</title>
            </head>

            <body style="
                font-family:Arial,sans-serif;
                text-align:center;
                padding:40px;
                background:#050914;
                color:white;
            ">

                <h1>Host Not Available</h1>

                <p>
                    The Bingo host is not currently connected.
                </p>

                <p>
                    Please notify the host and try again.
                </p>

            </body>
            </html>
        `);

    }

    // Make sure a game is actually running.
    if (gameState.status !== "running") {

        return res.status(409).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport"
                      content="width=device-width,initial-scale=1.0">
                <title>Safety Bingo</title>
            </head>

            <body style="
                font-family:Arial,sans-serif;
                text-align:center;
                padding:40px;
                background:#050914;
                color:white;
            ">

                <h1>Game Not Active</h1>

                <p>
                    There is no active Bingo game right now.
                </p>

            </body>
            </html>
        `);

    }

    // Send the claim directly to the Host Control.
    io.to(hostSocketId).emit(
        "physicalWinRequested",
        {
            cardId: cardId,
            timestamp: Date.now()
        }
    );

    console.log(
        "PHYSICAL BINGO CLAIM SENT TO HOST:",
        cardId
    );

    // Tell the person who scanned the QR
    // that the claim was successfully received.
    res.send(`
        <!DOCTYPE html>
        <html>

        <head>

            <meta charset="UTF-8">

            <meta
                name="viewport"
                content="width=device-width,initial-scale=1.0"
            >

            <title>Safety Bingo</title>

        </head>

        <body style="
            margin:0;
            min-height:100vh;
            display:flex;
            justify-content:center;
            align-items:center;
            font-family:Arial,sans-serif;
            background:radial-gradient(
                circle at top,
                #0b1b3a,
                #050914
            );
            color:white;
            text-align:center;
        ">

            <div style="
                width:min(90%,500px);
                padding:40px 25px;
                border-radius:20px;
                background:rgba(17,24,39,.95);
                border:2px solid rgba(255,215,0,.35);
                box-shadow:0 20px 45px rgba(0,0,0,.55);
            ">

                <div style="
                    font-size:60px;
                    margin-bottom:15px;
                ">
                    ✓
                </div>

                <h1 style="
                    color:#FFD700;
                    margin-bottom:15px;
                ">
                    BINGO CLAIM SENT
                </h1>

                <p style="
                    font-size:22px;
                    font-weight:bold;
                ">
                    Card #${cardId}
                </p>

                <p style="
                    color:#cbd5e1;
                    font-size:18px;
                    line-height:1.5;
                ">
                    Your Bingo claim has been sent
                    to the host for verification.
                </p>

                <p style="
                    color:#22c55e;
                    font-weight:bold;
                    margin-top:25px;
                ">
                    Please wait for the host to check your card.
                </p>

            </div>

        </body>

        </html>
    `);

});
