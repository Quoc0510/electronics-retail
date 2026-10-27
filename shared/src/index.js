/**
 * @feature [F01] Xác thực (frontend) - Điểm xuất của package dùng chung cho Client và Admin.
 * Gom logic dùng chung và các thành phần giao diện cơ bản (Button, FormField, Alert) để hai ứng dụng không phải viết lặp lại.
 */
export { createTokenStorage } from './tokenStorage.js';
export { createApiClient } from './createApiClient.js';
export { UserFacingError, getErrorMessage, getFieldErrors } from './errors.js';
export { createAuth } from './createAuth.jsx';
export { isValidEmail, isValidHttpUrl, isValidPhone, validatePassword } from './validation.js';
export { useFormState } from './useFormState.js';
export { default as Alert } from './ui/Alert.jsx';
export { default as Button } from './ui/Button.jsx';
export { default as FormField } from './ui/FormField.jsx';
export { discountPercent, formatVnd, resolveAssetUrl } from './format.js'; // [F03][F04]
export { default as SelectField } from './ui/SelectField.jsx'; // [F03]
export { default as Logo } from './ui/Logo.jsx'; // [F04]
export * from './ui/icons.jsx'; // [F04] IconSearch, IconPhone...
export { default as ThemeToggle } from './ui/ThemeToggle.jsx'; // [F12]
export {
  THEME_STORAGE_KEY,
  getTheme,
  initTheme,
  resolveInitialTheme,
  setTheme,
  useTheme,
} from './theme.js'; // [F12]
