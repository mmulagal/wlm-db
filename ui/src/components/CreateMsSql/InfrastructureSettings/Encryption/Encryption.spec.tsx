import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import Encryption from './Encryption';

vi.mock('react-redux', async () => {
    const actual = await vi.importActual('react-redux');
    return {
        ...actual,
        useDispatch: () => vi.fn()
    };
});

vi.mock('@netapp/design-system', async () => {
    const actual = await vi.importActual('@netapp/design-system');
    return {
        ...actual,
        AccordionCard: ({ children, title }: any) => (
            <div data-testid="accordion-card">
                <div data-testid="accordion-title">{title}</div>
                {children}
            </div>
        ),
        AccordionCardContent: ({ children }: any) => <div data-testid="accordion-content">{children}</div>,
        RadioButton: ({ children }: any) => <div data-testid="radio-button">{children}</div>,
        TextField: () => <input data-testid="text-field" />,
        Typography: ({ children }: any) => <div>{children}</div>,
        Popover: ({ children }: any) => <div data-testid="popover">{children}</div>
    };
});

vi.mock('./EncryptionTable/EncryptionTable/EncryptionTable', () => ({
    default: () => <div data-testid="encryption-table">Encryption Table</div>
}));

describe('Encryption', () => {
    const makeStore = () =>
        configureStore({
            reducer: {
                mssql: () => ({
                    getKmsList: { kmsData: [], kmsLoading: false }
                }),
                mssqlForm: () => ({
                    encryption: { selectedRow: null, encryptionType: 'default', encryptionArn: '' },
                    fsxN: { fsxNType: 'new', fsxNExistingName: null }
                }),
                msSqlAction: () => ({
                    isLoadConfig: false
                }),
                chatbot: () => ({
                    movingFromChatbot: false
                })
            }
        });

    it('renders encryption component', () => {
        const store = makeStore();
        render(
            <Provider store={store}>
                <Encryption />
            </Provider>
        );
        expect(screen.getByTestId('accordion-card')).toBeTruthy();
    });

    it('renders accordion content', () => {
        const store = makeStore();
        render(
            <Provider store={store}>
                <Encryption />
            </Provider>
        );
        expect(screen.getByTestId('accordion-content')).toBeTruthy();
    });
});
