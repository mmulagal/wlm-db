import { ChangeEvent, ReactNode } from 'react';
import { DsTextField } from '@tlveng/wlm-ds';
import { useTranslation } from 'react-i18next';
import classNames from 'classnames';
import { isValidSsmArn } from '../../utils/consts';
import styles from './SsmParameterArnField.module.scss';
import SsmArnTooltipContent from '../SsmArnTooltipContent/SsmArnTooltipContent';

export interface SsmParameterArnFieldProps {
    value: string;
    onChange: (value: string) => void;
    onBlur?: () => void;
    isDisabled?: boolean;
    className?: string;
    /** Override the default label from en.json */
    label?: string;
    /** Override the default placeholder from en.json */
    placeholder?: string;
    /** Show "action required" when the field is empty and this is true */
    showRequiredError?: boolean;
    /** External error message (e.g. auth failure) that takes priority over validation */
    externalError?: string;
    /** Skip the built-in ARN format validation (caller handles it) */
    skipValidation?: boolean;
    /** i18n key for the context-specific tooltip text shown at top of tooltip */
    tooltipKey?: string;
    /** i18n key for the JSON example shown in the tooltip */
    tooltipJsonKey?: string;
    /** Custom tooltip content (takes priority over auto-generated tooltip) */
    tooltipContent?: ReactNode;
}

const SsmParameterArnField = ({
    value,
    onChange,
    onBlur,
    isDisabled = false,
    className,
    label,
    placeholder,
    showRequiredError = false,
    externalError,
    skipValidation = false,
    tooltipKey = 'databases.register-flow.ssm-parameter-tooltip-fsx',
    tooltipJsonKey = 'databases.register-flow.ssm-tooltip-json-fsx',
    tooltipContent
}: SsmParameterArnFieldProps) => {
    const { t } = useTranslation();

    const resolvedLabel = label ?? t('databases.register-flow.ssm-parameter-arn-label');
    const resolvedPlaceholder = placeholder ?? t('databases.register-flow.ssm-parameter-arn-placeholder');

    const getErrorMessage = (): string => {
        if (externalError) return externalError;
        if (!value && showRequiredError) return t('databases.general.action-required');
        if (!skipValidation && value && !isValidSsmArn(value)) {
            return t('databases.register-flow.ssm-parameter-arn-invalid');
        }
        return '';
    };

    const errorMessage = getErrorMessage();

    const resolvedTooltip = tooltipContent || (
        <SsmArnTooltipContent tooltipKey={tooltipKey} tooltipJsonKey={tooltipJsonKey} />
    );

    return (
        <DsTextField
            title={resolvedLabel}
            value={value}
            onChange={(event?: ChangeEvent<HTMLInputElement>) => onChange(event?.target?.value || '')}
            onBlur={onBlur}
            placeholder={resolvedPlaceholder}
            className={classNames(styles.ssmArnField, className)}
            isDisabled={isDisabled}
            tooltip={{ children: resolvedTooltip }}
            {...(errorMessage ? { message: { type: 'error', value: errorMessage } } : {})}
        />
    );
};

export default SsmParameterArnField;
