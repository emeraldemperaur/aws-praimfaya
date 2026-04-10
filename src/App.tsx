import { Routes, Route, Navigate } from 'react-router-dom';
import { usePraimfaya } from './contexts';
import { ToastContainer } from 'react-toastify/unstyled';
import Praimfaya404 from './pages/404';
import AuthenticationUI from './pages/authentication';
import DashboardUI from './pages/dashboard';
import { contextCSSClass, ErrorIcon, FluidToastAnimation, InfoIcon, SuccessIcon, WarningIcon } from './utils/voltaire';
import { ErrorBoundary } from './utils/errorboundary';
import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import NavigationMenu from './components/navigationmenu';
import ContextProfilesUI from './pages/contextprofiles';
import TerminalConsoleUI from './pages/terminalconsole';
import LoaderGate from './components/loadergate';
import './styles/styles.scss';
import './App.scss';

function App() {
  const { logUser, userLog, isAuthenticated } = usePraimfaya();
  const systemPreferenceDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const [darkMode, setDarkMode] = useState<boolean>(systemPreferenceDark);
  console.log(`Context :: ${logUser} : ${userLog}`);

  useEffect(() => {
    document.body.style.backgroundColor = darkMode ? "#1b1c1d" : "#ffffff";
    document.body.style.color = darkMode ? "#f9fafb" : "#1f2937";
    document.body.style.transition = "background-color 0.3s ease, color 0.3s ease";
  }, [darkMode]); 
  
  const toggleDarkMode = () => { setDarkMode(!darkMode)}

  return (
    <>
    <Helmet>
        <link 
          rel="icon" 
          type="image/svg+xml"
          href={darkMode ? "/me-devlogo-white.png" : "/me-devlogo-black.png"} 
        />
    </Helmet>
    <div className={`App ${darkMode ? 'praimfaya-dark' : 'praimfaya-light'}` }>
      <ToastContainer stacked 
      toastClassName={(context) =>
        `praimfaya-toast${darkMode ? '-dark' : ''} ${contextCSSClass[context?.type || "default"]}`
      }
      progressClassName={`praimfaya-toast-progress${darkMode ? '-dark' : ''}`}
      position="top-right"
      autoClose={3000}
      hideProgressBar={false}
      transition={FluidToastAnimation}
      icon={({ type }) => {
        switch (type) {
          case "success": return <SuccessIcon />;
          case "error": return <ErrorIcon />;
          case "info": return <InfoIcon />;
          case "warning": return <WarningIcon />;
          default: return <InfoIcon />;
        }
      }}
      />
      <ErrorBoundary 
      fallback={(error, reset) => (
        <div role="alert" className={`error-fallback-container${darkMode ? '-dark' : ''}`}>
          <h1>Oh Sh*t!</h1>
          <h2>Something went wrong</h2>
          <p>{error.message}</p>
          <button onClick={reset}>Refresh</button>
        </div>
      )}>
        <LoaderGate darkMode={darkMode}>
        {isAuthenticated && <NavigationMenu darkMode={darkMode} darkModeToggle={toggleDarkMode}/>}
          <Routes>
            <Route path='/' element={
              isAuthenticated ? <Navigate to="/dashboard" replace /> : <AuthenticationUI darkMode={darkMode}/>
            }/>
            <Route path='dashboard' element={
              isAuthenticated ? <DashboardUI darkMode={darkMode}/> : <Navigate to="/" replace />
            }/>
            <Route path='context-profiles' element={
              isAuthenticated ? <ContextProfilesUI darkMode={darkMode}/> : <Navigate to="/" replace />
            }/>
            <Route path='terminal' element={
              isAuthenticated ? <TerminalConsoleUI darkMode={darkMode}/> : <Navigate to="/" replace />
            }/> 
            <Route path='*' element={<Praimfaya404 darkMode={darkMode}/>}/>
          </Routes>
        </LoaderGate>
      </ErrorBoundary>
    </div>
    </>
  )
}

export default App;