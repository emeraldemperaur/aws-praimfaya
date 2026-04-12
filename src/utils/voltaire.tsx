import { cssTransition } from 'react-toastify';

export const SuccessIcon = () => <a style={{ fontSize: '1.2rem' }}><i className="fa-regular fa-circle-check"></i></a>;
export const ErrorIcon = () => <a style={{ fontSize: '1.2rem' }}><i className="fa-solid fa-radiation"></i>&nbsp;</a>;
export const InfoIcon = () => <a style={{ fontSize: '1.2rem' }}><i className="fa-solid fa-info"></i>&nbsp;</a>;
export const WarningIcon = () => <a style={{ fontSize: '1.2rem' }}><i className="fa-solid fa-exclamation"></i></a>;
export const CloseIcon = () => <a style={{ fontSize: '1.2rem' }}><i className="fa-solid fa-xmark"></i></a>;
export const EyeSlashIcon = () => <a style={{ fontSize: '1.2rem' }}><i className="fa-regular fa-eye-slash"></i></a>;
export const EyeIcon = () => <a style={{ fontSize: '1.2rem' }}><i className="fa-regular fa-eye"></i></a>;


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
