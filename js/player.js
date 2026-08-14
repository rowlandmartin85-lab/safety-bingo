"use strict";

// =====================================================
// SAFETY BINGO HOST AUDIT
// =====================================================

let hostAuditContainer = null;
let pendingHostClaims = new Map();

// =====================================================
// INITIALIZE HOST AUDIT UI
// =====================================================

function initializeHostAudit() {

    console.log("INITIALIZING HOST AUDIT UI");

    createHostAuditUI();

    if (typeof hostSocket !== "undefined" && hostSocket) {
        setupHostAuditSocketEvents(hostSocket);
        return;
    }

    // If your host socket uses a different variable,
    // call setupHostAuditSocketEvents(yourSocket)
    if (typeof socket !== "undefined" && socket) {
        setupHostAuditSocketEvents(socket);
        return;
    }

    console.warn(
        "HOST AUDIT: Host socket not found yet."
    );
}

// =====================================================
// CREATE AUDIT UI
// =====================================================

function createHostAuditUI() {

    // Don't create it twice
    if (
        document.getElementById(
            "hostBingoAuditPanel"
        )
    ) {
        hostAuditContainer =
            document.getElementById(
                "hostBingoAuditPanel"
            );

        return;
    }

    hostAuditContainer =
        document.createElement("div");

    hostAuditContainer.id =
        "hostBingoAuditPanel";

    hostAuditContainer.innerHTML = `

        <div class="host-audit-header">

            <div>
                <div class="host-audit-title">
                    BINGO AUDIT
                </div>

                <div class="host-audit-subtitle">
                    Claims waiting for host verification
                </div>
            </div>

            <div
                id="hostAuditCount"
                class="host-audit-count"
            >
                0
            </div>

        </div>

        <div
            id="hostAuditClaims"
            class="host-audit-claims"
        >

            <div class="host-audit-empty">
                No Bingo claims waiting.
            </div>

        </div>
    `;

    document.body.appendChild(
        hostAuditContainer
    );

    addHostAuditStyles();
}

// =====================================================
// AUDIT STYLES
// =====================================================

function addHostAuditStyles() {

    if (
        document.getElementById(
            "hostAuditStyles"
        )
    ) {
        return;
    }

    const style =
        document.createElement("style");

    style.id =
        "hostAuditStyles";

    style.textContent = `

        #hostBingoAuditPanel {

            position: fixed;

            right: 20px;

            top: 20px;

            width: 390px;

            max-width: calc(100vw - 40px);

            max-height: calc(100vh - 40px);

            overflow-y: auto;

            background: #101827;

            color: white;

            border: 3px solid #f59e0b;

            border-radius: 16px;

            box-shadow:
                0 15px 50px
                rgba(0,0,0,.55);

            z-index: 999999;

            font-family:
                Arial,
                Helvetica,
                sans-serif;
        }

        .host-audit-header {

            display: flex;

            justify-content:
                space-between;

            align-items: center;

            padding: 18px;

            background:
                linear-gradient(
                    135deg,
                    #1e293b,
                    #111827
                );

            border-radius:
                13px 13px 0 0;

            border-bottom:
                1px solid #334155;
        }

        .host-audit-title {

            font-size: 22px;

            font-weight: 900;

            color: #fbbf24;
        }

        .host-audit-subtitle {

            margin-top: 4px;

            font-size: 13px;

            color: #cbd5e1;
        }

        .host-audit-count {

            min-width: 38px;

            height: 38px;

            display: flex;

            align-items: center;

            justify-content: center;

            border-radius: 50%;

            background: #dc2626;

            color: white;

            font-size: 18px;

            font-weight: 900;
        }

        .host-audit-claims {

            padding: 14px;
        }

        .host-audit-empty {

            padding: 25px 10px;

            text-align: center;

            color: #94a3b8;
        }

        .host-audit-card {

            margin-bottom: 14px;

            padding: 16px;

            background: #1e293b;

            border: 2px solid #475569;

            border-radius: 12px;
        }

        .host-audit-card-number {

            font-size: 24px;

            font-weight: 900;

            color: #38bdf8;

            margin-bottom: 10px;
        }

        .host-audit-status {

            padding: 9px;

            margin-bottom: 10px;

            border-radius: 8px;

            background: #064e3b;

            color: #6ee7b7;

            font-weight: 800;

            text-align: center;
        }

        .host-audit-pattern {

            margin-bottom: 10px;

            color: #e2e8f0;

            font-size: 14px;

            line-height: 1.5;
        }

        .host-audit-marked {

            margin-bottom: 14px;

            color: #94a3b8;

            font-size: 13px;

            line-height: 1.5;
        }

        .host-audit-buttons {

            display: grid;

            grid-template-columns:
                1fr 1fr;

            gap: 10px;
        }

        .host-audit-approve,
        .host-audit-reject {

            border: 0;

            border-radius: 9px;

            padding: 13px 8px;

            font-size: 15px;

            font-weight: 900;

            cursor: pointer;
        }

        .host-audit-approve {

            background: #16a34a;

            color: white;
        }

        .host-audit-approve:hover {

            background: #15803d;
        }

        .host-audit-reject {

            background: #dc2626;

            color: white;
        }

        .host-audit-reject:hover {

            background: #b91c1c;
        }

        .host-audit-approve:disabled,
        .host-audit-reject:disabled {

            opacity: .5;

            cursor: not-allowed;
        }

        @media(max-width:700px) {

            #hostBingoAuditPanel {

                right: 10px;

                top: 10px;

                width:
                    calc(100vw - 20px);

                max-height:
                    calc(100vh - 20px);
            }
        }
    `;

    document.head.appendChild(style);
}

// =====================================================
// SETUP HOST SOCKET AUDIT EVENTS
// =====================================================

function setupHostAuditSocketEvents(socket) {

    if (!socket) {
        console.error(
            "HOST AUDIT: No socket provided."
        );

        return;
    }

    console.log(
        "HOST AUDIT SOCKET EVENTS READY"
    );

    socket.on(
        "winRequested",
        claim => {

            console.log(
                "========== BINGO CLAIM RECEIVED =========="
            );

            console.log(
                claim
            );

            addHostAuditClaim(
                socket,
                claim
            );
        }
    );

    socket.on(
        "physicalWinRequested",
        claim => {

            console.log(
                "PHYSICAL BINGO CLAIM RECEIVED:",
                claim
            );

            addHostPhysicalAuditClaim(
                socket,
                claim
            );
        }
    );

    socket.on(
        "gameReset",
        () => {

            clearHostAuditClaims();
        }
    );

    socket.on(
        "gameEnded",
        () => {

            // Don't automatically remove approved
            // history, but pending claims can no
            // longer be approved.

            console.log(
                "GAME ENDED - HOST AUDIT UPDATED"
            );
        }
    );
}

// =====================================================
// ADD DIGITAL CLAIM
// =====================================================

function addHostAuditClaim(
    socket,
    claim
) {

    if (!claim) {
        return;
    }

    const cardId =
        Number(claim.cardId);

    if (
        !Number.isInteger(cardId) ||
        cardId <= 0
    ) {
        return;
    }

    pendingHostClaims.set(
        cardId,
        claim
    );

    renderHostAuditClaims(
        socket
    );

    // Bring attention to host
    try {
        if (
            typeof window.bingoAnimation ===
            "object" &&
            window.bingoAnimation
        ) {
            // Don't use player animation here.
        }

        if (
            typeof Audio !==
            "undefined"
        ) {
            // Optional notification only.
        }
    } catch (error) {
        console.warn(
            "AUDIT NOTIFICATION ERROR:",
            error
        );
    }
}

// =====================================================
// RENDER AUDIT CLAIMS
// =====================================================

function renderHostAuditClaims(socket) {

    const container =
        document.getElementById(
            "hostAuditClaims"
        );

    const count =
        document.getElementById(
            "hostAuditCount"
        );

    if (!container) {
        return;
    }

    if (count) {
        count.textContent =
            pendingHostClaims.size;
    }

    if (
        pendingHostClaims.size === 0
    ) {

        container.innerHTML = `

            <div class="host-audit-empty">
                No Bingo claims waiting.
            </div>

        `;

        return;
    }

    container.innerHTML = "";

    pendingHostClaims.forEach(
        claim => {

            const card =
                createAuditClaimElement(
                    socket,
                    claim
                );

            container.appendChild(
                card
            );
        }
    );
}

// =====================================================
// CREATE DIGITAL AUDIT CARD
// =====================================================

function createAuditClaimElement(
    socket,
    claim
) {

    const card =
        document.createElement("div");

    card.className =
        "host-audit-card";

    const cardId =
        Number(claim.cardId);

    const pattern =
        Array.isArray(
            claim.winningPattern
        )
            ? claim.winningPattern
            : [];

    const marked =
        Array.isArray(
            claim.markedIndices
        )
            ? claim.markedIndices
            : [];

    const patternName =
        getWinningPatternName(
            pattern
        );

    card.innerHTML = `

        <div class="
            host-audit-card-number
        ">
            CARD ${escapeAuditHTML(cardId)}
        </div>

        <div class="
            host-audit-status
        ">
            ✓ SERVER AUDIT PASSED
        </div>

        <div class="
            host-audit-pattern
        ">
            <strong>
                Claimed Bingo:
            </strong>

            ${escapeAuditHTML(patternName)}

            <br>

            <strong>
                Cells:
            </strong>

            ${escapeAuditHTML(
                pattern.join(", ")
            )}
        </div>

        <div class="
            host-audit-marked
        ">
            Server recorded marked cells:

            <br>

            ${escapeAuditHTML(
                marked.join(", ")
            )}
        </div>

        <div class="
            host-audit-buttons
        ">

            <button
                type="button"
                class="host-audit-approve"
            >
                ✓ APPROVE
            </button>

            <button
                type="button"
                class="host-audit-reject"
            >
                ✕ REJECT
            </button>

        </div>
    `;

    const approveButton =
        card.querySelector(
            ".host-audit-approve"
        );

    const rejectButton =
        card.querySelector(
            ".host-audit-reject"
        );

    approveButton.onclick =
        () => {

            approveButton.disabled =
                true;

            rejectButton.disabled =
                true;

            console.log(
                "HOST APPROVING BINGO:",
                cardId
            );

            socket.emit(
                "approveWin",
                cardId
            );

            pendingHostClaims.delete(
                cardId
            );

            renderHostAuditClaims(
                socket
            );
        };

    rejectButton.onclick =
        () => {

            const confirmed =
                window.confirm(
                    `Reject Bingo claim for Card ${cardId}?`
                );

            if (!confirmed) {
                return;
            }

            approveButton.disabled =
                true;

            rejectButton.disabled =
                true;

            console.log(
                "HOST REJECTING BINGO:",
                cardId
            );

            socket.emit(
                "rejectWin",
                cardId
            );

            pendingHostClaims.delete(
                cardId
            );

            renderHostAuditClaims(
                socket
            );
        };

    return card;
}

// =====================================================
// PHYSICAL QR AUDIT
// =====================================================

function addHostPhysicalAuditClaim(
    socket,
    claim
) {

    if (!claim) {
        return;
    }

    const cardId =
        Number(claim.cardId);

    if (
        !Number.isInteger(cardId) ||
        cardId <= 0
    ) {
        return;
    }

    const container =
        document.getElementById(
            "hostAuditClaims"
        );

    if (!container) {
        return;
    }

    const existing =
        document.getElementById(
            "physicalAudit-" + cardId
        );

    if (existing) {
        return;
    }

    const card =
        document.createElement("div");

    card.id =
        "physicalAudit-" + cardId;

    card.className =
        "host-audit-card";

    card.innerHTML = `

        <div class="
            host-audit-card-number
        ">
            CARD ${escapeAuditHTML(cardId)}
        </div>

        <div class="
            host-audit-status
        "
        style="
            background:#78350f;
            color:#fde68a;
        ">
            📱 PHYSICAL QR CLAIM
        </div>

        <div class="
            host-audit-pattern
        ">
            The player scanned the physical
            Bingo QR code.

            <br><br>

            <strong>
                Verify the physical card manually.
            </strong>
        </div>

        <div class="
            host-audit-buttons
        ">

            <button
                type="button"
                class="host-audit-approve"
            >
                ✓ APPROVE
            </button>

            <button
                type="button"
                class="host-audit-reject"
            >
                ✕ REJECT
            </button>

        </div>
    `;

    const approve =
        card.querySelector(
            ".host-audit-approve"
        );

    const reject =
        card.querySelector(
            ".host-audit-reject"
        );

    approve.onclick =
        () => {

            approve.disabled =
                true;

            reject.disabled =
                true;

            socket.emit(
                "approvePhysicalWin",
                {
                    cardId: cardId
                }
            );

            card.remove();

            updateHostAuditCount();
        };

    reject.onclick =
        () => {

            if (
                !window.confirm(
                    `Reject physical Bingo claim for Card ${cardId}?`
                )
            ) {
                return;
            }

            approve.disabled =
                true;

            reject.disabled =
                true;

            socket.emit(
                "rejectPhysicalWin",
                {
                    cardId: cardId
                }
            );

            card.remove();

            updateHostAuditCount();
        };

    const empty =
        container.querySelector(
            ".host-audit-empty"
        );

    if (empty) {
        empty.remove();
    }

    container.appendChild(
        card
    );

    updateHostAuditCount();
}

// =====================================================
// WINNING PATTERN NAME
// =====================================================

function getWinningPatternName(
    pattern
) {

    const key =
        Array.isArray(pattern)
            ? pattern.join(",")
            : "";

    const names = {

        "0,1,2,3,4":
            "Top Row",

        "5,6,7,8,9":
            "Second Row",

        "10,11,12,13,14":
            "Middle Row",

        "15,16,17,18,19":
            "Fourth Row",

        "20,21,22,23,24":
            "Bottom Row",

        "0,5,10,15,20":
            "Left Column",

        "1,6,11,16,21":
            "Second Column",

        "2,7,12,17,22":
            "Middle Column",

        "3,8,13,18,23":
            "Fourth Column",

        "4,9,14,19,24":
            "Right Column",

        "0,6,12,18,24":
            "Diagonal ↘",

        "4,8,12,16,20":
            "Diagonal ↙"
    };

    return (
        names[key] ||
        "Bingo Pattern"
    );
}

// =====================================================
// CLEAR AUDIT CLAIMS
// =====================================================

function clearHostAuditClaims() {

    pendingHostClaims.clear();

    const container =
        document.getElementById(
            "hostAuditClaims"
        );

    if (container) {

        container.innerHTML = `

            <div class="host-audit-empty">
                No Bingo claims waiting.
            </div>

        `;
    }

    updateHostAuditCount();
}

// =====================================================
// UPDATE AUDIT COUNT
// =====================================================

function updateHostAuditCount() {

    const count =
        document.getElementById(
            "hostAuditCount"
        );

    if (!count) {
        return;
    }

    const physicalClaims =
        document.querySelectorAll(
            '[id^="physicalAudit-"]'
        ).length;

    count.textContent =
        pendingHostClaims.size +
        physicalClaims;
}

// =====================================================
// HTML ESCAPE
// =====================================================

function escapeAuditHTML(value) {

    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

// =====================================================
// START HOST AUDIT
// =====================================================

function startHostAudit() {

    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            initializeHostAudit
        );

    } else {

        initializeHostAudit();
    }
}

// =====================================================
// EXPORT
// =====================================================

window.hostAudit = {

    initialize:
        initializeHostAudit,

    clear:
        clearHostAuditClaims,

    addClaim:
        addHostAuditClaim
};

// =====================================================
// START
// =====================================================

startHostAudit();
