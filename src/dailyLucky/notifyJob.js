const db = require('./db');
const service = require('./service');

/** Runs every minute: reminds users whose cooldown just elapsed that a new chance is ready. */
async function runDailyLuckyNotifyJob() {
  const settings = await service.getSettings();
  if (!settings.enabled) return;

  const due = await db.listAttemptsDueForNotification();
  for (const attempt of due) {
    // Mark notified regardless of delivery outcome — a permanently blocked/deleted
    // chat would otherwise get retried every minute forever with no chance of success.
    await service.sendReminder(attempt.telegram_id, settings.notificationText);
    await db.markNotified(attempt.id);
  }
}

module.exports = { runDailyLuckyNotifyJob };
