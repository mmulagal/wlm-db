import { DsTypography } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import { ReactComponent as InstanceName } from '../../../../../../assets/instance-name.svg';

import styles from './DetectHeader.module.scss';
import { useAppSelector } from '../../../../../../store/storeHooks';

import { GENERAL } from '../../../../../../utils/appConstants';
import { INVENTORY_STATUS } from '../../../../../../utils/consts';

const DetectHeader = () => {
    const { t } = useTranslation();
    const manageSingleInstanceData = useAppSelector(state => state.inventoryV2.manageSingleInstanceData);

    return (
        <div className={styles.cardHeader}>
            <div className={styles.cardContent}>
                {/* image */}
                <div className={`${styles.column} ${styles.columnImage}`}>
                    <InstanceName />
                </div>

                <div className={`${styles.column}`}>
                    <DsTypography
                        variant="Semibold_14"
                        className={styles.titleText}
                        style={{ paddingRight: '8px' }}
                        title={manageSingleInstanceData?.databaseInstanceName || GENERAL.NOT_AVAILABLE}
                    >
                        {manageSingleInstanceData?.databaseInstanceName || GENERAL.NOT_AVAILABLE}
                    </DsTypography>

                    <DsTypography
                        variant="Regular_14"
                        className={styles.label}
                        title={t('databases.register-flow.instance-header.instance-name')}
                    >
                        {t('databases.register-flow.instance-header.instance-name')}
                    </DsTypography>
                </div>

                {/* section 2 */}
                <div className={`${styles.column}`}>
                    <DsTypography variant="Semibold_14" className={styles.titleText}>
                        <>
                            {(manageSingleInstanceData?.status?.toLowerCase() === INVENTORY_STATUS.RUNNING_LOWER ||
                                manageSingleInstanceData?.status === INVENTORY_STATUS.CASE_SENSITIVE_UP) && (
                                <span className={`${styles.statusIcon} ${styles.circle} ${styles.online}`} />
                            )}
                            {(manageSingleInstanceData?.status === INVENTORY_STATUS.STOPPED ||
                                manageSingleInstanceData?.status === INVENTORY_STATUS.CASE_SENSITIVE_DOWN) && (
                                <span className={`${styles.statusIcon} ${styles.circle} ${styles.offline}`} />
                            )}
                            {manageSingleInstanceData?.status === INVENTORY_STATUS.UNKNOWN && (
                                <span className={`${styles.statusIcon} ${styles.circle} ${styles.unknown}`} />
                            )}

                            <span className={styles.valueSection}>
                                {manageSingleInstanceData?.status?.toLowerCase() === INVENTORY_STATUS.RUNNING_LOWER ||
                                manageSingleInstanceData?.status === INVENTORY_STATUS.CASE_SENSITIVE_UP
                                    ? INVENTORY_STATUS.ONLINE
                                    : manageSingleInstanceData?.status === INVENTORY_STATUS.STOPPED ||
                                      manageSingleInstanceData?.status === INVENTORY_STATUS.CASE_SENSITIVE_DOWN
                                    ? INVENTORY_STATUS.OFFLINE
                                    : manageSingleInstanceData?.status}
                            </span>
                        </>
                    </DsTypography>

                    <DsTypography variant="Regular_14">
                        {t('databases.register-flow.instance-header.instance-status')}
                    </DsTypography>
                </div>

                {/* section 3 */}
                <div className={`${styles.column}`}>
                    <DsTypography
                        variant="Semibold_14"
                        className={styles.titleText}
                        title={manageSingleInstanceData?.name || GENERAL.NOT_AVAILABLE}
                    >
                        {manageSingleInstanceData?.name || GENERAL.NOT_AVAILABLE}
                    </DsTypography>

                    <DsTypography
                        variant="Regular_14"
                        className={styles.label}
                        title={t('databases.register-flow.instance-header.host-name')}
                    >
                        {t('databases.register-flow.instance-header.host-name')}
                    </DsTypography>
                </div>

                {/* section 4 */}
                <div className={`${styles.column}`} style={{ borderRight: 'none' }}>
                    <DsTypography variant="Semibold_14" className={styles.titleText}>
                        {manageSingleInstanceData?.hostType || GENERAL.NOT_AVAILABLE}
                    </DsTypography>

                    <DsTypography
                        variant="Regular_14"
                        className={styles.label}
                        title={t('databases.register-flow.instance-header.engine-type')}
                    >
                        {t('databases.register-flow.instance-header.engine-type')}
                    </DsTypography>
                </div>
            </div>
        </div>
    );
};

export default DetectHeader;
