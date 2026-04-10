import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/404.scss';

const Praimfaya404 = ({ darkMode }: { darkMode: boolean }) => {
    const navigator = useNavigate();
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

    useEffect(() => {
        document.body.style.backgroundColor = darkMode ? "#1b1c1d" : "#ffffff";
        const handleMouseMove = (e: MouseEvent) => {
            const x = (e.clientX / window.innerWidth) * 2 - 1;
            const y = (e.clientY / window.innerHeight) * 2 - 1;
            setMousePos({ x, y });
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

  
    const outerTransform = `translate(${mousePos.x * 10}px, ${mousePos.y * 10}px) rotate(${mousePos.x * 5}deg)`;
    const innerTransform = `translate(${mousePos.x * 20}px, ${mousePos.y * 20}px) rotate(${mousePos.x * 10}deg)`;
    const coreTransform = `translate(${mousePos.x * 30}px, ${mousePos.y * 30}px) rotate(${mousePos.x * 15}deg)`;

    return (
        <div className={`not-found-container ${darkMode ? 'dark' : 'light'}`}>
            
            <div className="flame-wrapper">
                <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="interactive-flame">
                    <defs>
                        <filter id="glow">
                            <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                            <feMerge>
                                <feMergeNode in="coloredBlur"/>
                                <feMergeNode in="SourceGraphic"/>
                            </feMerge>
                        </filter>
                    </defs>
                    
                    <g style={{ transform: outerTransform, transformOrigin: 'center bottom', transition: 'transform 0.1s ease-out' }}>
                        <path d="M100,20 C100,20 150,80 150,130 C150,160 120,180 100,180 C80,180 50,160 50,130 C50,80 100,20 100,20 Z" 
                              fill="#d9381e" filter="url(#glow)" className="flicker-outer" />
                    </g>

                    <g style={{ transform: innerTransform, transformOrigin: 'center bottom', transition: 'transform 0.1s ease-out' }}>
                        <path d="M100,50 C100,50 135,95 135,135 C135,155 115,170 100,170 C85,170 65,155 65,135 C65,95 100,50 100,50 Z" 
                              fill="#f2a65a" className="flicker-inner" />
                    </g>

                    <g style={{ transform: coreTransform, transformOrigin: 'center bottom', transition: 'transform 0.1s ease-out' }}>
                        <path d="M100,80 C100,80 120,110 120,140 C120,150 110,160 100,160 C90,160 80,150 80,140 C80,110 100,80 100,80 Z" 
                              fill="#fff3cd" className="flicker-core" />
                    </g>
                </svg>
            </div>

            <div className="text-content">
                <h1 style={{ color: darkMode ? '#ffffff' : '#002C51' }}>404</h1>
                <h2 style={{ color: darkMode ? '#9ca3af' : '#666' }}>PAGE NOT FOUND</h2>
                <p style={{ color: darkMode ? '#6b7280' : '#888' }}>
                    The context you are looking for has been reduced to ashes or never existed.
                </p>
                
                <button className="return-btn" onClick={() => navigator('/dashboard')}>
                    Return to Dashboard
                </button>
            </div>
        </div>
    );
};

export default Praimfaya404;