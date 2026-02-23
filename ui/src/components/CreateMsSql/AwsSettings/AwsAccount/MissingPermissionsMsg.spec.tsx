import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import MissingPermissionsMsg from './MissingPermissionsMsg';

const mockSetDialog = vi.fn();

vi.mock('@netapp/design-system', async () => {
    const actual = await vi.importActual('@netapp/design-system');
    return {
        ...actual,
        useDialog: () => ({ setDialog: mockSetDialog })
    };
});

vi.mock('../../../../common/Dialog/DialogComponent', () => ({
    default: ({ header }: any) => <div data-testid="dialog">{header}</div>
}));

vi.mock('../../../../common/ViewDialog/ViewDialog', () => ({
    default: ({ data }: any) => <div data-testid="view-dialog">{data}</div>
}));

vi.mock('./MissingPermissionTable/MissingPermissionTable', () => ({
    default: ({ content }: any) => <div data-testid="missing-permission-table">Table</div>
}));

const makeStore = (overrides: any = {}) =>
    configureStore({
        reducer: {
            mssql: () => ({
                getPolicies: {
                    policiesList: overrides.policiesList ?? { packages: [] }
                }
            })
        }
    });

describe('MissingPermissionsMsg', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const missingPermissionData = {
        implicitlyDenied: [
            { service: 'ec2', action: 'DescribeVpcs' },
            { service: 'iam', action: 'GetRole' }
        ],
        explicitlyDenied: []
    };

    const blockedPermissionData = {
        implicitlyDenied: [{ service: 'ec2', action: 'DescribeVpcs' }],
        explicitlyDenied: [{ service: 'iam', action: 'GetRole' }]
    };

    it('renders without crashing', () => {
        const store = makeStore();
        const { container } = render(
            <Provider store={store}>
                <MissingPermissionsMsg permissionData={missingPermissionData} />
            </Provider>
        );
        expect(container).toBeDefined();
    });

    it('renders two buttons', () => {
        const store = makeStore();
        render(
            <Provider store={store}>
                <MissingPermissionsMsg permissionData={missingPermissionData} />
            </Provider>
        );
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThanOrEqual(2);
    });

    it('calls setDialog when first button (blocked) is clicked', () => {
        const store = makeStore();
        render(
            <Provider store={store}>
                <MissingPermissionsMsg permissionData={missingPermissionData} />
            </Provider>
        );
        const buttons = screen.getAllByRole('button');
        fireEvent.click(buttons[0]);
        expect(mockSetDialog).toHaveBeenCalledTimes(1);
    });

    it('calls setDialog when second button (operate) is clicked', () => {
        const store = makeStore();
        render(
            <Provider store={store}>
                <MissingPermissionsMsg permissionData={missingPermissionData} />
            </Provider>
        );
        const buttons = screen.getAllByRole('button');
        fireEvent.click(buttons[1]);
        expect(mockSetDialog).toHaveBeenCalledTimes(1);
    });

    it('handles permissionData with both implicitlyDenied and explicitlyDenied', () => {
        const store = makeStore();
        const { container } = render(
            <Provider store={store}>
                <MissingPermissionsMsg permissionData={blockedPermissionData} />
            </Provider>
        );
        expect(container).toBeDefined();
    });

    it('handles null permissionData gracefully', () => {
        const store = makeStore();
        const { container } = render(
            <Provider store={store}>
                <MissingPermissionsMsg permissionData={null} />
            </Provider>
        );
        expect(container).toBeDefined();
    });

    it('renders with policiesList packages and calls setDialog for blocked', () => {
        const store = makeStore({
            policiesList: {
                packages: [
                    {
                        name: 'FSxN/View',
                        permissions: {
                            Version: '2012-10-17',
                            Statement: [{ Effect: 'Allow', Action: ['ec2:Describe*'] }]
                        }
                    },
                    {
                        name: 'FSxN/Operate',
                        permissions: { Version: '2012-10-17', Statement: [{ Effect: 'Allow', Action: ['fsx:*'] }] }
                    },
                    {
                        name: 'FSxN/DatabaseHostCreation',
                        permissions: { Version: '2012-10-17', Statement: [] }
                    }
                ]
            }
        });
        render(
            <Provider store={store}>
                <MissingPermissionsMsg permissionData={missingPermissionData} />
            </Provider>
        );
        const buttons = screen.getAllByRole('button');
        fireEvent.click(buttons[0]);
        expect(mockSetDialog).toHaveBeenCalledTimes(1);
    });

    it('calls setDialog for operate type with packages', () => {
        const store = makeStore({
            policiesList: {
                packages: [
                    {
                        name: 'FSxN/View',
                        permissions: { Version: '2012-10-17', Statement: [] }
                    },
                    {
                        name: 'FSxN/Operate',
                        permissions: { Version: '2012-10-17', Statement: [] }
                    }
                ]
            }
        });
        render(
            <Provider store={store}>
                <MissingPermissionsMsg permissionData={missingPermissionData} />
            </Provider>
        );
        const buttons = screen.getAllByRole('button');
        fireEvent.click(buttons[1]);
        expect(mockSetDialog).toHaveBeenCalledTimes(1);
    });

    it('handles permissionData with only explicitlyDenied', () => {
        const store = makeStore();
        const onlyBlocked = {
            implicitlyDenied: [],
            explicitlyDenied: [{ service: 'iam', action: 'GetRole' }]
        };
        const { container } = render(
            <Provider store={store}>
                <MissingPermissionsMsg permissionData={onlyBlocked} />
            </Provider>
        );
        expect(container).toBeDefined();
    });
});
