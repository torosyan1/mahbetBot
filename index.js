
const { DateTime } = require('luxon');

let = latestRecordQuery = {
  created_at: '2024-06-15T17:48:44.000'
}
let dataCheck;

// Check if latestRecordQuery exists and has a valid created_at timestamp
if (!latestRecordQuery || !latestRecordQuery.created_at) {
  dataCheck = DateTime.now().toISO();
} else {
  dataCheck = DateTime.fromISO(String(latestRecordQuery.created_at));
}

const now = DateTime.now();
const hoursPassed = now.diff(dataCheck, 'hours').hours;

console.log(hoursPassed);