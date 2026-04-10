import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/google-sans-code';
import '@fontsource/google-sans-code/600.css';
import '@fontsource/google-sans-code/400-italic.css';
import '@fontsource-variable/bodoni-moda';
import './index.scss'
import App from './App.tsx'
import { PraimfayaProvider } from './contexts/index.tsx'
import { BrowserRouter } from 'react-router-dom';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PraimfayaProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </PraimfayaProvider>
  </StrictMode>,
)
