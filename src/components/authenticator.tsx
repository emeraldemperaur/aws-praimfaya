import React, { useContext, useRef, useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { PraimfayaContext } from '../contexts';
import devLogoDark from '../assets/me-devlogo-white.png';
import devLogoLight from '../assets/me-devlogo-black.png';
import '../styles/authenticator.scss';
import '../styles/styles.scss';

const Authenticator = ({darkMode}: {darkMode: boolean}) => {
    let navigator = useNavigate();
    const contextPraimfaya = useContext(PraimfayaContext);
    
    const loginUsername = useRef<HTMLInputElement>(null);
    const loginUserPassword = useRef<HTMLInputElement>(null);
    const signupUsername = useRef<HTMLInputElement>(null);
    const signupUserPassword = useRef<HTMLInputElement>(null);
    const confirmUserPassword = useRef<HTMLInputElement>(null);
    const loginButton = useRef<HTMLDivElement>(null);
    const signupButton = useRef<HTMLDivElement>(null);
    
    const [usernameLoginError, setUsernameLoginError] = useState([false, '']);
    const [passwordLoginError, setPasswordLoginError] = useState([false, '']);
    const [usernameSignUpError, setUsernameSignUpError] = useState([false, '']);
    const [passwordSignUpError, setPasswordSignUpError] = useState([false, '']);
    const [passwordConfirmError, setPasswordConfirmError] = useState([false, '']);
    
    const [isSignUpView, setIsSignUpView] = useState(false);

    useEffect(() => {
        if (contextPraimfaya.isAuthenticated) {
            navigator('/dashboard');
        }
    }, [contextPraimfaya.isAuthenticated, navigator]);

    const isValidEmail = (email: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const onInputChangeHandler = (event: React.ChangeEvent<HTMLInputElement>) => {
        console.log('Input Detected: ' + event.target.value);
    }

    const onLoginClickHandler = () => {
        const validated = validateInput(loginUsername.current?.value || '', loginUserPassword.current?.value || '', true);
        console.log('Praimfaya Log In...');
        console.log(`UserID: ${loginUsername.current?.value}`);
        
        if (validated) {
            setUsernameLoginError([false, '']);
            setPasswordLoginError([false, '']);
            contextPraimfaya.userLog(loginUsername.current?.value || '', loginUserPassword.current?.value || '');
        }
    }

    const validateInput = (emailValue: string, passwordValue: string, login: boolean, confirmPasswordValue?: string) => {
        setUsernameLoginError([false, '']); setPasswordLoginError([false, '']); setUsernameSignUpError([false, '']);
        setPasswordSignUpError([false, '']); setPasswordConfirmError([false, '']);
        
        if (emailValue?.trim() === '' || !isValidEmail(emailValue)) {
            const errorMessage = emailValue?.trim() === '' ? 'Email Required' : 'Valid email address required';
            login ? setUsernameLoginError([true, errorMessage]) : setUsernameSignUpError([true, errorMessage]);
            login ? toast.error('Valid Login Credentials Required', {
                position: "top-right",
                closeOnClick: true
            }) : null;
            return false;
        }

        if (passwordValue.trim() === '') {
            login ? setPasswordLoginError([true, 'Password Required']) : setPasswordSignUpError([true, 'Password Required']);
            login ? toast.error('Login Credentials Required', {
                position: "top-right",
                closeOnClick: true
            }) : null;
            return false;
        }

        if (!login && confirmPasswordValue?.trim() === '' || !login && passwordValue.trim() !== confirmPasswordValue?.trim()) {
            !login && confirmPasswordValue?.trim() === '' ? setPasswordConfirmError([true, 'Password Required']) : null;
            !login && passwordValue.trim() !== confirmPasswordValue?.trim() ? setPasswordConfirmError([true, 'Password does not match']) : null;
            return false;
        }

        return true;
    }

    const onSignUpClickHandler = () => {
        const validated = validateInput(signupUsername.current?.value || '', signupUserPassword.current?.value || '', false, confirmUserPassword.current?.value || '');
        console.log('Praimfaya Sign Up...');
        console.log(`UserID: ${signupUsername.current?.value}`);
        
        if (validated) {
            setUsernameSignUpError([false, '']);
            setPasswordSignUpError([false, '']);
            setPasswordConfirmError([false, '']);
            contextPraimfaya.userLog(signupUsername.current?.value || '', signupUserPassword.current?.value || '');
        }
    }

    return (
        <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            justifyContent: 'center', 
            alignItems: 'center', 
            minHeight: '100vh', 
            width: '100%',
            padding: '20px', 
            boxSizing: 'border-box',
            overflowX: 'hidden'
        }}>
            
            <div style={{ textAlign: 'center', marginBottom: '69px', fontFamily: 'Bodoni Moda Variable' }}>
                <h1 style={{ margin: 0, color: darkMode ? '#ffffff' : '#002C51', fontSize: '2.5rem', fontWeight: 300, transition: 'color 0.3s ease' }}>
                    Welcome to Praimfaya
                </h1>
                <h2 style={{ margin: '0px 0 33px 0', color: darkMode ? '#9ca3af' : '#666', fontSize: '1.19rem', fontWeight: 400, letterSpacing: '0.1em', transition: 'color 0.3s ease' }}>
                    Retrieval-Augmented Generation Chatbot
                </h2>
                <h3 style={{ margin: '10px 0px 0px 0', color: darkMode ? '#9ca3af' : '#666', fontSize: '1rem', fontWeight: 400, letterSpacing: '0.1em', transition: 'color 0.3s ease' }}>
                    Please Log In or Sign Up to continue
                </h3>
            </div>

            <div 
                className={`ost-container ${isSignUpView ? "log-in" : ""}`} 
                style={{ flexShrink: 0, margin: '0 auto', top: 'auto' }}
            >
                <div style={{ marginTop: "0" }} className="box"></div>
                <div className="ost-container-forms ostiary-font">

                    <div className="ost-container-info">
                        <div className="info-item">
                            <div className="table">
                                <div className="table-cell">
                                    <p className="ost-highlight">Have an account?</p>
                                    <div className="ost-btn" onClick={() => setIsSignUpView(false)}>
                                        Log in
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="info-item">
                            <div className="table">
                                <div className="table-cell">
                                    <p className="ost-highlight">Need an account?</p>
                                    <div className="ost-btn" onClick={() => setIsSignUpView(true)}>
                                        Sign Up
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="ost-container-form">
                        <div className="form-item log-in">
                            <div className="table">
                                <div className="table-cell">
                                    <input ref={loginUsername} className="ostiary-font" name="Username" placeholder="Username" type="text" maxLength={40} autoComplete="email" />
                                    {usernameLoginError[0] ? <p className='auth-validation-error'>{usernameLoginError[1]}</p> : null}
                                    <input ref={loginUserPassword} className="ostiary-font" name="Password" placeholder="Password" type="password" maxLength={33} autoComplete="current-password" />
                                    {passwordLoginError[0] ? <p className='auth-validation-error'>{passwordLoginError[1]}</p> : null}
                                    <div ref={loginButton} className="ost-btn ostiary-font" onClick={onLoginClickHandler}>
                                        Log in
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="form-item sign-up">
                            <div className="table">
                                <div className="table-cell">
                                    <input onChange={onInputChangeHandler} ref={signupUsername} className="ostiary-font" name="userEmail" placeholder="Email" type="text" maxLength={69} autoComplete="email" />
                                    {usernameSignUpError[0] ? <p className='auth-validation-error'>{usernameSignUpError[1]}</p> : null}
                                    <input onChange={onInputChangeHandler} ref={signupUserPassword} className="ostiary-font" name="userPassword" placeholder="Password" type="password" maxLength={33} autoComplete="new-password" />
                                    {passwordSignUpError[0] ? <p className='auth-validation-error'>{passwordSignUpError[1]}</p> : null}
                                    <input onChange={onInputChangeHandler} ref={confirmUserPassword} className="ostiary-font" name="confirmUserPassword" placeholder="Confirm Password" type="password" maxLength={6} autoComplete="new-password" />
                                    {passwordConfirmError[0] ? <p className='auth-validation-error'>{passwordConfirmError[1]}</p> : null}
                                    <div ref={signupButton} className="ost-btn" onClick={onSignUpClickHandler}>
                                        Sign Up
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>

            <div style={{ textAlign: 'center', marginTop: '40px', fontFamily: 'Montserrat' }}>
                <p style={{ margin: '13px 0 15px 0', color: darkMode ? '#9ca3af' : '#666', fontSize: '1rem', letterSpacing: '0.1em', transition: 'color 0.3s ease' }}>
                    Secure Access Portal
                </p>
                <p style={{ margin: '33px 0px 13px 0px', color: darkMode ? '#ffffff' : '#002C51', fontSize: '0.9rem', fontWeight: 500, fontFamily: 'Bodoni Moda Variable', transition: 'color 0.3s ease' }}>
                    BUILD by
                </p>
                <a href="https://www.mekaegwim.ca" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                <img 
                    src={darkMode ? devLogoDark : devLogoLight} 
                    alt="Praimfaya Logo" 
                    style={{ width: '80px', height: 'auto', opacity: 0.8, transition: 'opacity 0.3s ease' }} 
                />
                </a>
            </div>

        </div>
    )
}

export default Authenticator;