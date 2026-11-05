import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/media': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.replace(/\\/g, '/');
          if (normalized.includes('node_modules')) {
            if (normalized.includes('html2pdf') || normalized.includes('jspdf') || normalized.includes('html2canvas')) {
              return 'vendor-pdf';
            }
            if (normalized.includes('chart.js') || normalized.includes('react-chartjs-2')) {
              return 'vendor-charts';
            }
            if (normalized.includes('framer-motion')) {
              return 'vendor-framer';
            }
            if (normalized.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (normalized.includes('react-router-dom') || normalized.includes('react-dom') || normalized.includes('/react/')) {
              return 'vendor-react';
            }
            if (normalized.includes('@tanstack/react-query') || normalized.includes('axios')) {
              return 'vendor-query';
            }
            return 'vendor-libs';
          }
          if (normalized.includes('/src/pages/')) {
            if (normalized.includes('SuperAdmin') || normalized.includes('superadmin')) {
              return 'page-superadmin';
            }
            if (normalized.includes('/daycare/attendance/') || normalized.includes('Attendance')) {
              return 'page-attendance';
            }
            if (normalized.includes('/daycare/billing/') || normalized.includes('Billing')) {
              return 'page-billing';
            }
            if (
              normalized.includes('/daycare/employees/') ||
              normalized.includes('/daycare/staff/') ||
              normalized.includes('/daycare/scheduling/') ||
              normalized.includes('/daycare/credentials/') ||
              normalized.includes('/staff/')
            ) {
              return 'page-staff';
            }
            if (normalized.includes('/daycare/reports/')) {
              return 'page-reports';
            }
            if (
              normalized.includes('/children/') ||
              normalized.includes('/students/') ||
              normalized.includes('Child') ||
              normalized.includes('Student')
            ) {
              return 'page-children';
            }
            if (
              normalized.includes('/classrooms/') ||
              normalized.includes('Classroom') ||
              normalized.includes('AgeGroup')
            ) {
              return 'page-classrooms';
            }
            if (normalized.includes('/family/')) {
              return 'page-family';
            }
            if (normalized.includes('/public/')) {
              return 'page-public';
            }
            return 'page-daycare';
          }
          if (normalized.includes('/src/components/')) {
            if (
              normalized.includes('ManageDaycareModal') ||
              normalized.includes('DaycareFormModal') ||
              normalized.includes('DaycareCareOptionsModal')
            ) {
              return 'modal-daycare-manage';
            }
            if (normalized.includes('Tab')) {
              return 'components-tabs';
            }
            if (normalized.includes('Modal') || normalized.includes('Wizard')) {
              return 'components-modals';
            }
            return 'components-common';
          }
        },
      },
    },
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@tanstack/react-query',
      'axios',
      'lucide-react',
      'framer-motion',
      'chart.js',
      'react-chartjs-2',
    ],
  },
})
