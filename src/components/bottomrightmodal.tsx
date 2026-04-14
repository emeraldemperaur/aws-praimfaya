import React, { useEffect } from 'react';
import '../styles/bottomrightmodal.scss';

interface BottomRightModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  darkMode?: boolean;
  footer?: React.ReactNode;
}

const BottomRightModal: React.FC<BottomRightModalProps> = ({
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
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div 
      className={`bottom-right-modal-overlay ${darkMode ? 'dark-mode' : ''}`}
      onClick={handleOverlayClick}
      aria-hidden="true"
    >
      <div className="bottom-right-modal-container" role="dialog" aria-modal="true">
        
        <div className="bottom-right-modal-header">
          {title && <h2 className="bottom-right-modal-title">{title}</h2>}
          <button className="bottom-right-modal-close" onClick={onClose} aria-label="Close Modal">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="bottom-right-modal-body">
          {children}
        </div>

        {footer && (
          <div className="bottom-right-modal-footer">
            {footer}
          </div>
        )}
        
      </div>
    </div>
  );
};

export default BottomRightModal;