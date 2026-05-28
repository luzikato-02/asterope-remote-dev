import React from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <Toaster
      position="bottom-right"
      toastOptions={{
        style: {
          background: '#161b22',
          color: '#e6edf3',
          border: '1px solid #30363d',
          borderRadius: '8px',
          fontSize: '13px',
        },
        success: { iconTheme: { primary: '#238636', secondary: '#e6edf3' } },
        error:   { iconTheme: { primary: '#da3633', secondary: '#e6edf3' } },
      }}
    />
  </React.StrictMode>
);
