import { DsButton, DsTypography, useDialog } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import styles from './DetectHeader.module.scss';
import DialogComponent from '../../../../../../common/Dialog/DialogComponent';
import DetectedInstanceTable from './DetectedInstanceTable';
import { useAppSelector } from '../../../../../../store/storeHooks';
import { BulkDetectedInstance } from '../../../../../../utils/types/registerTypes';
import { getInstanceHeaderContent } from '../DetectInstanceHelper';
import { DBType } from '../../../../../../utils/consts';

export interface CountSummary {
    total?: number;
    success?: number;
    readyForManagement?: number;
}

const BulkAuthenticationHeader = ({ engineType }: { engineType: string }) => {
    const { t } = useTranslation();
    const { setDialog, closeDialog } = useDialog();
    const { bulkDetectedInstanceList, registerHostType } = useAppSelector(state => state.inventoryV2);
    const [countSummary, setCountSummary] = useState<CountSummary>({});
    const { selectedLabel, icon } = getInstanceHeaderContent(engineType, t);

    useEffect(() => {
        const newCountSummary = {
            total: 0,
            success: 0,
            readyForManagement: 0
        };
        bulkDetectedInstanceList.forEach((item: BulkDetectedInstance) => {
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

                <div className={styles.column}>
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

                <div className={`${styles.column}`}>
                    <div className={styles['long-text']}>
                        <DsTypography variant="Semibold_24" style={{ lineHeight: 'unset' }}>
                            {countSummary.success}
                        </DsTypography>
                        <DsTypography variant="Regular_14" style={{ lineHeight: 'unset' }}>
                            Out of
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

                <div className={styles.buttonBlock}>
                    <DsButton type="text" onClick={handleManageDialog}>
                        {t('databases.register-flow.view-details')}
                    </DsButton>
                </div>
            </div>
        </div>
    );
};

export default BulkAuthenticationHeader;
