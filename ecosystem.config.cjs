module.exports = {
  apps: [
    {
      name: 'games-api',
      script: './apps/api/dist/index.js',
      cwd: '/home/gamesadmin/games-hub',
      node_args: '--experimental-specifier-resolution=node',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
        PLAYFORFUN_PUBLIC_URL: 'https://playfofun.duckdns.org'
      }
    },
    {
      name: 'games-ws',
      script: './apps/ws/dist/index.js',
      cwd: '/home/gamesadmin/games-hub',
      node_args: '--experimental-specifier-resolution=node',
      env: {
        NODE_ENV: 'production',
        PORT: 3002,
        LIVEKIT_URL: process.env.LIVEKIT_URL || 'wss://playfofun.duckdns.org/livekit',
        LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY || 'devkey',
        LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET || 'secret'
      }
    }
  ]
};
