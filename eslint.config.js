/**
 * @feature [F00] Nền tảng - Cấu hình ESLint dùng chung cho cả 3 phần (backend, client, admin).
 * Mục tiêu theo rubric TC2.4: 0 lỗi lint còn tồn.
 */
import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';

export default [
  // Bỏ qua thư mục sinh ra tự động
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**', 'backend/prisma/migrations/**'],
  },

  js.configs.recommended,

  // Backend: chạy trên Node.js
  {
    files: ['backend/**/*.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: globals.node },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_|^next$' }],
      'no-console': 'warn', // dùng logger thay cho console.log
    },
  },

  // Frontend (client + admin + shared): chạy trên trình duyệt, dùng React
  {
    files: ['client/**/*.{js,jsx}', 'admin/**/*.{js,jsx}', 'shared/**/*.{js,jsx}'],
    plugins: { react, 'react-hooks': reactHooks },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: globals.browser,
    },
    settings: { react: { version: 'detect' } },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      'react/prop-types': 'off', // dự án dùng JavaScript thuần, không khai báo prop-types
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },

  // File cấu hình (vite, eslint...) chạy trên Node
  {
    files: ['**/*.config.js'],
    languageOptions: { globals: globals.node },
  },

  // Tắt các rule xung đột với Prettier (đặt cuối cùng)
  prettier,
];
