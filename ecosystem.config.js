module.exports = {
  apps: [{
    name: 'atlas',
    script: 'server.js',
    restart_delay: 3000,
    max_memory_restart: '500M',
    cron_restart: '0 3 * * *',
    watch: false,
    env: {
      NODE_ENV: 'production'
    }
  }]
};
