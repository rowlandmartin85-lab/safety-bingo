/**
 * Safety Bingo - Deterministic Card Generator Engine
 * -----------------------------------------------
 * Generates identical 5x5 bingo layouts from the same Card ID.
 * Used by host.html, host.js, and player verification.
 */

(function () {

    /**
     * Seeded Random Generator
     * Linear Congruential Generator (LCG)
     */
    function createSeededRandom(seed) {
        let currentSeed = parseInt(seed, 10);

        if (isNaN(currentSeed) || currentSeed < 1) {
            currentSeed = 1;
        }

        return function () {
            currentSeed =
                (currentSeed * 1664525 + 1013904223) %
                4294967296;

            return currentSeed / 4294967296;
        };
    }


    /**
     * Safety Phrase Database
     * Must contain at least 24 entries
     */
    const safetyPhrases = [
        "Wear Your PPE",
        "Keep Walkways Clear",
        "Report All Hazards",
        "Fire Extinguisher Box",
        "First Aid Kit Ready",
        "Lift With Your Legs",
        "Wipe Up Spills Fast",
        "Safety Glasses On",
        "Hold The Handrails",
        "Caution Wet Floor",
        "Lockout Tagout Safe",
        "Emergency Exit Clear",
        "Read The SDS Sheets",
        "No Loose Clothing",
        "Inspect Your Tools",
        "Stay Alert Stay Alive",
        "Watch Your Step",
        "Teamwork Safety First",
        "Keep Fire Doors Shut",
        "Proper Ventilation",
        "Store Chemicals Right",
        "Report Near Misses",
        "Clean Workstations",
        "Ergonomic Seating",
        "Know Evacuation Paths",
        "Check Ladder Rungs",
        "Wear Hearing Armor",
        "No Blocked Panels"
    ];


    /**
     * Escape HTML characters
     * Prevents unsafe rendering in generated cards
     */
    function escapeHTML(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    /**
     * Generate Single Card
     */
    window.generateCard = function (cardId) {

        const numericID = parseInt(cardId, 10);

        const safeID =
            isNaN(numericID) || numericID < 1
                ? 1
                : numericID;


        const random = createSeededRandom(safeID);


        let shuffled = [...safetyPhrases];


        // Fisher-Yates deterministic shuffle
        for (let i = shuffled.length - 1; i > 0; i--) {

            const j = Math.floor(
                random() * (i + 1)
            );

            const temp = shuffled[i];
            shuffled[i] = shuffled[j];
            shuffled[j] = temp;
        }


        const grid = [];

        let pointer = 0;


        for (let row = 0; row < 5; row++) {

            for (let col = 0; col < 5; col++) {


                if (row === 2 && col === 2) {

                    grid.push({
                        text: "FREE SPACE",
                        safeText: "FREE SPACE",
                        marked: true,
                        isFreeSpace: true
                    });

                } else {

                    const phrase = shuffled[pointer];
                        grid.push({
                        id: pointer,
                        text: phrase,
                        safeText: escapeHTML(phrase),
                        marked: false,
                        isFreeSpace: false
                    });
                    pointer++;
                }
            }
        }


        return {
            id: safeID,
            grid: grid
        };
    };


    /**
     * Generate Multiple Cards
     */
    window.generateBingoCards = function (
        startId,
        totalCount
    ) {

        const firstID =
            parseInt(startId, 10) || 1;


        const amount =
            parseInt(totalCount, 10) || 1;


        const cards = [];


        for (
            let i = 0;
            i < amount;
            i++
        ) {

            cards.push(
                window.generateCard(
                    firstID + i
                )
            );

        }


        return cards;
    };


})();

