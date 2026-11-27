# Folio 2.0 verification

## Reproduce

Install the pinned dependencies and build the Worker. Run npm test for local SQLite, contracts and offline tests. FOLIO_LIVE_EVIDENCE=1 enables real network research. Set FOLIO_LIVE_MODEL_PROVIDER and the corresponding model/credential to enable authenticated model tests. For operator-hosted inference set LOCAL_MODEL and LOCAL_AI_BASE_URL. The local engine accepts an OpenAI-compatible /v1 endpoint with JSON Schema support. Optional provider charges apply.

Run node test/scenarios.mjs with fitness, saas, fashion, performance, organize or rates as an argument, or omit the argument to run all six. Each scenario uses a new SQLite database and a labelled test brand. Set FOLIO_EVAL_FULL=1 to capture complete deliverables including evidence for human review. An execution status describes task completion, not marketing quality. Verify a factual assertion against the cited excerpt and original source, check each promised deliverable, and reject unsupported claims.

## Observations on November 26, 2026

- The browser preview created an isolated bicycle workshop brand and saved a real research run. It retained seven source records and recorded the GDELT failure and limited corroboration.
- SQLite tests independently checked seven performance ratios, zero denominators, missing pairs, idempotency, calendar slot counts after process restart, pause/resume, cancellation and tenant/brand isolation.
- A model fixture exercised rejection of restricted copy, refinement, an independent evaluator call and a single saved draft. This test is not proof of inference quality.
- A checksum-verified Qwen2.5-1.5B-Instruct Q4_K_M model served by llama.cpp performed genuine catalog discovery and structured inference on CPU through the local adapter. No hosted model key was present. This small model is a QA engine, not a recommended strategic default.
- A first real-model run omitted explicitly requested work in the fitness and SaaS briefs. The planner now reconciles the model's tool selection against explicit deliverables; this has a dedicated regression test.
- Credentialed Tavily and commercial inference, free quota eligibility, embedding retrieval, independent Cloudflare account deployment, very large imports and sustained-load behavior require separate verification or implementation.

## Evaluation rubric

For each brief capture the exact objective, model identifier, task graph, dated sources, outcomes, usage, outputs and limitations. Mark each criterion pass, fail or unverified; a score is unnecessary.

| Criterion | Passing evidence |
| --- | --- |
| Completion and autonomy | Every explicit deliverable has an artifact or a specific failure. A calculation-only objective produces a materially different plan. |
| Factual grounding | Open every citation used in substantive assertions. The source must support the claim within the relevant geography, period and population. Record disagreement or insufficient coverage. |
| Campaign usefulness | Named audience, actionable channels, objective-aligned KPI and CTA, a feasible cadence and reasons for choices. |
| Copy and compliance | Format fits the intended platform; no prohibited wording, invented endorsement or absolute environmental claim. |
| Measurement | Calculate ratios independently with paired denominators. Blank fields remain unknown. |
| Recovery and control | Interrupt a run, inspect its checkpoint, resume, and ensure a stale worker cannot duplicate a saved output. |
| Isolation | A separate identity or brand cannot read or control the first run. Model keys and private reasoning never appear in exports. |

The legacy workspace required several separate submissions for strategy and content. Folio 2.0 can prepare multiple deliverables from one objective. This is a behavioral comparison; no numerical uplift or model quality benchmark is claimed.

The live SaaS rerun after the objective-coverage fix produced research, audience, competitor, strategy and content artifacts in 12 local-model calls (13,987 input and 2,412 output tokens reported). Reading the draft exposed an unsupported free-trial CTA. The subsequent release adds a deterministic check for undocumented offers, discounts and selected certifications. Its regression test rejects the free-trial phrase unless the brand supplied it. A human still needs to review product capabilities and broad marketing claims. The exact release test output is saved in [acceptance.txt](verification/acceptance.txt).

## Published workspace observations on November 27, 2026

An isolated test workspace on the public deployment was used for these checks. A genuine production run for “Research sustainable fashion purchase intentions” returned six dated Crossref sources with original links. GDELT timed out and its error was visible. This test exposed a provider request option unsupported by the hosted runtime. It passed after the Worker was corrected and redeployed. A separate run from the build environment timed out across all three providers, recorded in [the network test output](verification/provider-outage.txt). Availability depends on network and provider.

The labelled performance CSV was uploaded through the production browser. The resulting run reported CTR 2.5%, conversion rate 5%, CPC 0.50, CPL 3.75, CPA 10 and ROAS 4×. Each ratio used two of three paired rows. The downloaded Word document passed ZIP integrity validation. Its document XML contained the same seven ratios, including engagement rate 4.6667%. Screenshots show the actual [research records](screenshots/production-research.jpg) and [measurements](screenshots/production-report.jpg).

The default acceptance run omits the opt-in live evidence, credentialed Tavily, and genuine model checks. The scheduled-report tests use a local database and invoke the cron handler. A real hosting-provider Cron delivery requires a separate deployment.
