import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import BarComponent from '../BarComponent';

vi.mock('@netapp/design-system', () => ({
    DsFlashingDotsLoader: () => <div data-testid="flashing-dots-loader" />,
    DsTypography: ({ children, variant, className, style }: any) => (
        <span data-testid={`typography-${variant}`} className={className} style={style}>
            {children}
        </span>
    ),
    TooltipInfo: ({ children }: any) => <div data-testid="tooltip-info">{children}</div>
}));

vi.mock('../../../../common/ProgressBar/ProgressBar', () => ({
    default: ({ value, color }: any) => <div data-testid="progress-bar" data-value={value} data-color={color} />
}));

vi.mock('../../../../common/Tag/Tag', () => ({
    default: ({ text }: any) => <div data-testid="tag">{text}</div>
}));

vi.mock('../../../../utils/consts', () => ({
    CONFIG_STATES: {
        DISMISSED: 'DISMISSED',
        POSTPONED: 'POSTPONED'
    },
    CONFIG_STATES_UI: {
        DISMISSED: 'Dismissed',
        POSTPONED: 'Postponed'
    }
}));

vi.mock('../../../../assets/warning.svg', () => ({
    ReactComponent: ({ ...props }: any) => <svg data-testid="warning-icon" {...props} />
}));

vi.mock('../../../../utils/CommonStyles.module.scss', () => ({ default: { notAvailable: 'notAvailable' } }));
vi.mock('./BarComponent.module.scss', () => ({
    default: {
        barComponent: 'barComponent',
        rightSection: 'rightSection',
        topSection: 'topSection',
        textWithLoading: 'textWithLoading',
        optimizeText: 'optimizeText',
        disableOptimize: 'disableOptimize',
        bottomSection: 'bottomSection',
        getWellBar: 'getWellBar',
        progressBar: 'progressBar',
        bottomTextSection: 'bottomTextSection',
        bottomRightSection: 'bottomRightSection',
        severity: 'severity',
        circle: 'circle',
        error: 'error',
        warning: 'warning',
        naCheck: 'naCheck',
        tagContainer: 'tagContainer',
        tagContainerDisabled: 'tagContainerDisabled',
        progress: 'progress',
        leftCurveBar: 'leftCurveBar',
        rightCurveBar: 'rightCurveBar',
        separator: 'separator'
    }
}));

describe('BarComponent', () => {
    const defaultProps = {
        color: '#ff0000',
        headingText: 'Test Heading',
        percentage: 50,
        severity: 'Critical',
        type: 'Storage'
    };

    it('renders heading text', () => {
        render(<BarComponent {...defaultProps} />);
        expect(screen.getByText('Test Heading')).toBeTruthy();
    });

    it('shows loading spinner when loading is true', () => {
        render(<BarComponent {...defaultProps} loading />);
        expect(screen.getByTestId('flashing-dots-loader')).toBeTruthy();
    });

    it('does not show spinner when loading is false', () => {
        render(<BarComponent {...defaultProps} loading={false} />);
        expect(screen.queryByTestId('flashing-dots-loader')).toBeNull();
    });

    it('renders percentage text when not disabled and no textMessage', () => {
        render(<BarComponent {...defaultProps} percentage={75} />);
        expect(screen.getByText('75%')).toBeTruthy();
    });

    it('renders textMessage when provided', () => {
        render(<BarComponent {...defaultProps} textMessage="Dismissed" />);
        expect(screen.getAllByText('Dismissed').length).toBeGreaterThan(0);
    });

    it('renders ProgressBar when from is not dashboard', () => {
        render(<BarComponent {...defaultProps} />);
        expect(screen.getByTestId('progress-bar')).toBeTruthy();
    });

    it('renders custom progress bar when from is dashboard', () => {
        render(<BarComponent {...defaultProps} from="dashboard" percentage={50} optimizePercentage={20} />);
        expect(screen.queryByTestId('progress-bar')).toBeNull();
    });

    it('renders tooltip when tooltipMessage is provided', () => {
        render(<BarComponent {...defaultProps} tooltipMessage="Some tooltip" />);
        expect(screen.getByTestId('tooltip-info')).toBeTruthy();
    });

    it('renders tag component with type', () => {
        render(<BarComponent {...defaultProps} type="Storage" />);
        expect(screen.getByTestId('tag')).toBeTruthy();
    });

    it('renders severity Critical with error class', () => {
        render(<BarComponent {...defaultProps} severity="Critical" />);
        expect(screen.getByText('Critical')).toBeTruthy();
    });

    it('renders severity warning case', () => {
        render(<BarComponent {...defaultProps} severity="Warning" />);
        expect(screen.getByText('Warning')).toBeTruthy();
    });

    it('renders when isDisabled is true', () => {
        render(<BarComponent {...defaultProps} isDisabled />);
        expect(screen.getByText('Test Heading')).toBeTruthy();
    });

    it('renders from dashboard with percentage 100', () => {
        render(<BarComponent {...defaultProps} from="dashboard" percentage={100} optimizePercentage={0} />);
        expect(screen.getByText('Test Heading')).toBeTruthy();
    });

    it('renders from dashboard with both percentages as 0', () => {
        render(<BarComponent {...defaultProps} from="dashboard" percentage={0} optimizePercentage={0} />);
        expect(screen.getByText('Test Heading')).toBeTruthy();
    });

    it('renders from dashboard with only percentage non zero', () => {
        render(<BarComponent {...defaultProps} from="dashboard" percentage={30} optimizePercentage={0} />);
        expect(screen.getByText('Test Heading')).toBeTruthy();
    });

    it('renders from dashboard with only optimizePercentage non zero', () => {
        render(<BarComponent {...defaultProps} from="dashboard" percentage={0} optimizePercentage={30} />);
        expect(screen.getByText('Test Heading')).toBeTruthy();
    });

    it('renders bottomText when provided', () => {
        render(<BarComponent {...defaultProps} bottomText="Some bottom text" />);
        expect(screen.getByText('Some bottom text')).toBeTruthy();
    });

    it('renders beforeOutOf and afterOutOf outside dashboard', () => {
        render(<BarComponent {...defaultProps} beforeOutOf={5} afterOutOf={10} />);
        expect(screen.getByText(/5 out of 10/)).toBeTruthy();
    });

    it('renders only beforeOutOf inside dashboard', () => {
        render(<BarComponent {...defaultProps} from="dashboard" beforeOutOf={5} />);
        expect(screen.getByText('5')).toBeTruthy();
    });

    it('renders with isDisabled and textMessage', () => {
        render(<BarComponent {...defaultProps} isDisabled textMessage="N/A" />);
        expect(screen.getAllByText('N/A').length).toBeGreaterThan(0);
    });

    it('renders with custom textMessageVariant', () => {
        render(<BarComponent {...defaultProps} textMessage="Postponed" textMessageVariant="Semibold_14" />);
        expect(screen.getAllByText('Postponed').length).toBeGreaterThan(0);
    });

    it('renders dismissed message in bottomText section', () => {
        render(<BarComponent {...defaultProps} textMessage="Dismissed" />);
        // Should see the "This configuration analysis is dismissed" text
        expect(screen.getByText(/This configuration analysis is/)).toBeTruthy();
    });

    it('renders postponed message in bottomText section', () => {
        render(<BarComponent {...defaultProps} textMessage="Postponed" />);
        expect(screen.getByText(/This configuration analysis is/)).toBeTruthy();
    });

    it('renders with width prop', () => {
        render(<BarComponent {...defaultProps} width="200px" />);
        expect(screen.getByText('Test Heading')).toBeTruthy();
    });
});
