import { useWizard } from '@netapp/design-system/dist/components/Wizard';

import DetectHeader from './DetectHeader/DetectHeader';
import styles from './DetectInstanceStep.module.scss';
import DetectContent from './DetectContent/DetectContent';
import ManageWizardFooter from '../ManageWizardFooter';
import { useAppSelector } from '../../../../../store/storeHooks';
import { DsTypography } from '@netapp/design-system';
import { GENERAL } from '../../../../../utils/appConstants';
import { useMemo } from 'react';
import AuthenticatedScreen from './AuthenticatedScreen/AuthenticatedScreen';

export const Content = () => {
    const { wizardOperationType, selectedMultiDetectInstances } = useAppSelector(state => state.inventoryV2);

    const isAuth = useMemo(() => {
        return selectedMultiDetectInstances?.every((item: any) => item?.authorized);
    }, []);
    return (
        <div className={styles['detect-step']}>
            {wizardOperationType === 'single' && (
                <div style={{ width: '100%' }}>
                    <DetectHeader />
                </div>
            )}

            {wizardOperationType === 'bulk' && isAuth && <AuthenticatedScreen />}

            {wizardOperationType !== 'bulk' || (wizardOperationType === 'bulk' && !isAuth && <DetectContent />)}
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
