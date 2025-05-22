import { DsTypography } from '@netapp/design-system';
import { ReactComponent as InstanceName } from '../../../../../../assets/instance-name.svg';

import styles from './DetectHeader.module.scss';
import { useAppSelector } from '../../../../../../store/storeHooks';
import { useEffect } from 'react';
import { GENERAL } from '../../../../../../utils/appConstants';
import { INVENTORY_STATUS } from '../../../../../../utils/consts';

const DetectHeader = () => {
    const manageSingleInstanceData = useAppSelector(state => state.inventoryV2.manageSingleInstanceData);

    return (
        <div className={styles['detect-header']}>
            <div className={styles.firstBlock}>
                <div>
                    <InstanceName />
                </div>

                <div className={styles.textSection}>
                    <DsTypography variant="Semibold_14">
                        {manageSingleInstanceData?.databaseInstanceName || GENERAL.NOT_AVAILABLE}
                    </DsTypography>
                    <DsTypography variant="Regular_14">Instance name</DsTypography>
                </div>
            </div>

            <div className={styles.commonBlock}>
                <div className={styles.firstColText}>
                    {(manageSingleInstanceData?.status?.toLowerCase() === INVENTORY_STATUS.RUNNING_LOWER ||
                        manageSingleInstanceData?.status === INVENTORY_STATUS.CASE_SENSITIVE_UP) && (
                        <div className={`${styles.statusIcon} ${styles['circle']} ${styles['online']}`}></div>
                    )}
                    {(manageSingleInstanceData?.status === INVENTORY_STATUS.STOPPED ||
                        manageSingleInstanceData?.status === INVENTORY_STATUS.CASE_SENSITIVE_DOWN) && (
                        <div className={`${styles.statusIcon} ${styles['circle']} ${styles['offline']}`}></div>
                    )}
                    {manageSingleInstanceData?.status === INVENTORY_STATUS.UNKNOWN && (
                        <div className={`${styles.statusIcon} ${styles['circle']} ${styles['unknown']}`}></div>
                    )}

                    <DsTypography variant="Regular_14">
                        {manageSingleInstanceData?.status?.toLowerCase() === INVENTORY_STATUS.RUNNING_LOWER ||
                        manageSingleInstanceData?.status === INVENTORY_STATUS.CASE_SENSITIVE_UP
                            ? INVENTORY_STATUS.ONLINE
                            : manageSingleInstanceData?.status === INVENTORY_STATUS.STOPPED ||
                              manageSingleInstanceData?.status === INVENTORY_STATUS.CASE_SENSITIVE_DOWN
                            ? INVENTORY_STATUS.OFFLINE
                            : manageSingleInstanceData?.status}
                    </DsTypography>
                </div>
                <DsTypography variant="Regular_14">Instance status</DsTypography>
            </div>

            <div className={styles.commonBlock}>
                <DsTypography variant="Semibold_14">
                    {manageSingleInstanceData?.name || GENERAL.NOT_AVAILABLE}
                </DsTypography>
                <DsTypography variant="Regular_14">Host name</DsTypography>
            </div>

            <div className={styles.fourthBlock}>
                <DsTypography variant="Semibold_14">
                    {manageSingleInstanceData?.hostType || GENERAL.NOT_AVAILABLE}
                </DsTypography>
                <DsTypography variant="Regular_14">Engine type</DsTypography>
            </div>
        </div>
    );
};

export default DetectHeader;
