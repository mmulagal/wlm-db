import { DsButton, DsTypography, useDialog } from '@netapp/design-system';
import { ReactComponent as InstanceName } from '../../../../../../assets/instance-name.svg';

import styles from './DetectHeader.module.scss';
import DialogComponent from '../../../../../../common/Dialog/DialogComponent';
import { GENERAL } from '../../../../../../utils/appConstants';
import DetectedInstanceTable from './DetectedInstanceTable';
import { useAppSelector } from '../../../../../../store/storeHooks';
import { useEffect, useState } from 'react';

const MultiInstanceHeader = () => {
    const { setDialog, closeDialog } = useDialog();
    const { selectedMultiDetectInstances } = useAppSelector(state => state.inventoryV2);
    const [countSummary, setCountSummary] = useState<any>({});

    useEffect(() => {
        let newCountSummary = {
            total: 0,
            success: 0,
            readyForManagement: 0
        };
        selectedMultiDetectInstances.forEach((item: any) => {
            newCountSummary.total += 1;
            if (item?.authorized) {
                newCountSummary.success += 1;
                newCountSummary.readyForManagement += 1;
            }
        });
        setCountSummary(newCountSummary);
    }, [selectedMultiDetectInstances]);

    const handleManageDialog = () => {
        setDialog(
            <DialogComponent
                header={'Authenticated Instances status'}
                content={<DetectedInstanceTable />}
                primaryButton={GENERAL.CLOSE}
                callback={() => {}}
                closeCallback={() => {
                    closeDialog();
                }}
            />
        );
    };
    return (
        <div className={styles['detect-header']}>
            <div className={styles.firstBlock}>
                <div>
                    <InstanceName />
                </div>

                <div className={styles.textSection}>
                    <DsTypography variant="Semibold_24" style={{ lineHeight: 'unset' }}>
                        {countSummary.total}
                    </DsTypography>
                    <DsTypography variant="Regular_14">Selected instances</DsTypography>
                </div>
            </div>

            <div className={styles.commonBlock}>
                <DsTypography variant="Semibold_24" style={{ lineHeight: 'unset' }}>
                    {countSummary.success} / {countSummary.total}
                </DsTypography>
                <DsTypography variant="Regular_14">Successfully authenticated</DsTypography>
            </div>

            <div className={styles.commonBlock}>
                <DsTypography variant="Semibold_24" style={{ lineHeight: 'unset' }}>
                    {countSummary.readyForManagement} / {countSummary.total}
                </DsTypography>
                <DsTypography variant="Regular_14">Ready for management</DsTypography>
            </div>

            <div className={styles.buttonBlock}>
                <DsButton type="text" onClick={handleManageDialog}>
                    View Instance status
                </DsButton>
            </div>
        </div>
    );
};

export default MultiInstanceHeader;
