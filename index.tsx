import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/tailwind.css';
import App from './App';

const serializeUnknown = (value: unknown) => {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  if (typeof value === 'object' && value !== null) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (e) {
      return { value: String(value) };
    }
  }
  return { value };
};

const logRendererError = (payload: Record<string, unknown>) => {
  try {
    window.katanos?.logError?.({ ...payload, source: 'renderer' });
  } catch (e) {
    // Ignore logging failures.
  }
};

const originalConsoleError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  originalConsoleError(...args);
  logRendererError({ type: 'console.error', args: args.map(serializeUnknown) });
};

window.addEventListener('error', (event) => {
  logRendererError({
    type: 'error',
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: serializeUnknown(event.error),
  });
});

window.addEventListener('unhandledrejection', (event) => {
  logRendererError({
    type: 'unhandledrejection',
    reason: serializeUnknown(event.reason),
  });
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
