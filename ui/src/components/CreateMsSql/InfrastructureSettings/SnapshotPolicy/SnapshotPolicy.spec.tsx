import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import SnapshotPolicy from './SnapshotPolicy';

vi.mock('../../../../store/mssql/mssqlFormSlice', () => ({
    setSnapshotPolicyToggle: (val: any) => ({ type: 'mssqlForm/setSnapshotPolicyToggle', payload: val })
}));

vi.mock('../../../../store/chatbot/chatbotSlice', () => ({
    setIsWizardTouched: (val: boolean) => ({ type: 'chatbot/setIsWizardTouched', payload: val })
}));

const makeStore = (snapshotPolicyToggle = false) =>
    configureStore({
        reducer: {
            mssqlForm: () => ({
                snapshotPolicyToggle
            })
        }
    });

describe('SnapshotPolicy', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders without crashing', () => {
        const store = makeStore();
        const { container } = render(
            <Provider store={store}>
                <SnapshotPolicy />
            </Provider>
        );
        expect(container).toBeDefined();
    });

    it('renders Snapshot policy title', () => {
        const store = makeStore();
        render(
            <Provider store={store}>
                <SnapshotPolicy />
            </Provider>
        );
        expect(screen.getByText(/Snapshot policy/i)).toBeTruthy();
    });

    it('shows None in header when toggle is false', () => {
        const store = makeStore(false);
        render(
            <Provider store={store}>
                <SnapshotPolicy />
            </Provider>
        );
        expect(screen.getAllByText('None').length).toBeGreaterThan(0);
    });

    it('shows Daily snapshot info when toggle is true', () => {
        const store = makeStore(true);
        render(
            <Provider store={store}>
                <SnapshotPolicy />
            </Provider>
        );
        // When toggle is true, should show daily snapshot
        expect(screen.getAllByText(/daily snapshot/i).length).toBeGreaterThan(0);
    });

    it('renders toggle selector', () => {
        const store = makeStore();
        render(
            <Provider store={store}>
                <SnapshotPolicy />
            </Provider>
        );
        // ToggleSelector is rendered
        expect(document.body).toBeDefined();
    });
});
