import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import DataGuard from './DataGuard';

const mockSetDialog = vi.hoisted(() => vi.fn());

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => {
            const map: Record<string, string> = {
                'databases.data-guard.related-databases': 'Related Databases',
                'databases.general.close': 'Close',
                'databases.data-guard.protection-mode': 'Protection Mode',
                'databases.data-guard.open-mode': 'Open Mode',
                'databases.data-guard.active-data-guard': 'Active Data Guard',
                'databases.data-guard.enabled': 'Enabled',
                'databases.data-guard.disabled': 'Disabled',
                'databases.data-guard.transport-lag': 'Transport Lag',
                'databases.data-guard.apply-lag': 'Apply Lag',
                'databases.data-guard.ahead-by': 'Ahead by',
                'databases.data-guard.view-related-databases': 'View Related Databases'
            };
            return map[key] || key;
        }
    })
}));

vi.mock('@tlveng/wlm-ds', () => ({
    DsTypography: ({ children, variant, className }: any) => (
        <span data-testid="ds-typography" data-variant={variant} className={className}>
            {children}
        </span>
    )
}));

vi.mock('@netapp/design-system', () => ({
    Button: ({ children, onClick, variant, style }: any) => (
        <button data-testid="button" onClick={onClick} data-variant={variant}>
            {children}
        </button>
    ),
    useDialog: () => ({ setDialog: mockSetDialog })
}));

vi.mock('../../DatabaseOverviewLayout/DBAccordion/DBAccordion', () => ({
    default: ({ heading, toggle, open, content, resourceLoading }: any) => (
        <div data-testid="db-accordion" data-loading={resourceLoading}>
            <div data-testid="accordion-heading" onClick={() => toggle(heading)}>
                {heading}
            </div>
            {open && <div data-testid="accordion-content">{content}</div>}
        </div>
    )
}));

vi.mock('../../../../utils/CommonStyles.module.scss', () => ({
    default: { row: 'row', heading: 'heading', rowSingleColumn: 'rowSingleColumn' }
}));

vi.mock('../../../../utils/consts', () => ({
    OVERVIEW_CARDS_HEADINGS: {
        DATA_GUARD_CONFIGURATIONS: 'Data Guard Configurations'
    }
}));

vi.mock('../../../../utils/resourceUtils', () => ({
    formatDataGuardLag: vi.fn((lag: any, prefix: string) => (lag ? `${lag} ${prefix}` : 'N/A')),
    toSentenceCase: vi.fn((str: string) => (str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : ''))
}));

vi.mock('../../../../common/Dialog/DialogComponent', () => ({
    default: ({ header }: any) => <div data-testid="dialog">{header}</div>
}));

vi.mock('./ReplicatesDialogContent/ReplicatesDialogContent', () => ({
    default: () => <div data-testid="replicates-dialog">Replicates</div>
}));

const primaryResourceDetails = {
    dataguardDetails: {
        isPrimaryNode: true,
        protectionLevel: 'MAXIMUM_PERFORMANCE',
        openMode: 'READ_WRITE',
        isActiveDataguard: true,
        status: { transportLag: '0', applyLag: '0' }
    }
};

const standbyResourceDetails = {
    dataguardDetails: {
        isPrimaryNode: false,
        protectionLevel: 'MAXIMUM_PERFORMANCE',
        openMode: 'READ_ONLY',
        isActiveDataguard: false,
        status: { transportLag: '5s', applyLag: '3s' }
    }
};

describe('DataGuard', () => {
    const defaultProps = {
        handleToggle: vi.fn(),
        openKey: 'Data Guard Configurations',
        resourceDetails: primaryResourceDetails,
        resourceLoading: false
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render accordion with "Data Guard Configurations" heading', () => {
        render(<DataGuard {...defaultProps} />);
        expect(screen.getByText('Data Guard Configurations')).toBeTruthy();
    });

    it('should render Protection Mode label', () => {
        render(<DataGuard {...defaultProps} />);
        expect(screen.getByText('Protection Mode')).toBeTruthy();
    });

    it('should render protection level value in sentence case', () => {
        render(<DataGuard {...defaultProps} />);
        expect(screen.getByText('Maximum_performance')).toBeTruthy();
    });

    it('should render Open Mode label', () => {
        render(<DataGuard {...defaultProps} />);
        expect(screen.getByText('Open mode')).toBeTruthy();
    });

    it('should render Active Data Guard label', () => {
        render(<DataGuard {...defaultProps} />);
        expect(screen.getByText('Active Data Guard')).toBeTruthy();
    });

    it('should render "Enabled" when isActiveDataguard is true', () => {
        render(<DataGuard {...defaultProps} />);
        expect(screen.getByText('Enabled')).toBeTruthy();
    });

    it('should render "Disabled" when isActiveDataguard is false', () => {
        render(<DataGuard {...defaultProps} resourceDetails={standbyResourceDetails} />);
        expect(screen.getByText('Disabled')).toBeTruthy();
    });

    it('should NOT render Transport Lag for primary node', () => {
        render(<DataGuard {...defaultProps} />);
        expect(screen.queryByText('Transport Lag')).toBeNull();
    });

    it('should NOT render Apply Lag for primary node', () => {
        render(<DataGuard {...defaultProps} />);
        expect(screen.queryByText('Apply Lag')).toBeNull();
    });

    it('should render Transport Lag for standby node', () => {
        render(<DataGuard {...defaultProps} resourceDetails={standbyResourceDetails} />);
        expect(screen.getByText('Transport Lag')).toBeTruthy();
    });

    it('should render Apply Lag for standby node', () => {
        render(<DataGuard {...defaultProps} resourceDetails={standbyResourceDetails} />);
        expect(screen.getByText('Apply Lag')).toBeTruthy();
    });

    it('should render View Related Databases button', () => {
        render(<DataGuard {...defaultProps} />);
        expect(screen.getByText('View Related Databases')).toBeTruthy();
    });

    it('should call setDialog when View Related Databases is clicked', () => {
        render(<DataGuard {...defaultProps} />);
        fireEvent.click(screen.getByText('View Related Databases'));
        expect(mockSetDialog).toHaveBeenCalled();
    });

    it('should NOT render content when accordion is closed', () => {
        render(<DataGuard {...defaultProps} openKey="Other" />);
        expect(screen.queryByTestId('accordion-content')).toBeNull();
    });

    it('should pass resourceLoading to accordion', () => {
        render(<DataGuard {...defaultProps} resourceLoading />);
        expect(screen.getByTestId('db-accordion').getAttribute('data-loading')).toBe('true');
    });
});
