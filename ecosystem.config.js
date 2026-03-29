module.exports = {
  apps: [
    {
      name: 'etf-signal-engine',
      cwd: '/home/user/ETF-Tracker',
      script: 'main.py',
      interpreter: 'python3',
      autorestart: false,           // Batch job — don't restart on normal exit
      watch: false,
      cron_restart: '0 22 * * 1-5', // Mon-Fri 22:00 UTC (23:00 CET)
                                    // After EU close (17:30 CET) + FRED lag
      env: {
        PYTHONUNBUFFERED: '1',      // Real-time log output
      },
      log_file: 'data/pm2.log',
      error_file: 'data/pm2-error.log',
      time: true,
    },
  ],
};
