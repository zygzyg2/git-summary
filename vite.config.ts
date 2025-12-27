import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        proxy: {
            // 云效Codeup API代理 - 使用codeup.aliyun.com端点
            '/codeup-api': {
                target: 'https://codeup.aliyun.com',
                changeOrigin: true,
                secure: true,
                rewrite: (path) => path.replace(/^\/codeup-api/, ''),
            },
        },
    },
})
