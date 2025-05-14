import { DsButton, DsTypography, useDialog } from '@netapp/design-system';
import { ReactComponent as InstanceName } from '../../../../../../assets/instance-name.svg';

import styles from './DetectHeader.module.scss';
import DialogComponent from '../../../../../../common/Dialog/DialogComponent';
import { GENERAL } from '../../../../../../utils/appConstants';
import DetectedInstanceTable from './DetectedInstanceTable';

const MultiInstanceHeader = () => {
    const { setDialog, closeDialog } = useDialog();

    const handleManageDialog = () => {
        setDialog(
            <DialogComponent
                header={'Detected Instances status'}
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
                        28
                    </DsTypography>
                    <DsTypography variant="Regular_14">Selected instances</DsTypography>
                </div>
            </div>

            <div className={styles.commonBlock}>
                <DsTypography variant="Semibold_24" style={{ lineHeight: 'unset' }}>
                    26 / 28
                </DsTypography>
                <DsTypography variant="Regular_14">Successfully detected</DsTypography>
            </div>

            <div className={styles.commonBlock}>
                <DsTypography variant="Semibold_24" style={{ lineHeight: 'unset' }}>
                    20 / 28
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
