import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import WizardComponent from '../WizardComponent';
import msSqlActionSlice from '../../../../store/mssql/msSqlActionSlice';

// Mock child components
vi.mock('../CreateNewDBHeader/CreateNewDBHeader', () => ({
    default: () => <div data-testid="create-new-user-header">Header</div>
}));

vi.mock('../CreateNewDBFooter/CreateNewDBFooter', () => ({
    default: () => <div data-testid="create-new-user-footer">Footer</div>
}));

vi.mock('../ContentComponent/ContentComponent', () => ({
    default: () => <div data-testid="content-component">ContentComponent</div>
}));

vi.mock('../CreateNewDBCodeBox/CreateNewUserCodeBox', () => ({
    default: () => <div data-testid="create-new-user-codebox">CodeBox</div>
}));

// Fix relative paths - WizardComponent uses relative imports
vi.mock('../../CreateNewDBHeader/CreateNewDBHeader', () => ({
    default: () => <div data-testid="create-new-user-header">Header</div>
}));

vi.mock('../../CreateNewDBFooter/CreateNewDBFooter', () => ({
    default: () => <div data-testid="create-new-user-footer">Footer</div>
}));

vi.mock('../../ContentComponent/ContentComponent', () => ({
    default: () => <div data-testid="content-component">ContentComponent</div>
}));

vi.mock('../../CreateNewDBCodeBox/CreateNewUserCodeBox', () => ({
    default: () => <div data-testid="create-new-user-codebox">CodeBox</div>
}));

// Mock design system
vi.mock('@netapp/design-system', () => ({
    Spinner: ({ isLarge }: any) => <div data-testid="spinner" data-islarge={isLarge} />,
    StepLayout: ({ children, className }: any) => (
        <div data-testid="step-layout" className={className}>
            {children}
        </div>
    ),
    WizardContent: ({ children, className }: any) => (
        <div data-testid="wizard-content" className={className}>
            {children}
        </div>
    ),
    WizardFooter: ({ children }: any) => <div data-testid="wizard-footer">{children}</div>
}));

vi.mock('../WizardComponent.module.scss', () => ({
    default: {
        wizardComponent: 'wizardComponent',
        loaderOverlay: 'loaderOverlay',
        spinnerPlacement: 'spinnerPlacement',
        leftSide: 'leftSide',
        header: 'header',
        content: 'content',
        rightSide: 'rightSide'
    }
}));

describe('WizardComponent', () => {
    const createMockStore = (isLoading = false) =>
        configureStore({
            reducer: {
                [msSqlActionSlice.name]: msSqlActionSlice.reducer
            } as any,
            preloadedState: {
                msSqlAction: {
                    isLoading
                }
            } as any
        });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render without crashing', () => {
        const store = createMockStore();
        const { container } = render(
            <Provider store={store}>
                <WizardComponent />
            </Provider>
        );
        expect(container).toBeTruthy();
    });

    it('should render Header component', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <WizardComponent />
            </Provider>
        );
        expect(screen.getByTestId('create-new-user-header')).toBeTruthy();
    });

    it('should render Footer component', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <WizardComponent />
            </Provider>
        );
        expect(screen.getByTestId('create-new-user-footer')).toBeTruthy();
    });

    it('should render ContentComponent', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <WizardComponent />
            </Provider>
        );
        expect(screen.getByTestId('content-component')).toBeTruthy();
    });

    it('should render CodeBox component', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <WizardComponent />
            </Provider>
        );
        expect(screen.getByTestId('create-new-user-codebox')).toBeTruthy();
    });

    it('should NOT show spinner when loading is false', () => {
        const store = createMockStore(false);
        render(
            <Provider store={store}>
                <WizardComponent />
            </Provider>
        );
        expect(screen.queryByTestId('spinner')).toBeNull();
    });

    it('should show spinner when loading is true', () => {
        const store = createMockStore(true);
        render(
            <Provider store={store}>
                <WizardComponent />
            </Provider>
        );
        expect(screen.getByTestId('spinner')).toBeTruthy();
    });

    it('should render Spinner with isLarge prop when loading', () => {
        const store = createMockStore(true);
        render(
            <Provider store={store}>
                <WizardComponent />
            </Provider>
        );
        const spinner = screen.getByTestId('spinner');
        expect(spinner.getAttribute('data-islarge')).toBe('true');
    });

    it('should render StepLayout', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <WizardComponent />
            </Provider>
        );
        expect(screen.getByTestId('step-layout')).toBeTruthy();
    });

    it('should render WizardContent', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <WizardComponent />
            </Provider>
        );
        expect(screen.getByTestId('wizard-content')).toBeTruthy();
    });

    it('should render WizardFooter', () => {
        const store = createMockStore();
        render(
            <Provider store={store}>
                <WizardComponent />
            </Provider>
        );
        expect(screen.getByTestId('wizard-footer')).toBeTruthy();
    });

    it('should show loader overlay and spinner together when loading', () => {
        const store = createMockStore(true);
        const { container } = render(
            <Provider store={store}>
                <WizardComponent />
            </Provider>
        );
        expect(screen.getByTestId('spinner')).toBeTruthy();
        expect(container.querySelector('.loaderOverlay')).toBeTruthy();
    });
});
