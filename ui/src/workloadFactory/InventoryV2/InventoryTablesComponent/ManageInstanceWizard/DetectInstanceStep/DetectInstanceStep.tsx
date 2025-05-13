import { useWizard } from '@netapp/design-system/dist/components/Wizard';

import DetectHeader from './DetectHeader/DetectHeader';
import styles from './DetectInstanceStep.module.scss';
import DetectContent from './DetectContent/DetectContent';
import ManageWizardFooter from '../ManageWizardFooter';
import { useAppSelector } from '../../../../../store/storeHooks';
import { DsTypography } from '@netapp/design-system';

export const Content = () => {
    const { wizardOperationType } = useAppSelector(state => state.inventoryV2);
    return (
        <div className={styles['detect-step']}>
            {wizardOperationType === 'single' && <DetectHeader />}

            {wizardOperationType === 'bulk' && (
                <DsTypography variant="Regular_14" className={styles.note}>
                    Select multiple Microsoft SQL Server instances that share the same authentication credentials and
                    FSx for ONTAP credentials.
                </DsTypography>
            )}

            <DetectContent />
        </div>
    );
};

export const Footer = () => {
    const { state }: any = useWizard();
    return (
        <ManageWizardFooter
            nextButtonProps={{
                onClick: async () => {
                    if (state.submit) {
                        state.submit();
                    }
                }
            }}
        />
    );
};
