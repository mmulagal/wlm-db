import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { describe, it, expect, vi } from 'vitest';
import FileSettingsMode from '../FileSettingsMode/FileSettingsMode';
import createNewUserSlice from '../../../../../store/workloadFactory/createNewDBSlice';

// Mock @netapp/design-system components
vi.mock('@netapp/design-system', () => ({
    AccordionCard: ({ title, ValueContent, children }: any) => (
        <div data-testid="accordion-card">
            <div data-testid="accordion-title">{title}</div>
            {children}
        </div>
    ),
    AccordionCardContent: ({ children }: any) => <div data-testid="accordion-content">{children}</div>,
    DsTypography: ({ children }: any) => <span>{children}</span>,
    RadioButton: ({ isChecked, onChange, children }: any) => (
        <label data-testid="radio-option">
            <input type="radio" checked={isChecked} onChange={onChange} />
            {children}
        </label>
    )
}));

// Mock SCSS modules
vi.mock('../FileSettingsMode/FileSettingsMode.module.scss', () => ({
    default: {
        fileSettingsMode: 'fileSettingsMode',
        failOver: 'failOver',
        failoverText: 'failoverText',
        radio: 'radio'
    }
}));

vi.mock('../../../../../utils/CommonStyles.module.scss', () => ({
    default: {
        'heading-content': 'heading-content',
        title: 'title'
    }
}));

describe('FileSettingsMode Component', () => {
    const createMockStore = (selectedNewUserConfig = 'Quick create') => {
        return configureStore({
            reducer: {
                createNewUser: createNewUserSlice.reducer
            },
            preloadedState: {
                createNewUser: {
                    selectedNewUserConfig
                }
            }
        });
    };

    it('should have Quick create selected by default', () => {
        const store = createMockStore('Quick create');

        render(
            <Provider store={store}>
                <FileSettingsMode />
            </Provider>
        );

        const radioButtons = screen.getAllByRole('radio');
        expect(radioButtons[0]).toBeChecked();
        expect(radioButtons[1]).not.toBeChecked();
    });

    it('should have Advanced create selected when configured', () => {
        const store = createMockStore('Advanced create');

        render(
            <Provider store={store}>
                <FileSettingsMode />
            </Provider>
        );

        const radioButtons = screen.getAllByRole('radio');
        expect(radioButtons[0]).not.toBeChecked();
        expect(radioButtons[1]).toBeChecked();
    });

    it('should update store when Quick create is clicked', () => {
        const store = createMockStore('Advanced create');

        render(
            <Provider store={store}>
                <FileSettingsMode />
            </Provider>
        );

        const radioButtons = screen.getAllByRole('radio');
        fireEvent.click(radioButtons[0]);

        expect(store.getState().createNewUser.selectedNewUserConfig).toBe('Quick create');
    });

    it('should update store when Advanced create is clicked', () => {
        const store = createMockStore('Quick create');

        render(
            <Provider store={store}>
                <FileSettingsMode />
            </Provider>
        );

        const radioButtons = screen.getAllByRole('radio');
        fireEvent.click(radioButtons[1]);

        expect(store.getState().createNewUser.selectedNewUserConfig).toBe('Advanced create');
    });

    it('should read selectedNewUserConfig from Redux store', () => {
        const store = createMockStore('Advanced create');

        render(
            <Provider store={store}>
                <FileSettingsMode />
            </Provider>
        );

        expect(store.getState().createNewUser.selectedNewUserConfig).toBe('Advanced create');
    });
});
