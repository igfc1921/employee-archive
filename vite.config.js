import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// مهم: غيّر "employee-archive" بالأسفل ليطابق اسم المستودع (repository) اللي بترفعه على GitHub
// مثال: لو رابط مستودعك github.com/USERNAME/hr-archive استبدل employee-archive بـ hr-archive
export default defineConfig({
  plugins: [react()],
  base: '/employee-archive/',
});
