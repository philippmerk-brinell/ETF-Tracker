require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

module.exports = {
  PORT: parseInt(process.env.PORT || '3001'),
  NODE_ENV: process.env.NODE_ENV || 'development',
  // Scheduler: check every 15 minutes Mon-Fri 8-22 CET
  SCHEDULER_CRON: process.env.SCHEDULER_CRON || '*/15 6-20 * * 1-5',
};
