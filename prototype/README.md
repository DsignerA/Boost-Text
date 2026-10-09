# Live Call Intelligence prototype

This experimental branch adds opt-in Chrome audio capture to the existing Boost Text extension. **It is not validated against an actual Google Voice call yet**. It does not send SMS, record to disk, notify Samuel, or claim to capture calls made outside Chrome.

## Run
1. Start local relay: set OPENAI_API_KEY and a random BOOST_SESSION_TOKEN (24+ characters), then run `node prototype/relay.mjs` in Node 20+.
2. Load extension unpacked from this repository in chrome://extensions; reload if it was already installed.
3. Open Google Voice in Chrome, select its tab, open Boost Text's side panel and click **Call Lab**.
4. Explain the transcription to all call participants and obtain any required consent. Check the consent box.
5. Enter the matching local session token and press **Start Listening**. Allow Chrome microphone permission.
6. Verify both sides of a consented test call appear in transcript. Stop to end capture; export JSON if needed.

## Scope and limitations
- Chrome desktop only, user initiated; no background recording. Closing the panel ends the session.
- Capture attempts to mix Google Voice tab audio and local microphone; device/Chrome behavior must be verified.
- Every ~8 seconds, a self-contained WebM segment is sent to a localhost relay, then to OpenAI transcription. This is near-real-time with potential gaps and no speaker labels, not a low-latency streaming STT implementation.
- Audio processing sends call audio to an external provider. Do not use with real customer calls until consent, data retention, privacy controls, and vendor terms are reviewed.
- No automatic messages or sales coaching yet. No call monitoring via phone-only Google Voice.
- Relay binds to loopback and requires a long session token; do not expose it on a public interface. Token stays in page memory and is not stored.
- A real implementation needs a secure authenticated backend, encrypted transport outside localhost, diarization, better capture lifecycle, and opt-in retention policy.
