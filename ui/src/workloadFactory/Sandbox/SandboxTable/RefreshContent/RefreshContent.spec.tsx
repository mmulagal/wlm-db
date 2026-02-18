import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import RefreshContent from './RefreshContent';

vi.mock('../RebaseRollbackContent/RebaseRollbackContent', () => ({
    default: ({ rowData, fromPage }: any) => (
        <div data-testid="rebase-rollback-content" data-from-page={fromPage}>
            RebaseRollbackContent
        </div>
    )
}));

vi.mock('../../../../assets/ic_bullet.svg', () => ({
    ReactComponent: () => <svg data-testid="bullet-icon" />
}));

vi.mock('@netapp/design-system', () => ({
    DsTypography: ({ children, variant, className }: any) => (
        <div data-testid="ds-typography" data-variant={variant} className={className}>
            {children}
        </div>
    )
}));

vi.mock('./RefreshContent.module.scss', () => ({
    default: {
        refreshContent: 'refreshContent',
        secondLine: 'secondLine',
        list: 'list',
        listItem: 'listItem',
        textWidth: 'textWidth',
        rollbackContainer: 'rollbackContainer'
    }
}));

vi.mock('../../../../utils/appConstants', () => ({
    GENERAL: {
        REFRESH_DIALOG_TITLE: ['Are you sure you want to refresh ', ' from database '],
        REFRESH_DIALOG_FIRST_BULLET: 'All changes in this sandbox will be reverted.',
        REFRESH_DIALOG_SECOND_BULLET: 'A new baseline snapshot will be created.'
    }
}));

const createMockStore = () =>
    configureStore({
        reducer: {
            sandbox: () => ({
                isRollbackSelected: false,
                rollbackSnapshotList: [],
                selectedRollbackSnapshot: null,
                rollbackSnapshotsLoading: false
            }),
            headers: () => ({
                headerSelectedCredSandbox: null,
                headerSelectedRegionSandbox: null
            }),
            workloadFactoryResource: () => ({
                selectedResourceCredId: null,
                selectedResourceRegionId: null
            })
        }
    });

describe('RefreshContent', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render with sandbox name and database name', () => {
        const store = createMockStore();

        render(
            <Provider store={store}>
                <RefreshContent
                    databaseName="testDB"
                    sandboxName="testSandbox"
                    rowData={{ databaseHostId: 'h1', name: 'testSandbox', instanceId: 'i1' }}
                    fromPage="sandboxes"
                />
            </Provider>
        );

        expect(screen.getByText('testSandbox')).toBeTruthy();
        expect(screen.getByText('testDB')).toBeTruthy();
    });

    it('should render dialog title parts', () => {
        const store = createMockStore();

        const { container } = render(
            <Provider store={store}>
                <RefreshContent databaseName="testDB" sandboxName="testSandbox" rowData={{}} fromPage="sandboxes" />
            </Provider>
        );

        expect(container.textContent).toContain('Are you sure you want to refresh');
        expect(container.textContent).toContain('from database');
    });

    it('should render first and second bullet points', () => {
        const store = createMockStore();

        render(
            <Provider store={store}>
                <RefreshContent databaseName="testDB" sandboxName="testSandbox" rowData={{}} fromPage="sandboxes" />
            </Provider>
        );

        expect(screen.getByText('All changes in this sandbox will be reverted.')).toBeTruthy();
        expect(screen.getByText('A new baseline snapshot will be created.')).toBeTruthy();
    });

    it('should render RebaseRollbackContent', () => {
        const store = createMockStore();

        render(
            <Provider store={store}>
                <RefreshContent
                    databaseName="testDB"
                    sandboxName="testSandbox"
                    rowData={{ databaseHostId: 'h1' }}
                    fromPage="sandboxes"
                />
            </Provider>
        );

        expect(screen.getByTestId('rebase-rollback-content')).toBeTruthy();
    });

    it('should pass fromPage to RebaseRollbackContent', () => {
        const store = createMockStore();

        render(
            <Provider store={store}>
                <RefreshContent databaseName="testDB" sandboxName="testSandbox" rowData={{}} fromPage="inventory" />
            </Provider>
        );

        expect(screen.getByTestId('rebase-rollback-content').getAttribute('data-from-page')).toBe('inventory');
    });
});
