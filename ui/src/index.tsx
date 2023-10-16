import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider as ReduxContextProvider } from 'react-redux';
import { DialogContextProvider } from '@netapp/design-system';
import { BrowserRouter } from 'react-router-dom';
import store from './store/store';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
    <React.StrictMode>
        <ReduxContextProvider store={store}>
            <BrowserRouter>
                <DialogContextProvider>
                    <App />
                </DialogContextProvider>
            </BrowserRouter>
        </ReduxContextProvider>
    </React.StrictMode>
);
