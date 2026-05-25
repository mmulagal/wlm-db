import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import SsmParameterArnField from './SsmParameterArnField';

vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string) => key
    })
}));

vi.mock('@tlveng/wlm-ds', () => ({
    DsTextField: ({ title, value, onChange, onBlur, placeholder, className, isDisabled, message }: any) => (
        <div data-testid="ds-text-field" className={className}>
            <label>{title}</label>
            <input
                data-testid="ssm-arn-input"
                value={value}
                onChange={onChange}
                onBlur={onBlur}
                placeholder={placeholder}
                disabled={isDisabled}
            />
            {message && (
                <span data-testid="error-message" data-type={message.type}>
                    {message.value}
                </span>
            )}
        </div>
    )
}));

vi.mock('../../utils/consts', () => ({
    isValidSsmArn: (arn: string) => /^arn:aws(-us-gov)?:ssm:[^:]+:\d{12}:parameter\/netapp\/wlmdb\/.+$/.test(arn)
}));

describe('SsmParameterArnField', () => {
    const defaultProps = {
        value: '',
        onChange: vi.fn()
    };

    it('should be a defined component', () => {
        expect(SsmParameterArnField).toBeDefined();
    });

    it('should render with default i18n label and placeholder', () => {
        const { getByText, getByTestId } = render(<SsmParameterArnField {...defaultProps} />);
        expect(getByText('databases.register-flow.ssm-parameter-arn-label')).toBeTruthy();
        expect(getByTestId('ssm-arn-input').getAttribute('placeholder')).toBe(
            'databases.register-flow.ssm-parameter-arn-placeholder'
        );
    });

    it('should render with custom label and placeholder', () => {
        const { getByText, getByTestId } = render(
            <SsmParameterArnField {...defaultProps} label="Custom Label" placeholder="Custom Placeholder" />
        );
        expect(getByText('Custom Label')).toBeTruthy();
        expect(getByTestId('ssm-arn-input').getAttribute('placeholder')).toBe('Custom Placeholder');
    });

    it('should call onChange with value when input changes', () => {
        const onChange = vi.fn();
        const { getByTestId } = render(<SsmParameterArnField {...defaultProps} onChange={onChange} />);
        fireEvent.change(getByTestId('ssm-arn-input'), {
            target: { value: 'arn:aws:ssm:us-east-1:123456789012:parameter/netapp/wlmdb/test' }
        });
        expect(onChange).toHaveBeenCalled();
    });

    it('should show validation error for invalid ARN format', () => {
        const { getByTestId } = render(<SsmParameterArnField {...defaultProps} value="invalid-arn" />);
        const errorEl = getByTestId('error-message');
        expect(errorEl.textContent).toBe('databases.register-flow.ssm-parameter-arn-invalid');
        expect(errorEl.dataset.type).toBe('error');
    });

    it('should not show validation error for valid ARN', () => {
        const { queryByTestId } = render(
            <SsmParameterArnField
                {...defaultProps}
                value="arn:aws-us-gov:ssm:us-gov-west-1:123456789012:parameter/netapp/wlmdb/creds"
            />
        );
        expect(queryByTestId('error-message')).toBeNull();
    });

    it('should not show validation error for empty value (no showRequiredError)', () => {
        const { queryByTestId } = render(<SsmParameterArnField {...defaultProps} value="" />);
        expect(queryByTestId('error-message')).toBeNull();
    });

    it('should show required error when value is empty and showRequiredError is true', () => {
        const { getByTestId } = render(<SsmParameterArnField {...defaultProps} value="" showRequiredError />);
        const errorEl = getByTestId('error-message');
        expect(errorEl.textContent).toBe('databases.general.action-required');
    });

    it('should show externalError over validation error', () => {
        const { getByTestId } = render(
            <SsmParameterArnField {...defaultProps} value="invalid-arn" externalError="Auth failed" />
        );
        expect(getByTestId('error-message').textContent).toBe('Auth failed');
    });

    it('should show externalError over required error', () => {
        const { getByTestId } = render(
            <SsmParameterArnField {...defaultProps} value="" showRequiredError externalError="Server error" />
        );
        expect(getByTestId('error-message').textContent).toBe('Server error');
    });

    it('should skip validation when skipValidation is true', () => {
        const { queryByTestId } = render(<SsmParameterArnField {...defaultProps} value="invalid-arn" skipValidation />);
        expect(queryByTestId('error-message')).toBeNull();
    });

    it('should render disabled when isDisabled is true', () => {
        const { getByTestId } = render(<SsmParameterArnField {...defaultProps} isDisabled />);
        expect(getByTestId('ssm-arn-input').hasAttribute('disabled')).toBe(true);
    });

    it('should not be disabled by default', () => {
        const { getByTestId } = render(<SsmParameterArnField {...defaultProps} />);
        expect(getByTestId('ssm-arn-input').hasAttribute('disabled')).toBe(false);
    });

    it('should apply custom className', () => {
        const { getByTestId } = render(<SsmParameterArnField {...defaultProps} className="my-custom" />);
        expect(getByTestId('ds-text-field').className).toContain('my-custom');
    });

    it('should call onBlur when input loses focus', () => {
        const onBlur = vi.fn();
        const { getByTestId } = render(<SsmParameterArnField {...defaultProps} onBlur={onBlur} />);
        fireEvent.blur(getByTestId('ssm-arn-input'));
        expect(onBlur).toHaveBeenCalledTimes(1);
    });

    it('should accept valid commercial ARN', () => {
        const { queryByTestId } = render(
            <SsmParameterArnField
                {...defaultProps}
                value="arn:aws:ssm:us-east-1:123456789012:parameter/netapp/wlmdb/creds"
            />
        );
        expect(queryByTestId('error-message')).toBeNull();
    });

    it('should accept valid GovCloud ARN', () => {
        const { queryByTestId } = render(
            <SsmParameterArnField
                {...defaultProps}
                value="arn:aws-us-gov:ssm:us-gov-east-1:123456789012:parameter/netapp/wlmdb/password"
            />
        );
        expect(queryByTestId('error-message')).toBeNull();
    });
});
