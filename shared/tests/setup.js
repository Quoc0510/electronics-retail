// @feature [F01] Thiết lập chung cho test của package dùng chung: thêm matcher toBeInTheDocument()... và dọn DOM sau mỗi test
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => cleanup());
