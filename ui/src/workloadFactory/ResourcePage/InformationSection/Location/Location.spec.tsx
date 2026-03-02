import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import Location from './Location';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => {
            const map: Record<string, string> = {
                'databases.resource-overview.availability-zone': 'Availability Zone',
                'databases.resource-overview.availability-zone-1': 'Availability Zone 1',
                'databases.resource-overview.subnet': 'Subnet',
                'databases.resource-overview.subnet-1': 'Subnet 1'
            };
            return map[key] || key;
        }
    })
}));

vi.mock('@netapp/design-system', () => ({
    Typography: ({ children, variant, className, title }: any) => (
        <span data-testid="typography" data-variant={variant} className={className} title={title}>
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
        heading: 'heading',
        valueCSS: 'valueCSS'
    }
}));

vi.mock('../../../../utils/appConstants', () => ({
    GENERAL: {
        AWS_ACC_INFO: 'AWS Account',
        REGION_INFO: 'Region',
        AZ_INFO_2: 'AZ 2',
        SUBNET_INFO_2: 'Subnet 2'
    }
}));

const baseResourceDetails = {
    topology: {
        awsAccount: '123456789',
        region: 'us-east-1',
        ec2Details: [
            { availabilityZone: 'us-east-1a', subnetId: 'subnet-001' },
            { availabilityZone: 'us-east-1b', subnetId: 'subnet-002' }
        ]
    }
};

describe('Location', () => {
    const defaultProps = {
        handleToggle: vi.fn(),
        openKey: 'Location',
        resourceDetails: baseResourceDetails,
        resourceLoading: false
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render accordion with "Location" heading', () => {
        render(<Location {...defaultProps} />);
        expect(screen.getByText('Location')).toBeTruthy();
    });

    it('should render AWS Account label', () => {
        render(<Location {...defaultProps} />);
        expect(screen.getByText('AWS Account')).toBeTruthy();
    });

    it('should render AWS account value', () => {
        render(<Location {...defaultProps} />);
        expect(screen.getByText('123456789')).toBeTruthy();
    });

    it('should render Region label', () => {
        render(<Location {...defaultProps} />);
        expect(screen.getByText('Region')).toBeTruthy();
    });

    it('should render region value', () => {
        render(<Location {...defaultProps} />);
        expect(screen.getByText('us-east-1')).toBeTruthy();
    });

    it('should render Availability Zone when ec2Details has entries', () => {
        render(<Location {...defaultProps} />);
        expect(screen.getByText('Availability Zone 1')).toBeTruthy();
    });

    it('should render first AZ value', () => {
        render(<Location {...defaultProps} />);
        expect(screen.getByText('us-east-1a')).toBeTruthy();
    });

    it('should render Subnet 1 label', () => {
        render(<Location {...defaultProps} />);
        expect(screen.getByText('Subnet 1')).toBeTruthy();
    });

    it('should render second AZ when ec2Details has >1 entries', () => {
        render(<Location {...defaultProps} />);
        expect(screen.getByText('AZ 2')).toBeTruthy();
        expect(screen.getByText('us-east-1b')).toBeTruthy();
    });

    it('should render second subnet when ec2Details has >1 entries', () => {
        render(<Location {...defaultProps} />);
        expect(screen.getByText('Subnet 2')).toBeTruthy();
        expect(screen.getByText('subnet-002')).toBeTruthy();
    });

    it('should render single AZ label when only one ec2Detail', () => {
        render(
            <Location
                {...defaultProps}
                resourceDetails={{
                    topology: {
                        awsAccount: '111',
                        region: 'us-west-2',
                        ec2Details: [{ availabilityZone: 'us-west-2a', subnetId: 'subnet-single' }]
                    }
                }}
            />
        );
        expect(screen.getByText('Availability Zone')).toBeTruthy();
        expect(screen.getByText('Subnet')).toBeTruthy();
        expect(screen.queryByText('AZ 2')).toBeNull();
    });

    it('should NOT render AZ section when ec2Details is empty', () => {
        render(
            <Location {...defaultProps} resourceDetails={{ topology: { awsAccount: '222', region: 'eu-west-1' } }} />
        );
        expect(screen.queryByText('Availability Zone')).toBeNull();
    });

    it('should NOT render content when accordion is closed', () => {
        render(<Location {...defaultProps} openKey="Other" />);
        expect(screen.queryByTestId('accordion-content')).toBeNull();
    });

    it('should call handleToggle on click', () => {
        const handleToggle = vi.fn();
        render(<Location {...defaultProps} handleToggle={handleToggle} />);
        screen.getByText('Location').click();
        expect(handleToggle).toHaveBeenCalledWith('Location');
    });

    it('should pass resourceLoading to accordion', () => {
        render(<Location {...defaultProps} resourceLoading />);
        expect(screen.getByTestId('db-accordion').getAttribute('data-loading')).toBe('true');
    });
});
