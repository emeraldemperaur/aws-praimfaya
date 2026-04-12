import { useContext, useRef, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PraimfayaContext } from '../contexts';
import { signIn, signUp, confirmSignUp, getCurrentUser, fetchUserAttributes, autoSignIn } from 'aws-amplify/auth';
import devLogoDark from '../assets/me-devlogo-white.png';
import devLogoLight from '../assets/me-devlogo-black.png';
import '../styles/authenticator.scss';
import '../styles/styles.scss';
import { showToast } from '../utils/toastService';
import { EyeIcon, EyeSlashIcon } from '../utils/voltaire';

const Authenticator = ({ darkMode }: { darkMode: boolean }) => {
    let navigator = useNavigate();
    const contextPraimfaya = useContext(PraimfayaContext);

    const loginUsername = useRef<HTMLInputElement>(null);
    const loginUserPassword = useRef<HTMLInputElement>(null);
    const signupUsername = useRef<HTMLInputElement>(null);
    const signupUserPassword = useRef<HTMLInputElement>(null);
    const confirmUserPassword = useRef<HTMLInputElement>(null);
    const verificationCode = useRef<HTMLInputElement>(null);

    const [usernameLoginError, setUsernameLoginError] = useState([false, '']);
    const [passwordLoginError, setPasswordLoginError] = useState([false, '']);
    const [usernameSignUpError, setUsernameSignUpError] = useState([false, '']);
    const [passwordSignUpError, setPasswordSignUpError] = useState([false, '']);
    const [passwordConfirmError, setPasswordConfirmError] = useState([false, '']);

    const [isConfirming, setIsConfirming] = useState(false);
    const [isSignUpView, setIsSignUpView] = useState(false);

    const [showLoginPassword, setShowLoginPassword] = useState(false);
    const [showSignUpPassword, setShowSignUpPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    useEffect(() => {
        checkAuthStatus();
    }, [navigator]);

    const checkAuthStatus = async () => {
        try {
            const { username } = await getCurrentUser();
            const attributes = await fetchUserAttributes();
            contextPraimfaya.userLog(attributes.email || 'aws-user', 'verified', username);
            navigator('/dashboard');
        } catch (err) { /* Not logged in */ }
    };

    const isValidEmail = (email: string): boolean => {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    };

    const validateInput = (emailValue: string, passwordValue: string, login: boolean, confirmPasswordValue?: string) => {
        setUsernameLoginError([false, '']); setPasswordLoginError([false, '']); setUsernameSignUpError([false, '']);
        setPasswordSignUpError([false, '']); setPasswordConfirmError([false, '']);

        if (emailValue?.trim() === '' || !isValidEmail(emailValue)) {
            const errorMessage = emailValue?.trim() === '' ? 'Email Required' : 'Valid email address required';
            login ? setUsernameLoginError([true, errorMessage]) : setUsernameSignUpError([true, errorMessage]);
            if (login) showToast.error('Valid Login Credentials Required');
            return false;
        }

        if (passwordValue.trim() === '') {
            login ? setPasswordLoginError([true, 'Password Required']) : setPasswordSignUpError([true, 'Password Required']);
            if (login) showToast.error('Login Credentials Required');
            return false;
        }

        if (!login && (confirmPasswordValue?.trim() === '' || passwordValue.trim() !== confirmPasswordValue?.trim())) {
            setPasswordConfirmError([true, confirmPasswordValue?.trim() === '' ? 'Password Required' : 'Password does not match']);
            return false;
        }

        return true;
    }

    const onLoginClickHandler = async () => {
        const email = loginUsername.current?.value || '';
        const password = loginUserPassword.current?.value || '';
        if (validateInput(email, password, true)) {
            try {
                const { isSignedIn, nextStep } = await signIn({ username: email, password });
                if (isSignedIn) {
                    const { userId } = await getCurrentUser();
                    showToast.success("Successfully logged in!");
                    contextPraimfaya.userLog(email, 'verified', userId);
                    navigator('/dashboard');
                } else if (nextStep.signInStep === 'CONFIRM_SIGN_UP') {
                    showToast.info("Please verify your email address first.");
                    setIsSignUpView(true);
                    setIsConfirming(true);
                }
            } catch (error: any) {
                showToast.error(error.message || "Failed to log in.");
                setPasswordLoginError([true, "Authentication failed."]);
            }
        }
    }

    const onSignUpClickHandler = async () => {
        const email = signupUsername.current?.value || '';
        const password = signupUserPassword.current?.value || '';
        const confirmPw = confirmUserPassword.current?.value || '';
        if (validateInput(email, password, false, confirmPw)) {
            try {
                const { nextStep } = await signUp({
                    username: email, password,
                    options: { userAttributes: { email }, autoSignIn: true }
                });
                if (nextStep.signUpStep === 'CONFIRM_SIGN_UP') {
                    showToast.success("Verification code sent to your email!");
                    setIsConfirming(true);
                }
            } catch (error: any) {
                showToast.error(error.message || "Failed to sign up.");
                setUsernameSignUpError([true, "Sign up failed."]);
            }
        }
    }

    const onConfirmSignUpHandler = async () => {
        const email = signupUsername.current?.value || '';
        const code = verificationCode.current?.value || '';
        if (!code) { showToast.error("Please enter the verification code."); return; }
        try {
            const { isSignUpComplete, nextStep } = await confirmSignUp({ username: email, confirmationCode: code });
            if (nextStep?.signUpStep === 'COMPLETE_AUTO_SIGN_IN') {
                await autoSignIn();
                showToast.success("Email verified and logged in!");
                const { userId } = await getCurrentUser();
                setIsConfirming(false);
                contextPraimfaya.userLog(email, 'verified', userId);
                navigator('/dashboard');
            } else if (isSignUpComplete) {
                showToast.success("Email verified! Please log in.");
                setIsConfirming(false);
                setIsSignUpView(false);
            }
        } catch (error: any) { showToast.error(error.message || "Invalid verification code."); }
    }

    return (
        <div className="auth-page-wrapper" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', width: '100%', padding: '20px', boxSizing: 'border-box' }}>
            
            <div style={{ textAlign: 'center', marginBottom: '69px', fontFamily: 'Bodoni Moda Variable' }}>
                <h1 style={{ margin: 0, color: darkMode ? '#ffffff' : '#002C51', fontSize: '2.5rem', fontWeight: 300 }}>Welcome to Praimfaya</h1>
                <h2 style={{ margin: '0px 0 33px 0', color: darkMode ? '#9ca3af' : '#666', fontSize: '1.19rem', fontWeight: 400 }}>Retrieval-Augmented Generation Chatbot</h2>
                <h3 style={{ margin: '10px 0px 0px 0', color: darkMode ? '#9ca3af' : '#666', fontSize: '1rem', fontWeight: 400 }}>Please Log In or Sign Up to continue</h3>
            </div>

            <div className={`ost-container ${isSignUpView ? "log-in" : ""}`} style={{ flexShrink: 0, margin: '0 auto' }}>
                <div className="box"></div>
                <div className="ost-container-forms ostiary-font">
                    
                    <div className="ost-container-info">
                        <div className="info-item">
                            <div className="table"><div className="table-cell">
                                <p className="ost-highlight">Have an account?</p>
                                <div className="ost-btn" onClick={() => { setIsSignUpView(false); setIsConfirming(false); }}>Log in</div>
                            </div></div>
                        </div>
                        <div className="info-item">
                            <div className="table"><div className="table-cell">
                                <p className="ost-highlight">Need an account?</p>
                                <div className="ost-btn" onClick={() => setIsSignUpView(true)}>Sign Up</div>
                            </div></div>
                        </div>
                    </div>

                    <div className="ost-container-form">
                        <div className="form-item log-in">
                            <div className="table"><div className="table-cell">
                                <input ref={loginUsername} className="ostiary-font" name="Username" placeholder="Email Address" type="text" maxLength={40} />
                                {usernameLoginError[0] && <p className='auth-validation-error'>{usernameLoginError[1]}</p>}
                                
                                <div className="password-input-wrapper">
                                    <input ref={loginUserPassword} className="ostiary-font" name="Password" placeholder="Password" type={showLoginPassword ? "text" : "password"} maxLength={33} />
                                    <span className="password-toggle-icon" onClick={() => setShowLoginPassword(!showLoginPassword)}>
                                        {showLoginPassword ? <EyeSlashIcon /> : <EyeIcon />}
                                    </span>
                                </div>
                                {passwordLoginError[0] && <p className='auth-validation-error'>{passwordLoginError[1]}</p>}
                                
                                <div className="ost-btn" onClick={onLoginClickHandler}>Log in</div>
                            </div></div>
                        </div>

                        <div className="form-item sign-up">
                            <div className="table"><div className="table-cell">
                                {isConfirming ? (
                                    <>
                                        <p style={{ color: '#fff', marginBottom: '15px' }}>Enter the 6-digit code sent to your email.</p>
                                        <input ref={verificationCode} className="ostiary-font" placeholder="Verification Code" type="text" maxLength={6} />
                                        <div className="ost-btn" onClick={onConfirmSignUpHandler}>Verify Code</div>
                                    </>
                                ) : (
                                    <>
                                        <input ref={signupUsername} className="ostiary-font" placeholder="Email" type="text" maxLength={69} />
                                        {usernameSignUpError[0] && <p className='auth-validation-error'>{usernameSignUpError[1]}</p>}
                                        
                                        <div className="password-input-wrapper">
                                            <input ref={signupUserPassword} className="ostiary-font" placeholder="Password" type={showSignUpPassword ? "text" : "password"} maxLength={33} />
                                            <span className="password-toggle-icon" onClick={() => setShowSignUpPassword(!showSignUpPassword)}>
                                                {showSignUpPassword ? <EyeSlashIcon /> : <EyeIcon />}
                                            </span>
                                        </div>
                                        {passwordSignUpError[0] && <p className='auth-validation-error'>{passwordSignUpError[1]}</p>}
                                        
                                        <div className="password-input-wrapper">
                                            <input ref={confirmUserPassword} className="ostiary-font" placeholder="Confirm Password" type={showConfirmPassword ? "text" : "password"} maxLength={33} />
                                            <span className="password-toggle-icon" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                                                {showConfirmPassword ? <EyeSlashIcon /> : <EyeIcon />}
                                            </span>
                                        </div>
                                        {passwordConfirmError[0] && <p className='auth-validation-error'>{passwordConfirmError[1]}</p>}
                                        
                                        <div className="ost-btn" onClick={onSignUpClickHandler}>Sign Up</div>
                                    </>
                                )}
                            </div></div>
                        </div>
                    </div>

                </div>
            </div>

            <div style={{ textAlign: 'center', marginTop: '40px', fontFamily: 'Montserrat' }}>
                <p style={{ margin: '13px 0 15px 0', color: darkMode ? '#9ca3af' : '#666', fontSize: '1rem' }}>Secure Access Portal</p>
                <p style={{ margin: '33px 0px 13px 0px', color: darkMode ? '#ffffff' : '#002C51', fontSize: '0.9rem', fontWeight: 500, fontFamily: 'Bodoni Moda Variable' }}>BUILD by</p>
                <a href="https://www.mekaegwim.ca" target="_blank" rel="noopener noreferrer">
                    <img src={darkMode ? devLogoDark : devLogoLight} alt="Logo" style={{ width: '80px', opacity: 0.8 }} />
                </a>
            </div>
        </div>
    );
}

export default Authenticator;