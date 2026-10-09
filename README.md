# Boost Messaging Controller v0.1.0

Chrome Manifest V3 side-panel extension for managing customer contacts, message templates, local drafts, and customer notes alongside Google Voice.

## Install locally
1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode**.
4. Click **Load unpacked** and choose the folder containing `manifest.json`.
5. Pin the extension. Click its icon to open the side panel.

## Workflow
1. In **Contacts**, add a customer with a valid phone number.
2. Under **Compose**, select the customer and optionally choose a template. `{name}` is replaced with the customer's first name.
3. Adjust the draft, **Copy message**, and **Open Google Voice**.
4. In Google Voice, select or start the correct customer's conversation, paste your message, and **manually press Send**.
5. Save notes and drafts locally. No SMS has been sent by this extension.

## Storage/privacy
- Contacts, phone numbers, customer notes, message templates, and drafts are stored **locally in the current Chrome profile** with `chrome.storage.local`.
- No external server, analytics, Google Voice DOM scraping, or undocumented Google Voice API is used.
- Extension does not synchronize actual sent messages or Google Voice conversations. Drafts are not automatic evidence of delivery.
- Back up customer data before removing the extension or Chrome profile. Use a protected computer/profile for sensitive customer information.

## Future architecture
- Integrate a user-authenticated Boost CRM service with encrypted-at-rest records and permissions.
- Add provider interface supporting approved, opt-in SMS sending through official APIs (e.g., Twilio), including opt-outs, A2P registration where required, delivery statuses and audit logs.
- Add AI reply suggestions using a backend without exposing API keys in the extension.

## Important limitation
Google Voice does not offer a public SMS-sending API for this use case and restricts automated or bulk texts. This extension is intentionally a human-in-the-loop drafting assistant, not a Google Voice auto-sender.