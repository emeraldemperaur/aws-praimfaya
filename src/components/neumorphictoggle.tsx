import React, { useId } from 'react';
import '../styles/neumorphictoggle.scss';

interface NeumorphicToggleProps {
  checked: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  darkMode?: boolean;
}

const NeumorphicToggle: React.FC<NeumorphicToggleProps> = ({ 
  checked, 
  onChange, 
  disabled = false,
  darkMode = false 
}) => {
  const toggleId = useId();

  return (
    <div className={`neu-toggle-container ${darkMode ? 'dark' : ''}`}>
      <input
        type="checkbox"
        id={toggleId}
        className="neu-toggle-input"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
      />
      <label htmlFor={toggleId} className="neu-toggle-label">
        <span className="neu-toggle-knob">
          <svg width="10px" height="10px" className="neu-toggle-svg">
            <path
              className="neu-toggle-path"
              d="M5,1 L5,1 C2.790861,1 1,2.790861 1,5 L1,5 C1,7.209139 2.790861,9 5,9 L5,9 C7.209139,9 9,7.209139 9,5 L9,5 C9,2.790861 7.209139,1 5,1 L5,9 L5,1 Z"
            ></path>
          </svg>
        </span>
      </label>
    </div>
  );
};

export default NeumorphicToggle;