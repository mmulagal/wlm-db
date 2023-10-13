import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider as ReduxContextProvider } from 'react-redux';
import { DialogContextProvider, ThemeProvider } from '@netapp/design-system';
import { BrowserRouter } from 'react-router-dom';
import store from './store/store';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
    <React.StrictMode>
        <ReduxContextProvider store={store}>
            <ThemeProvider isIframe={true} theme={'light'}>
                <BrowserRouter>
                    <DialogContextProvider>
                        <App />
                    </DialogContextProvider>
                </BrowserRouter>
            </ThemeProvider>
        </ReduxContextProvider>
    </React.StrictMode>
);
