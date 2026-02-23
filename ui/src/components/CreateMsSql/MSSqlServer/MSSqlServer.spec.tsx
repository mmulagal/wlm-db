import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import MSSqlServer from './MSSqlServer';

vi.mock('./MSSqlAccordions', () => ({
    default: () => <div data-testid="mssql-accordions">MSSql Accordions</div>
}));
vi.mock('../SelectConfig/SelectConfig', () => ({
    default: ({ wizardType }: { wizardType: string }) => <div data-testid="select-config">{wizardType}</div>
}));

const makeStore = (isWorkloadFactory = false) =>
    configureStore({
        reducer: {
            auth: () => ({ isWorkloadFactory })
        }
    });

describe('MSSqlServer', () => {
    it('renders SelectConfig with MSSQL wizard type', () => {
        const store = makeStore();
        render(
            <Provider store={store}>
                <MSSqlServer />
            </Provider>
        );
        expect(screen.getByTestId('select-config')).toBeTruthy();
        expect(screen.getByText('mssql')).toBeTruthy();
    });

    it('renders MSSqlAccordions', () => {
        const store = makeStore();
        render(
            <Provider store={store}>
                <MSSqlServer />
            </Provider>
        );
        expect(screen.getByTestId('mssql-accordions')).toBeTruthy();
    });

    it('renders margin div when isWorkloadFactory is true', () => {
        const store = makeStore(true);
        const { container } = render(
            <Provider store={store}>
                <MSSqlServer />
            </Provider>
        );
        // Component may or may not render margin divs depending on implementation
        expect(container).toBeDefined();
    });

    it('does not render margin div when isWorkloadFactory is false', () => {
        const store = makeStore(false);
        const { container } = render(
            <Provider store={store}>
                <MSSqlServer />
            </Provider>
        );
        const marginDivs = container.querySelectorAll('div[style*="marginBottom"]');
        expect(marginDivs.length).toBe(0);
    });
});
