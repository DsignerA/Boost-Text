# Boost-Text deterministic messaging service

This is an initial Node.js service for Samuel notifications and **human-approved** customer onboarding SMS. It is not a Google Voice automation layer. The Chrome extension in the repo remains a manual Google Voice companion.

## Implemented
- Customer registry with consent metadata
- Onboarding event creation, expiring approval records and one-use queueing
- Exact SMS commands: STATUS, DETAILS <id>, APPROVE <id>, CANCEL <id>
- SMS commands that attempt to approve/cancel require subsequent **authenticated API confirmation**. An SMS reply alone cannot authorize a sensitive action.
- Outbound Twilio adapter disabled by default, deliberate per-message delivery API
- Twilio webhook signature validation; STOP/START commands and suppression list
- Local JSON state with audit log and safe atomic save
- No AI decisions, customer-facing bulk campaigns, or unattended delivery

## Start
Use Node 20+. From `server/`:
```bash
npm install
cp .env.example .env
# Export .env variables through your process manager / shell; this example does not load dotenv automatically.
npm test
npm start
```
For example, with a secured service environment, inject all variables defined in `.env.example`. Keep `ADMIN_API_KEY` at least 24 random characters. **Do not commit secrets.** Use HTTPS behind a reverse proxy, strict inbound firewall policies, encrypted backups, and controlled access. JSON storage is a prototype; use a transactional DB for production.

## API (authentication: x-api-key)
```bash
curl -H "x-api-key: $ADMIN_API_KEY" http://localhost:8787/api/status
curl -X POST -H "x-api-key: $ADMIN_API_KEY" -H 'Content-Type: application/json' \
  -d '{"name":"Customer","phone":"+15552223333","consent":true,"consentSource":"signed onboarding form"}' \
  http://localhost:8787/api/customers
curl -X POST -H "x-api-key: $ADMIN_API_KEY" -H 'Content-Type: application/json' \
  -d '{"customerId":"<customer UUID>"}' http://localhost:8787/api/onboarding
curl -X POST -H "x-api-key: $ADMIN_API_KEY" -H 'Content-Type: application/json' \
  -d '{"approvalId":"<approval UUID>"}' http://localhost:8787/api/approve
curl -X POST -H "x-api-key: $ADMIN_API_KEY" -H 'Content-Type: application/json' \
  -d '{"outboxId":"<outbox UUID>"}' http://localhost:8787/api/deliver
```

Customer SMS sending is enabled **only** when `ENABLE_SMS_SEND=true` and working Twilio settings are present. Configure inbound webhook `POST https://your-https-domain/twilio/inbound` with `PUBLIC_BASE_URL=https://your-https-domain`. It validates `X-Twilio-Signature` against the exact public URL and POST form fields.

## Before production
1. Implement authenticated web dashboard with role-based authorization and session-based approval (no client-side shared admin API key).
2. Migrate to Postgres/SQLite with transactional claim-and-send to prevent duplicate delivery on retries, restarts or concurrent workers.
3. Host a real onboarding destination, preferably with expiring signed links and token storage hashed at rest. Current URL generator does not create an onboarding session; generated token is a prototype placeholder.
4. Verify SMS consent independently, implement comprehensive STOP/HELP handling, registration where applicable (US A2P 10DLC), retention and privacy policies.
5. Add delivery-status webhooks, queue worker/backoff, provider idempotency/reconciliation and alerts for uncertain sends.
6. Wire Samuel's event bus and authenticated commands, then test in a sandbox with consented phone numbers.
7. Add Qwen as optional **suggestion only** after deterministic commands. Do not permit AI to execute arbitrary actions.

### Known gaps
- No production-ready authentication dashboard, webhook rate limiting or CSRF protection.
- API-key comparison and JSON-store mutation are intended for a trusted development environment.
- Incoming replies are not a full CRM conversation sync.
- Inbound SMS messages are processed without retaining customer free text; privacy minimization is intentional.
- Sending is deliberately not automatic and may have at-least-once failure ambiguity.
