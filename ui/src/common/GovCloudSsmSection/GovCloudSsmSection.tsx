import { ChangeEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DsTypography, TextField } from '@netapp/design-system';
import classNames from 'classnames';
import { ReactComponent as ExternalLinkIcon } from '@netapp/icons/ic_external_link.svg';
import { ReactComponent as ChevronIcon } from '@netapp/icons/ic_card_arrow_expand.svg';
import { ReactComponent as CopyIcon } from '@netapp/icons/ic_copy.svg';
import { ReactComponent as SuccessIcon } from '../../assets/success.svg';

import CopyToClipboardCommon from '../CopyToClipboard/copyToClipboard';
import { isValidSsmArn } from '../../utils/consts';

import styles from './GovCloudSsmSection.module.scss';

export const SsmArnFormatTooltip = () => {
    const { t } = useTranslation();
    const arnFormat = t('databases.register-flow.ssm-tooltip-arn-format-value');

    return (
        <div className={styles.arnFormatTooltip}>
            <DsTypography variant="Semibold_13">
                {t('databases.register-flow.ssm-tooltip-arn-format-label')}:
            </DsTypography>
            <DsTypography variant="Regular_13">{arnFormat}</DsTypography>
            <CopyToClipboardCommon
                value={arnFormat}
                tooltipTitle={t('databases.register-flow.govcloud-ssm-copied')}
                tooltipMessage
                iconProvided={
                    <DsTypography variant="Regular_13" className={styles.arnCopyLink}>
                        {t('databases.register-flow.govcloud-ssm-copy')}
                    </DsTypography>
                }
            />
        </div>
    );
};

export interface GovCloudSsmSectionProps {
    jsonExample: string;
    arnValue?: string;
    onArnChange?: (e: ChangeEvent<HTMLInputElement>) => void;
    errorMessage?: string;
    isValid?: boolean;
    showRequiredError?: boolean;
    instructionalOnly?: boolean;
    isDisabled?: boolean;
    learnMoreUrl?: string;
    placeholder?: string;
}

const GovCloudSsmSection = ({
    arnValue,
    onArnChange,
    errorMessage,
    isValid,
    showRequiredError = false,
    instructionalOnly = false,
    jsonExample,
    isDisabled = false,
    learnMoreUrl,
    placeholder
}: GovCloudSsmSectionProps) => {
    const { t } = useTranslation();
    const [jsonExpanded, setJsonExpanded] = useState(false);
    const [copied, setCopied] = useState(false);

    const copyToClipboardFallback = (text: string) => {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
    };

    const handleCopyJson = () => {
        const text = t(jsonExample);
        try {
            navigator.clipboard.writeText(text).catch(() => copyToClipboardFallback(text));
        } catch {
            copyToClipboardFallback(text);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    const getFieldError = (): string => {
        if (errorMessage) return errorMessage;
        if (!arnValue && showRequiredError) return t('databases.general.action-required');
        if (arnValue && !isValidSsmArn(arnValue)) return t('databases.register-flow.ssm-parameter-arn-invalid');
        return '';
    };

    const fieldError = instructionalOnly ? '' : getFieldError();
    const showSuccess = !instructionalOnly && isValid && !fieldError;

    const renderJsonToggle = () => (
        <>
            <div
                className={styles.jsonToggle}
                onClick={() => setJsonExpanded(prev => !prev)}
                role="button"
                tabIndex={0}
                aria-expanded={jsonExpanded}
                onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setJsonExpanded(prev => !prev);
                    }
                }}
            >
                <ChevronIcon className={classNames(styles.chevronIcon, { [styles.expanded]: jsonExpanded })} />
                <DsTypography variant="Regular_14">
                    {t('databases.register-flow.govcloud-ssm-expected-json')}
                </DsTypography>
            </div>

            {jsonExpanded && (
                <div className={styles.jsonSection}>
                    <div className={styles.jsonBlock}>
                        <pre>{t(jsonExample)}</pre>
                        <div
                            className={styles.copyButton}
                            onClick={handleCopyJson}
                            onKeyDown={e => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    handleCopyJson();
                                }
                            }}
                            role="button"
                            tabIndex={0}
                            aria-label={t('databases.register-flow.govcloud-ssm-copy')}
                        >
                            {copied ? (
                                <DsTypography variant="Regular_13" className={styles.copiedText}>
                                    {t('databases.register-flow.govcloud-ssm-copied')}
                                </DsTypography>
                            ) : (
                                <CopyIcon className={styles.copyIcon} />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );

    if (instructionalOnly) {
        return (
            <div className={styles.govCloudSsmSectionInstructional}>
                <DsTypography variant="Regular_14">
                    {t('databases.register-flow.govcloud-ssm-step1-label')}
                </DsTypography>

                {renderJsonToggle()}

                {learnMoreUrl && (
                    <a href={learnMoreUrl} target="_blank" rel="noopener noreferrer" className={styles.learnMoreLink}>
                        {t('databases.register-flow.govcloud-ssm-learn-more')}
                        <ExternalLinkIcon className={styles.externalLinkIcon} />
                    </a>
                )}
            </div>
        );
    }

    return (
        <div className={styles.govCloudSsmSection}>
            {/* Step 1: Create a secret */}
            <div className={styles.step}>
                <div className={styles.stepNumber}>
                    <DsTypography variant="Semibold_14">1</DsTypography>
                    <div className={styles.stepPipe} />
                </div>
                <div className={styles.stepContent}>
                    <DsTypography variant="Regular_14">
                        {t('databases.register-flow.govcloud-ssm-step1-label')}
                    </DsTypography>

                    {renderJsonToggle()}
                </div>
            </div>

            {/* Step 2: Provide ARN */}
            <div className={styles.step}>
                <div className={styles.stepNumber}>
                    <DsTypography variant="Semibold_14">2</DsTypography>
                    <div className={styles.stepPipe} />
                </div>
                <div className={styles.stepContent}>
                    <DsTypography variant="Regular_14">
                        {t('databases.register-flow.govcloud-ssm-step2-label')}
                    </DsTypography>

                    <div className={styles.arnFieldContainer}>
                        <TextField
                            label={t('databases.register-flow.govcloud-ssm-endpoint-label')}
                            info={<SsmArnFormatTooltip />}
                            infoProps={{
                                interactive: true,
                                delayHide: 300,
                                placement: 'right',
                                isAppendedToBody: true
                            }}
                            value={arnValue || ''}
                            onChange={onArnChange}
                            placeholder={placeholder || t('databases.register-flow.ssm-parameter-arn-placeholder')}
                            error={fieldError}
                            isDisabled={isDisabled}
                        />
                    </div>
                </div>
            </div>

            {showSuccess && (
                <div className={styles.successMessage}>
                    <SuccessIcon />
                    <DsTypography variant="Regular_14" className={styles.successText}>
                        {t('databases.register-flow.govcloud-ssm-arn-valid')}
                    </DsTypography>
                </div>
            )}

            {/* Learn more link */}
            {learnMoreUrl && (
                <a href={learnMoreUrl} target="_blank" rel="noopener noreferrer" className={styles.learnMoreLink}>
                    {t('databases.register-flow.govcloud-ssm-learn-more')}
                    <ExternalLinkIcon className={styles.externalLinkIcon} />
                </a>
            )}
        </div>
    );
};

export default GovCloudSsmSection;
