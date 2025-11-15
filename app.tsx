import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css'; // Global styles

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Failed to find the root element. 'root' div is missing from index.html.");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
