import { toast, type ToastOptions } from 'react-toastify';
import { SuccessIcon, ErrorIcon, InfoIcon, WarningIcon } from './voltaire';

const defaultOptions: ToastOptions = {};

const CloseSVG = () => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    fill="none" 
    viewBox="0 0 24 24" 
    strokeWidth={2} 
    stroke="currentColor" 
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

export const showToast = {
  success: (message: string, options?: ToastOptions) => {
    toast(
      ({ closeToast }) => (
        <div className="praimfaya-toast-content toast-success">
          <SuccessIcon />
          <span className="toast-message">{message}</span>
          <button className="toast-close-btn" onClick={closeToast} aria-label="Close">
            <CloseSVG />
          </button>
        </div>
      ),
      { ...defaultOptions, ...options }
    );
  },

  error: (message: string, options?: ToastOptions) => {
    toast(
      ({ closeToast }) => (
        <div className="praimfaya-toast-content toast-error">
          <ErrorIcon />
          <span className="toast-message">{message}</span>
          <button className="toast-close-btn" onClick={closeToast} aria-label="Close">
            <CloseSVG />
          </button>
        </div>
      ),
      { ...defaultOptions, ...options }
    );
  },

  info: (message: string, options?: ToastOptions) => {
    toast(
      ({ closeToast }) => (
        <div className="praimfaya-toast-content toast-info">
          <InfoIcon />
          <span className="toast-message">{message}</span>
          <button className="toast-close-btn" onClick={closeToast} aria-label="Close">
            <CloseSVG />
          </button>
        </div>
      ),
      { ...defaultOptions, ...options }
    );
  },

  warning: (message: string, options?: ToastOptions) => {
    toast(
      ({ closeToast }) => (
        <div className="praimfaya-toast-content toast-warning">
          <WarningIcon />
          <span className="toast-message">{message}</span>
          <button className="toast-close-btn" onClick={closeToast} aria-label="Close">
            <CloseSVG />
          </button>
        </div>
      ),
      { ...defaultOptions, ...options }
    );
  }
};