import { useWizard } from '@netapp/design-system/dist/components/Wizard';
import { useEffect, useRef, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import classNames from 'classnames';
import ManageWizardFooter from '../ManageWizardFooter';
import styles from './AuthenticateFSxStep.module.scss';

import { UseWizardReturn } from '../../../../../utils/types/registerTypes';
import HeaderCard from './HeaderCard/HeaderCard';
import InputCard from './InputCard/InputCard';
import FsxAuthenticatedScreen from './FsxAuthenticatedScreen/FsxAuthenticatedScreen';
import { useAppSelector } from '../../../../../store/storeHooks';
import {
    areAllFsxAuthenticated,
    hasPartialAuthSuccess,
    useFsxDiscoverContext,
    getFsxNeedingAuth,
    getFsxNeedingAuthFromBulk,
    getFsxCredStatusByEngine
} from './AuthenticateFsxUtils';
import { setSelectedFSxForOntapCredentials } from '../../../../../store/workloadFactory/inventoryV2Slice';
import { FSX_FOR_ONTAP_CRED_OPTION } from '../../../../../utils/consts';

export const Content = () => {
    const dispatch = useDispatch();
    const inventoryV2State = useAppSelector(state => state.inventoryV2);
    const { manageSingleInstanceData, fsxAuthStatus, selectedMultiDetectInstances, registerHostType } =
        inventoryV2State;
    const isGovAccount = useAppSelector(state => state.auth.isGovAccount);

    const fsxCredentialStatusObj = useMemo(
        () => getFsxCredStatusByEngine(inventoryV2State, registerHostType),
        [
            inventoryV2State.fsxCredentialStatusObj,
            inventoryV2State.fsxCredentialStatusObjOracle,
            inventoryV2State.fsxCredentialStatusObjPgsql,
            registerHostType
        ]
    );

    // Get loading state from msSqlAction slice to disable inputs during API calls
    const isDetectHostLoading = useAppSelector(state => state.msSqlAction.isDetectHostLoading);

    const { discoverContext, instanceIdentifiers, isBulkMode } = useFsxDiscoverContext();

    // Memoized: Get FSx list that require authentication (filters out already authenticated ones)
    const fsxNeedingAuthList = useMemo(
        () =>
            isBulkMode
                ? getFsxNeedingAuthFromBulk(selectedMultiDetectInstances, fsxCredentialStatusObj, discoverContext)
                : getFsxNeedingAuth(
                      manageSingleInstanceData?.storage,
                      fsxCredentialStatusObj,
                      instanceIdentifiers,
                      discoverContext
                  ),
        [
            isBulkMode,
            selectedMultiDetectInstances,
            fsxCredentialStatusObj,
            discoverContext,
            manageSingleInstanceData?.storage,
            instanceIdentifiers
        ]
    );
    const hasSingleFsxNeedingAuth = fsxNeedingAuthList.length === 1;

    // Track if we've already set the mode to avoid re-running
    const hasSetModeRef = useRef(false);

    // Auto-select MANAGE_CRED_MANUALLY when there's only 1 FSx needing auth
    useEffect(() => {
        if (hasSingleFsxNeedingAuth && !hasSetModeRef.current) {
            hasSetModeRef.current = true;
            dispatch(setSelectedFSxForOntapCredentials(FSX_FOR_ONTAP_CRED_OPTION.MANAGE_CRED_MANUALLY));
        }
    }, [hasSingleFsxNeedingAuth, dispatch]);

    // Memoized: Check if all FSx are authenticated (reacts to credential status changes)
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
            manageSingleInstanceData?.storage,
            fsxCredentialStatusObj,
            isBulkMode,
            selectedMultiDetectInstances,
            instanceIdentifiers,
            discoverContext
        ]
    );

    // Memoized: Check if we have partial success to disable radio buttons (reacts to auth status changes)
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
            manageSingleInstanceData?.storage,
            fsxCredentialStatusObj,
            fsxAuthStatus,
            isBulkMode,
            selectedMultiDetectInstances,
            instanceIdentifiers,
            discoverContext
        ]
    );

    // Disable radio when: partial success OR only 1 FSx needing auth
    const isRadioDisabled = hasPartialSuccess || hasSingleFsxNeedingAuth;

    const renderContent = () => {
        if (isFsxAuthenticated) {
            return <FsxAuthenticatedScreen />;
        }

        // FSx needs authentication
        return (
            <>
                <HeaderCard isRadioDisabled={isRadioDisabled} isLoading={isDetectHostLoading} />
                <InputCard isBulkMode={isBulkMode} isLoading={isDetectHostLoading} />
            </>
        );
    };

    return (
        <div className={classNames(styles['authenticate-fsx-step'], { [styles.govCloud]: isGovAccount })}>
            {renderContent()}
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
