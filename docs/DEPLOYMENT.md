# Deployment and activation

## Use the supplied private site

1. Open the deployment link and sign in to ChatGPT with the owning account. No runtime install or terminal is required.
2. Create a brand in Brand Workspace. The application and D1 database are provisioned together. On-device generation needs no API key.
3. For cloud generation, create a key for an eligible Google AI Studio project, then use **Settings → Verify and connect**. Select a project model and keep its quota and billing limits in view. Do not put keys in a repository, client-side environment file or chat message.
4. For an additional device, sign in with the same account. Brand and campaign records persist server-side; device model caches and theme preferences are per browser.

## Rebuild on Sites

Use a new private, server-backed project with a D1 binding named DB. Replace the source hosting manifest's project_id with the ID assigned by that project's registration. Keep the first schema migration and journal under drizzle/. Run the Node build, validate its Worker ES module, package dist with the migration under dist/.openai/drizzle, push the matching source and deploy the saved version. The private gateway must supply the authenticated user ID. Check GET /health, open the main dashboard, and complete the acceptance workflow as an authenticated owner.

Set KEY_ENCRYPTION_SECRET to a new, securely generated 32-byte key encoded as standard base64. Use encrypted runtime configuration for this key and for provider secrets. A deployment-wide GEMINI_API_KEY with optional GEMINI_MODEL is also supported. Per-user credentials take precedence. Redeploy the saved version after runtime environment changes.

## Independent hosting with Cloudflare Workers and D1

This alternative requires a Cloudflare account, a controlled Access application, D1 and a Git repository. Check current service quotas. It has a separate identity and database from the managed private site.

1. Create a D1 database in the Cloudflare dashboard. In its SQL console, apply drizzle/0000_workspace.sql statement by statement. For subsequent migrations, use Wrangler D1 migration tracking consistently or apply each new migration through your change process. Do not apply the initial schema twice.
2. Create a Cloudflare Access self-hosted application for the exact Worker hostname. Add an allow policy restricted to the intended users. Copy the team issuer URL and application audience. [Cloudflare Access JWT validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)
3. In GitHub, copy wrangler.example.jsonc to wrangler.jsonc. Set the D1 database ID, hostname configuration, Access issuer and audience. The entry point must be deploy/cloudflare.mjs, which verifies the Access signature and refuses unsigned requests.
4. Connect the repository in Workers Builds. Use Node 24, npm ci, npm run build and npx wrangler deploy. These commands run in the hosted build. Add runtime secrets in the Cloudflare dashboard. Use a unique base64 encoding of 32 random bytes for KEY_ENCRYPTION_SECRET.
5. Open the resulting URL through Access. Check /health and test brand creation and isolation with separate authorized accounts. This independent deployment path has not been deployed in the owner's Cloudflare account.

## Optional LinkedIn publishing

Register a LinkedIn developer application, enable Sign In with LinkedIn using OpenID Connect and Share on LinkedIn, and register the exact production callback URL ending in /oauth/linkedin. Configure LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET on the server and redeploy. In a selected brand's Publishing screen, authorize the intended member account. Approval and posting are separate actions. Review the visible member name and the PUBLIC audience before sending. This release implements text-only member posts; a company Page needs separate permissions. Meta and YouTube use the approved-content manual handoff.

## Backup and operating boundaries

Use the database provider's D1 backup/export tools for a full restore, including ownership records and relationships. Retain the corresponding encryption key in the hosting secret store. Calendar and analytics CSV exports omit credentials and do not constitute a full database backup. Each workspace view currently loads up to 1,500 items per type, the latest 20 research runs and 30 activity entries. Use a new campaign or brand intentionally; monitor storage and quotas. This bounded release does not provide a background publisher, team approval roles, media hosting, automated network-wide fact verification or native platform analytics synchronization.
