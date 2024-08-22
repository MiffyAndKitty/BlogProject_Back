module.exports = {
  apps: [
    {
      name: 'backend',
      script: 'src/app.ts',
      interpreter: './node_modules/.bin/tsx',
      watch: true, // 파일 변경 시 재시작
      autorestart: true, // 프로세스 실패 시 자동으로 재시작
      env_development: {
        NODE_ENV: 'development'
      },
      env_production: {
        NODE_ENV: 'production'
      }
    }
  ]
};
