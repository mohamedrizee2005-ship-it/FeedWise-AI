# Hosting FeedWise

The managed app is at https://feedwise-classroom.mohamedrizny5002.chatgpt.site . It works across student phones and lecturer computers using hosted D1 storage. Users do not connect their ChatGPT account to submit or view a private results link.

## Independent free-tier deployment

The supported independent target is **Cloudflare Workers + D1**, within the account's free quotas. GitHub Pages alone cannot run the private API or database. Reddit is a discussion website; if you meant **Render**, its free web services lose local SQLite files on restart/redeploy/spin-down and its free Postgres currently expires after 30 days, so that is not the default durable deployment here.

This process deploys a **new app and database in your own Cloudflare account**. It does not transfer managed Site feedback or change its address. No paid upgrade or billing change is required by the code; check your account's plan and current usage before deployment.

1. Run the local setup first and verify the app. Create a Cloudflare account yourself if needed, then sign in through Wrangler:

```sh
npx wrangler login
```

2. Create your own D1 database:

```sh
npx wrangler d1 create feedwise-db
```

3. Copy `self-host/settings.example.json` to `self-host/settings.json`. Set `database_id` to the exact ID returned by that command. Set `database_name` to `feedwise-db`; choose an available lowercase Worker name in `worker_name`. These are identifiers, not API secrets. The local settings file is ignored by Git.

4. Build and create your standalone deployment config:

```sh
npm run host:build
```

The command writes `dist/server/wrangler.selfhost.json` with your database binding, built Worker and assets. It preserves the application code; it does not overwrite `.openai/hosting.json` or use the managed Site ID. Build again after each source/model change.

5. Apply pending migrations to **your new remote database**, then deploy:

```sh
npx wrangler d1 migrations apply DB --remote --config dist/server/wrangler.selfhost.json
npx wrangler deploy --config dist/server/wrangler.selfhost.json
```

Review Wrangler's target before accepting its prompts. Open the `https://...workers.dev` address Wrangler returns. Create a new class, save the private results link and test a student submission on a separate device. Later deployments repeat steps 4–5; tracked migrations should not be replayed manually.

You can use a custom domain later; it is optional. Do not enable paid resources or automatic plan upgrades simply to follow this guide.

## Free does not mean unlimited

Official limits checked on 16 November 2026:

- Workers Free: 100,000 requests/day, 10 ms CPU/request and 128 MB memory. Static asset rules and other limits also apply.
- D1 Free: 5 million rows read/day, 100,000 rows written/day and 5 GB total storage. These are rows, not feedback submissions; indexes and queries also consume quota.
- The app independently caps each class at 1,000 responses. Hosted-provider quotas may be reached sooner.

The standalone config can be generated and dry-run locally; a deployment into **your personal Cloudflare account** still requires that account's Wrangler authorization. Local testing does not establish real free-tier CPU usage or production load capacity. Check Cloudflare Metrics for CPU errors (1102), quota errors and database usage. Reduce traffic/workload or revise the model before deciding whether any paid plan is appropriate. No unlimited availability or zero-cost guarantee is made for another provider/account.

Official references:

- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/)
- [D1 pricing and free quotas](https://developers.cloudflare.com/d1/platform/pricing/)
- [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)
- [Cloudflare Vite deployments](https://developers.cloudflare.com/workers/vite-plugin/get-started/)
- [Render Free limitations](https://render.com/docs/free)

## Backups and secrets

Use the lecturer CSV export to keep readable results. For a standalone database, an operator can also run:

```sh
npx wrangler d1 export DB --remote --config dist/server/wrangler.selfhost.json --output feedwise-backup.sql
```

That export contains private data; store it privately, outside this repository. Never commit actual feedback, private results links, account tokens, `.env` files, `.dev.vars`, local databases or exported backups.

The current app needs **no AI API key**. Adding an external AI provider later requires a server-side secret and a deliberate data-sharing decision; putting a key in React code exposes it to visitors.
