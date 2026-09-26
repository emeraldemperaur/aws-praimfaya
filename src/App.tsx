import { Routes, Route, Navigate } from 'react-router-dom';
import { usePraimfaya } from './contexts';
import { ToastContainer } from 'react-toastify';
import Praimfaya404 from './pages/404';
import AuthenticationUI from './pages/authentication';
import DashboardUI from './pages/dashboard';
import { FluidToastAnimation } from './utils/voltaire';
import { ErrorBoundary } from './utils/errorboundary';
import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import NavigationMenu from './components/navigationmenu';
import ContextProfilesUI from './pages/contextprofiles';
import TerminalConsoleUI from './pages/terminalconsole';
import LoaderGate from './components/loadergate';
import './styles/styles.scss';
import './App.scss';
import { Amplify } from 'aws-amplify';
import { fetchAuthSession, getCurrentUser, fetchUserAttributes } from 'aws-amplify/auth'; // Added required auth imports
import { CubeIcon } from './components/cube'; 
import VectorCollectionsUI from './pages/vectorcollections';
import AmazonBedrockUI from './pages/amazonbedrock';
import FoundationModelsUI from './pages/foundationmodels';
import UserProfile from './pages/userprofile';
import TerminalSessionUI from './pages/terminalsession';
import SystemBootstrap from './components/systembootstrap';
import AutomationWorkflowsUI from './pages/automationworkflows';
import RAGArtifactsUI from './pages/ragartifacts';
import UsageWatchtower from './pages/watchtowerdashboard';
import AgentActivity from './pages/agentsactivity';

function App() {
  const { logUser, userLog, isAuthenticated } = usePraimfaya();
  const systemPreferenceDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const [darkMode, setDarkMode] = useState<boolean>(systemPreferenceDark);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);

  console.log(`Context :: ${logUser} : ${userLog}`);

  useEffect(() => {
    document.body.style.backgroundColor = darkMode ? "#1b1c1d" : "#ffffff";
    document.body.style.color = darkMode ? "#f9fafb" : "#1f2937";
    document.body.style.transition = "background-color 0.3s ease, color 0.3s ease";
    console.log('Amplify.configure:');
    console.log(Amplify.getConfig());
  }, [darkMode]); 

  useEffect(() => {
    const verifySession = async () => {
      try {
        const { username, userId } = await getCurrentUser();
        const attributes = await fetchUserAttributes();
        const session = await fetchAuthSession();
        const tokenPayload = session.tokens?.accessToken?.payload;
        const groups = (tokenPayload?.['cognito:groups'] as string[]) || [];
        const authTimeEpoch = tokenPayload?.auth_time as number;
        const lastSignInTime = authTimeEpoch 
            ? new Date(authTimeEpoch * 1000).toISOString() 
            : new Date().toISOString();
        
        userLog(attributes.email || username || 'aws-user', 'verified', userId, lastSignInTime, groups);
      } catch (error) {
      } finally {
        setIsInitializing(false);
      }
    };
    verifySession();
  }, []);
  
  const toggleDarkMode = () => { setDarkMode(!darkMode)}

  if (isInitializing) {
    return (
      <div className={`App ${darkMode ? 'praimfaya-dark' : 'praimfaya-light'}`} style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: darkMode ? "#1b1c1d" : "#ffffff", color: darkMode ? '#f9fafb' : '#111827', fontFamily: 'Google Sans Code, monospace' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}>
            <CubeIcon width={40} height={40} darkMode={darkMode} edgeColor={darkMode ? '#ffffff' : '#0B0B45'} animationDuration="2s" />
          </div>
          <h3 style={{ margin: '0 0 0.5rem 0', fontFamily: 'Bodoni Moda Variable', letterSpacing: '0.1em' }}>AUTHENTICATING...</h3>
          <p style={{ opacity: 0.5, fontSize: '0.85rem', margin: 0, fontFamily: 'Google Sans Code', letterSpacing: '0.13em' }}>Verifying secure session.</p>
        </div>
      </div>
    );
  }

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
      <ToastContainer 
        stacked
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        toastClassName="praimfaya-toast-shell" 
        progressClassName="praimfaya-toast-progress"
        transition={FluidToastAnimation}
        icon={false}        
        closeButton={false}
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
        
        {isAuthenticated && <SystemBootstrap />}
        
        {isAuthenticated && <NavigationMenu darkMode={darkMode} darkModeToggle={toggleDarkMode}/>}
          <Routes>
            <Route path='/' element={
              isAuthenticated ? <Navigate to="/dashboard" replace /> : <AuthenticationUI darkMode={darkMode}/>
            }/>
            <Route path='dashboard' element={
              isAuthenticated ? <DashboardUI darkMode={darkMode}/> : <Navigate to="/" replace />
            }/>
            <Route path='dashboard/usage-watchtower' element={
              isAuthenticated ? <UsageWatchtower darkMode={darkMode}/> : <Navigate to="/" replace />
            }/>
             <Route path='dashboard/agents-activity' element={
              isAuthenticated ? <AgentActivity darkMode={darkMode}/> : <Navigate to="/" replace />
            }/>
             <Route path='dashboard/rag-artifacts' element={
              isAuthenticated ? <RAGArtifactsUI darkMode={darkMode}/> : <Navigate to="/" replace />
            }/>
            <Route path='context-profiles' element={
              isAuthenticated ? <ContextProfilesUI darkMode={darkMode}/> : <Navigate to="/" replace />
            }/>
            <Route path='automation-workflows' element={
              isAuthenticated ? <AutomationWorkflowsUI darkMode={darkMode}/> : <Navigate to="/" replace />
            }/>
            <Route path='vector-collections' element={
              isAuthenticated ? <VectorCollectionsUI darkMode={darkMode}/> : <Navigate to="/" replace />
            }/>
            <Route path='foundation-models' element={
              isAuthenticated ? <FoundationModelsUI darkMode={darkMode}/> : <Navigate to="/" replace />
            }/>
            <Route path='amazon-bedrock' element={
              isAuthenticated ? <AmazonBedrockUI darkMode={darkMode}/> : <Navigate to="/" replace />
            }/>
            <Route path='console-terminals' element={
              isAuthenticated ? <TerminalConsoleUI darkMode={darkMode}/> : <Navigate to="/" replace />
            }/> 
            <Route path='console-terminals/session/:sessionId' element={
              isAuthenticated ? <TerminalSessionUI darkMode={darkMode}/> : <Navigate to="/" replace />
            }/>
            <Route path='user-profile' element={
              isAuthenticated ? <UserProfile darkMode={darkMode}/> : <Navigate to="/" replace />
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