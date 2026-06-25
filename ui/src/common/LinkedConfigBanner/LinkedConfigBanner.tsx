import { DsTypography } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import { ReactComponent as Warning } from '../../assets/warning.svg';
import SeparatorComponent from '../SeparatorComponent/SeparatorComponent';
import { isLayoutConfig } from '../../workloadFactory/Oracle/OracleResourcePages/OracleWellArchitectDashboard/OracleConfigDependencies';
import styles from './LinkedConfigBanner.module.scss';

interface LinkedConfigBannerProps {
    linkedConfigNames: string[];
    configName: string;
}

const LinkedConfigBanner = ({ linkedConfigNames, configName }: LinkedConfigBannerProps) => {
    const { t } = useTranslation();

    if (!linkedConfigNames || linkedConfigNames.length === 0) return null;

    const isLayout = isLayoutConfig(configName);
    const configNameLower = configName.replace(/-/g, ' ').toLowerCase();
    const linkedNames =
        linkedConfigNames.length > 1
            ? `${linkedConfigNames.slice(0, -1).join(', ')}, and ${linkedConfigNames[linkedConfigNames.length - 1]}`
            : linkedConfigNames[0];

    return (
        <div className={styles.linkedConfigBanner} data-testid="linked-config-banner">
            <div className={styles.firstSegment}>
                <Warning />
                <DsTypography variant="Semibold_14">{t('databases.well-architect.linked-config.title')}</DsTypography>
            </div>
            <div className={styles.secondSegment}>
                {isLayout ? (
                    <DsTypography variant="Regular_14">
                        {t('databases.well-architect.linked-config.layout-message', { configName: configNameLower })}
                    </DsTypography>
                ) : (
                    <>
                        <DsTypography variant="Regular_14">
                            {t('databases.well-architect.linked-config.ontap-message', { linkedNames })}
                        </DsTypography>
                        <DsTypography variant="Regular_14">
                            {t('databases.well-architect.linked-config.ontap-message-line2', {
                                configName: configNameLower
                            })}
                        </DsTypography>
                    </>
                )}
            </div>
            {isLayout && (
                <div className={styles.thirdSegment}>
                    <DsTypography variant="Semibold_14">
                        {t('databases.well-architect.linked-config.related-configurations')}:
                    </DsTypography>
                    {linkedConfigNames.map((name, index) => (
                        <div key={name} className={styles.configItem}>
                            <DsTypography variant="Regular_14">{name}</DsTypography>
                            {index < linkedConfigNames.length - 1 && (
                                <SeparatorComponent variant="vertical" height="14px" />
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default LinkedConfigBanner;
