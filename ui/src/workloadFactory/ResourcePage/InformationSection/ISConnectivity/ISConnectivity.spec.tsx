import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ISConnectivity from './ISConnectivity';

vi.mock('@netapp/design-system', () => ({
    Typography: ({ children, variant, className }: any) => (
        <span data-testid="typography" data-variant={variant} className={className}>
            {children}
        </span>
    )
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
    default: {
        row: 'row',
        heading: 'heading'
    }
}));

vi.mock('../../../../utils/appConstants', () => ({
    GENERAL: {
        VPC_INFO: 'VPC',
        ACCESS_PROTOCOL: 'Access Protocol'
    }
}));

describe('ISConnectivity', () => {
    const mockResourceDetails = {
        topology: { vpcId: 'vpc-123' },
        storage: { fsxn: { protocol: ['NFS'] } }
    };

    const defaultProps = {
        handleToggle: vi.fn(),
        openKey: 'Connectivity',
        resourceDetails: mockResourceDetails,
        resourceLoading: false
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render accordion with "Connectivity" heading', () => {
        render(<ISConnectivity {...defaultProps} />);
        expect(screen.getByText('Connectivity')).toBeTruthy();
    });

    it('should render VPC label in open accordion', () => {
        render(<ISConnectivity {...defaultProps} />);
        expect(screen.getByText('VPC')).toBeTruthy();
    });

    it('should render VPC ID value', () => {
        render(<ISConnectivity {...defaultProps} />);
        expect(screen.getByText('vpc-123')).toBeTruthy();
    });

    it('should render Access Protocol when protocol is present', () => {
        render(<ISConnectivity {...defaultProps} />);
        expect(screen.getByText('Access Protocol')).toBeTruthy();
        expect(screen.getByText('NFS')).toBeTruthy();
    });

    it('should NOT render Access Protocol when protocol is absent', () => {
        render(
            <ISConnectivity
                {...defaultProps}
                resourceDetails={{ topology: { vpcId: 'vpc-456' }, storage: { fsxn: {} } }}
            />
        );
        expect(screen.queryByText('Access Protocol')).toBeNull();
    });

    it('should NOT render content when accordion is closed', () => {
        render(<ISConnectivity {...defaultProps} openKey="Location" />);
        expect(screen.queryByTestId('accordion-content')).toBeNull();
    });

    it('should call handleToggle when clicked', () => {
        const handleToggle = vi.fn();
        render(<ISConnectivity {...defaultProps} handleToggle={handleToggle} />);
        screen.getByText('Connectivity').click();
        expect(handleToggle).toHaveBeenCalledWith('Connectivity');
    });

    it('should pass resourceLoading to accordion', () => {
        render(<ISConnectivity {...defaultProps} resourceLoading />);
        expect(screen.getByTestId('db-accordion').getAttribute('data-loading')).toBe('true');
    });

    it('should render multiple protocols joined with comma', () => {
        render(
            <ISConnectivity
                {...defaultProps}
                resourceDetails={{ topology: { vpcId: 'vpc-789' }, storage: { fsxn: { protocol: ['NFS', 'CIFS'] } } }}
            />
        );
        expect(screen.getByText('NFS,CIFS')).toBeTruthy();
    });
});
