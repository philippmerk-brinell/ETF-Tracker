module.exports = {
  apps: [{
    name: 'etf-tracker',
    cwd: './backend',
    script: 'src/index.js',
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: { NODE_ENV: 'production' },
  }]
};
