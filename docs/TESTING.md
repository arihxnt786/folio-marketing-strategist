# Acceptance and browser walkthrough

## Checks run on 26 November 2026

The build and ES module export validation passed with Node 24. Four integration groups exercise the production Worker handler against a real SQLite database with foreign keys enabled. No AI responses or provider search results are mocked.

| Area | Observed result |
| --- | --- |
| Brand lifecycle | A profile created with the browser form appeared on its dashboard and in a second browser tab. Automated checks verified edits, stale revision rejection, deletion and reopening a disk-backed database. |
| Isolation and auth | Missing visitor identity returned 401; the wrong request origin returned 403; another visitor could not read a brand; references created under one brand stayed inaccessible to another. |
| Live search | The cycling query through the UI returned six Crossref records and four Hacker News records, with original links, supplied dates and retrieval timestamps. GDELT timed out. An independent run through the handler for marketing returned eight Hacker News and five Crossref records. |
| Generation | Browser loading, genuine model download and streaming inference were exercised using the public bicycle workshop brief below. A low-storage failure found during testing led to an in-memory fallback. See the handover for final end-to-end generation results. |
| Repurposing | The application rejects an empty original and includes the actual supplied original in its model request. See handover for model execution status. |
| Planning and calendar | Campaign insert, planned slot persistence, timezone conversion, duplicate suppression, draft editing, revision conflict and approval-before-receipt checks passed. |
| Exports | A calendar export downloaded in Chrome. CSV multiline text round-tripped, missing values stayed empty, and formula-prefixed text was neutralized. |
| Measurements | Measured QA button-click entry imported. Re-importing the same key updated the record. Missing metrics remained absent. An invalid row prevented partial import. |
| Mobile | Tested the app in a 390 CSS pixel browser frame. Opened the navigation drawer, selected Content Calendar and switched from month to week. This was responsive browser testing on a desktop engine. |
| External credentials | Missing Gemini credentials and an unconfigured LinkedIn app produced actionable failures. No customer account credentials, live social posts or linked-platform analytics were available for verification. |

For a fresh development checkout use Node 24, then npm run build, npm run validate and npm test. Run node test/live.mjs to perform a real research call with current provider data; counts will change over time. Use npm run dev for the single-user local preview. None of these commands are needed to use a hosted deployment.

## Test the private deployment in your browser

1. In Brand Workspace create a disposable profile named “Workshop acceptance”. Set products to “Saturday bicycle repair workshops”, audience to “First-time bicycle commuters”, objective to “Encourage workshop enquiries”, voice to “Practical and welcoming”, and select LinkedIn. Save. Edit its voice, reload and check the change.
2. Add a second brand and switch between them. Upload a short TXT guideline to only one brand. Confirm the other brand has its own empty document list. Return to the workshop brand.
3. In Market Research enter “bicycle commuting” or a relevant public topic and choose a lookback. Open an original result, compare its dates and inspect each provider's availability. A successful query can legitimately return zero results.
4. In Content Studio choose LinkedIn post. Enter “Invite first-time commuters to ask about our Saturday bicycle repair workshop. Keep it brief.” Choose On-device and Generate drafts. Allow the first download and generation to finish. Open the saved item, read the hook, body, CTA and visual direction, edit the body, save and refresh.
5. Select Repurpose, choose Instagram caption, and paste “Our bicycle repair workshop meets on Saturdays. First-time commuters are welcome. Message us with a question before attending.” Request a concise caption. Compare the output to these actual source statements. Save editorial corrections.
6. In Campaign Planner create “Workshop enquiries” with a one-week date range. Generate a calendar using two posts per week and one or more formats. In Calendar use both views, filter by campaign, open a slot, fill in copy and change its local time. Refresh, then export CSV and compare the stored schedule with its UTC timestamp.
7. In Publishing preview that item, approve its current version, then download the approved copy. To test without sending anything externally, stop here. For a real campaign, publish manually in the intended account and record its actual permalink. Only use the optional LinkedIn public-send button when you intend to publish to the named member profile.
8. In Analytics download the blank CSV template. Copy a small set of measurements from your own platform export using ISO calendar dates and the displayed platform names. Leave absent counts empty. Import twice and verify the row count stays stable. Filter by campaign, export measured rows and compare them to the source file. Print / PDF uses the browser print dialog.
9. To inspect AI failure handling without a secret, select unconnected Gemini and submit a brief. Check that the app explains setup and leaves previous drafts intact. A second authorized visitor in an independent Access deployment should see a separate workspace.

The screenshots in this directory were taken from the running application. The illustrative workshop is a test input. It is never seeded into a new production database.
