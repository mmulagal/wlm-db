import { useWizard } from '@netapp/design-system/dist/components/Wizard';
import DetectHeader from './DetectHeader/DetectHeader';
import styles from './DetectInstanceStep.module.scss';
import DetectContent from './DetectContent/DetectContent';
import ManageWizardFooter from '../ManageWizardFooter';
import { useAppSelector } from '../../../../../store/storeHooks';
import { useMemo } from 'react';
import AuthenticatedScreen from './AuthenticatedScreen/AuthenticatedScreen';
import { ACTION_TYPE } from '../../../../../utils/consts';
import { BulkDetectedInstance, UseWizardReturn } from '../../../../../utils/types/registerTypes';

export const Content = () => {
    const { wizardOperationType, selectedMultiDetectInstances } = useAppSelector(state => state.inventoryV2);

    const isAuth = useMemo(() => {
        return selectedMultiDetectInstances?.every((item: BulkDetectedInstance) => item?.authorized);
    }, []);

    return (
        <div className={styles['detect-step']}>
            {wizardOperationType === ACTION_TYPE.SINGLE && (
                <div style={{ width: '100%' }}>
                    <DetectHeader />
                </div>
            )}

            {wizardOperationType === ACTION_TYPE.BULK && isAuth && <AuthenticatedScreen />}

            {(wizardOperationType !== ACTION_TYPE.BULK || (wizardOperationType === ACTION_TYPE.BULK && !isAuth)) && (
                <DetectContent />
            )}
        </div>
    );
};

export const Footer = () => {
    const { state }: UseWizardReturn = useWizard();
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
