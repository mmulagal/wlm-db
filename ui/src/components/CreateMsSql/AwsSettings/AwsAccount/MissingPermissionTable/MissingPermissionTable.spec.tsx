import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import MissingPermissionTable from './MissingPermissionTable';

vi.mock('@netapp/design-system', async () => {
    const actual = await vi.importActual('@netapp/design-system');
    return {
        ...actual,
        useTable: vi.fn(() => ({
            selectionState: {},
            rows: [],
            pageSize: 50
        })),
        Table: ({ tableProps }: any) => <div data-testid="table">Table</div>
    };
});

describe('MissingPermissionTable', () => {
    it('renders without crashing', () => {
        const { container } = render(<MissingPermissionTable content={[]} />);
        expect(container).toBeDefined();
    });

    it('renders with permission data', () => {
        const content = [
            { service: 'ec2', action: 'DescribeVpcs', error: 'Missing permission' },
            { service: 'iam', action: 'GetRole', error: 'Blocked by permission boundary' }
        ];
        render(<MissingPermissionTable content={content} />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });

    it('renders with null content gracefully', () => {
        const { container } = render(<MissingPermissionTable content={null} />);
        expect(container).toBeDefined();
    });

    it('renders with undefined content gracefully', () => {
        const { container } = render(<MissingPermissionTable content={undefined} />);
        expect(container).toBeDefined();
    });

    it('renders the table component', () => {
        render(<MissingPermissionTable content={[]} />);
        expect(screen.getByTestId('table')).toBeTruthy();
    });
});
