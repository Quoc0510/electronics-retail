// @feature [F00] Nền tảng - Thiết lập chung cho test frontend: thêm các matcher như toBeInTheDocument()
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Dọn DOM sau mỗi test để các test không ảnh hưởng nhau
afterEach(() => cleanup());
