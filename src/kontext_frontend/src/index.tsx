// 🔥 FIX: Import React FIRST before anything else to prevent initialization errors
// Note: MonacoEnvironment is now configured in index.html as an inline script before any modules load
import React from 'react';
import ReactDOM from 'react-dom/client';

// 🔥 FIX: Don't import perf at module level - causes React initialization errors
// Performance tracking disabled to prevent circular dependencies

// App component
import { App } from './App';

// Styles
import './styles.css';

// Render app
const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

setTimeout(() => {
  const loader = document.getElementById('app-loader');
  if (loader) {
    loader.style.opacity = '0';
    loader.style.transition = 'opacity 0.3s ease';
    setTimeout(() => {
      loader.remove();
    }, 300);
  }
}, 0);