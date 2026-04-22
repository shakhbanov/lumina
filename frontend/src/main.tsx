import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/globals.css';

const container = document.getElementById('root')!;

// If the page was prerendered, hydrate. Otherwise do a fresh client render.
const hasPrerenderedMarkup = container.hasChildNodes() && container.children.length > 0;

const tree = (
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

if (hasPrerenderedMarkup) {
  ReactDOM.hydrateRoot(container, tree);
} else {
  ReactDOM.createRoot(container).render(tree);
}
