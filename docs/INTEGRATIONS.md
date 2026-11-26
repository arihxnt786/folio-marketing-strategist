# Provider access and publishing handoff

Provider documentation checked 26 November 2026. The release's README and test record identify the integrations actually enabled on its deployment.

## Publish an approved item manually

1. Review the final copy, links, media rights, target account and intended publication time. Approve the version you intend to publish.
2. Take the approved copy from the workspace to the platform's own composer. Select the correct account. Attach the finished image or video and review the native preview.
3. Publish on the platform. Open the resulting post, check its visibility and copy its permalink. A scheduled post can remain pending until it appears.
4. Retain the permalink with the campaign. A manually supplied link is an operator's record. API confirmation requires a response from the destination platform. If the composer times out, check the destination account before trying again.

| Destination | Native handoff | Requirements for a direct connector |
| --- | --- | --- |
| Instagram | Open Instagram or Meta Business Suite, select the professional account and attach the finished media. | Instagram Login requires business basic and content-publish permissions. The Facebook Login route has different scopes and account linkage. Meta's URL-based flow fetches an accessible media asset, creates a container, checks its status and returns a media ID after publication. [Instagram content publishing](https://developers.facebook.com/documentation/instagram-platform/content-publishing) |
| Facebook Page | Open the intended Page or Business Suite and create a post as the Page. | Facebook Login must authorize a person with appropriate Page tasks and issue a Page token. Check the permissions for each operation, including `pages_manage_posts`. A successful Page feed creation returns a post ID. [Pages API guide](https://developers.facebook.com/documentation/pages-api/posts) |
| LinkedIn | Open the member or company composer. Verify the identity shown above the text before posting. | Member sharing requires the Share on LinkedIn product and OAuth scope `w_member_social`. Organization posting requires separate access, `w_organization_social` and an eligible role at that organization. [Member sharing](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin) · [Organization posting](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api) |
| YouTube | Open YouTube Studio, upload the finished video, enter its title and description, then choose visibility and schedule. | Enable the YouTube Data API, register a web OAuth client and authorize the channel with a supported upload scope. `videos.insert` needs actual media. Confirm upload, processing status and visibility before recording publication. [Upload specification](https://developers.google.com/youtube/v3/docs/videos/insert) |

A direct connector needs developer-app registration, an exact HTTPS redirect URI registered with the platform and a grant from the account owner. A server-side integration must bind the grant to the correct brand and user, keep tokens secret, handle expiration and revoke access on disconnect. App registration alone does not activate a connector.

## Gemini setup and data use

1. Sign into Google AI Studio with the account that owns the project. Create or select a project with an eligible free model and a nonzero quota. Review the project billing tier before creating a key. [API keys](https://aistudio.google.com/apikey) · [Billing](https://ai.google.dev/gemini-api/docs/billing)
2. Add the key to the deployment's server-side secret settings using the name in its configuration example. Select a supported model available to that project. Check the deployment README for the activation and test steps.
3. Use a public brand description for the first generation. Under Google's unpaid-service terms, prompts and outputs may be reviewed or used to improve products. Sensitive, confidential and personal inputs are excluded from unpaid services. Google's terms require paid services for API clients made available in the EEA, Switzerland or the UK. [Gemini service terms](https://ai.google.dev/gemini-api/terms)
4. Check project limits in AI Studio after a quota error. Quotas vary by model and project and include per-minute and daily limits. Changing a key within the same project does not provide a separate quota. [Rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)

## Free hosting limits

For deployment in your own Cloudflare account, Workers Free currently includes 100,000 requests/day and 10 ms CPU per invocation. D1 Free includes 5 million rows read/day, 100,000 rows written/day and 5 GB total storage. Query scans and index updates affect those counts. Check the account plan and usage before increasing request volume. A managed hosting service can apply its own limits. [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) · [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)
