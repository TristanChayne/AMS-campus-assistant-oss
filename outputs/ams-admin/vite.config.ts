import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({plugins:[react()],base:'/admin/',build:{sourcemap:false,chunkSizeWarningLimit:600}});
