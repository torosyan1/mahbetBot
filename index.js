
const { DateTime } = require('luxon');


let dataCheck;

// Check if latestRecordQuery exists and has a valid created_at timestamp
dataCheck =DateTime.fromISO(new Date().toISOString());

console.log(dataCheck)
const now = DateTime.now();
const hoursPassed = now.diff(dataCheck, 'hours').hours;

console.log(hoursPassed, hoursPassed);