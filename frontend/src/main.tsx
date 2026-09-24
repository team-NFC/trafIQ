import ReactDOM from 'react-dom/client';
import { AppProvider } from './context/AppContext';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <AppProvider>
    <App />
  </AppProvider>
);
