import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { getInstanceColDefs } from './InstanceInformationUtils';
import { INSTANCE_INFORMATION_DETAIL } from '../../../../utils/consts';

vi.mock('@netapp/design-system', () => ({
    DsTypography: ({ children }: any) => <span>{children}</span>,
    DsFlashingDotsLoader: () => <span data-testid="loader" />,
    TooltipInfo: ({ children }: any) => <span data-testid="tooltip-info">{children}</span>
}));

const t = (key: string) => (key === 'databases.general.not-available' ? 'n/a' : key);

const getValueRenderCell = () => {
    const columns = getInstanceColDefs({
        loading: false,
        noOfInstances: 1,
        storageSavingsLoading: false,
        snapshotLoading: false,
        savingsCalculatorFrom: 'Auto_EBS',
        styles: { tooltips: 'tooltips' },
        t: t as any
    });
    return columns.find(col => col.id === '2')!.renderCell as any;
};

describe('getInstanceColDefs - SQL Edition value cell', () => {
    it('does not show the permission tooltip when a real edition value is known', () => {
        const renderCell = getValueRenderCell();
        const { queryByTestId, getByText } = render(
            <>
                {renderCell(null, {
                    detailKey: INSTANCE_INFORMATION_DETAIL.SQL_EDITION,
                    value: 'Enterprise Edition: Core-based Licensing',
                    showSqlLicensePermissionTooltip: true
                })}
            </>
        );
        expect(queryByTestId('tooltip-info')).toBeNull();
        expect(getByText('Enterprise Edition: Core-based Licensing')).toBeTruthy();
    });

    it('shows the permission tooltip when no edition value is available', () => {
        const renderCell = getValueRenderCell();
        const { getByTestId } = render(
            <>
                {renderCell(null, {
                    detailKey: INSTANCE_INFORMATION_DETAIL.SQL_EDITION,
                    value: 'n/a',
                    showSqlLicensePermissionTooltip: true
                })}
            </>
        );
        expect(getByTestId('tooltip-info')).toBeTruthy();
    });
});
