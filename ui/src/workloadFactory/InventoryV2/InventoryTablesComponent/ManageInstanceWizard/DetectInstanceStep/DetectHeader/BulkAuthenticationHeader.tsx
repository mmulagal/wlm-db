import { DsTypography, useDialog } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import styles from './DetectHeader.module.scss';
import DialogComponent from '../../../../../../common/Dialog/DialogComponent';
import DetectedInstanceTable from './DetectedInstanceTable';
import { useAppSelector } from '../../../../../../store/storeHooks';
import { BulkDetectedInstance } from '../../../../../../utils/types/registerTypes';
import { getInstanceHeaderContent } from '../DetectInstanceHelper';
import { DBType } from '../../../../../../utils/consts';
import { isInstanceAuthenticated, generateInstanceUniqueKey } from '../../SelectInstancesStep/AuthenticateBulkUtils';

export interface CountSummary {
    total: number;
    success: number;
    readyForManagement: number;
}

const BulkAuthenticationHeader = ({ engineType }: { engineType: string }) => {
    const { t } = useTranslation();
    const { setDialog, closeDialog } = useDialog();
    const { bulkDetectedInstanceList, registerHostType, selectedMultiDetectInstances, instanceAuthStatus } =
        useAppSelector(state => state.inventoryV2);
    const { selectedLabel, icon } = getInstanceHeaderContent(engineType, t);
    const [countSummary, setCountSummary] = useState<CountSummary>({
        total: 0,
        success: 0,
        readyForManagement: 0
    });

    useEffect(() => {
        const newCountSummary: CountSummary = {
            total: 0,
            success: 0,
            readyForManagement: 0
        };

        // Use bulkDetectedInstanceList if available
        // Otherwise fall back to selectedMultiDetectInstances with instanceAuthStatus check
        const dataSource =
            bulkDetectedInstanceList && bulkDetectedInstanceList.length > 0
                ? bulkDetectedInstanceList
                : selectedMultiDetectInstances;

        dataSource?.forEach((item: BulkDetectedInstance) => {
            newCountSummary.total += 1;

            // Get instance data for auth check
            const instanceData = item?.data || item;
            const instanceId = instanceData?.databaseInstanceName || item?.databaseInstanceName || '';
            const ec2InstanceId = instanceData?.ec2InstanceId || item?.ec2InstanceId || '';
            const uniqueKey = generateInstanceUniqueKey(ec2InstanceId, instanceId);

            // Check if instance is authenticated using the utility function
            // This checks BOTH pre-authentication status AND wizard auth status
            const isAuthenticated = isInstanceAuthenticated(uniqueKey, instanceData, instanceAuthStatus, engineType);

            if (isAuthenticated) {
                newCountSummary.success += 1;

                // Only count as ready for management if readyCount is available and > 0
                if (item?.readyCount !== undefined && item?.readyCount > 0) {
                    newCountSummary.readyForManagement += 1;
                }
            }
        });

        setCountSummary(newCountSummary);
    }, [bulkDetectedInstanceList, selectedMultiDetectInstances, instanceAuthStatus, engineType]);

    const handleManageDialog = () => {
        setDialog(
            <div className={styles.dialogContainer}>
                <DialogComponent
                    header={
                        registerHostType === DBType.MSSQL
                            ? t('databases.register-flow.multiinstance-header-dialog-heading')
                            : t('databases.register-flow.multidatabase-header-dialog-heading')
                    }
                    content={<DetectedInstanceTable />}
                    primaryButton={t('databases.general.close')}
                    callback={() => {}}
                    closeCallback={() => {
                        closeDialog();
                    }}
                />
            </div>
        );
    };
    return (
        <div className={styles.cardHeader}>
            <div className={styles.cardContent}>
                {/* image */}
                <div className={`${styles.column} ${styles.columnImage}`}>{icon}</div>

                <div className={styles.column} style={{ maxWidth: '220px' }}>
                    <DsTypography variant="Semibold_24" className={styles.titleText} style={{ lineHeight: 'unset' }}>
                        {countSummary.success}
                    </DsTypography>
                    <DsTypography
                        variant="Regular_14"
                        className={styles.label}
                        title={t('databases.register-flow.authenticated-instances')}
                    >
                        {t('databases.register-flow.authenticated-instances')}
                    </DsTypography>
                </div>

                <div className={`${styles.column}`} style={{ maxWidth: '220px' }}>
                    <div className={styles['long-text']}>
                        <DsTypography variant="Semibold_24" style={{ lineHeight: 'unset' }}>
                            {countSummary.readyForManagement}
                        </DsTypography>
                        <DsTypography variant="Regular_14" style={{ lineHeight: 'unset' }}>
                            {t('databases.register-flow.out-of')}
                        </DsTypography>
                        <DsTypography variant="Semibold_24" style={{ lineHeight: 'unset' }}>
                            {countSummary.total}
                        </DsTypography>
                    </div>

                    <DsTypography
                        variant="Regular_14"
                        className={styles.label}
                        title={t('databases.register-flow.ready-for-management')}
                    >
                        {t('databases.register-flow.ready-for-management')}
                    </DsTypography>
                </div>
            </div>
        </div>
    );
};

export default BulkAuthenticationHeader;
