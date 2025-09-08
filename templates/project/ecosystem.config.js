module.exports = {
  apps: [{
    // The name of your application, as it will appear in PM2.
    name: 'gingerjs-server',
    
    // The script that starts your application.
    script: 'start.js',
    cwd: __dirname,

    // --- Advanced Options ---
    // Reference: https://pm2.io/doc/en/runtime/reference/ecosystem-file/

    // To enable cluster mode and run on all available CPU cores:
    // instances: 'max',
    // exec_mode: 'cluster',

    // To watch for file changes and automatically restart (for development):
    // watch: ["./web", "./modules"],
    
    // Automatic restart on crash
    autorestart: true,
    
    // Resource limits to prevent memory leaks from crashing the server
    max_memory_restart: '1G',

    // Environment variables
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production'
    }
  }]
};
