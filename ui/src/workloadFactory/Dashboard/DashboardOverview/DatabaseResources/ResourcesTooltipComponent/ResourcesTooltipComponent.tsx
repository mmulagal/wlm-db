import { DsTypography } from '@tlveng/wlm-ds';
import { useTranslation } from 'react-i18next';
import styles from './ResourcesTooltipComponent.module.scss';
import SeparatorComponent from '../../../../../common/SeparatorComponent/SeparatorComponent';
import { DBType } from '../../../../../utils/consts';

type ResourcesTooltipComponentProps = {
    type: string;
    data: any;
};

const ResourcesTooltipComponent = ({ type, data }: ResourcesTooltipComponentProps) => {
    const { t } = useTranslation();
    if (type === DBType.MSSQL) {
        return (
            <div className={styles.resourceTooltip}>
                <div className={styles.row}>
                    <DsTypography variant="Regular_13">{t('databases.dashboard.hosts')}</DsTypography>
                    <DsTypography variant="Semibold_13">{data?.totalHosts || 0}</DsTypography>
                </div>

                <SeparatorComponent variant="horizontal" />

                <div className={styles.row}>
                    <DsTypography variant="Regular_13">{t('databases.dashboard.instances-caps')}</DsTypography>
                    <DsTypography variant="Semibold_13">{data?.totalInstances || 0}</DsTypography>
                </div>

                <SeparatorComponent variant="horizontal" />

                <div className={styles.row}>
                    <DsTypography variant="Regular_13">{t('databases.dashboard.databases')}</DsTypography>
                    <DsTypography variant="Semibold_13">{data?.totalDatabases || 0}</DsTypography>
                </div>
            </div>
        );
    }

    if (type === DBType.ORACLE) {
        return (
            <div className={styles.resourceTooltip}>
                <div className={styles.row}>
                    <DsTypography variant="Regular_13">{t('databases.dashboard.hosts')}</DsTypography>
                    <DsTypography variant="Semibold_13">{data?.totalHosts || 0}</DsTypography>
                </div>

                <SeparatorComponent variant="horizontal" />

                <div className={styles.row}>
                    <DsTypography variant="Regular_13">{t('databases.dashboard.databases')}</DsTypography>
                    <DsTypography variant="Semibold_13">{data?.totalInstances || 0}</DsTypography>
                </div>

                <SeparatorComponent variant="horizontal" />

                <div className={styles.row}>
                    <DsTypography variant="Regular_13">{t('databases.dashboard.pdbs')}</DsTypography>
                    <DsTypography variant="Semibold_13">{data?.totalDatabases || 0}</DsTypography>
                </div>
            </div>
        );
    }
    if (type === DBType.POSTGRESQL) {
        return (
            <div className={styles.resourceTooltip}>
                <div className={styles.row}>
                    <DsTypography variant="Regular_13">{t('databases.dashboard.hosts')}</DsTypography>
                    <DsTypography variant="Semibold_13">{data?.totalHosts || 0}</DsTypography>
                </div>

                <SeparatorComponent variant="horizontal" />

                <div className={styles.row}>
                    <DsTypography variant="Regular_13">{t('databases.dashboard.instances-caps')}</DsTypography>
                    <DsTypography variant="Semibold_13">{data?.totalInstances || 0}</DsTypography>
                </div>

                <SeparatorComponent variant="horizontal" />

                <div className={styles.row}>
                    <DsTypography variant="Regular_13">{t('databases.dashboard.databases')}</DsTypography>
                    <DsTypography variant="Semibold_13">{data?.totalDatabases || 0}</DsTypography>
                </div>
            </div>
        );
    }

    // Default fallback (could be for other database types or when type is not recognized)
    return <div className={styles.resourceTooltip}>{t('databases.general.not-available-table-columns')}</div>;
};

export default ResourcesTooltipComponent;
