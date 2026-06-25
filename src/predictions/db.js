const knex = require('../connections/db');

async function createPool(home_team, away_team) {
  const [id] = await knex('prediction_pools').insert({ home_team, away_team, status: 'open' });
  return knex('prediction_pools').where({ id }).first();
}

function listPools() {
  return knex('prediction_pools').orderBy('created_at', 'desc');
}

function getPool(id) {
  return knex('prediction_pools').where({ id }).first();
}

function listPredictions(poolId) {
  return knex('predictions').where({ pool_id: poolId }).orderBy('created_at', 'desc');
}

async function savePrediction(poolId, telegramId, predictedHome, predictedAway) {
  const existing = await knex('predictions').where({ pool_id: poolId, telegram_id: String(telegramId) }).first();
  if (existing) {
    await knex('predictions').where({ id: existing.id }).update({
      predicted_home: predictedHome,
      predicted_away: predictedAway,
    });
    return false; // updated, not new
  }
  await knex('predictions').insert({
    pool_id: poolId,
    telegram_id: String(telegramId),
    predicted_home: predictedHome,
    predicted_away: predictedAway,
  });
  return true; // newly created
}

async function settlePool(poolId, resultHome, resultAway) {
  await knex('prediction_pools').where({ id: poolId }).update({
    status: 'settled',
    result_home: resultHome,
    result_away: resultAway,
    settled_at: knex.fn.now(),
  });

  const predictions = await knex('predictions').where({ pool_id: poolId });
  for (const p of predictions) {
    const isCorrect = p.predicted_home === resultHome && p.predicted_away === resultAway;
    await knex('predictions').where({ id: p.id }).update({ is_correct: isCorrect });
    p.is_correct = isCorrect;
  }
  return predictions;
}

module.exports = {
  createPool,
  listPools,
  getPool,
  listPredictions,
  savePrediction,
  settlePool,
};
