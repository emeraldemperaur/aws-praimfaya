import React from 'react';

export const MicrochipAIIcon = ({ className = "w-6 h-6", style }: { className?: string, style?: React.CSSProperties }) => {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="1.5" 
      strokeLinejoin="miter"
      className={className}
      style={style}
    >
      <rect x="5" y="5" width="14" height="14" />
      
      <path d="M8 2v3m4-3v3m4-3v3" />
      <path d="M8 19v3m4-3v3m4-3v3" />
      
      <path d="M2 8h3m-3 4h3m-3 4h3" />
      <path d="M19 8h3m-3 4h3m-3 4h3" />
      
      <path d="M8.5 15l2-6 2 6" />
      <path d="M9.1 12.5h2.8" />
      
      <path d="M15.5 9v6" />
    </svg>
  );
};

export const btnStyle = (darkMode: boolean, intent: 'neutral' | 'success' | 'danger') => ({
  background: 'transparent',
  border: `1px solid ${darkMode ? '#4b5563' : '#d1d5db'}`,
  color: intent === 'success' ? '#10b981' : intent === 'danger' ? '#ef4444' : (darkMode ? '#d1d5db' : '#4b5563'),
  width: '32px', height: '32px', borderRadius: '6px', cursor: 'pointer', 
  display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'
});

