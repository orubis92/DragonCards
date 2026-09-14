import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' permette il deploy in una sottocartella (GitHub Pages: /DraghiCarte/)
export default defineConfig({
  plugins: [react()],
  base: './',
});
