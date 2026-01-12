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

export const Content = () => {
    const { wizardOperationType, selectedMultiDetectInstances, manageSingleInstanceData } = useAppSelector(
        state => state.inventoryV2
    );

    // @Todo : Will be moved to utility file once oracle register revamp is done
    const isAuthorizedSingleInstance = useMemo(() => {
        if (!manageSingleInstanceData) return false;
        return !!(
            manageSingleInstanceData.sqlServerAuthentication ||
            manageSingleInstanceData.windowsAuthentication ||
            manageSingleInstanceData.windowsDomainUserAuthentication
        );
    }, [manageSingleInstanceData]);

    const isAuth = useMemo(
        () => selectedMultiDetectInstances?.every((item: BulkDetectedInstance) => item?.authorized),
        []
    );

    const renderContent = () => {
        // Single operation with MSSQL and authenticated
        if (
            wizardOperationType === ACTION_TYPE.SINGLE &&
            manageSingleInstanceData?.hostType === DBType.MSSQL &&
            isAuthorizedSingleInstance
        ) {
            return <NewAuthenticatedScreen />;
        }

        // All other cases
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
