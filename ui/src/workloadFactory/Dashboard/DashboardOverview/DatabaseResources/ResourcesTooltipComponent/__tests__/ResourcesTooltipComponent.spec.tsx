import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ResourcesTooltipComponent from '../ResourcesTooltipComponent';
import { DBType } from '../../../../../../utils/consts';

vi.mock('@tlveng/wlm-ds', () => ({
    DsTypography: ({ children, variant }: any) => <span data-testid={`typography-${variant}`}>{children}</span>
}));

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key
    })
}));

vi.mock('../../../../../common/SeparatorComponent/SeparatorComponent', () => ({
    default: () => <hr data-testid="separator" />
}));

vi.mock('./ResourcesTooltipComponent.module.scss', () => ({
    default: {
        resourceTooltip: 'resourceTooltip',
        row: 'row'
    }
}));

describe('ResourcesTooltipComponent', () => {
    const mssqlData = { totalHosts: 5, totalInstances: 10, totalDatabases: 20 };

    it('renders MSSQL tooltip with hosts, instances, databases', () => {
        render(<ResourcesTooltipComponent type={DBType.MSSQL} data={mssqlData} />);
        expect(screen.getByText('databases.dashboard.hosts')).toBeTruthy();
        expect(screen.getByText('databases.dashboard.instances-caps')).toBeTruthy();
        expect(screen.getByText('databases.dashboard.databases')).toBeTruthy();
        expect(screen.getByText('5')).toBeTruthy();
        expect(screen.getByText('10')).toBeTruthy();
        expect(screen.getByText('20')).toBeTruthy();
    });

    it('renders MSSQL tooltip with 0 defaults when data is empty', () => {
        render(<ResourcesTooltipComponent type={DBType.MSSQL} data={{}} />);
        expect(screen.getAllByText('0').length).toBe(3);
    });

    it('renders Oracle tooltip with hosts, databases, pdbs', () => {
        render(<ResourcesTooltipComponent type={DBType.ORACLE} data={mssqlData} />);
        expect(screen.getByText('databases.dashboard.hosts')).toBeTruthy();
        expect(screen.getByText('databases.dashboard.databases')).toBeTruthy();
        expect(screen.getByText('databases.dashboard.pdbs')).toBeTruthy();
    });

    it('renders Oracle tooltip with 0 defaults when data is empty', () => {
        render(<ResourcesTooltipComponent type={DBType.ORACLE} data={{}} />);
        expect(screen.getAllByText('0').length).toBe(3);
    });

    it('renders PostgreSQL tooltip with hosts, instances, databases', () => {
        render(<ResourcesTooltipComponent type={DBType.POSTGRESQL} data={mssqlData} />);
        expect(screen.getByText('databases.dashboard.hosts')).toBeTruthy();
        expect(screen.getByText('databases.dashboard.instances-caps')).toBeTruthy();
        expect(screen.getByText('databases.dashboard.databases')).toBeTruthy();
    });

    it('renders fallback for unknown type', () => {
        render(<ResourcesTooltipComponent type="UNKNOWN" data={mssqlData} />);
        expect(screen.getByText('databases.general.not-available-table-columns')).toBeTruthy();
    });

    it('renders separators between rows for MSSQL', () => {
        const { container } = render(<ResourcesTooltipComponent type={DBType.MSSQL} data={mssqlData} />);
        const mockedSeparators = screen.queryAllByTestId('separator');
        const realSeparators = container.querySelectorAll('[style*="border-top"]');
        expect(mockedSeparators.length === 2 || realSeparators.length === 2).toBeTruthy();
    });

    it('renders separators between rows for Oracle', () => {
        const { container } = render(<ResourcesTooltipComponent type={DBType.ORACLE} data={mssqlData} />);
        const mockedSeparators = screen.queryAllByTestId('separator');
        const realSeparators = container.querySelectorAll('[style*="border-top"]');
        expect(mockedSeparators.length === 2 || realSeparators.length === 2).toBeTruthy();
    });
});
