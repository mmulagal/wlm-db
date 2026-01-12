import { useWizard } from '@netapp/design-system/dist/components/Wizard';
import { useMemo } from 'react';
import ManageWizardFooter from '../ManageWizardFooter';
import styles from './AuthenticateFSxStep.module.scss';

import { UseWizardReturn } from '../../../../../utils/types/registerTypes';
import HeaderCard from './HeaderCard/HeaderCard';
import InputCard from './InputCard/InputCard';
import FsxAuthenticatedScreen from './FsxAuthenticatedScreen/FsxAuthenticatedScreen';
import { useAppSelector } from '../../../../../store/storeHooks';
import { getAllFsxFromStorage, areAllFsxAuthenticated, hasPartialAuthSuccess } from './AuthenticateFsxUtils';

export const Content = () => {
    const { manageSingleInstanceData, fsxCredentialStatusObj, fsxAuthStatus } = useAppSelector(
        state => state.inventoryV2
    );

    // Get FSx list from storage array
    const fsxListFromStorage = useMemo(
        () => getAllFsxFromStorage(manageSingleInstanceData?.storage),
        [manageSingleInstanceData?.storage]
    );

    // Check if all FSx are authenticated by checking fsxCredentialStatusObj
    const isFsxAuthenticated = useMemo(() => {
        if (!manageSingleInstanceData) return false;
        return areAllFsxAuthenticated(manageSingleInstanceData?.storage, fsxCredentialStatusObj);
    }, [manageSingleInstanceData, fsxCredentialStatusObj]);

    // Check if we have partial success to disable radio buttons
    const hasPartialSuccess = useMemo(
        () => hasPartialAuthSuccess(manageSingleInstanceData?.storage, fsxCredentialStatusObj, fsxAuthStatus),
        [manageSingleInstanceData?.storage, fsxCredentialStatusObj, fsxAuthStatus]
    );

    const renderContent = () => {
        if (isFsxAuthenticated) {
            return <FsxAuthenticatedScreen />;
        }

        // FSx needs authentication
        return (
            <>
                <HeaderCard isRadioDisabled={hasPartialSuccess} />
                <InputCard />
            </>
        );
    };

    return <div className={styles['authenticate-fsx-step']}>{renderContent()}</div>;
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
