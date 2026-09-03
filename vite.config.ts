import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const devApiTarget = env.VITE_DEV_API_TARGET || 'https://api.starsnap.kr'
  const devWebSocketTarget = env.VITE_DEV_WS_TARGET || 'wss://api.starsnap.kr'

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      // Vite 8 otherwise selects lottie-react's UMD browser entry as an object.
      alias: [{ find: /^lottie-react$/, replacement: 'lottie-react/build/index.es.js' }],
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      proxy: {
        '/api': {
          target: devApiTarget,
          changeOrigin: true,
        },
        '/ws-chat': {
          target: devWebSocketTarget,
          ws: true,
          changeOrigin: true,
        },
      },
    },
  }
})
