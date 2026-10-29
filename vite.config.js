import { defineConfig } from 'vite';
export default defineConfig({
 base: process.env.BASE_PATH || '/peirytale-website/',
 server: {fs: {deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**']}},
});
