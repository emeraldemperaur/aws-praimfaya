import React, { useEffect } from 'react';
import '../styles/fullscreenmodal.scss';

interface FullScreenModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  darkMode?: boolean;
  footer?: React.ReactNode;
}

const FullScreenModal: React.FC<FullScreenModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  darkMode = false,
  footer
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className={`fullscreen-modal-overlay ${darkMode ? 'dark-mode' : ''}`}>
      <div className="fullscreen-modal-container" role="dialog" aria-modal="true">
        
        <div className="fullscreen-modal-header">
          {title && <h2 className="fullscreen-modal-title">{title}</h2>}
          <button className="fullscreen-modal-close" onClick={onClose} aria-label="Close Modal">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="fullscreen-modal-body">
          {children}
        </div>

        {footer && (
          <div className="fullscreen-modal-footer">
            {footer}
          </div>
        )}
        
      </div>
    </div>
  );
};

export default FullScreenModal;