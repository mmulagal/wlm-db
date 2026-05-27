import { DsTypography } from '@tlveng/wlm-ds';
import { useTranslation } from 'react-i18next';
import CommonStyles from '../../utils/CommonStyles.module.scss';

export interface SsmArnTooltipContentProps {
    tooltipKey: string;
    tooltipJsonKey: string;
}

const SsmArnTooltipContent = ({ tooltipKey, tooltipJsonKey }: SsmArnTooltipContentProps) => {
    const { t } = useTranslation();

    return (
        <div className={CommonStyles.ssmTooltip}>
            <DsTypography variant="Regular_13">{t(tooltipKey)}</DsTypography>
            <DsTypography variant="Semibold_13">
                {t('databases.register-flow.ssm-tooltip-arn-format-label')}
            </DsTypography>
            <DsTypography variant="Regular_13" className={CommonStyles.ssmTooltipCode}>
                {t('databases.register-flow.ssm-tooltip-arn-format-value')}
            </DsTypography>
            <DsTypography variant="Regular_13">{t('databases.register-flow.ssm-tooltip-arn-rules')}</DsTypography>
            <DsTypography variant="Semibold_13">{t('databases.register-flow.ssm-tooltip-json-label')}</DsTypography>
            <pre className={CommonStyles.ssmTooltipPre}>{t(tooltipJsonKey)}</pre>
        </div>
    );
};

export default SsmArnTooltipContent;
