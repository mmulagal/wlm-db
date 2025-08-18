import React from 'react';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import store from './store/store';
import App from './App';

vi.mock('@netapp/design-system', () => ({
    Notification: vi.fn(),
    NotificationPanel: vi.fn(),
    Typography: vi.fn(),
    useBlueXP: vi.fn(),
    Spinner: vi.fn(),
    ThemeProvider: vi.fn()
}));

test('renders the App component', () => {
    render(
        <Provider store={store}>
            <BrowserRouter>
                <App />
            </BrowserRouter>
        </Provider>
    );

    // Assert that the component renders without errors
    expect(App).toBeDefined();
});
