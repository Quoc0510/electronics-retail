/**
 * @feature [F01] Xác thực (frontend) - Điểm xuất của package dùng chung cho Client và Admin.
 * Gom logic dùng chung và các thành phần giao diện cơ bản (Button, FormField, Alert) để hai ứng dụng không phải viết lặp lại.
 */
export { createTokenStorage } from './tokenStorage.js';
export { createApiClient } from './createApiClient.js';
export { UserFacingError, getErrorMessage, getFieldErrors } from './errors.js';
export { createAuth } from './createAuth.jsx';
export { isValidEmail, isValidPhone, validatePassword } from './validation.js';
export { useFormState } from './useFormState.js';
export { default as Alert } from './ui/Alert.jsx';
export { default as Button } from './ui/Button.jsx';
export { default as FormField } from './ui/FormField.jsx';
