# Model connections

The server adapter accepts structured planning, drafting and review requests at fixed HTTPS endpoints. Provider and model selection are explicit per request. The surrounding application owns account authorization, tenant-scoped credential storage, approval and workflow state. The model has no publishing token or executable tools.

| Provider ID | Credential setting | Model setting | Catalog and service details |
| --- | --- | --- | --- |
| `gemini` | `GEMINI_API_KEY` | `GEMINI_MODEL` | Authenticated list of Gemini models that support content generation. When no model is configured, the adapter looks for Flash-Lite before Flash. Free eligibility and limits depend on the project. [Catalog](https://ai.google.dev/api/models) · [Structured generation](https://ai.google.dev/gemini-api/docs/structured-output) · [Available tiers](https://ai.google.dev/gemini-api/docs/billing) |
| `groq` | `GROQ_API_KEY` | `GROQ_MODEL` | Select a text model from the authenticated catalog that supports JSON object output. Some models and quotas vary by plan. [Models](https://console.groq.com/docs/models) · [JSON modes](https://console.groq.com/docs/structured-outputs) |
| `openrouter` | `OPENROUTER_API_KEY` | `OPENROUTER_MODEL` | Catalog discovery is public. Inference requires a key. Choose an explicitly free route when cost matters, then check availability and quota in the account. Compatibility is enforced on the requested response and token-limit parameters. [API overview](https://openrouter.ai/docs/api/reference/overview) · [Structured output](https://openrouter.ai/docs/guides/features/structured-outputs) |
| `openai` | `OPENAI_API_KEY` | `OPENAI_MODEL` | Optional connection for an account with API access and available credit. Select a chat model that accepts a system message and JSON object mode. [Structured output and JSON mode](https://developers.openai.com/api/docs/guides/structured-outputs) |

Configure only the provider you intend to use. Store keys in the hosting provider's server-side secret manager. Per-user configuration may also pass a decrypted `config.key` from authorized backend storage. Configure the model ID exactly as shown by the provider. By default only the selected provider receives context. Selecting an optional fallback in the run controls explicitly authorizes that second provider to receive the same context on eligible failures. Enter public brand material when evaluating unpaid Gemini. Google specifies how it uses unpaid inputs and outputs and restricts use with confidential information. [Gemini terms](https://ai.google.dev/gemini-api/terms)

## Server interface

`listModels({env, config:{provider,key?}})` returns identifiers retrieved from the provider at request time. Discovery lists candidate text models. A successful generation is necessary to verify generation access, remaining quota and JSON support for a particular model.

`askModel({env, config:{provider,model?,key?}, system, input, maxTokens, schema})` accepts trusted workflow instructions and a separate string or JSON payload. It returns `{value, provider, model, usage, attempts}`. Only `value` should enter the action validator. The caller must check allowed transitions, ownership, references and claim provenance before using any value.

The default output ceiling is 1,200 tokens and the maximum is 8,192. Serialized instructions, schema and input together are limited to 96 KB. The server accepts at most 250 KB of JSON response data and permits two network attempts per request. HTTP 429 and 503 may receive one short, bounded retry. A long Retry-After is returned as seconds in the error. A generation with a network timeout, ambiguous gateway failure, invalid JSON, refusal or truncated result ends without silently issuing a second generation.

Usage fields are `inputTokens`, `outputTokens` and `totalTokens`. Each directly reflects the provider's reported counts. Missing counts remain null. Gemini's reported total can include reasoning tokens beyond its visible candidate count. The adapter returns counts for the successful response. A provider can process a request even if its response never reaches the application, so local accounting cannot replace the provider's bill.

Each workflow can require a JSON Schema. Supported keywords are type, properties, required, additionalProperties (boolean), items, enum and const (scalar), anyOf, minimum, maximum, minLength, maxLength, minItems and maxItems. Title and description are annotations. Response roots must be objects. Unknown schema keywords cause a configuration error. Gemini receives the schema natively. Chat providers receive the schema in the trusted instruction, use JSON object mode, and undergo identical local validation.

## Verification

`node --test test/models.test.mjs` tests local validation for accepted structures, invalid actions, unrecognized fields, bounds, unsafe configuration and missing inputs. The optional live test runs when `FOLIO_LIVE_MODEL_PROVIDER` names a supported provider. Place the corresponding credential and model in the CI environment, then run the same command. It performs real catalog discovery and generation using a public bookstore brief. It can consume provider quota.

During development, the anonymous OpenRouter catalog returned 445 candidate text models. Google's live model-list endpoint rejected an invalid credential. No valid hosted model key was available for authenticated inference in that session. A catalog count is an observation at test time.

## Implementation provenance

The upstream Google and Groq SDKs and their Apache-2.0 licenses were reviewed. Their code documents generation, schema selection and chat-completion endpoints. This adapter uses the provider HTTP contracts and the Worker runtime's standard fetch API. It includes no copied SDK source. [Google SDK implementation](https://github.com/googleapis/js-genai/blob/main/src/models.ts) · [Google license](https://github.com/googleapis/js-genai/blob/main/LICENSE) · [Groq SDK implementation](https://github.com/groq/groq-typescript/blob/main/src/resources/chat/completions.ts) · [Groq license](https://github.com/groq/groq-typescript/blob/main/LICENSE)

## Operator-hosted compatible inference

Set LOCAL_AI_BASE_URL to a dedicated OpenAI-compatible /v1 endpoint and LOCAL_MODEL to its advertised model ID. LOCAL_API_KEY is optional for an operator's loopback service. Remote endpoints require HTTPS. The URL is server configuration; users cannot supply an address. This path was exercised with llama.cpp. A hosted Worker cannot reach a model running on the user's phone or laptop over localhost. Independent deployments can point at their own reachable compatible service. Private CPU/GPU runtime costs and upkeep belong to that deployment.

The adapter also accepts an optional streaming callback and validates the assembled JSON before use. The run monitor shows persisted task events. For OpenRouter the adapter records usage.cost when supplied. Unknown prices remain unknown. An alternate configured in askModelWithFallback only receives context after eligible provider failures; the central workspace defaults to the selected connection and reserves one call per inference. Rates and quotas are set by the provider. Configure a provider-side spending cap for a currency ceiling.
