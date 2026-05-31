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

export const AddVectorCollectionSVG = <svg
            xmlns="http://www.w3.org/2000/svg"
            width={24}
            height={24}
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <defs>
              <mask id="microchip-mask">
                <rect width="24" height="24" fill="white" />
                <circle cx="18" cy="18" r="6.5" fill="black" />
              </mask>
              
              <mask id="plus-badge-mask">
                <rect width="24" height="24" fill="white" />
                <path 
                  d="M18 14.5v7m-3.5-3.5h7" 
                  stroke="black" 
                  strokeWidth="1.5" 
                  strokeLinecap="round" 
                />
              </mask>
            </defs>

            <g 
              mask="url(#microchip-mask)" 
              stroke="currentColor" 
              strokeWidth="1.5" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              fill="none"
            >
              <rect x="4" y="4" width="16" height="16" rx="2" />
              
              <path d="M8 4V1m4 3V1m4 3V1" />
              <path d="M4 8H1m3 4H1m3 4H1" />
              <path d="M8 20v3m4-3v3" />
              <path d="M20 8h3m-3 4h3" />

              <path d="M8.5 14.5L10.5 9.5L12.5 14.5M9.3 12.5h2.4M15 9.5v5" />
            </g>

            <circle 
              cx="18" 
              cy="18" 
              r="5.5" 
              fill="currentColor" 
              mask="url(#plus-badge-mask)" 
            />
          </svg>
  
export const inputStyle = (darkMode: boolean): React.CSSProperties => (  {
    width: '100%',
    padding: '0.75rem',
    borderRadius: '0.375rem',
    border: `1px solid ${darkMode ? '#374151' : '#d1d5db'}`,
    backgroundColor: darkMode ? '#1f2937' : '#ffffff',
    color: darkMode ? '#f9fafb' : '#111827',
    fontFamily: 'inherit',
    boxSizing: 'border-box' 
  });

  export const labelStyle = (darkMode: boolean): React.CSSProperties => ({
    display: 'block', marginBottom: '0.5rem', fontWeight: 500,
    fontSize: '0.875rem', color: darkMode ? '#d1d5db' : '#374151'
  });