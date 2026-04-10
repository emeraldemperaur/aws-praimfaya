import React, { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import terminalIcon from '../assets/console-icon.png';
import aiChipIcon from '../assets/aichip-icon.png';
import agenticIcon from '../assets/agentic-icon.png';
import cubeIcon from '../assets/neu-components-icon.png';
import mediaIcon from '../assets/media-icon.png';
import controlsIcon from '../assets/touch-control-icon.png';
import mcpIcon from '../assets/mcp-icon.png';
import web3Icon from '../assets/ethereum-icon.png';
import '../styles/navigator.scss';

const NavigationMenu = ({darkModeToggle, darkMode} : {darkModeToggle: () => void, darkMode: boolean}) => {
    const [isDocumentation, setIsDocumentation] = useState<[boolean, string]>([false, '']);
    const [isLaboratory, setIsLaboratory] = useState<[boolean, string]>([false, '']);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
    
    const [isVisible, setIsVisible] = useState(true);
    const lastScrollY = useRef(0);
    
    const headerRef = useRef<HTMLElement | null>(null);

    const toggleDocumentation = (e: React.MouseEvent) => {
        e.preventDefault(); 
        if (isLaboratory[0]) setIsLaboratory([false, '']);
        setIsDocumentation([!isDocumentation[0], isDocumentation[1] === 'active' ? '' : 'active']);
    }

    const toggleLaboratory = (e: React.MouseEvent) => {
        e.preventDefault(); 
        if (isDocumentation[0]) setIsDocumentation([false, '']);
        setIsLaboratory([!isLaboratory[0], isLaboratory[1] === 'active' ? '' : 'active']);
    }

    const closeDropDowns = () => { 
        setIsDocumentation([false, '']); 
        setIsLaboratory([false, '']); 
        setIsMobileMenuOpen(false); 
    }

    const showDropDown = (index: number) => { 
        if(index === 1){ 
            setIsLaboratory([false, '']);
            setIsDocumentation([true, 'active']);
        }
        else if (index === 2){ 
            setIsDocumentation([false, '']);
            setIsLaboratory([true, 'active']);
        }
     }

    const toggleHamburger = () => { 
        setIsMobileMenuOpen(!isMobileMenuOpen); 
    }

    const handleExoClick = (event: MouseEvent) => {
        if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
            closeDropDowns();
        }
    };

    useEffect(() => {
        document.body.style.backgroundColor = darkMode ? "#1b1c1d" : "#ffffff";
        if (darkMode) {
            document.body.classList.add('dark-theme');
        } else {
            document.body.classList.remove('dark-theme');
        }
        document.addEventListener("mousedown", handleExoClick);
        document.addEventListener("keydown", (event) => { if (event.key === "Escape") { closeDropDowns() }});
        return () => {
            document.removeEventListener("mousedown", handleExoClick);
        }
    }, [darkMode]);

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;

            if (isMobileMenuOpen) return;

            if (currentScrollY > lastScrollY.current && currentScrollY > 123) {
                setIsVisible(false);
            } 
            else if (currentScrollY < lastScrollY.current) {
                setIsVisible(true);
            }

            lastScrollY.current = currentScrollY;
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        
        return () => {
            window.removeEventListener('scroll', handleScroll);
        };
    }, [isMobileMenuOpen]);

    const navLinkStyle = ({ isActive }: { isActive: boolean }) => {
        if (isActive) {
            return { color: darkMode ? '#a9a9a9' : '#800020' };
        }
        return { color: darkMode ? '#ffffff' : '#0B0B45' };
    };

    const dropLinkStyle = ({ isActive }: { isActive: boolean }) => {
        if (isActive) {
            return { 
                color: darkMode ? '#a9a9a9' : '#800020', 
                textDecoration: 'none' 
            };
        }
        return { 
            color: darkMode ? '#ffffff' : '#0B0B45', 
            textDecoration: 'none' 
        };
    };

    const staticDropLinkStyle = {
        color: darkMode ? '#ffffff' : '#0B0B45',
        textDecoration: 'none'
    };

    const titleStyle = {
        color: 'inherit',
    };

    return(
        <>        
        <header 
            ref={headerRef} 
            style={{
                position: 'fixed', 
                top: 0, 
                left: 0, 
                zIndex: 1000, 
                width: '100%', 
                background: darkMode ? "#1b1c1d" : "#ffffff",
                transition: 'transform 0.3s ease-in-out',
                transform: isVisible ? 'translateY(0)' : 'translateY(-100%)'
            }} 
            id="nav-menu" 
            aria-label="navigation bar"
        >
            <div className="ux-container">
                <div className="nav-start">
                <NavLink className="logo" to="/" onClick={closeDropDowns}>
                    <div style={{textDecoration: 'none', color: darkMode ? '#ffffff' : '#0B0B45'}} className="menu-logo">Praimfaya</div> 
                </NavLink>
                <nav className={`ux-menu ${isMobileMenuOpen ? 'show' : ''}`} style={{background: darkMode ? '#1b1c1d' : '#ffffff'}}>
                    <ul className={darkMode ? 'ux-menu-bar ux-menu-bar-dark' : 'ux-menu-bar'}>
                    <li>
                        <NavLink className={darkMode ? 'ux-menu-bar-dark' : 'ux-menu-bar'} style={navLinkStyle} to="dashboard">
                        <button
                        style={{ fontSize: '1.2rem', color: 'inherit' }}
                        onMouseOver={() => showDropDown(1)}
                        onClick={(e) => toggleDocumentation(e)}
                        className={`ux-nav-link ux-dropdown-btn${darkMode ? '-dark' : ''}`}  
                        data-dropdown="dropdown1"
                        aria-haspopup="true"
                        aria-expanded="false"
                        aria-label="browse"
                        id='dropdown-menu-one'
                        >
                         RAG Dashboard
                        <i className="bx bx-chevron-down" aria-hidden="true"></i>
                        </button></NavLink>
                        
                        <div id="dropdown1" className={`ux-dropdown ${isDocumentation[1]}`} style={{ background: darkMode ? '#1b1c1d' : '#ffffff' }}>
                        <ul role="menu">
                            <li role="menuitem">
                            <NavLink className="ux-dropdown-link" style={dropLinkStyle} to="dashboard" onClick={() => closeDropDowns()}>
                                <img style={{width: '40px', height: '40px'}} src={terminalIcon} className="icon" alt="Terminal" />
                                <div>
                                <span className="ux-dropdown-link-title" style={titleStyle}>Getting Started</span>
                                <p>Elevate your UI with Neumorphic components</p>
                                </div>
                            </NavLink>
                            </li>
                            <li role="menuitem">
                            <NavLink className="ux-dropdown-link" style={dropLinkStyle} to="ai-components" onClick={() => closeDropDowns()}>
                                <img style={{width: '40px', height: '40px'}} src={aiChipIcon} className="icon" alt="AI Chip" />
                                <div>
                                <span className="ux-dropdown-link-title" style={titleStyle}>AI Components</span>
                                <p>Building blocks for AI/RAG user experiences</p>
                                </div>
                            </NavLink>
                            </li>
                            <li role="menuitem">
                            <NavLink className="ux-dropdown-link" style={dropLinkStyle} to="neu-components" onClick={() => closeDropDowns()}>
                                <img style={{width: '40px', height: '40px'}} src={cubeIcon} className="icon" alt="Cube" />
                                <div>
                                <span className="ux-dropdown-link-title" style={titleStyle}>Neucorporeal Components</span>
                                <p>Skeuomorphic components for elevated user experiences</p>
                                </div>
                            </NavLink>
                            </li>
                            <li role="menuitem">
                            <NavLink className="ux-dropdown-link" style={dropLinkStyle} to="agentic-ai" onClick={() => closeDropDowns()}>
                                <img style={{width: '40px', height: '40px'}} src={agenticIcon} className="icon" alt="Agentic" />
                                <div>
                                <span className="ux-dropdown-link-title" style={titleStyle}>Model Context Protocol & AI Agents</span>
                                <p>Reconnoitre and develop interfaces with Agentic AIs</p>
                                </div>
                            </NavLink>
                            </li>
                        </ul>

                        <ul role="menu">
                            <li className="ux-dropdown-title">
                            <span className="ux-dropdown-link-title" style={{ color: darkMode ? '#ffffff' : '#0B0B45' }}>Browse by Category</span>
                            </li>
                            <li role="menuitem">
                            <NavLink className="ux-dropdown-link" style={dropLinkStyle} to="ai-components" onClick={() => closeDropDowns()}>
                                <img style={{width: '34px', height: '34px'}} src={aiChipIcon} alt="AI" />
                                AI/RAG
                            </NavLink>
                            </li>
                            <li role="menuitem">
                            <NavLink className="ux-dropdown-link" style={dropLinkStyle} to="neu-components#ui-controls" onClick={() => closeDropDowns()}>
                                <img style={{width: '30px', height: '30px'}} src={controlsIcon} alt="Controls" />
                                UI Controls
                            </NavLink>
                            </li>
                            <li role="menuitem">
                            <NavLink className="ux-dropdown-link" style={dropLinkStyle} to="neu-components#multimedia" onClick={() => closeDropDowns()}>
                                <img style={{width: '30px', height: '30px'}} src={mediaIcon} alt="Media" />
                                Multimedia
                            </NavLink>
                            </li>
                            <li role="menuitem">
                            <NavLink className="ux-dropdown-link" style={dropLinkStyle} to="agentic-ai" onClick={() => closeDropDowns()}>
                                <img style={{width: '25px', height: '25px'}} src={mcpIcon} alt="MCP" />
                                Model Context Protocol
                            </NavLink>
                            </li>
                            <li role="menuitem">
                            <NavLink className="ux-dropdown-link" style={dropLinkStyle} to="neu-components#web3" onClick={() => closeDropDowns()}>
                                <img style={{width: '25px', height: '25px'}} src={web3Icon} alt="Web3" />
                                Blockchain (Web3)
                            </NavLink>
                            </li>
                        </ul>
                        </div>
                    </li>
                    <li>
                        <NavLink style={navLinkStyle} to="context-profiles">
                        <button
                        style={{ fontSize: '1.2rem', color: 'inherit' }}
                        onMouseOver={() => showDropDown(2)}
                        onClick={(e) => toggleLaboratory(e)}
                        className="ux-nav-link ux-dropdown-btn"
                        data-dropdown="dropdown2"
                        aria-haspopup="true"
                        aria-expanded="false"
                        aria-label="neu-laboratory"
                        >
                        Context Profiles
                        <i className="bx bx-chevron-down" aria-hidden="true"></i>
                        </button></NavLink>
                        
                        <div id="dropdown2" className={`ux-dropdown ${isLaboratory[1]}`} style={{ background: darkMode ? '#1b1c1d' : '#ffffff' }}>
                        <ul role="menu">
                            <li>
                            <span className="ux-dropdown-link-title" style={{ color: darkMode ? '#ffffff' : '#0B0B45' }}>Apotheosis Design System</span>
                            </li>
                            <li role="menuitem">
                            <NavLink className="ux-dropdown-link" style={dropLinkStyle} to="neu-laboratory#desktop" onClick={() => closeDropDowns()}>Desktop Deism</NavLink>
                            </li>
                            <li role="menuitem">
                            <NavLink className="ux-dropdown-link" style={dropLinkStyle} to="neu-laboratory#mobile" onClick={() => closeDropDowns()}>Mobile Múses</NavLink>
                            </li>
                        </ul>
                        <ul role="menu">
                            <li>
                            <span className="ux-dropdown-link-title" style={{ color: darkMode ? '#ffffff' : '#0B0B45' }}>Learn</span>
                            </li>
                            <li role="menuitem">
                            <NavLink className="ux-dropdown-link" style={dropLinkStyle} to="pantheon" onClick={() => closeDropDowns()}>Pantheon Playground</NavLink>
                            </li>
                            <li role="menuitem">
                            <a className="ux-dropdown-link" style={staticDropLinkStyle} href="https://www.neumorphism.io" target='_blank' rel="noreferrer" onClick={() => closeDropDowns()}>Neumorphism.io</a>
                            </li>
                        </ul>
                        </div>
                    </li>
                    <li>
                        <NavLink style={navLinkStyle} to="terminal" onClick={() => closeDropDowns()}>
                         <button style={{ fontSize: '1.2rem', color: 'inherit' }} className="ux-nav-link ux-dropdown-btn" aria-haspopup="true" aria-expanded="false" aria-label="raison-detre">
                                Console Terminal
                        </button></NavLink>
                    </li>
                    <li>
                        
                    </li>
                    </ul>
                </nav>
                </div>
                <div className="nav-end">
                <div className="right-container">
                    <button style={{ color: darkMode ? '#ffffff' : '#0B0B45' }} className="ux-nav-link ux-dropdown-btn" aria-haspopup="true" aria-expanded="false" aria-label="github" onClick={closeDropDowns}>
                               <a style={{ color: 'inherit' }} href="https://github.com/emeraldemperaur/aws-praimfaya" target='_blank' rel="noreferrer"><i className="ux-menu-icons fa-brands fa-github"></i></a>
                    </button>
                    <button style={{marginRight: '33px', color: darkMode ? '#ffffff' : '#0B0B45' }} 
                    className="ux-nav-link ux-dropdown-btn" aria-haspopup="true" aria-expanded="false" aria-label="dark-mode-toggle" onClick={() => { darkModeToggle(); closeDropDowns(); }}>
                    <a><i className={`ux-menu-icons ${darkMode ? 'fa-regular fa-lightbulb'  : 'fa-regular fa-moon'}`}></i></a>
                    </button>
                </div>

                <button
                    id="hamburger"
                    style={{ color: darkMode ? '#ffffff' : '#0B0B45' }}
                    aria-label="hamburger"
                    aria-haspopup="true"
                    aria-expanded="false"
                    onClick={() => toggleHamburger()}
                >
                    <i className="bx bx-menu" aria-hidden="true"></i>
                </button>
                </div>
            </div>
        </header>
        </>
    )

}
export default NavigationMenu;