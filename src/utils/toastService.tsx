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
        <div className="praimfaya-toast-content toast-success" style={{ display: 'flex', alignItems: 'center' }}>
          <SuccessIcon />
          &nbsp;
          <span className="toast-message" style={{ paddingLeft: '8px', flex: 1 }}>{message}</span>
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
        <div className="praimfaya-toast-content toast-error" style={{ display: 'flex', alignItems: 'center' }}>
          <ErrorIcon />
          &nbsp;
          <span className="toast-message" style={{ paddingLeft: '8px', flex: 1 }}>{message}</span>
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
        <div className="praimfaya-toast-content toast-info" style={{ display: 'flex', alignItems: 'center' }}>
          <InfoIcon />
          &nbsp;
          <span className="toast-message" style={{ paddingLeft: '8px', flex: 1 }}>{message}</span>
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
        <div className="praimfaya-toast-content toast-warning" style={{ display: 'flex', alignItems: 'center' }}>
          <WarningIcon />
          &nbsp;
          <span className="toast-message" style={{ paddingLeft: '8px', flex: 1 }}>{message}</span>
          <button className="toast-close-btn" onClick={closeToast} aria-label="Close">
            <CloseSVG />
          </button>
        </div>
      ),
      { ...defaultOptions, ...options }
    );
  }
};