import React from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './shared/auth.jsx';
import './styles/base.css';
import App from './app.jsx';

createRoot(document.getElementById('root')).render(
  <AuthProvider>
    <App />
  </AuthProvider>
);
