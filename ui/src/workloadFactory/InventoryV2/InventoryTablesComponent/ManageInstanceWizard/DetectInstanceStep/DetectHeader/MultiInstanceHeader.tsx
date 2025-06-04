import { DsButton, DsTypography, useDialog } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { ReactComponent as InstanceName } from '../../../../../../assets/instance-name.svg';

import styles from './DetectHeader.module.scss';
import DialogComponent from '../../../../../../common/Dialog/DialogComponent';
import DetectedInstanceTable from './DetectedInstanceTable';
import { useAppSelector } from '../../../../../../store/storeHooks';

const MultiInstanceHeader = () => {
    const { t } = useTranslation();
    const { setDialog, closeDialog } = useDialog();
    const { bulkDetectedInstanceList } = useAppSelector(state => state.inventoryV2);
    const [countSummary, setCountSummary] = useState<any>({});

    useEffect(() => {
        const newCountSummary = {
            total: 0,
            success: 0,
            readyForManagement: 0
        };
        bulkDetectedInstanceList.forEach((item: any) => {
            newCountSummary.total += 1;
            if (item?.authorized) {
                newCountSummary.success += 1;
                if (item?.readyCount > 0) {
                    newCountSummary.readyForManagement += 1;
                }
            }
        });
        setCountSummary(newCountSummary);
    }, [bulkDetectedInstanceList]);

    const handleManageDialog = () => {
        setDialog(
            <DialogComponent
                header={t('databases.register-flow.multiinstance-header-dialog-heading')}
                content={<DetectedInstanceTable />}
                primaryButton={t('databases.general.close')}
                callback={() => {}}
                closeCallback={() => {
                    closeDialog();
                }}
            />
        );
    };
    return (
        <div className={styles.cardHeader}>
            <div className={styles.cardContent}>
                {/* image */}
                <div className={`${styles.column} ${styles.columnImage}`}>
                    <InstanceName />
                </div>

                <div className={`${styles.column}`}>
                    <DsTypography variant="Semibold_24" className={styles.titleText} style={{ lineHeight: 'unset' }}>
                        {countSummary.total}
                    </DsTypography>

                    <DsTypography
                        variant="Regular_14"
                        className={styles.label}
                        title={t('databases.register-flow.selected-instances')}
                    >
                        {t('databases.register-flow.selected-instances')}
                    </DsTypography>
                </div>

                <div className={styles.column}>
                    <DsTypography variant="Semibold_24" className={styles.titleText} style={{ lineHeight: 'unset' }}>
                        {countSummary.success} / {countSummary.total}
                    </DsTypography>
                    <DsTypography
                        variant="Regular_14"
                        className={styles.label}
                        title={t('databases.register-flow.successfully-authenticated')}
                    >
                        {t('databases.register-flow.successfully-authenticated')}
                    </DsTypography>
                </div>

                <div className={`${styles.column}`}>
                    <DsTypography className={styles.titleText} variant="Semibold_24" style={{ lineHeight: 'unset' }}>
                        {countSummary.readyForManagement} / {countSummary.total}
                    </DsTypography>

                    <DsTypography
                        variant="Regular_14"
                        className={styles.label}
                        title={t('databases.register-flow.ready-for-management')}
                    >
                        {t('databases.register-flow.ready-for-management')}
                    </DsTypography>
                </div>

                <div className={styles.buttonBlock}>
                    <DsButton type="text" onClick={handleManageDialog}>
                        {t('databases.register-flow.view-details')}
                    </DsButton>
                </div>
            </div>
        </div>
    );
};

export default MultiInstanceHeader;
