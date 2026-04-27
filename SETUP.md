# Setup — Daily AI + EdTech Brief

You'll do this once. ~10 minutes total.

## 1. Get a free Gemini API key (2 min)

1. Go to <https://aistudio.google.com/apikey>
2. Sign in with your Google account
3. Click **Create API key** → **Create API key in new project**
4. Copy the key (starts with `AIza...`). Keep it somewhere safe for the next step.

## 2. Create the Apps Script project (5 min)

1. Go to <https://script.google.com>
2. Click **New project** (top left).
3. You'll see a default file `Code.gs` with a placeholder function. **Delete everything** in it.
4. Open `brief.gs` from this repo, **copy all of it**, paste into `Code.gs`.
5. At the top of the file, find this line:
   ```js
   const GEMINI_API_KEY = 'PASTE_YOUR_KEY_HERE';
   ```
   Replace `PASTE_YOUR_KEY_HERE` with the key you copied. Keep the quotes.
6. Click the project name **"Untitled project"** at the top → rename to **"Daily Brief"**.
7. Click the **disk icon** (Save) — or `Ctrl+S` / `Cmd+S`.

## 3. Test it once (1 min)

1. In the toolbar, make sure the function dropdown shows `dailyBrief`.
2. Click **Run**.
3. **First time only:** Google asks for permissions.
   - Click **Review permissions** → pick your account → **Advanced** → **Go to Daily Brief (unsafe)** → **Allow**.
   - The "unsafe" warning shows because it's your own personal script (not from the marketplace). Normal.
4. The function runs. Check `mattiesc@stanford.edu` — you should get a brief within ~30 seconds.
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

- **Add or remove news sources:** edit the `FEEDS` array at the top of `brief.gs`.
- **Change recipient or send time:** edit `RECIPIENT` and the trigger respectively.
- **Change tone, sections, or style:** edit the prompt inside the `synthesize` function.
- **Don't like the model output?** Try `gemini-2.5-pro` instead of `gemini-2.5-flash` (slower, more thoughtful, still free for low volume).

## If something breaks

- Open the Apps Script project → **Executions** tab in the left sidebar — every run is logged with errors.
- Most common issues:
  - **Gemini API error 400:** API key wrong or unset.
  - **Gemini API error 429:** rate limited (very rare on free tier with one call/day).
  - **0 articles fetched:** all feeds were unreachable. Try again tomorrow, or swap in different feeds.
