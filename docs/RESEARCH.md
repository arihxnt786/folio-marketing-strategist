# Research providers and open-source evaluation

Reviewed on 26 November 2026. The results below came from direct HTTP requests in the development environment. They establish what providers returned there. See the testing notes for checks through the application.

## Source coverage

| Provider | Search surface | Observed response | Interpretation |
| --- | --- | --- | --- |
| Crossref | Publisher-deposited scholarly metadata, accessible without a key | HTTP 200. Searching for “social media marketing” with a 2026 publication window returned “Social Media Marketing”, publisher listed as Oxford University PressNew York, NY, publication date 2026-06-25, DOI 10.1093/9780197859063.003.0045. | Evidence that a work is registered with these details. A title alone cannot substantiate its findings. |
| Hacker News Search by Algolia | Public discussions and submitted articles, weighted toward technology | HTTP 200. A date-sorted title query for “marketing” with typo tolerance disabled returned discussion 50625738, submitted 2026-11-24. | The creation date belongs to the Hacker News submission. A title match can be irrelevant to the selected audience. |
| GDELT DOC 2.0 | News article discovery across publishers | HTTP 503 on a live article-list query for “marketing”. | An unavailable source provides no usable evidence. Article discovery dates are insufficient to establish publication dates. |
| Stack Exchange | Public questions on a particular community | HTTP 200 for a query on the Webmasters community. | Questions identify topics raised by participants. Their counts do not measure market demand. |
| GOV.UK Search | UK government publications, updates and announcements | The public endpoint returned results, including an irrelevant result when sorted by recency. | Suitable for attributed UK public-sector material after checking its relevance and date. |

The application can use only a subset of these candidates. Provider responses may vary with time, quotas, query terms and network location.

### Crossref

Use a date filter with both bounds and request `title,URL,published,publisher`. A relevance-ranked query without a date filter returned a 2014 publication during testing. Preserve year-only or year-and-month precision in `published.date-parts`. Public search has a documented concurrency limit of one and a documented rate limit of one query per second. The service exposes limits in the response headers. A maintainer can use a real support email to opt into its polite pool. [Access and authentication](https://www.crossref.org/documentation/retrieve-metadata/rest-api/access-and-authentication/) · [Observed publication](https://doi.org/10.1093/9780197859063.003.0045)

### Hacker News

The upstream search controller sends date-ordered requests to a dedicated search index. Use `tags=story`, `query` and a small page size. Typo matching can increase noise. A development query matching “marketing” against story titles with typo tolerance disabled produced an inspectable discussion permalink. Preserve the original outbound article URL separately when available. Store the local retrieval timestamp. Avoid rendering the provider's HTML highlight fields. [API](https://hn.algolia.com/api) · [Controller at reviewed revision](https://github.com/algolia/hn-search/blob/e27760e09840a6fa3efc592649fceb89237e4c2f/app/controllers/api/v1/search_controller.rb) · [Observed discussion](https://news.ycombinator.com/item?id=50625738)

### Additional candidates

GDELT's `ArtList` supports JSON article results. Handle timeouts, HTTP failures and invalid upstream responses as distinct from a successful empty result. Stack Exchange requires a community selection, observing `backoff` when returned and inspecting remaining quota. GOV.UK is geographically specific. None of these sources supplies the private reach, conversions or impressions of a competitor. [GDELT API](https://blog.gdeltproject.org/gdelt-doc-2-0-api-debuts/) · [Stack Exchange search](https://api.stackexchange.com/docs/advanced-search) · [Stack Exchange throttling](https://api.stackexchange.com/docs/throttle) · [GOV.UK search](https://docs.publishing.service.gov.uk/apis/search/search-api.html)

## Code and licence inspection

| Project | Reviewed implementation | Deployment decision |
| --- | --- | --- |
| Papa Parse 5.5.3, MIT, copyright Matthew Holt | The npm release tarball matched its registry SHA-512 integrity value. Inspected the unminified parser, serializer and `escapeFormulae` handling. The parser returns structured errors; export protection is opt-in. | Suitable for use as a pinned browser dependency for CSV imports and exports. Retain its MIT notice with distributed copies. Use an explicit export option, validate headers and numbers separately, and preserve empty cells as missing measurements. [Source](https://github.com/mholt/PapaParse/tree/5.5.3) · [Documentation](https://www.papaparse.com/docs) · [Licence](https://github.com/mholt/PapaParse/blob/master/LICENSE) |
| Postiz, AGPL-3.0 | Reviewed its Compose deployment and LinkedIn provider at revision `44df988cb1840dc5eb50755536b3e6e326d27fc3`. The provider handles OAuth, media preparation, status polling and extraction of the platform-issued post identifier. Its deployment includes PostgreSQL, Redis and Temporal. | Those infrastructure dependencies do not fit the selected single-Worker deployment. The provider is an architectural reference. Implementing official social APIs still requires app credentials and account permissions. [Provider source](https://github.com/gitroomhq/postiz-app/blob/44df988cb1840dc5eb50755536b3e6e326d27fc3/libraries/nestjs-libraries/src/integrations/social/linkedin.provider.ts) · [Deployment](https://github.com/gitroomhq/postiz-app/blob/44df988cb1840dc5eb50755536b3e6e326d27fc3/docker-compose.yaml) · [Licence](https://github.com/gitroomhq/postiz-app/blob/44df988cb1840dc5eb50755536b3e6e326d27fc3/LICENSE) |

Provider API access and source-code licensing are separate. Linking to an article does not confer permission to reproduce its full text. For research, keep the provenance of each source record and attach hypotheses to the brand and its evidence.
