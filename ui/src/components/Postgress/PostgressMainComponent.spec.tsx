import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import PostgressMainComponent from './PostgressMainComponent';

// Mock all child components
vi.mock('./PostgressHeader/PostgressHeader', () => ({
    default: () => <div data-testid="postgress-header">Header</div>
}));

vi.mock('./PostgressFooter/PostgressFooter', () => ({
    default: () => <div data-testid="postgress-footer">Footer</div>
}));

vi.mock('./PostgressLayout/PostgressLayout', () => ({
    default: () => <div data-testid="postgress-layout">Layout</div>
}));

vi.mock('./PostgreCodebox/PostgreCodebox', () => ({
    default: () => <div data-testid="postgress-codebox">Codebox</div>
}));

// PostgreApis is called as a function (hook-like), mock it as no-op
vi.mock('./PostgreServer/PostgreApis', () => ({
    default: () => null
}));

vi.mock('@netapp/design-system', () => ({
    Spinner: ({ isLarge }: any) => (
        <div data-testid="spinner" data-large={String(!!isLarge)}>
            Loading...
        </div>
    ),
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

vi.mock('./PostgressMainComponent.module.scss', () => ({
    default: {
        protectComponent: 'protectComponent',
        loaderOverlay: 'loaderOverlay',
        spinnerPlacement: 'spinnerPlacement',
        leftSide: 'leftSide',
        rightSide: 'rightSide',
        header: 'header',
        content: 'content'
    }
}));

const makeStore = (isLoading: boolean) =>
    configureStore({
        reducer: {
            msSqlAction: () => ({ isLoading })
        }
    });

describe('PostgressMainComponent', () => {
    beforeEach(() => vi.clearAllMocks());

    it('renders without crashing', () => {
        const { container } = render(
            <Provider store={makeStore(false)}>
                <PostgressMainComponent />
            </Provider>
        );
        expect(container).toBeTruthy();
    });

    it('renders PostgressHeader', () => {
        render(
            <Provider store={makeStore(false)}>
                <PostgressMainComponent />
            </Provider>
        );
        expect(screen.getByTestId('postgress-header')).toBeTruthy();
    });

    it('renders PostgressFooter', () => {
        render(
            <Provider store={makeStore(false)}>
                <PostgressMainComponent />
            </Provider>
        );
        expect(screen.getByTestId('postgress-footer')).toBeTruthy();
    });

    it('renders PostgressLayout', () => {
        render(
            <Provider store={makeStore(false)}>
                <PostgressMainComponent />
            </Provider>
        );
        expect(screen.getByTestId('postgress-layout')).toBeTruthy();
    });

    it('renders PostgreCodebox', () => {
        render(
            <Provider store={makeStore(false)}>
                <PostgressMainComponent />
            </Provider>
        );
        expect(screen.getByTestId('postgress-codebox')).toBeTruthy();
    });

    it('renders StepLayout, WizardContent, WizardFooter when not loading', () => {
        render(
            <Provider store={makeStore(false)}>
                <PostgressMainComponent />
            </Provider>
        );
        expect(screen.getByTestId('step-layout')).toBeTruthy();
        expect(screen.getByTestId('wizard-content')).toBeTruthy();
        expect(screen.getByTestId('wizard-footer')).toBeTruthy();
    });

    it('does NOT show spinner when isLoading is false', () => {
        render(
            <Provider store={makeStore(false)}>
                <PostgressMainComponent />
            </Provider>
        );
        expect(screen.queryByTestId('spinner')).toBeNull();
    });

    it('shows spinner when isLoading is true', () => {
        render(
            <Provider store={makeStore(true)}>
                <PostgressMainComponent />
            </Provider>
        );
        expect(screen.getByTestId('spinner')).toBeTruthy();
    });

    it('renders spinner as large', () => {
        render(
            <Provider store={makeStore(true)}>
                <PostgressMainComponent />
            </Provider>
        );
        expect(screen.getByTestId('spinner').getAttribute('data-large')).toBe('true');
    });

    it('renders loader overlay when isLoading is true', () => {
        const { container } = render(
            <Provider store={makeStore(true)}>
                <PostgressMainComponent />
            </Provider>
        );
        // loaderOverlay div should be rendered
        const overlayDiv = container.querySelector('.loaderOverlay');
        expect(overlayDiv).toBeTruthy();
    });
});
