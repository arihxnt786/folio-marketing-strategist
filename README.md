# Folio • AI social media marketing strategist

A private, browser-based marketing workspace. Folio maintains separate brand records, gathers public research, runs task-specific generation workflows, and carries drafts through editing, scheduling, approval and reporting.

## Open the workspace

Open the private deployment link supplied with this repository and sign in with the owning ChatGPT account. Choose **Create brand**. Enter a name, target audience, marketing objective and preferred platforms. The workspace starts empty. A published private site and its preview have separate databases.

**Generate without an API key.** In Content Studio, enter a short creative brief, choose a destination format and select **On-device · Qwen 0.5B**. The browser downloads approximately 398 MB of model weights from Hugging Face on first use. It requires WebAssembly, sufficient memory and a stable connection. When persistent browser storage is limited, Folio uses a session-only download. Keep the tab open. Device speed and output quality vary. Review each draft's facts and suitability.

**Use Gemini.** In Settings, enter your project key and optionally its model ID. Verify and connect checks the model catalogue and encrypts the key server-side. Select Gemini in the workflow. Google controls free availability, model access, quotas and regional terms. See [provider requirements](docs/INTEGRATIONS.md).

## Operating workflows

| Workspace | What you can do |
| --- | --- |
| Brand Workspace | Create, edit, switch and delete brands. Store positioning, competitors, voice, restrictions, preferred channels and reference material. Upload plain UTF-8 TXT or Markdown. Up to six recent reference excerpts enter each AI brief. |
| Market Research | Search public Hacker News discussions, GDELT news and Crossref metadata. Inspect original links, available dates, retrieval time and per-provider failures. Request interpretation separately. No reach or search-volume estimates are generated. |
| Audience Intelligence | Ask for audience segments, personas, objections, messaging and customer journeys. Analyze supplied competitor observations and relevant source evidence. Treat proposed segments and gaps as hypotheses. |
| Content Studio | Generate or repurpose 16 formats covering the requested channels, with up to five variation directions. Review, edit, duplicate or refine into a new draft. Optional research refresh runs before generation. |
| Campaign Planner | Create campaigns; generate an editable strategy, content pillars, channel recommendations and cadence. Generate dated draft briefs using campaign objectives, chosen formats, brand context and user-defined frequency. |
| Content Calendar | Week and month views, channel/campaign filters, date/time editing, desktop drag-and-drop, duplication and filtered CSV export. Slot generation produces editorial briefs. Write or generate final copy before approval. Dates use the browser timezone for display and UTC in storage. |
| Publishing | Preview exact copy, approve and export. Record manual publication using a permalink. An optional authorized LinkedIn member connector supports text posts. Manual confirmations and confirmed API publications have distinct labels. |
| Analytics and Reports | Import platform measurements via a CSV template, including missing values. Compare rows and channel aggregates, filter by campaign, export raw measures, print to PDF, or request an AI report. |

## Handover

- [Deployment and account setup](docs/DEPLOYMENT.md)
- [Acceptance checks and a reproducible browser walkthrough](docs/TESTING.md)
- [Security and tenancy](docs/SECURITY.md)
- [Research providers and upstream evaluation](docs/RESEARCH.md)
- [Publishing accounts and provider requirements](docs/INTEGRATIONS.md)
- [Component licences](docs/THIRD-PARTY.md) and [original code licence](LICENSE)
- [Actual browser screenshots](docs/screenshots/)

## Source layout

The Worker entry point is in worker/. server/ implements input validation, bound SQL access, retrieval, AI planning and validation, manual workflows and OAuth. client/ contains the responsive interface and device inference. drizzle/ contains the SQLite/D1 migration. scripts/build.mjs embeds first-party assets and pinned runtime files into one deployable ES module. The independent Cloudflare adapter in deploy/ verifies Access JWTs. test/ contains executable integration checks.

For development with Node 24: run npm run build, npm test, and npm run dev. Local development uses a single disposable preview identity and a file-backed SQLite database. Normal hosted operation requires only a browser.
