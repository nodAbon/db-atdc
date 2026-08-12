# Daily late-attendance bot function

This function is intentionally fail-closed. It will not send anything until all required secrets are configured in Supabase:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
- `NAVER_WORKS_ACCESS_TOKEN`
- `NAVER_WORKS_BOT_ID`
- `NAVER_WORKS_CHANNEL_ID`

Never put these values in Git, `.env` files committed to the repository, or browser code. Use Supabase Edge Function Secrets/Vault.

The migration creates `db_notification_deliveries`, which provides one delivery claim per work date and recipient set. This prevents duplicate mail when a cron invocation is retried.

The bot must be added to the target message room. The target room's Channel ID is used; no recipient email list is needed. The API requires the `bot.message` scope.

After the function is deployed, schedule it for 08:00 Asia/Seoul (23:00 UTC on the previous day) with Supabase Cron. The scheduled request must include `x-cron-secret: <CRON_SECRET>`.

Before enabling the production schedule, invoke the function once with a test recipient list and verify the delivery log and provider response.
