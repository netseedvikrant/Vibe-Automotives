import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { Toaster } from 'react-hot-toast';
import { NotificationProvider } from './providers/NotificationProvider.jsx';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <NotificationProvider>
      <App />
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#0f0f0f',
            color: '#e8e8e8',
            border: '1px solid #2a2a2a',
            borderLeft: '3px solid #1c69d4',
            borderRadius: '0',
            fontFamily: "'Barlow Condensed', sans-serif",
            fontSize: '13px',
            letterSpacing: '0.04em',
          },
          success: {
            iconTheme: { primary: '#1cd46a', secondary: '#0f0f0f' },
            style: { borderLeft: '3px solid #1cd46a' },
          },
          error: {
            iconTheme: { primary: '#d4261c', secondary: '#0f0f0f' },
            style: { borderLeft: '3px solid #d4261c' },
          },
        }}
      />
    </NotificationProvider>
  </React.StrictMode>
);
