import type React from "react";

const FAButton: React.FC<{ onClick: () => void; icon: React.ReactNode; darkMode?: boolean }> = ({ onClick, icon, darkMode = false }) => {
    return (
        <div className={`floating-action-button ${darkMode ? 'dark-mode' : 'light-mode'}`} onClick={onClick}>  
            {icon}
        </div>
    );
};

export default FAButton;