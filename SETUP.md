# Setup — Daily AI × Education Brief

You'll do this once. ~10 minutes total. Powered by the Anthropic Claude API (~$5/month with web search at one brief per day on Sonnet 4.6).

## 1. Get your Anthropic API key (2 min)

1. Go to <https://console.anthropic.com/settings/keys>
2. Sign in (you already have an account since you bought credits).
3. Click **Create Key** → name it "Daily Brief" → copy the key (starts with `sk-ant-...`). Keep it somewhere safe for the next step.

## 2. Create the Apps Script project (5 min)

1. Go to <https://script.google.com>
2. Click **New project** (top left).
3. You'll see a default file `Code.gs` with a placeholder function. **Delete everything** in it.
4. Open `brief.gs` from this repo, **copy all of it**, paste into `Code.gs`.
5. At the top of the file, find:
   ```js
   const ANTHROPIC_API_KEY = 'PASTE_YOUR_KEY_HERE';
   ```
   Replace `PASTE_YOUR_KEY_HERE` with the key you copied. Keep the quotes.
6. Click the project name **"Untitled project"** at the top → rename to **"Daily Brief"**.
7. Click the **disk icon** (Save) — or `Ctrl+S` / `Cmd+S`.

## 3. Test it once (1 min)

1. In the toolbar, make sure the function dropdown shows `dailyBrief`.
2. Click **Run**.
3. **First time only:** Google asks for permissions.
   - Click **Review permissions** → pick your account → **Advanced** → **Go to Daily Brief (unsafe)** → **Allow**.
   - The "unsafe" warning shows because it's your own personal script. Normal.
4. The function runs. Claude takes ~30-60 seconds to research and write the brief. Check `mattiesc@stanford.edu` — you should get the email shortly after.
5. If something fails, click **Execution log** at the bottom of the editor for the error.

## 4. Schedule it for 7am daily (1 min)

1. In the left sidebar, click the **alarm-clock icon** (Triggers).
2. Bottom right: click **Add Trigger**.
3. Set:
   - **Function to run:** `dailyBrief`
   - **Event source:** `Time-driven`
   - **Type of time-based trigger:** `Day timer`
   - **Time of day:** `7am to 8am`
4. Click **Save**.

Done. You'll get a brief between 7–8am every morning.

> **Timezone note:** Triggers fire in the project's timezone, which defaults to your Google account's timezone. If the brief arrives at the wrong time, go to **Project Settings (gear icon) → Time zone** and set it to your local timezone.

## Customizing later

All knobs are at the top of `brief.gs` in the CONFIG block:

- **What gets covered:** edit the `TOPICS` list — plain English, like "AI policy in higher ed". Claude searches the web for these.
- **RSS sample:** edit the `FEEDS` array (these are supplementary, not canonical).
- **Model:** `CLAUDE_MODEL` — `'claude-sonnet-4-6'` is the default sweet spot (~$0.05/run). Switch to `'claude-opus-4-7'` for the very best quality (~$0.25/run) or `'claude-haiku-4-5'` for cheapest (~$0.02/run).
- **Tone, sections, format:** edit the prompt inside the `synthesize` function.
- **Web search budget:** `WEB_SEARCH_MAX_USES` caps how many searches Claude can run per brief (~$0.01 each).

## If something breaks

- Open the Apps Script project → **Executions** tab in the left sidebar — every run is logged with errors.
- Most common issues:
  - **Anthropic API error 401:** API key wrong or unset.
  - **Anthropic API error 429:** rate limited or out of credits — top up at <https://console.anthropic.com/settings/billing>.
  - **0 articles fetched:** all RSS feeds were unreachable. Claude will still write the brief from web search alone — this is fine.

## Cost expectations

At one brief per day with web search on (10 searches/day):

| Model | Token cost | Search cost | Monthly total |
|---|---|---|---|
| Haiku 4.5 | ~$0.02/day | ~$0.10/day | **~$3.60/month** |
| **Sonnet 4.6 (default)** | ~$0.05/day | ~$0.10/day | **~$4.50/month** |
| Opus 4.7 | ~$0.25/day | ~$0.10/day | **~$10.50/month** |

Your $10 in credits → roughly 2 months on Sonnet, 1 month on Opus, or 3 months on Haiku.
