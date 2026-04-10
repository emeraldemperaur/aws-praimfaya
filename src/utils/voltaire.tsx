import { cssTransition } from 'react-toastify';

export const SuccessIcon = () => <span style={{ fontSize: '1.2rem' }}>✅</span>;
export const ErrorIcon = () => <span style={{ fontSize: '1.2rem' }}>🚨</span>;
export const InfoIcon = () => <span style={{ fontSize: '1.2rem' }}>ℹ️</span>;
export const WarningIcon = () => <span style={{ fontSize: '1.2rem' }}>ℹ️</span>;

export const FluidToastAnimation = cssTransition({
  enter: 'praimfaya-toast-enter',
  exit: 'praimfaya-toast-exit',
});

export const contextCSSClass = {
    success: "toast-success",
    error: "toast-error",
    info: "toast-default",
    warning: "toast-default",
    default: "toast-default",
  };
