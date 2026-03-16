const cron = require('node-cron');
const { SCHEDULER_CRON } = require('./config');
const { checkAll } = require('./services/alertEngine');

function startScheduler() {
  console.log(`Scheduler starting with cron: "${SCHEDULER_CRON}"`);

  cron.schedule(SCHEDULER_CRON, async () => {
    console.log(`[${new Date().toISOString()}] Running scheduled alert check...`);
    try {
      await checkAll();
    } catch (err) {
      console.error('Scheduler error:', err.message);
    }
  }, {
    timezone: 'Europe/Berlin',
  });

  console.log('Scheduler started (Mon-Fri, 8:00-22:00 CET, every 15 minutes).');
}

module.exports = { startScheduler };
