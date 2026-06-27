# Phase 2 — Turn on the live advisor (Mabel) · ~5 minutes

This deploys the server-side function that talks to Claude. Your Anthropic key lives
ONLY here (as a Supabase secret) — never in the app.

## 1. Deploy the `advisor` function
1. Supabase dashboard → left sidebar → **Edge Functions**.
2. **Deploy a new function** (or **Create function**) → name it exactly **`advisor`**.
3. In the code editor, delete the starter template and paste the full contents of
   `supabase/functions/advisor/index.ts` (in the Reading Genie folder).
   *(Tell me when you're on this screen and I'll copy it to your clipboard.)*
4. Click **Deploy**. Wait for "deployed".

## 2. Add your Anthropic key as a secret
1. Edge Functions → **Secrets** (or Project Settings → Edge Functions → Secrets).
2. **Add new secret**:
   - Name: `ANTHROPIC_API_KEY`
   - Value: your `sk-ant-…` key
3. Save. (`SUPABASE_URL` and `SUPABASE_ANON_KEY` are provided to the function automatically.)

## 3. Test it
1. Open **localhost:8123**, sign in.
2. Open a **Finished** book → **Revisit with the advisor** → type a message.
   You should get a **real, original Claude reply** (not the scripted one).
3. Or: the moth → **Consult your advisor** → real, reasoned picks.

**If it falls back to the scripted version:** open the console (⌥⌘J). You'll see
`[advisor] falling back: …` with the exact error — paste it to me and I'll fix it.
(The app never breaks — it just uses the scripted preview until the function works.)

## 4. Cost lever (your call)
The model is set at the top of `index.ts`:
```ts
const MODEL = 'claude-opus-4-8';   // most capable
```
Opus is ~pennies per conversation but the priciest. To stretch your $5 further across
friends, change it to `'claude-sonnet-4-6'` (cheaper) or `'claude-haiku-4-5'` (cheapest)
and re-deploy. All three are good; Opus is just the most perceptive.

## 5. Security — rotate the key when convenient
Because the key came through our chat in plaintext, roll it once we're settled:
Anthropic console → API keys → roll → paste the new value into the Supabase secret. Done.
