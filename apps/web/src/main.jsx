import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { GlobalEffectsProvider } from './context/GlobalEffectsContext';
import { ThemeProvider } from './context/ThemeContext';
import { GlobalEffects } from './components/GlobalEffects';
import { ToastProvider } from './components/Toast';
import App from './App';
import './index.css';
import './styles/design-tokens.css';
import './styles/theme-neon.css';
import './styles/theme-modern.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <GlobalEffectsProvider>
          <ToastProvider>
            <GlobalEffects />
            <App />
          </ToastProvider>
        </GlobalEffectsProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);
