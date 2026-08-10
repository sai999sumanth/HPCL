import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "tailwindcss";
import path from "path";

const removeCrossorigin = () => {
  return {
    name: 'remove-crossorigin',
    transformIndexHtml(html) {
      return html.replace(/ crossorigin/g, '');
    },
  };
};

export default defineConfig({
  optimizeDeps: {
    include: [
      '@emotion/react',
      '@emotion/styled',
      '@mui/material/Tooltip'
    ],
  },
  plugins: [
    react(),
    removeCrossorigin(),
  ],
  define: {
    'process.env': process.env,
    global: 'globalThis',
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  css: {
    postcss: {
      plugins: [tailwindcss()],
    },
  },
  server: {
    port: 3000,
    host: true,
    allowedHosts: true,
    hmr: true,
  },
  build: {
    //chunk loading for production
    rollupOptions: {
      output: {
        // Manual chunk splitting for better caching and faster initial load
        manualChunks: {
          // Vendor chunks - libraries that rarely change
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'redux-vendor': ['redux', '@reduxjs/toolkit', 'react-redux', 'zustand'],
          'ui-vendor': ['@chakra-ui/react', '@mui/material', '@emotion/react', '@emotion/styled'],
          'shadcn-vendor': ['@radix-ui/react-icons', '@radix-ui/react-tooltip', 'class-variance-authority', 'tailwind-merge', 'lucide-react'],
          // Keep auth and core functionality in main bundle for fast initial load
        },
      },
    },
    // Increase chunk size warning limit (this app has many dependencies)
    chunkSizeWarningLimit: 1000,
    // Enable minification for smaller bundle sizes (esbuild is faster and included with Vite)
    minify: 'esbuild',
    // Note: esbuild doesn't support drop_console, but it's much faster than terser
    // If you need to remove console.logs, install terser: npm install -D terser
    // Then change minify to 'terser' and uncomment the terserOptions below
    // terserOptions: {
    //   compress: {
    //     drop_console: true,
    //     drop_debugger: true,
    //   },
    // } as any,
  },

});
