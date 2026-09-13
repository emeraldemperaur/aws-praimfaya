import React, { useEffect } from 'react';
import '../styles/bottommodal.scss';

interface BottomModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  darkMode?: boolean;
  footer?: React.ReactNode;
}

const BottomModal: React.FC<BottomModalProps> = ({
  isOpen,
  onClose,
  title,
  icon,
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
      className={`bottom-modal-overlay ${darkMode ? 'dark-mode' : ''}`}
      onClick={handleOverlayClick}
      aria-hidden="false"
    >
      <div className="bottom-modal-container" role="dialog" aria-modal="true">
        
        <div className="bottom-modal-header">
          {title && <h2 className="bottom-modal-title">{icon && <>{icon}&nbsp;</>}{title}</h2>}
          <button className="bottom-modal-close" onClick={onClose} aria-label="Close Modal">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="bottom-modal-body">
          {children}
        </div>

        {footer && (
          <div className="bottom-modal-footer">
            {footer}
          </div>
        )}
        
      </div>
    </div>
  );
};

export default BottomModal;