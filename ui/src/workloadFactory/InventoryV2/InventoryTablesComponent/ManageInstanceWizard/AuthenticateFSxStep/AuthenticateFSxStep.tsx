import { useWizard } from '@netapp/design-system/dist/components/Wizard';
import { useMemo } from 'react';
import ManageWizardFooter from '../ManageWizardFooter';
import styles from './AuthenticateFSxStep.module.scss';

import { UseWizardReturn } from '../../../../../utils/types/registerTypes';
import HeaderCard from './HeaderCard/HeaderCard';
import InputCard from './InputCard/InputCard';
import FsxAuthenticatedScreen from './FsxAuthenticatedScreen/FsxAuthenticatedScreen';
import { useAppSelector } from '../../../../../store/storeHooks';
import { areAllFsxAuthenticated, hasPartialAuthSuccess, useFsxDiscoverContext } from './AuthenticateFsxUtils';

export const Content = () => {
    const { manageSingleInstanceData, fsxCredentialStatusObj, fsxAuthStatus, selectedMultiDetectInstances } =
        useAppSelector(state => state.inventoryV2);

    // Get loading state from msSqlAction slice to disable inputs during API calls
    const isDetectHostLoading = useAppSelector(state => state.msSqlAction.isDetectHostLoading);

    const { discoverContext, instanceIdentifiers, isBulkMode } = useFsxDiscoverContext();

    // Check if all FSx are authenticated by checking fsxCredentialStatusObj
    const isFsxAuthenticated = useMemo(
        () =>
            areAllFsxAuthenticated(
                manageSingleInstanceData?.storage,
                fsxCredentialStatusObj,
                isBulkMode,
                selectedMultiDetectInstances,
                instanceIdentifiers,
                discoverContext
            ),
        [
            isBulkMode,
            manageSingleInstanceData?.storage,
            selectedMultiDetectInstances,
            fsxCredentialStatusObj,
            instanceIdentifiers,
            discoverContext
        ]
    );

    // Check if we have partial success to disable radio buttons
    const hasPartialSuccess = useMemo(
        () =>
            hasPartialAuthSuccess(
                manageSingleInstanceData?.storage,
                fsxCredentialStatusObj,
                fsxAuthStatus,
                isBulkMode,
                selectedMultiDetectInstances,
                instanceIdentifiers,
                discoverContext
            ),
        [
            isBulkMode,
            manageSingleInstanceData?.storage,
            selectedMultiDetectInstances,
            fsxCredentialStatusObj,
            fsxAuthStatus,
            instanceIdentifiers,
            discoverContext
        ]
    );

    const renderContent = () => {
        if (isFsxAuthenticated) {
            return <FsxAuthenticatedScreen />;
        }

        // FSx needs authentication
        return (
            <>
                <HeaderCard isRadioDisabled={hasPartialSuccess} isLoading={isDetectHostLoading} />
                <InputCard isBulkMode={isBulkMode} isLoading={isDetectHostLoading} />
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
