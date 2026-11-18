import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

if (import.meta.env.DEV) {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/dev-sw.js?dev-sw', {scope: '/'}).catch(() => {
      // Ignore dev SW registration errors in restricted contexts
    });
  }
} else {
  registerSW({immediate: true});
}

createRoot(document.getElementById('root')!).render(<App />);
