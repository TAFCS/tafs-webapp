/**
 * TAFSD-615: MCP Docs. The one source for the MCP Docs page and its A4 PDF
 * (scripts/mcp-docs/build-pdf.mts turns this same file into LaTeX). The tool
 * list itself is generated from the backend code into mcp-tools.generated.ts;
 * this file only adds what the code cannot say (what a tool is for, examples).
 *
 * Every claim here was checked against tafs-backend src/modules/mcp on main
 * (see MCP_TOOLS_SOURCE_COMMIT). When the MCP server changes, rerun
 * scripts/mcp-docs/sync-tools.sh, read this file against the change, and
 * rebuild the PDF.
 *
 * No imports: the PDF build loads this file with plain Node.
 *
 * Inline markup, understood by both renderers:
 *   **bold**   `code`   [[On-screen label]]   https://… (linked)
 */

export const MCP_DOCS_VERSION = "1.0";
export const MCP_DOCS_DATE = "27 November 2026";
export const MCP_ENDPOINT = "https://api.tafs.cloud/api/v1/mcp";
export const MCP_DOCS_PDF_PATH = "/docs/TAFSync-AI-Assistant-MCP-Guide.pdf";

export type Block =
    | { kind: "p"; text: string }
    | { kind: "steps"; items: string[] }
    | { kind: "list"; items: string[] }
    | { kind: "code"; text: string }
    | { kind: "note" | "tip" | "warn"; title: string; text: string }
    | { kind: "table"; head: string[]; rows: string[][]; widths?: number[] };

export type Section = {
    id: string;
    title: string;
    /** Sub-sections, each its own heading. */
    parts?: { id: string; title: string; blocks: Block[] }[];
    blocks?: Block[];
};

/** What the code cannot say about a tool: what it is for, what comes back, an example. */
export type ToolNote = {
    returns: string;
    scope: string;
    example: string;
    caveat?: string;
};

export const TOOL_NOTES: Record<string, ToolNote> = {
    whoami: {
        returns:
            "Your username, full name, role, home campus, the scope stored on your account (campuses, classes, sections) and the names of the tools you can use right now.",
        scope: "Only your own session. Needs no tile.",
        example: "Which TAFS tools can you use for me?",
        caveat:
            "For a Super Admin the scope shown is the one stored on the account, but a Super Admin is never limited by scope and sees every campus.",
    },
    search_students: {
        returns:
            "Up to 10 students: CC, full name, GR number, photo, class, section, campus, and which identifier matched. An empty search returns nothing.",
        scope: "Only students in the campuses, classes and sections you can see.",
        example: "Find the student whose father's name is Imran Ahmed in class VII.",
    },
    get_student: {
        returns:
            "The full student profile for one CC: class, section, campus, status, family, guardians and fee settings.",
        scope: "Refused if the student is outside your scope.",
        example: "Show me CC 1234's profile and guardians.",
    },
    get_student_payment_history: {
        returns:
            "The student's fee heads for one academic year, with the vouchers each head was billed on and the deposits that paid it (method, reference, date).",
        scope: "Refused if the student is outside your scope.",
        example: "Which payments did CC 4521 make in 2026-2027?",
        caveat:
            "Results are large and are often cut at 100,000 characters. Ask about one year at a time.",
    },
    list_vouchers: {
        returns:
            "A page of issued vouchers, newest first: voucher id, student, fee heads, amounts, due and validity dates, status. 20 per page unless you ask for more (at most 100).",
        scope: "Only vouchers of students in your scope.",
        example: "List CC 1234's unpaid and overdue vouchers.",
    },
    get_voucher: {
        returns:
            "One voucher: fee heads, amounts, issue, due and validity dates, the deposits allocated to it, and its status.",
        scope: "Refused if the voucher's student is outside your scope.",
        example: "What is on voucher 14422 and how was it paid?",
    },
    get_student_arrears: {
        returns:
            "Total arrears and total late surcharge, the unpaid fee heads dated before the fee date, and one surcharge row for each month in arrears. This is the amount a new voucher dated that day would carry forward.",
        scope: "Refused if the student is outside your scope.",
        example: "How much does CC 1234 owe from before 1 December 2026?",
        caveat:
            "Without a fee date it uses today's date on the server's clock (UTC). Between midnight and 5 AM in Pakistan that is still yesterday, so give the date when it matters.",
    },
    list_defaulters: {
        returns:
            "The Financial Reports defaulters list as of a date: each student's months behind, arrears outstanding, oldest arrear and number of unpaid heads, with totals. view=by_class, by_campus or aging returns roll-ups instead of students. 25 rows per page unless you ask for more (at most 100).",
        scope: "Only students in your scope, the same as the Defaulters report.",
        example: "List the defaulters at Kaneez Fatima Campus by class.",
        caveat:
            "Without as_of_date it uses today's date on the server's clock, which can still be yesterday early in the morning in Pakistan.",
    },
    search_employees: {
        returns: "Up to 10 staff members: id, full name and employee code.",
        scope: "Only staff in the campuses and departments you can see.",
        example: "Find staff members named Ali at Gulistan-e-Johar.",
    },
};

export const MCP_DOCS_INTRO =
    "The TAFSync AI Assistant lets Claude or ChatGPT answer questions about TAFS data in plain language: students, vouchers, payments, arrears, defaulters and staff. It connects to TAFSync over the Model Context Protocol (MCP), signs in as you, and can only read.";

export const KEY_FACTS: { title: string; text: string }[] = [
    { title: "Read-only", text: "There are no tools that create, change, delete or pay anything." },
    { title: "Sees what you see", text: "Your tiles decide which tools it gets. Your scope decides which campuses, classes and sections appear." },
    { title: "Every call logged", text: "Each tool call goes into the Activity Log under your name, including refused calls." },
    { title: "Needs a permission", text: "The AI Assistant (MCP) tile, granted per person in People & Access." },
];

export const MCP_DOCS_SECTIONS: Section[] = [
    {
        id: "before",
        title: "Before you start",
        blocks: [
            {
                kind: "list",
                items: [
                    "You need the **AI Assistant (MCP)** permission (tile `system.ai_assistant`). A Super Admin ticks it for you in [[System > People & Access]]. Like every web tile it is off until someone switches it on for you. Super Admins can always connect.",
                    "The address to give Claude or ChatGPT is `" + MCP_ENDPOINT + "`. You never need anything else: no key, no password in the chat.",
                    "You sign in on the normal TAFSync login page, with your own username and password. Never paste your password into a chat.",
                ],
            },
            {
                kind: "note",
                title: "Without the permission",
                text: "The sign-in still opens, but instead of an approval screen you see: “Your TAFS access does not include the AI Assistant (MCP). Ask an administrator to grant it in People & Access.” The only button is [[Back to app]]. An app that was already connected stops working on its next request, with the same message.",
            },
        ],
    },
    {
        id: "connect",
        title: "Connecting",
        parts: [
            {
                id: "connect-claude",
                title: "Claude: web, desktop and mobile",
                blocks: [
                    {
                        kind: "steps",
                        items: [
                            "On claude.ai or in the Claude desktop app, open [[Settings]], then [[Connectors]].",
                            "Choose [[Add custom connector]].",
                            "Name: `TAFS`. URL: `" + MCP_ENDPOINT + "`.",
                            "Click [[Add]], then [[Connect]].",
                            "A TAFSync window opens. Log in with your TAFSync username and password if asked.",
                            "Read the approval screen (see “The sign-in and approval screen” below) and click [[Approve]].",
                            "Start a new chat and ask your question. If Claude does not use TAFS on its own, add “use TAFS” to the question.",
                        ],
                    },
                    {
                        kind: "list",
                        items: [
                            "**Mobile:** add the connector once on claude.ai or the desktop app. It then appears in the Claude mobile app on the same account.",
                            "**Plans:** the free Claude plan allows one custom connector; paid plans allow more.",
                            "**Team and Enterprise:** the organisation owner adds the connector once; each person then clicks [[Connect]] and signs in as themselves.",
                        ],
                    },
                ],
            },
            {
                id: "connect-claude-code",
                title: "Claude Code",
                blocks: [
                    { kind: "p", text: "Run this once, then type `/mcp`, choose `tafs` and sign in:" },
                    { kind: "code", text: "claude mcp add --transport http tafs " + MCP_ENDPOINT },
                ],
            },
            {
                id: "connect-chatgpt",
                title: "ChatGPT",
                blocks: [
                    {
                        kind: "steps",
                        items: [
                            "On chatgpt.com, open [[Settings]], then [[Apps & Connectors]] (on some accounts called Connectors or Apps).",
                            "Open [[Advanced settings]] and switch on [[Developer mode]].",
                            "Add a custom MCP server. Name: `TAFS`. Server URL: `" + MCP_ENDPOINT + "`. Authentication: [[OAuth]]. Accept ChatGPT's warning about custom servers.",
                            "Click [[Connect]]. A TAFSync window opens. Log in, then click [[Approve]].",
                            "In a new chat, turn on the TAFS app from the + or tools menu next to the message box, and ask your question.",
                        ],
                    },
                    {
                        kind: "list",
                        items: [
                            "Custom connectors need a paid ChatGPT plan (Plus, Pro, Business, Enterprise or Edu) and are added on the website, not in the phone app.",
                            "On a Business or Enterprise workspace the workspace admin may have to allow developer mode first.",
                            "ChatGPT's menus move from time to time. If a step is missing, look for “Developer mode” and “Add custom MCP server” in Settings.",
                        ],
                    },
                ],
            },
            {
                id: "connect-other",
                title: "Other MCP clients and personal tokens",
                blocks: [
                    {
                        kind: "p",
                        text: "Any MCP client that supports Streamable HTTP with OAuth sign-in can use the same address. For a client without OAuth, issue a personal token on [[System > AI Assistant (MCP)]] and send it as a bearer header:",
                    },
                    { kind: "code", text: "claude mcp add --transport http tafs " + MCP_ENDPOINT + ' --header "Authorization: Bearer tafs_pat_..."' },
                    {
                        kind: "list",
                        items: [
                            "A token is shown once; TAFSync keeps only a fingerprint of it.",
                            "It lasts 30 days unless you choose otherwise, 90 days at most. You can hold 10 live tokens.",
                            "Tokens cannot be issued while impersonating another user.",
                            "Treat a token like a password: anyone holding it reads TAFS as you until you revoke it.",
                        ],
                    },
                ],
            },
        ],
    },
    {
        id: "signin",
        title: "The sign-in and approval screen",
        blocks: [
            {
                kind: "p",
                text: "Connecting opens TAFSync's own page at www.tafs.cloud/mcp/authorize. If you are not logged in, the normal login page comes first and brings you back. The approval screen then shows:",
            },
            {
                kind: "list",
                items: [
                    "The app's name, marked **unverified** because the app chose it, next to the address it will send you back to (claude.ai, claude.com, chatgpt.com, or your own computer for Claude Code).",
                    "That the app will act as you, with your access.",
                    "The exact list of tools you would get, worked out from your tiles at that moment.",
                ],
            },
            {
                kind: "p",
                text: "Click [[Approve]] only if you started the connection from that app just now. [[Deny]] sends the app away with nothing. While impersonating another user the screen only offers [[Back to app]]: exit impersonation to connect as yourself.",
            },
            {
                kind: "table",
                head: ["What", "How long"],
                rows: [
                    ["The approval link", "10 minutes, used once"],
                    ["Access the app holds", "1 hour, renewed automatically while the connection lasts"],
                    ["Renewal without signing in again", "30 days from the last renewal"],
                    ["A connection", "90 days at most, then you sign in again"],
                ],
            },
        ],
    },
    {
        id: "access",
        title: "What the assistant can see",
        blocks: [
            {
                kind: "list",
                items: [
                    "Each tool stands in for an existing TAFSync page's data route, and runs that route's own permission checks for you. A tool is never wider than the page.",
                    "Tools you are not allowed to use are not listed at all. If an app asks for one anyway, TAFSync answers as if it did not exist and logs the attempt as DENIED.",
                    "Your tiles and scope are read again on every request. A change in People & Access applies to the very next question, with no need to reconnect.",
                    "Inside a tool, your scope applies exactly as on the page: a student, voucher or employee outside your campuses, classes, sections or departments is refused or left out.",
                    "Super Admins see every tool and every campus.",
                ],
            },
        ],
    },
];

export const TOOLS_SECTION = {
    id: "tools",
    title: "Tools",
    intro:
        "These are all the tools the server offers. You only get the ones your tiles allow; whoami lists yours. Each entry is generated from the server code: inputs are exactly what the tool accepts, and “Who gets it” is the page permission its route checks.",
};

export const EXAMPLES: string[] = [
    "Show me CC 1234's fee vouchers for this year and what is still owed.",
    "List the defaulters at Kaneez Fatima Campus by class.",
    "How many students are three or more months behind, by campus, as of 30 November 2026?",
    "Find the student whose father's name is Imran Ahmed in class VII.",
    "Which payments did CC 4521 make since August?",
    "What is on voucher 14422 and which deposit paid it?",
    "How much would a voucher dated 1 December 2026 carry forward for CC 1234?",
    "Find staff members named Ali at Gulistan-e-Johar.",
    "Which TAFS tools can you use for me?",
];

export const LATE_SECTIONS: Section[] = [
    {
        id: "limits",
        title: "Limits",
        blocks: [
            {
                kind: "table",
                head: ["Limit", "Detail"],
                rows: [
                    ["Read-only", "No tool writes. Every tool is marked read-only to the app. Issuing vouchers, recording deposits and every other change stay in TAFSync."],
                    ["Your access only", "Tools follow your tiles; data follows your scope. Super Admins are unrestricted."],
                    ["Result size", "A result longer than 100,000 characters is cut, with a note asking the assistant to narrow the question (fewer years, a filter, a page)."],
                    ["Searches", "Student and staff searches return at most 10 matches. Narrow by name, CC, GR number or code."],
                    ["Pages", "list_vouchers returns 20 rows and list_defaulters 25 unless asked for more; 100 is the most per page."],
                    ["Arrears", "Arrears come only from get_student_arrears or list_defaulters, which use the school's one arrears definition. Adding up voucher balances gives a different number."],
                    ["Amounts", "Pakistani rupees."],
                ],
            },
        ],
    },
    {
        id: "audit",
        title: "Audit logging",
        blocks: [
            {
                kind: "p",
                text: "Every tool call is written to the Activity Log ([[System > Activity Logs]], section System) under your name, whether it worked or not:",
            },
            {
                kind: "table",
                head: ["Entry", "Recorded"],
                rows: [
                    ["MCP_TOOL CALL", "A tool answered: its name, a short summary of the arguments (text cut to 40 characters), which connection was used, and the size of the result."],
                    ["MCP_TOOL DENIED", "An app asked for a tool you may not use, or one that does not exist."],
                    ["MCP_TOOL ERROR", "The tool refused the request (for example a student outside your scope) or failed."],
                    ["MCP_OAUTH", "An app registered, an approval or denial, a sign-in, a renewal, a disconnection."],
                    ["MCP_TOKEN", "A personal token issued or revoked."],
                ],
            },
            { kind: "p", text: "Tokens and sign-in codes are never written to any log." },
        ],
    },
    {
        id: "disconnect",
        title: "Disconnecting",
        blocks: [
            {
                kind: "list",
                items: [
                    "In TAFSync open [[System > AI Assistant (MCP)]]. Under [[Connected apps]], click [[Disconnect]] next to the app. It stops at once.",
                    "Personal tokens are revoked on the same page, under your tokens.",
                    "A connection also ends on its own after 90 days; sign in again to continue.",
                    "If your AI Assistant permission is removed, or your account is deactivated, every connection and token stops on its next request.",
                ],
            },
        ],
    },
    {
        id: "troubleshooting",
        title: "Troubleshooting",
        blocks: [
            {
                kind: "table",
                head: ["What you see", "What to do"],
                rows: [
                    ["The sign-in window only offers [[Back to app]]", "You do not have the AI Assistant (MCP) permission, or you are impersonating someone. Ask a Super Admin to grant it in People & Access, or exit impersonation."],
                    ["“Your access does not include the AI Assistant (MCP)” in the middle of a chat", "The permission was removed. Ask a Super Admin to grant it again. The app may pick up again by itself; if it asks you to sign in, click Connect."],
                    ["The app says it needs you to sign in again", "The connection was disconnected, renewed too late (30 days unused) or reached 90 days. Click Connect and sign in."],
                    ["“Unknown tool”, or the assistant says it has no tool for something", "Your tiles do not include that page. Ask the assistant to run whoami to see your tools, then ask for the tile you need."],
                    ["A student or voucher “not found” that exists", "It is outside your campuses, classes or sections. The assistant sees exactly what you can see in TAFSync."],
                    ["“Result truncated …”", "The answer was over 100,000 characters. Ask about one academic year, one student or one page at a time."],
                    ["Today's arrears or defaulters look a day old", "Before 5 AM in Pakistan the server's date is still yesterday. Name the date in your question."],
                    ["Claude answers without using TAFS", "Add “use TAFS” to the question, and check the connector is switched on for that chat."],
                    ["ChatGPT has no option to add the server", "Developer mode is off, the plan does not allow custom connectors, or a workspace admin has blocked it."],
                ],
            },
            { kind: "p", text: "If something still does not work, send a screenshot to the TAFS IT and Software Department." },
        ],
    },
    {
        id: "care",
        title: "Please keep in mind",
        blocks: [
            {
                kind: "list",
                items: [
                    "Treat answers like any report: check important figures in TAFSync before acting on them, especially money.",
                    "Chats with student or fee details are confidential. Do not share them or make them public.",
                    "You only ever type your TAFSync password on the TAFSync sign-in page, never in a chat.",
                ],
            },
        ],
    },
];
