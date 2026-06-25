# Match Prediction Feature (removed — documented for reference)

This documents the "guess the game result" feature that existed in this repo
up to commit `8a9ee53`. It was fully removed in commit `7e2c70f` ("a").
Only the two DB migrations below are still present on disk; the rest is
reconstructed here from git history so it can be re-implemented later.

## Idea

Admin creates a "prediction pool" for an upcoming match (e.g. Arsenal vs PSG).
The bot broadcasts an announcement with a "🔮 پیش‌بینی نتیجه" (Predict result)
button to users. Each user predicts the final score (home goals, away goals).
After the real match ends, the admin "settles" the pool with the actual score,
the bot marks each prediction correct/incorrect, and notifies every user who
predicted with a win/lose message.

## Data model

`migrations/20260625000000_prediction_pools.js`

- `prediction_pools`: `id`, `home_team`, `away_team`, `status` (`open` →
  `closed` → `settled`), `result_home`, `result_away`, `created_at`,
  `settled_at`.

`migrations/20260625000001_predictions.js`

- `predictions`: `id`, `pool_id` (FK → `prediction_pools`, cascade delete),
  `telegram_id`, `predicted_home`, `predicted_away`, `is_correct`,
  `created_at`. Unique on `(pool_id, telegram_id)` — one prediction per user
  per pool (resubmitting updates the existing row instead of inserting).

## Bot flow (`src/predictions/handlers.js`, `src/predictions/db.js`)

1. User taps the inline button `predict_<poolId>` (callback data).
   `bot.action(/^predict_(\d+)$/, ...)` looks up the pool, checks it's still
   `open`, and starts a flow stored in `ctx.session.predictFlow = { poolId, step: 'home' }`.
   Bot asks: "⚽ چند گل می‌زند {home_team}؟"
2. User replies with a number. A `bot.use(predictionTextMiddleware)`
   middleware intercepts plain text messages whenever `ctx.session.predictFlow`
   is set (and only then — it calls `next()` otherwise so it doesn't swallow
   unrelated messages).
   - `parseScore(ctx)` validates the reply is an integer in `[0, 50]`;
     otherwise replies with an error and stays on the same step.
   - On the `home` step: stores the home score, advances `step` to `'away'`,
     asks "⚽ چند گل می‌زند {away_team}؟"
   - On the `away` step: calls `savePrediction(poolId, telegramId, home, away)`
     (upsert via the unique `(pool_id, telegram_id)` constraint), clears
     `ctx.session.predictFlow`, and confirms the submitted score to the user.
3. Session state (`ctx.session`) is persisted in Redis (`tg:session:<key>`),
   not in-memory, specifically so a crash/restart mid-flow doesn't lose the
   user's in-progress prediction.

Note: an earlier version used a Telegraf `Scenes`/`WizardScene` for this flow
(see commit `57fc2d8`), but it was rewritten as an explicit
`ctx.session.predictFlow` state machine (commit `8a9ee53`/parents) because the
Scenes/Stage abstraction made it hard to diagnose why the home→away handoff
was stalling in production.

## Admin panel routes (`server.js`, all behind `panelAuth`)

- `GET /pools` — list pools with a `prediction_count` per pool (grouped count
  from `predictions`).
- `POST /pools` — create a pool, body `{ home_team, away_team }`.
- `GET /pools/:id` — pool details + its predictions (left-joined with `users`
  for `username`).
- `POST /pools/:id/announce` — broadcast the predict button to a given list
  of `telegram_ids`, or to every active user in `users` if none is given.
  Sends in batches of 25 with a ~1s pacing delay between batches to stay
  under Telegram's rate limits.
- `POST /pools/:id/settle` — body `{ result_home, result_away }`. Marks the
  pool `settled`, flags each prediction `is_correct`, and DMs every predictor
  a win (🎉) or lose (❌) message showing their guess vs. the real score.
- `DELETE /pools/:id` — delete a pool (cascades to its predictions).

## Concurrency note

The polling loop in `server.js` guards against overlapping `getUpdates()`
calls (an `isPolling` flag) specifically because two concurrent
`bot.handleUpdate` calls on the same update batch could race a user through
two steps of the predict flow at once and corrupt `ctx.session.predictFlow`.
Any re-implementation of this flow needs to keep that guard (or equivalent)
in place.

## Re-implementing

To restore this feature, recreate `src/predictions/db.js` and
`src/predictions/handlers.js` from commit `8a9ee53` (run
`git show 8a9ee53:src/predictions/db.js` /
`git show 8a9ee53:src/predictions/handlers.js`), re-wire the two `require`s
and `registerPredictionHandlers(bot)` call plus the five `/pools*` routes
into `server.js` (diff against `8a9ee53` to see exactly what to re-add), and
run the two existing migrations if they haven't been applied yet.
