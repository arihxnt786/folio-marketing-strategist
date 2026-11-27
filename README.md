# Folio 2.0

Folio turns a marketing objective into a saved plan, research evidence, measured comparisons and reviewable campaign assets. The existing browser workspace, brand identities, approvals and D1 records are retained. Social accounts are never connected. A user records a publication link after posting independently.

## Use the workspace

1. Create a brand, add the audience and marketing objective, and choose its channels. Brand Workspace accepts selectable-text PDF, DOCX, text, Markdown and CSV references. Uploaded text is retained under the current brand.
2. Open **Settings → Agent model connections** for cloud planning and composition. Select a provider, enter its key, load the catalog, select a text model with JSON support, and save. Catalog access and generation access can differ. Use the provider's billing controls. The application never displays a saved key.
3. Open **Agent Workspace**, enter a business objective or choose an example, select an engine and start. **Research and calculations only** is available immediately. A general strategic brief needs an inference engine. For analytics, import your own data first.
4. Inspect the task plan, dependency links, actual attempts, usage, cited sources and limitations. Pause or cancel at any checkpoint. Use **Recover stalled run** after an interruption. Reopening the workspace restores its saved history.
5. Open each deliverable to edit or review it. Campaigns and drafts appear in their existing modules. Use Approve or Reject on insights and the Publishing queue for content. Download the run in Markdown, JSON, Word, or print to PDF. The calendar and metrics offer CSV exports.

## Try two different objectives

**Current research:** “Research published evidence on sustainable fashion purchase intentions. Show the publication date and original source.” Open one numbered source and compare the excerpt with its original.

**Measured performance:** Import [the labelled example CSV](test/data/performance-example.csv) into a separate test brand. Start “Calculate CTR, CPC, CPL, CPA and ROAS from my uploaded campaign data.” The correct CTR is 2.5%, CPC is 0.50 in the input currency and ROAS is 4×. This run can finish without model calls.

**Multi-deliverable campaign:** Connect a model, select an appropriate brand and use the Indian fitness, B2B SaaS or sustainable fashion example in the objective editor. A 30-day schedule at three posts a week produces editable slots. A draft per selected format is prepared when content was requested and passes review. Remaining slots carry editorial briefs.

## Engineering handover

- [Architecture, application contracts and execution states](docs/AGENT.md)
- [Deployment, migrations and recovery](docs/DEPLOYMENT.md)
- [Model choices, service requirements and costs](docs/MODELS.md)
- [Research sources, provenance and coverage](docs/EVIDENCE.md)
- [Security and operating boundaries](docs/SECURITY.md)
- [Verification and scenario evaluation](docs/QA-2.md)
- [Third-party software](docs/THIRD-PARTY.md) and [application license](LICENSE)

Development uses Node 24, SQLite and the same Worker bundle as production. Run `npm ci --ignore-scripts --omit=optional`, `npm run build`, `npm run validate` and `npm test`. For a local single-user development instance, run `npm run dev`. The development identity must only be used on a trusted local preview. Production users only need a browser.

**Trying Folio without signing in:** Choose **Try a test workspace** for a browser-specific seven-day workspace. Create a test brand and try public research or upload the labelled performance CSV. Sign in to create permanent brands and add a model connection. Test records stay separate from the signed-in workspace.
