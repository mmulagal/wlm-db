import { ChangeEvent } from 'react';
import { DsTextField } from '@tlveng/wlm-ds';
import { useTranslation } from 'react-i18next';
import classNames from 'classnames';
import { isValidSsmArn } from '../../utils/consts';
import styles from './SsmParameterArnField.module.scss';

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
    skipValidation = false
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

    return (
        <DsTextField
            title={resolvedLabel}
            value={value}
            onChange={(event?: ChangeEvent<HTMLInputElement>) => onChange(event?.target?.value || '')}
            onBlur={onBlur}
            placeholder={resolvedPlaceholder}
            className={classNames(styles.ssmArnField, className)}
            isDisabled={isDisabled}
            {...(errorMessage ? { message: { type: 'error', value: errorMessage } } : {})}
        />
    );
};

export default SsmParameterArnField;
