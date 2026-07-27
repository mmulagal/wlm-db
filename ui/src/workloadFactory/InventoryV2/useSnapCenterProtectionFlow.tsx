import { ReactNode, useCallback } from 'react';
import { DsTypography } from '@tlveng/wlm-ds';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import DialogComponent from '../../common/Dialog/DialogComponent';
import {
    useAddHostJobScMutation,
    useAddHostScMutation,
    useAssignBackupRecoveryLicenseMutation,
    useAssignRBACPrivilegesMutation,
    useConfigureDirectoryMutation,
    useDeleteHostScMutation,
    useDiscoverExistingFsxNMutation,
    useGenerateCredentialIDMutation,
    useGetBackupRecoveryLicenseMutation,
    useGetConnectorsMutation,
    useGetDiscoverHostResultMutation,
    useGetDiscoverInstanceResultMutation,
    useGetFsxDetailsMutation,
    useGetOrganizationIdsMutation,
    useGetRBACPrivilegesMutation,
    useGetSCCrendentialsMutation,
    useGetWorkSpaceIDMutation,
    useListAllDirectoriesMutation,
    useListExistingHostsMutation,
    useRegisterResourceCredentialsBulkMutation
} from '../../utils/apiService';
import { bxpRedirect } from '../../utils/utilityFunctions';
import { DETECT_HOST_VAR, FROM_DIALOG } from '../../utils/consts';
import { GENERAL } from '../../utils/appConstants';
import store from '../../store/store';
import { NOTIFICATION_TYPES, addNotification } from '../../store/notificationSlice';
import NoAgentDialog from './InventoryTablesComponent/ProtectionDialogs/NoAgentDialog';
import SingleAgentDialog from './InventoryTablesComponent/ProtectionDialogs/SingleAgentDialog';
import FetchingDialog from './InventoryTablesComponent/ProtectionDialogs/FetchingDIalog';
import WindowsAuthDialog from './InventoryTablesComponent/ProtectionDialogs/WindowsAuthDialog';
import {
    cancelProtectionForRow,
    setAuthVerification,
    setDataForRow
} from '../../store/workloadFactory/snapcenterSlice';
import { setActionsDisabled } from '../../store/workloadFactory/dialogComponentSlice';
import { handleProtectionUtil } from './AddHostUtils';
import { addHostHandlerSc } from './InventoryUtilsV2';
import { useAppSelector } from '../../store/storeHooks';
import styles from './InventoryTablesComponent/InventoryTable.module.scss';

type SnapCenterProtectionDialogType = 'instance' | 'database';

type UseSnapCenterProtectionFlowOptions = {
    dialogType?: SnapCenterProtectionDialogType;
};

export function useSnapCenterProtectionFlow(
    setDialog: (content: ReactNode) => void,
    closeDialog: () => void,
    options: UseSnapCenterProtectionFlowOptions = {}
) {
    const { dialogType = 'instance' } = options;
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const isDemoMode = useAppSelector(state => state.auth?.isDemoMode);
    const isWorkloadFactory = useAppSelector(state => state.auth?.isWorkloadFactory);

    const [getConnector] = useGetConnectorsMutation();
    const [getFsxDetails] = useGetFsxDetailsMutation();
    const [discoverExistingFsxN] = useDiscoverExistingFsxNMutation();
    const [getWorkSpaceID] = useGetWorkSpaceIDMutation();
    const [getRBACPrivileges] = useGetRBACPrivilegesMutation();
    const [getBackupRecoveryLicense] = useGetBackupRecoveryLicenseMutation();
    const [assignBackupRecoveryLicense] = useAssignBackupRecoveryLicenseMutation();
    const [listExistingHosts] = useListExistingHostsMutation();
    const [assignRBACPrivileges] = useAssignRBACPrivilegesMutation();
    const [generateCredentialID] = useGenerateCredentialIDMutation();
    const [addHostScApi] = useAddHostScMutation();
    const [addHostJobScApi] = useAddHostJobScMutation();
    const [deleteHostSc] = useDeleteHostScMutation();
    const [configureDirectory] = useConfigureDirectoryMutation();
    const [listAllDirectories] = useListAllDirectoriesMutation();
    const [getDiscoverHostResult] = useGetDiscoverHostResultMutation();
    const [getDiscoverInstanceResult] = useGetDiscoverInstanceResultMutation();
    const [getSCCrendentials] = useGetSCCrendentialsMutation();
    const [registerResourceCredBulk] = useRegisterResourceCredentialsBulkMutation();
    const [getOrganizationIds] = useGetOrganizationIdsMutation();

    const protectHeader =
        dialogType === 'database'
            ? t('databases.inventory.protect-header-database')
            : t('databases.inventory.protect-header');

    const fetchDialog = useCallback(
        (key: string) => {
            setDialog(
                <DialogComponent
                    header={protectHeader}
                    content={<FetchingDialog />}
                    secondaryButton={GENERAL.CANCEL}
                    closeCallback={() => {
                        dispatch(cancelProtectionForRow(key));
                        closeDialog();
                    }}
                    hidePrimaryButton
                    customClass={styles.protectionDialog}
                    dialogFrom={FROM_DIALOG.LOADER}
                />
            );
        },
        [closeDialog, dispatch, protectHeader, setDialog]
    );

    const showNoAgentDialog = useCallback(
        (extraStep?: boolean, rowData?: any) => {
            setDialog(
                <DialogComponent
                    header={
                        <div
                            className={styles.headerClass}
                            style={{ display: 'flex', justifyContent: 'space-between' }}
                        >
                            <DsTypography variant="Regular_14">{protectHeader}</DsTypography>
                            {extraStep && (
                                <DsTypography variant="Regular_14" className={styles.protectionHeaderText}>
                                    {t('databases.inventory.step-2-out-of')}
                                </DsTypography>
                            )}
                        </div>
                    }
                    content={<NoAgentDialog dialogType={dialogType} />}
                    primaryButton={t('databases.inventory.redirect')}
                    secondaryButton={GENERAL.CANCEL}
                    closeCallback={closeDialog}
                    callback={() => {
                        bxpRedirect(isWorkloadFactory, rowData);
                    }}
                    customClass={styles.protectionDialog}
                />
            );
        },
        [closeDialog, dialogType, isWorkloadFactory, protectHeader, setDialog, t]
    );

    const showSingleAgentDialog = useCallback(
        (connectors?: any, hostExists?: boolean, rowData?: any, extraStep?: boolean) => {
            const dialogKeyValue = `${rowData.databaseInstanceName}_${rowData.name}_${rowData.credentialId}_${rowData.regionId}`;
            const protectionState = store.getState().snapCenter.protectionProcessState[dialogKeyValue];
            if (protectionState?.step1Status === 'running' || protectionState?.step2Status === 'running') {
                dispatch(setActionsDisabled(true));
            } else {
                dispatch(setActionsDisabled(false));
            }

            setDialog(
                <DialogComponent
                    header={
                        <div
                            className={styles.headerClass}
                            style={{ display: 'flex', justifyContent: 'space-between' }}
                        >
                            <DsTypography variant="Regular_14">{protectHeader}</DsTypography>
                            {!hostExists && !extraStep && (
                                <DsTypography variant="Regular_14" className={styles.protectionHeaderText}>
                                    {t('databases.inventory.step-1-out-of')}
                                </DsTypography>
                            )}
                            {extraStep && !hostExists && (
                                <DsTypography variant="Regular_14" className={styles.protectionHeaderText}>
                                    {t('databases.inventory.step-2-out-of-3')}
                                </DsTypography>
                            )}
                        </div>
                    }
                    content={
                        <SingleAgentDialog
                            agents={connectors}
                            hostExists={hostExists}
                            dialogKey={dialogKeyValue}
                            extraStep={extraStep}
                            rowData={rowData}
                            dialogType={dialogType}
                        />
                    }
                    primaryButton={hostExists ? t('databases.inventory.redirect') : t('databases.inventory.continue')}
                    secondaryButton={t('databases.inventory.cancel')}
                    closeCallback={closeDialog}
                    callback={() => {
                        if (hostExists) {
                            if (dialogType === 'database') {
                                bxpRedirect(isWorkloadFactory, rowData, 'database', undefined, getDiscoverHostResult);
                            } else {
                                bxpRedirect(isWorkloadFactory, rowData, 'instance', getDiscoverInstanceResult);
                            }
                        } else {
                            addHostHandlerSc(
                                rowData,
                                dispatch,
                                generateCredentialID,
                                addHostScApi,
                                addHostJobScApi,
                                t,
                                deleteHostSc,
                                listAllDirectories,
                                configureDirectory,
                                getDiscoverHostResult
                            );
                        }
                    }}
                    customClass={styles.protectionDialog}
                    dialogFrom={FROM_DIALOG.SINGLE_AGENT}
                />
            );
        },
        [
            addHostJobScApi,
            addHostScApi,
            closeDialog,
            configureDirectory,
            deleteHostSc,
            dialogType,
            dispatch,
            generateCredentialID,
            getDiscoverHostResult,
            getDiscoverInstanceResult,
            isWorkloadFactory,
            listAllDirectories,
            protectHeader,
            setDialog,
            t
        ]
    );

    const scAuthDialog = useCallback(
        (key: string, dialogToOpen: string, activeAgents?: unknown[], boolValue?: boolean, rowData?: any) => {
            setDialog(
                <DialogComponent
                    header={
                        <div
                            className={styles.headerClass}
                            style={{ display: 'flex', justifyContent: 'space-between' }}
                        >
                            <DsTypography variant="Regular_14">{protectHeader}</DsTypography>
                            <DsTypography variant="Regular_14" className={styles.protectionHeaderText}>
                                {t('databases.inventory.step-1-out-of')}
                            </DsTypography>
                        </div>
                    }
                    content={<WindowsAuthDialog />}
                    primaryButton={t('databases.inventory.continue')}
                    secondaryButton={GENERAL.CANCEL}
                    closeCallback={() => {
                        dispatch(cancelProtectionForRow(key));
                        closeDialog();
                    }}
                    callback={async () => {
                        try {
                            dispatch(setAuthVerification(true));
                            const state = store.getState();
                            const credDetails = state.snapCenter.credentials;
                            const { isGovAccount } = state.auth;
                            const credential = isGovAccount
                                ? {
                                      resourceId: rowData?.databaseInstanceName,
                                      resourceType: DETECT_HOST_VAR.WINDOWS,
                                      ssmParameterArn: credDetails.ssmParameterArn || ''
                                  }
                                : {
                                      resourceId: rowData?.databaseInstanceName,
                                      resourceType: DETECT_HOST_VAR.WINDOWS,
                                      username: credDetails.username,
                                      password: credDetails.password
                                  };
                            const payload = {
                                items: [
                                    {
                                        credentials: [credential],
                                        ec2InstanceId: rowData?.ec2InstanceId,
                                        region: rowData.regionId,
                                        credentialsId: rowData.credentialId
                                    }
                                ]
                            };
                            const result = await registerResourceCredBulk({ payload });
                            const authFailedMsg = t('databases.inventory.authentication-failed-msg');
                            if (result && !result?.error && result?.data) {
                                if (result?.data?.items[0]?.registerDetails[0]?.databaseServerError) {
                                    dispatch(setAuthVerification(false));
                                    dispatch(
                                        addNotification({
                                            notificationType: NOTIFICATION_TYPES.ERROR,
                                            message:
                                                result?.data?.items[0]?.registerDetails[0]?.databaseServerError ||
                                                authFailedMsg
                                        })
                                    );
                                } else {
                                    dispatch(
                                        setDataForRow({
                                            key,
                                            stepData: {
                                                scCredentialsChecked: true,
                                                scCredentialsValid: true
                                            }
                                        })
                                    );

                                    if (dialogToOpen === 'openNoAgent') {
                                        setTimeout(() => {
                                            showNoAgentDialog(true, rowData);
                                        }, 10);
                                    } else {
                                        setTimeout(() => {
                                            showSingleAgentDialog(activeAgents, boolValue, rowData, true);
                                        }, 10);
                                    }
                                }
                            } else {
                                dispatch(
                                    addNotification({
                                        notificationType: NOTIFICATION_TYPES.ERROR,
                                        message: result?.error?.data?.message || authFailedMsg
                                    })
                                );
                            }
                        } catch (error) {
                            dispatch(setAuthVerification(false));
                            dispatch(
                                addNotification({
                                    notificationType: NOTIFICATION_TYPES.ERROR,
                                    message: t('databases.inventory.authentication-failed-msg')
                                })
                            );
                        } finally {
                            dispatch(setAuthVerification(false));
                        }
                    }}
                    customClass={styles.protectionDialog}
                    dialogFrom={FROM_DIALOG.WINDOWS_AUTH}
                />
            );
        },
        [
            closeDialog,
            dispatch,
            protectHeader,
            registerResourceCredBulk,
            setDialog,
            showNoAgentDialog,
            showSingleAgentDialog,
            t
        ]
    );

    const startProtection = useCallback(
        async (rowData: any) => {
            await handleProtectionUtil(rowData, {
                dispatch,
                fetchDialog,
                showSingleAgentDialog,
                showNoAgentDialog,
                closeDialog,
                listExistingHosts,
                getWorkSpaceID,
                getConnector,
                getFsxDetails,
                discoverExistingFsxN,
                assignRBACPrivileges,
                getRBACPrivileges,
                getBackupRecoveryLicense,
                assignBackupRecoveryLicense,
                isDemoMode,
                getSCCrendentials,
                scAuthDialog,
                getOrganizationIds
            });
        },
        [
            assignBackupRecoveryLicense,
            assignRBACPrivileges,
            closeDialog,
            discoverExistingFsxN,
            dispatch,
            fetchDialog,
            getBackupRecoveryLicense,
            getConnector,
            getFsxDetails,
            getOrganizationIds,
            getRBACPrivileges,
            getSCCrendentials,
            getWorkSpaceID,
            isDemoMode,
            listExistingHosts,
            scAuthDialog,
            showNoAgentDialog,
            showSingleAgentDialog
        ]
    );

    const startEditProtection = useCallback(
        (rowData: any) => {
            const { isGovAccount } = store.getState().auth;
            if (isGovAccount) return;
            if (dialogType === 'database') {
                bxpRedirect(
                    isWorkloadFactory,
                    { ...rowData, editProtection: true },
                    'database',
                    undefined,
                    getDiscoverHostResult
                );
            } else {
                bxpRedirect(
                    isWorkloadFactory,
                    { ...rowData, editProtection: true },
                    'instance',
                    getDiscoverInstanceResult
                );
            }
        },
        [dialogType, getDiscoverHostResult, getDiscoverInstanceResult, isWorkloadFactory]
    );

    return { startProtection, startEditProtection };
}
