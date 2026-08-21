module.exports = {
  apps: [
    {
      name: 'omegle-vitap-nodejs-1',
      script: './dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 8080,
      },
      error_file: 'logs/err-1.log',
      out_file: 'logs/out-1.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      autorestart: true,
      max_memory_restart: '1G',
      watch: false,
    },
    {
      name: 'omegle-vitap-nodejs-2',
      script: './dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 8081,
      },
      error_file: 'logs/err-2.log',
      out_file: 'logs/out-2.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      autorestart: true,
      max_memory_restart: '1G',
      watch: false,
    },
  ],
};
