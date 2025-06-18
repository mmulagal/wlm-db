import React from 'react';
import ReactDOM from 'react-dom/client';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import Backend from 'i18next-http-backend';
import { Provider as ReduxContextProvider } from 'react-redux';
import { DialogContextProvider } from '@netapp/design-system';
import { BrowserRouter } from 'react-router-dom';
import store from './store/store';
import './index.css';
import App from './App';

i18next
    .use(Backend)
    .use(initReactI18next)
    .init({
        debug: true,
        fallbackLng: 'en',
        backend: {
            loadPath: `./resources/i18n/{{lng}}.json?cb=${Date.now()}`
        }
    });

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
    <ReduxContextProvider store={store}>
        <BrowserRouter>
            <DialogContextProvider>
                <App />
            </DialogContextProvider>
        </BrowserRouter>
    </ReduxContextProvider>
);
