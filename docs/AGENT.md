# Architecture and application contracts

The JavaScript Worker serves the UI and enforces tenant and brand scope before dispatch. A model sees curated JSON data. Its only plan authority is a locally validated selection from seven marketing tools. There is no shell, URL-fetch, social posting or database tool exposed to a model. HTTP adapters use operator-controlled origins. The build embeds browser assets and server modules in one Worker ES module. The PDF reader loads on demand.

## Execution

Creating a run writes the user's objective, access scope, budgets, model selection, start time and request ID. Planning selects relevant tools, queries and assumptions. User selections can constrain the plan. A model-free route matches explicit research, scheduling and measurement intents. The compiler expands content per selected format and constructs a dependency graph. A dependency that ends with missing data is visible to later steps and the user. Independent source lookups run concurrently. When research and measurement analysis are both ready, they run together under one lease. Once evidence records arrive, a model-connected run inserts a cited research synthesis and adds it as a dependency of remaining strategic tasks. Inference advances one task at a time. An explicit format or cadence in the objective can narrow the brand defaults. Users can override either setting.

Each execution step obtains an expiring D1 lease. Checkpoint and artifact writes share a revision fence and are committed in one D1 batch. A user pause, cancellation or competing claim invalidates stale writes. Model-call reservations are recorded before submission. Model errors may still incur a provider charge; an interrupted request can consume allowance without returning billable usage. Draft validation and a fresh model review precede final saving. A rejected output can be revised once with the recorded feedback. Manual edits and final publication tracking are separate.

The managed deployment dispatches work on the server via waitUntil and short-lived HMAC-authenticated continuations. An interrupted handoff can leave a pending run. The monitor reads checkpoints and offers explicit recovery. The independent Cloudflare configuration also provides a one-minute Cron trigger that reclaims expired leases without a browser. The local preview drains SQLite on a process interval. A process without persistent storage is unsuitable.

## Context and provenance

Brand profiles, documents, research records, former strategies, content, campaigns and run summaries are scoped by owner and brand before retrieval. The inexpensive lexical retriever ranks overlapping passages and attaches the record ID, kind, offset, authority and excerpt. It inspects up to 30 recent records per kind and selects up to six passages. References and historical drafts retain different authority labels. There is no embedding service or training job. This bounds cost but can miss synonyms and older materials. Use more specific wording and update the knowledge documents when needed. Open a reference in Brand Workspace to inspect and edit its extracted text. Saving checks the reference revision. A run retains the context captured for its objective.

## HTTP

All browser operations use same-origin JSON POST /api. Boot uses GET /api. Authentication comes from the trusted gateway. The standalone Worker verifies Cloudflare Access JWTs. Every brand action takes the selected brand ID. Error responses contain a user-readable error and meaningful HTTP status.

| Action | Inputs | Result |
| --- | --- | --- |
| modelAccount | mode list/save/remove, provider, key for list/save, model for save | catalog or saved model identity |
| runStart | brand, requestId, objective, provider, optional tools/formats, depth, start, days, frequency, maxCalls and maxTokens | durable run ID |
| runGet / runList | brand and optional run ID | scoped checkpoint or recent run history |
| runControl | brand, id, command pause/resume/cancel/recover | updated control state |
| runExport | brand, id | current saved deliverables, scheduled drafts, attributed sources and checkpoint |
| metrics | brand, rows | validated measurements, upserted by date, label, platform and campaign |
| reviewInsight | brand, id, rev and decision | approval or rejection of the selected version |

The run can be pending, planning, researching, executing, evaluating, awaiting clarification, paused, completed, partially completed, failed or cancelled. Durable events record tool and review decisions. Raw private reasoning is never requested or stored. GET /health reports database availability. The signed continuation accepts a short-lived, scoped permit; requests without a valid signature cannot launch work.

## Numerical definitions

Ratios use sums over rows that supply both numerator and denominator. Zero total denominator yields an unknown value. Engagement rate = engagements/impressions. CTR = clicks/impressions. Conversion rate = conversions/clicks. CPC = spend/clicks. CPL = spend/leads. CPA = spend/conversions. ROAS = revenue/spend. Rate percentages multiply by 100. Monetary inputs within a comparison must share a currency. Campaign-level ratios use the same formulas. An unusual-CTR flag requires at least five paired rows, nonzero median absolute deviation and distance over three scaled median absolute deviations. It is a descriptive flag for investigation.
