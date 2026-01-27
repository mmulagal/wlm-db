import { useWizard } from '@netapp/design-system/dist/components/Wizard';
import { useMemo } from 'react';
import DetectHeader from './DetectHeader/DetectHeader';
import styles from './DetectInstanceStep.module.scss';
import DetectContent from './DetectContent/DetectContent';
import ManageWizardFooter from '../ManageWizardFooter';
import { useAppSelector } from '../../../../../store/storeHooks';
import AuthenticatedScreen from './AuthenticatedScreen/AuthenticatedScreen';
import { ACTION_TYPE, DBType } from '../../../../../utils/consts';
import { BulkDetectedInstance, UseWizardReturn } from '../../../../../utils/types/registerTypes';
import NewAuthenticatedScreen from './NewAuthenticatedScreen/NewAuthenticatedScreen';
import { isAuthRequiredForInstance } from './DetectContent/DetectContentHelper';

export const Content = () => {
    const { wizardOperationType, selectedMultiDetectInstances, manageSingleInstanceData } = useAppSelector(
        state => state.inventoryV2
    );

    // Check if single instance is already authorized
    const isAuthorizedSingleInstance = useMemo(
        () => !isAuthRequiredForInstance(manageSingleInstanceData, manageSingleInstanceData?.hostType),
        [manageSingleInstanceData]
    );

    const isAuth = useMemo(
        () => selectedMultiDetectInstances?.every((item: BulkDetectedInstance) => item?.authorized),
        []
    );

    const renderContent = () => {
        // Single operation with MSSQL or Oracle and authenticated
        if (wizardOperationType === ACTION_TYPE.SINGLE && isAuthorizedSingleInstance) {
            return <NewAuthenticatedScreen />;
        }

        return (
            <>
                {wizardOperationType === ACTION_TYPE.SINGLE && (
                    <div style={{ width: '100%' }}>
                        <DetectHeader />
                    </div>
                )}

                {wizardOperationType === ACTION_TYPE.BULK && isAuth && <AuthenticatedScreen />}

                {(wizardOperationType !== ACTION_TYPE.BULK ||
                    (wizardOperationType === ACTION_TYPE.BULK && !isAuth)) && <DetectContent />}
            </>
        );
    };

    return <div className={styles['detect-step']}>{renderContent()}</div>;
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
