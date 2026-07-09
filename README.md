# Presenting Structure

A calibrated triage instrument for contemplative practitioners, grounded in the Stage 4 diagnostic framework ("Practice Derivation as Diagnosis"). Hybrid flow: safety screening → structured intake → differential dialogue → a mapping of the presenting structure with the framework's practice directions, attractor tags, epistemic tags, and failure modes.

It deliberately does **not** assess attainment, and refuses to. It stops and refers out on signs of acute difficulty.

## Architecture

```
public/                          # static site (no build step)
netlify/functions/
  triage.mjs                     # serverless proxy → api.anthropic.com (with prompt caching)
  triage-prompt.mjs              # the facilitator protocol — four phases, stances, state line
  framework-doc.mjs              # ⟵ THE ONE REQUIRED STEP: paste the Stage 4 markdown here
netlify.toml
```

The full framework document travels as a cached system block: after the first request, the large document costs cache-read rates, so per-turn cost stays low despite the document's size.

## Setup

1. **Paste the framework.** Open `netlify/functions/framework-doc.mjs`, replace the placeholder between the backticks with the complete Stage 4 markdown (escape any triple-backticks in the document as \\\`\\\`\\\`), and set `FRAMEWORK_READY = true`. Until this is done, the app deploys fine but the facilitator tells users the instrument isn't configured and declines to assess — it will never improvise the framework from general knowledge.

2. **Update rail labels (optional).** In `public/app.js`, the `STRUCTURES` array holds the display names for the sidebar; names for Structures 1–3 are placeholders. These are labels only — diagnosis comes from the document.

3. **Push to GitHub and connect Netlify** — identical to the dyad app:
   ```bash
   git init && git add -A && git commit -m "Structure triage v1"
   git remote add origin git@github.com:YOUR_USERNAME/structure-triage.git
   git push -u origin main
   ```
   Netlify → Add new site → Import from GitHub → set env var `ANTHROPIC_API_KEY` → trigger deploy. Optional: `TRIAGE_MODEL` to override the default (`claude-sonnet-4-6`).

## Cost control (open link)

You chose an open link, so anyone with the URL spends your API credit:

- **Set a monthly spend limit** on the key in the Anthropic console — this is the real backstop. Consider a dedicated key for this app so a limit here can't interrupt your other work.
- **Realistic scale:** with the framework document cached (cache reads are ~10% of input price), a full 20–25 turn reading on Sonnet 4.6 costs roughly $0.50; on Haiku 4.5 roughly a third of that. Costs only matter if usage grows a lot.
- **Cheaper model, no code change:** set `TRIAGE_MODEL=claude-haiku-4-5-20251001` in Netlify env vars and redeploy.
- The function already caps history (60 turns), message size (8K chars), and reply length (1,200 tokens).
- Share the URL deliberately rather than posting it publicly. If usage grows, add a passcode later: one env var plus a header check in `triage.mjs`.

## Switching providers (OpenAI, z.ai GLM, any OpenAI-compatible API)

The function is provider-agnostic. Default is Anthropic. To use an OpenAI-compatible endpoint instead, set in Netlify env vars:

```
PROVIDER=openai-compatible
OPENAI_API_KEY=<key from that provider>
OPENAI_BASE_URL=https://api.openai.com/v1        # or your provider's base URL, e.g. z.ai's
TRIAGE_MODEL=gpt-5.5                              # or glm-5.2, etc.
```

Note: **API keys are metered pay-per-token on every provider** — an OpenAI key is billed separately from a ChatGPT Plus subscription, which covers the chat app only. Switching providers changes the rate, not the billing model. Judge model quality on this task before optimizing its price: run the same test reading on both and compare diagnostic honesty, not just cost.

## Safety design

Phase 0 screens before anything else: functioning, distress, urgency. Red flags (functioning breakdown, ungrounded dissociation or panic, psychotic-spectrum features, self-harm references) permanently end assessment for the session and route to qualified human support — a teacher experienced with meditation-related difficulties and/or a clinician; Cheetah House is named as a specialized resource. The facilitator never validates or denies attainment claims, grounds every diagnostic statement in the document, preserves the framework's epistemic tags (ESTABLISHED / CONTESTED / INFERRED / SPECULATIVE), and closes every mapping with the raft-clause: the map is an instrument, not a truth.

Sessions are not stored server-side; participants can export their transcript as markdown.
