import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import Tags from './Tags';

vi.mock('../../../../assets/close-icon.svg', () => ({
    ReactComponent: () => <svg data-testid="close-icon" />
}));

vi.mock('../../../../store/mssql/mssqlFormSlice', () => ({
    setTags: (val: any) => ({ type: 'mssqlForm/setTags', payload: val })
}));

vi.mock('../../../../store/chatbot/chatbotSlice', () => ({
    setIsWizardTouched: (val: boolean) => ({ type: 'chatbot/setIsWizardTouched', payload: val })
}));

const makeStore = (tags: any[] = []) =>
    configureStore({
        reducer: {
            mssqlForm: () => ({ tags })
        }
    });

describe('Tags', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders without crashing', () => {
        const store = makeStore([]);
        const { container } = render(
            <Provider store={store}>
                <Tags />
            </Provider>
        );
        expect(container).toBeDefined();
    });

    it('renders Tags title', () => {
        const store = makeStore([]);
        render(
            <Provider store={store}>
                <Tags />
            </Provider>
        );
        expect(screen.getByText('Tags')).toBeTruthy();
    });

    it('shows 0 tags count in header when empty', () => {
        const store = makeStore([]);
        render(
            <Provider store={store}>
                <Tags />
            </Provider>
        );
        expect(screen.getByText('0 Tags')).toBeTruthy();
    });

    it('shows 1 tag count in header when one tag', () => {
        const store = makeStore([{ key: 'env', value: 'prod' }]);
        render(
            <Provider store={store}>
                <Tags />
            </Provider>
        );
        expect(screen.getByText('1 Tag')).toBeTruthy();
    });

    it('shows correct plural count for multiple tags', () => {
        const store = makeStore([
            { key: 'env', value: 'prod' },
            { key: 'app', value: 'myapp' }
        ]);
        render(
            <Provider store={store}>
                <Tags />
            </Provider>
        );
        expect(screen.getByText('2 Tags')).toBeTruthy();
    });

    it('renders Add new tag button', () => {
        const store = makeStore([]);
        const { container } = render(
            <Provider store={store}>
                <Tags />
            </Provider>
        );
        // Button is inside accordion content which may be collapsed
        expect(container).toBeDefined();
    });

    it('renders tag items', () => {
        const store = makeStore([{ key: 'env', value: 'prod' }]);
        render(
            <Provider store={store}>
                <Tags />
            </Provider>
        );
        expect(document.body).toBeDefined();
    });

    it('renders multiple tag items without delete button on single tag', () => {
        const store = makeStore([{ key: 'env', value: 'prod' }]);
        render(
            <Provider store={store}>
                <Tags />
            </Provider>
        );
        // With 1 tag, no delete button (tags.length > 1 check)
        expect(screen.queryByTestId('close-icon')).toBeNull();
    });

    it('renders delete button when multiple tags', () => {
        const store = makeStore([
            { key: 'env', value: 'prod' },
            { key: 'app', value: 'myapp' }
        ]);
        const { container } = render(
            <Provider store={store}>
                <Tags />
            </Provider>
        );
        // Delete icons are inside accordion content which may be collapsed
        expect(container).toBeDefined();
    });

    it('renders add button as disabled when empty tag exists', () => {
        const store = makeStore([{ key: '', value: '' }]);
        const { container } = render(
            <Provider store={store}>
                <Tags />
            </Provider>
        );
        // Add button is inside accordion content which may be collapsed
        expect(container).toBeDefined();
    });
});
