# Evidence search

The autonomous researcher accepts an objective, the selected brand, a depth and optional public search phrases. It returns an evidence packet with numbered sources, queries actually sent, the search period, per-provider outcomes and gaps. Reference numbers are scoped to their packet. Persist the packet alongside any output citing it.

## Search sequence

1. Use the task's proposed search phrases. If none are supplied, select terms from the objective, or from the public industry field if the objective has no usable terms. Strip URLs, email-like tokens and long opaque tokens from outbound phrases. Keep personal details, secrets and confidential business information out of search topics.
2. Search Crossref, Hacker News and GDELT concurrently. Include the Federal Register for a US regulatory objective. Search providers receive bounded keyword queries. Uploaded documents, account tokens and full profiles are never sent by this component.
3. Check the source title, link and text for relevance. Keep source excerpts separate from analyst conclusions. A title-only record explicitly identifies its evidence type. Scholarly abstracts are publisher metadata, and a commenter's submission text represents that person's statements.
4. Remove duplicates by canonical URL, DOI or sufficiently long matching title on the same host. Ranking uses term overlap in the title and excerpt, overlap with the objective, the presence of a substantive excerpt and recent publication. Reserve room for distinct source types. These internal ranking weights measure relevance within the search, not public engagement or truth.
5. Follow a second planned phrase if the budget permits. When fewer than three distinct records match and no planned phrase remains, broaden the topic or try the brand's industry. An unavailable provider is skipped for the rest of that run. When coverage is sufficient and there are no remaining phrases, stop early.

| Depth | Maximum search rounds | Lookback | Maximum returned sources |
| --- | ---: | ---: | ---: |
| Quick | 1 | 90 days | 6 |
| Standard | 2 | 180 days | 10 |
| Deep | 3 | 365 days | 15 |

GDELT's lookback is capped at 90 days. Provider calls have individual deadlines and bounded response sizes. Transient HTTP gateway failures receive one retry when the request budget permits. A 429 is reported, and a numeric retry-after is preserved. Further rounds stop once the time budget is exhausted.

## What a source substantiates

| Field | Meaning |
| --- | --- |
| `id`, `url`, `title`, `publisher` | A local citation ID and the actual record or linked article. Hacker News also retains its discussion link. |
| `provider`, `found_via`, `queries` | Search provider, alternate discovery paths and matching search phrases. |
| `excerpt`, `excerpt_type` | A short piece of provider-supplied text with its origin. If only a title is available the excerpt repeats that title with an explicit label. |
| `published_at` | Publication date at the provider's supplied precision. Missing values stay null. |
| `discussion_at`, `discovered_at` | Separate community-submission and news-index discovery timestamps. |
| `retrieved_at`, `freshness` | Retrieval time in UTC and a recency warning. Records over 90 days old receive an age flag. A recent discovery alone leaves publication recency unknown. |

A source listing establishes that the provider reported the material. Before publishing a substantive claim, check the original article and its applicability to the selected brand. The packet cannot establish market share, search volume, engagement or the accuracy of statements from a title. A geographically constrained government notice supports only claims within its jurisdiction. Multiple discovery paths can lead to the same original work.

## Source contracts

- Crossref's public REST API returns deposited metadata and date parts. A deployment may configure an actual operator address in `CROSSREF_MAILTO` for the polite access pool. [Access and limits](https://www.crossref.org/documentation/retrieve-metadata/rest-api/access-and-authentication/) · [Date filters](https://www.crossref.org/documentation/retrieve-metadata/rest-api/rest-api-filters/)
- Hacker News Search provides public story records and discussion timestamps. An outbound article may have a different author, publisher and publication date. [API](https://hn.algolia.com/api) · [Provider source](https://github.com/algolia/hn-search)
- GDELT DOC offers article-list search for public news. Its seen date describes indexing. [API](https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/)
- The US Federal Register publishes notice and rule metadata, agency names and publication dates. A proposed rule must retain that status in subsequent summaries. [API documentation](https://www.federalregister.gov/developers/documentation/api/v1)

## Verification

On 26 November 2026 an invocation of the actual module with “social media marketing” and “advertising” returned ten distinct Crossref records after applying the output limit. A publisher-supplied abstract was returned for DOI `10.21511/im.22(4).2026.10` with publication date 10 November 2026. Hacker News and GDELT timed out on that invocation; both failures appeared in the returned limitations. This verifies a live development-environment run. Provider availability and records may differ on another network.

Run the focused checks with `node --test test/evidence.test.mjs`. Set `FOLIO_LIVE_EVIDENCE=1` to include a real provider retrieval. The opt-in test requires at least one actual result, checks attribution and budgets, and verifies that provider failures are disclosed. The other tests exercise URL hygiene, date precision, irrelevance filtering, provenance-preserving deduplication, follow-up bounds and missing-input handling without contacting providers.

## Optional general-web and competitor search

Set the server secret `TAVILY_API_KEY` to enable Tavily general-web Search. Basic search runs at most once per executed research round and requests six results with original URLs, source excerpts and publication dates when available. The application uses fixed Tavily endpoints and disables provider-generated answers. Provider credits and quotas apply. The user can run the public index workflow without a Tavily account. [Search API](https://docs.tavily.com/documentation/api-reference/endpoint/search) · [Credits](https://docs.tavily.com/documentation/api-credits)

For competitor requests, enter public competitor websites in Brand Workspace. Search uses up to eight registered hostnames as a hard domain filter and rechecks returned URLs. Undated first-party pages remain eligible so positioning pages can be considered alongside dated news. Search results contain source-reported claims for editorial review.

To allow additional page extraction, set the optional server variable `TAVILY_EXTRACT=1` and run **Deep** competitor research. One basic Extract request may read up to two HTTPS URLs already returned by Tavily on configured competitors' sites. The application requests one relevant text chunk per page, stores a short excerpt, and records failures separately. URLs pasted into an objective cannot trigger a direct fetch. Extract can consume additional credits. [Extract API](https://docs.tavily.com/documentation/api-reference/endpoint/extract)

Tavily credentials were unavailable in the development environment. Domain restrictions, deduplication and date parsing were exercised locally. Live authenticated Tavily Search and Extract remain unverified. With an authorized key in the environment, the live test additionally searches REI's website for bicycle repair classes and checks for an actual sourced excerpt. This test performs a single Tavily Search request; it does not publish or start an extraction.

Optional general-web access uses Tavily when TAVILY_API_KEY is configured. Basic search requests bounded source snippets. Deep competitor research may use extract for up to two search-returned HTTPS pages on declared competitor domains. No visitor-supplied URL is fetched directly by the Worker. Coverage and charges depend on the provider account and terms. When the service is unavailable, its absence is visible in the evidence packet.

Signed-in users can also connect their own Tavily key in Settings → General web search. Verification uses one basic search. The stored credential is encrypted and scoped to its owner.
