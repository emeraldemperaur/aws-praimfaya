import React, { useState, useEffect } from 'react';

interface TitleRibbonProps {
  title: string;
  darkMode: boolean;
  backgroundColor?: string;
  textColor?: string;
  textAlignment?: 'left' | 'center' | 'right';
  typewriterFX?: boolean;
}

const TitleRibbon: React.FC<TitleRibbonProps> = ({
  title,
  darkMode,
  backgroundColor,
  textColor,
  textAlignment = 'left',
  typewriterFX = false,
}) => {
  const [displayedText, setDisplayedText] = useState(typewriterFX ? '' : title);
  const [isTyping, setIsTyping] = useState(typewriterFX);

  useEffect(() => {
    if (!typewriterFX) {
      setDisplayedText(title);
      setIsTyping(false);
      return;
    }

    setDisplayedText('');
    setIsTyping(true);
    let currentIndex = 0;

    const typingInterval = setInterval(() => {
      if (currentIndex < title.length) {
        setDisplayedText(title.substring(0, currentIndex + 1));
        currentIndex++;
      } else {
        clearInterval(typingInterval);
        setIsTyping(false); 
      }
    }, 45);

    return () => clearInterval(typingInterval);
  }, [title, typewriterFX]);

  const defaultBg = darkMode ? '#121212' : '#f7f7f9';
  const defaultText = darkMode ? '#ffffff' : '#0B0B45';

  return (
    <>
      <style>
        {`
          @keyframes blinkFX {
            0%, 100% { opacity: 1; }
            50% { opacity: 0; }
          }
          .typewriter-cursor {
            display: inline-block;
            width: 3px;
            height: 0.9em;
            background-color: ${textColor || defaultText};
            margin-left: 4px;
            vertical-align: text-bottom;
            animation: blinkFX 0.85s step-end infinite;
          }
        `}
      </style>

      <div
        className="page-title-ribbon"
        style={{
          backgroundColor: backgroundColor || defaultBg,
          color: textColor || defaultText,
          textAlign: textAlignment,
          marginTop: '90px', 
          padding: '2.5rem 3rem',
          paddingTop: '2.5rem',
          paddingBottom: '0.5rem',
          paddingLeft: '3rem',
          paddingRight: '3rem',
          width: '100%',
          boxSizing: 'border-box',
          borderBottom: darkMode ? '1px solid #2a2a2a' : '1px solid #eaeaea',
          transition: 'background-color 0.3s ease, color 0.3s ease',
        }}
      >
        <div
          className="ribbon-inner-container"
          style={{
            maxWidth: '1600px',
            margin: '13px 0px',
            fontFamily: '"Bodoni Moda Variable", serif',
            fontSize: '2.4rem',
            fontWeight: 600,
            letterSpacing: '0.04em',
            lineHeight: '1.2',
            minHeight: '1.2em', 
          }}
        >
          {displayedText}
          {isTyping && <span className="typewriter-cursor" />}
        </div>
      </div>
    </>
  );
};

export default TitleRibbon;