import { DsTypography } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import { ReactComponent as Warning } from '../../assets/warning.svg';
import SeparatorComponent from '../SeparatorComponent/SeparatorComponent';
import {
    DEPENDENCY_TYPE,
    RECOMMENDATION_TYPE
} from '../../workloadFactory/Oracle/OracleResourcePages/OracleWellArchitectDashboard/OracleConfigDependencies';
import styles from './LinkedConfigBanner.module.scss';

interface LinkedConfigBannerProps {
    linkedConfigNames: string[];
    configName: string;
    dependencyType?: string;
    recommendationType?: string;
}

const LinkedConfigBanner = ({
    linkedConfigNames,
    configName,
    dependencyType = DEPENDENCY_TYPE.STORAGE_LAYOUT,
    recommendationType = RECOMMENDATION_TYPE.ONTAP
}: LinkedConfigBannerProps) => {
    const { t } = useTranslation();

    if (!linkedConfigNames || linkedConfigNames.length === 0) return null;

    const messageParams = { configName: configName.toLowerCase(), dependencyType, recommendationType };

    return (
        <div className={styles.linkedConfigBanner} data-testid="linked-config-banner">
            <div className={styles.firstSegment}>
                <Warning />
                <DsTypography variant="Semibold_14">{t('databases.well-architect.linked-config.title')}</DsTypography>
            </div>
            <div className={styles.secondSegment}>
                <DsTypography variant="Regular_14">
                    {t('databases.well-architect.linked-config.message', messageParams)}
                </DsTypography>
                <DsTypography variant="Regular_14">
                    {t('databases.well-architect.linked-config.message-line2', messageParams)}
                </DsTypography>
            </div>
            <div className={styles.thirdSegment}>
                <DsTypography variant="Semibold_14">
                    {t('databases.well-architect.linked-config.linked-configurations')}:
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
        </div>
    );
};

export default LinkedConfigBanner;
