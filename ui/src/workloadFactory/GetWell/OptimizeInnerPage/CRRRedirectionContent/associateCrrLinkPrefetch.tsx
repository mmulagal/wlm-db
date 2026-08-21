import { ReactNode, useCallback } from 'react';
import { BlueXPListeners, postBlueXPMessage } from '@tlveng/wlm-ds';
import { Button } from '@netapp/design-system';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import {
    setAssociatedLinks,
    setAssociateLinkLoading,
    setCrrPrefetchLoading,
    setFsxDetails,
    setFsxDetailsLoading,
    setShowLinkError
} from '../../../../store/workloadFactory/crrRedirectionSlice';
import {
    useGetAssociatedLinksMutation,
    useGetFsxDetailsForLinkRedirectMutation,
    useCheckExistingLinkMutation,
    useDeleteExistingLinkMutation,
    useAssociateSelectedLinkMutation,
    useTriggerInstanceAssessmentMutation,
    useTriggerOracleInstanceAssessmentMutation,
    useTriggerUnregisteredMssqlAssessmentMutation,
    useTriggerUnregisteredOracleAssessmentMutation,
    useLazyGetSubTaskListQuery
} from '../../../../utils/apiService';
import { addNotification, NOTIFICATION_TYPES } from '../../../../store/notificationSlice';
import { setInventoryTableData } from '../../../../store/workloadFactory/inventoryV2Slice';
import { setRefreshOracleWellArchitect } from '../../../../store/workloadFactory/oracleSlice';
import {
    setFsxLinkExists,
    setGwAdhocError,
    setGwRefreshPage
} from '../../../../store/workloadFactory/getWellOptimizeSlice';
import { markInstanceFsxLinkExistsInInventory } from '../../../InventoryV2/InventoryUtilsV2';
import { resetGwValuesOnRefresh } from '../../GetWellUtils';
import { handleTriggerAssessment, handleWellArchitectRefresh } from '../../../../utils/resourceUtils';
import { GENERAL } from '../../../../utils/appConstants';
import { DBType, FROM_DIALOG } from '../../../../utils/consts';
import DialogComponent from '../../../../common/Dialog/DialogComponent';
import CRRDataDiaolgContent from './CRRDataDialogContent';
import styles from './CRRRedirectionContent.module.scss';
import store from '../../../../store/store';

export type AssociateCrrLinkPrefetchResult = {
    runAssociateLinkPrefetch: (
        rowData: any,
        dialogHeader: ReactNode,
        isWad?: boolean,
        triggerAssessmentOnSuccess?: boolean
    ) => Promise<void>;
};

/** Pass `setDialog` / `closeDialog` from the parent’s `useDialog()` so the dialog context is not subscribed twice. */
export function useAssociateCrrLinkPrefetch(
    setDialog: (content: ReactNode) => void,
    closeDialog: (payload?: unknown) => void
): AssociateCrrLinkPrefetchResult {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const [getAssociatedLinksApi] = useGetAssociatedLinksMutation();
    const [getFsxDetailsForLinkRedirectApi] = useGetFsxDetailsForLinkRedirectMutation();
    const [checkExistingLinkApi] = useCheckExistingLinkMutation();
    const [deleteExistingLinkApi] = useDeleteExistingLinkMutation();
    const [associateSelectedLinkApi] = useAssociateSelectedLinkMutation();
    const [triggerMssqlAssessmentApi] = useTriggerInstanceAssessmentMutation();
    const [triggerOracleAssessmentApi] = useTriggerOracleInstanceAssessmentMutation();
    const [triggerUnregisteredMssqlAssessmentApi] = useTriggerUnregisteredMssqlAssessmentMutation();
    const [triggerUnregisteredOracleAssessmentApi] = useTriggerUnregisteredOracleAssessmentMutation();
    const [getJobDetailApi] = useLazyGetSubTaskListQuery();

    const runPostLinkAssociateActions = useCallback(() => {
        const state = store.getState();
        const {
            selectedResourceId,
            selectedDatabaseInstance,
            selectedDatabaseInstanceName,
            selectedGwInstanceCredId,
            selectedGwInstanceRegionId,
            isUnregistered,
            configEngineType
        } = state.getWellOptimize;
        const { inventoryTableData, registerHostType } = state.inventoryV2;
        const {
            selectedResourceId: oracleResourceId,
            selectedDatabaseInstance: oracleInstanceId,
            selectedResourceCredId,
            selectedResourceRegionId
        } = state.workloadFactoryResource;
        const { isWorkloadFactory, accountId } = state.auth;
        const dbType = configEngineType || registerHostType || DBType.MSSQL;
        const isOracle = dbType === DBType.ORACLE;

        const updatedInventory = markInstanceFsxLinkExistsInInventory(inventoryTableData, {
            resourceId: selectedResourceId,
            credId: selectedGwInstanceCredId,
            regionId: selectedGwInstanceRegionId,
            instanceId: selectedDatabaseInstance,
            instanceName: selectedDatabaseInstanceName
        });
        if (updatedInventory) {
            dispatch(setInventoryTableData(updatedInventory));
        }
        dispatch(setFsxLinkExists(true));

        const refreshGetWellPage = () => {
            handleWellArchitectRefresh(
                dispatch,
                resetGwValuesOnRefresh,
                isOracle ? setRefreshOracleWellArchitect : setGwRefreshPage
            );
        };
        const createNotificationMessage = (handleJobMonitoringClick: () => void) => (
            <div>
                {t('databases.well-architect.assessment-track-in-progress')}{' '}
                <Button Component="button" variant="text" onClick={handleJobMonitoringClick}>
                    {GENERAL.JOB_MONITORING}.
                </Button>
            </div>
        );

        handleTriggerAssessment({
            setTriggerAssessmentInProgress: () => undefined,
            triggerAssessmentApi: isOracle ? triggerOracleAssessmentApi : triggerMssqlAssessmentApi,
            triggerUnregisteredAssessmentApi: isOracle
                ? triggerUnregisteredOracleAssessmentApi
                : triggerUnregisteredMssqlAssessmentApi,
            credentialId: isOracle ? selectedResourceCredId || selectedGwInstanceCredId : selectedGwInstanceCredId,
            regionId: isOracle ? selectedResourceRegionId || selectedGwInstanceRegionId : selectedGwInstanceRegionId,
            selectedResourceId: isUnregistered
                ? selectedResourceId || oracleResourceId
                : oracleResourceId || selectedResourceId,
            selectedDatabaseInstance: oracleInstanceId || selectedDatabaseInstance,
            instanceName: selectedDatabaseInstanceName,
            accountId,
            isUnregistered,
            dispatch,
            isWorkloadFactory,
            getJobDetailApi,
            refreshGetWellPage,
            setGwAdhocError,
            t,
            createNotificationMessage
        });
    }, [
        dispatch,
        getJobDetailApi,
        t,
        triggerMssqlAssessmentApi,
        triggerOracleAssessmentApi,
        triggerUnregisteredMssqlAssessmentApi,
        triggerUnregisteredOracleAssessmentApi
    ]);

    const runAssociateLinkPrefetch = useCallback(
        async (rowData: any, dialogHeader: ReactNode, isWad: boolean = false, triggerAssessmentOnSuccess = false) => {
            dispatch(setCrrPrefetchLoading(true));
            try {
                const stateBefore = store.getState();
                const { selectedGwInstanceCredId, selectedRowFsxId, selectedGwInstanceRegionId } =
                    stateBefore.getWellOptimize;
                const { isWorkloadFactory } = stateBefore.auth;

                const associatedLinksResponse: any = await getAssociatedLinksApi({ fsxId: selectedRowFsxId });

                dispatch(setFsxDetailsLoading(true));
                const fsxDetailsResponse = await getFsxDetailsForLinkRedirectApi({
                    credentialId: selectedGwInstanceCredId,
                    region: selectedGwInstanceRegionId,
                    fsxId: selectedRowFsxId
                });
                dispatch(setFsxDetails(fsxDetailsResponse?.data ?? null));
                dispatch(setFsxDetailsLoading(false));

                const handleNavigation = async () => {
                    const state = store.getState();
                    const { selectedLinkOption, fsxDetails, selectedExistingLink } = state.crrRedirection;
                    const {
                        selectedGwInstanceCredId: credId,
                        selectedResourceId,
                        selectedDatabaseInstance,
                        selectedHostname,
                        selectedDatabaseInstanceName
                    } = state.getWellOptimize;
                    const workloadFactory = state.auth.isWorkloadFactory;

                    if (selectedLinkOption === 'createNewLink') {
                        const pathname = `../../${
                            workloadFactory ? 'administration' : 'fsxadministration'
                        }/links/create?awsAccount=${fsxDetails?.awsAccountId}&from=${
                            workloadFactory ? '/databases' : '/fsxdb'
                        }/inventory/${credId}/${fsxDetails?.region}/${
                            fsxDetails?.id
                        }/resource/${selectedResourceId}/instance/${selectedDatabaseInstance}/host/${selectedHostname}/db/${selectedDatabaseInstanceName}/volumeName/${
                            rowData?.volumeName
                        }/target/crr/comingFrom/createNewLink/overview&region=${fsxDetails?.region}&securityGroupId=${
                            fsxDetails?.securityGroups[0]?.id
                        }&securityGroupName=${fsxDetails?.securityGroups[0]?.name}&subnetCidr=${
                            fsxDetails?.subnets[0]?.cidrBlock
                        }&subnetId=${fsxDetails?.subnets[0]?.id}&vpcCidr=${fsxDetails?.vpcInfo?.vpcCidr}&vpcId=${
                            fsxDetails?.subnets[0]?.vpcId
                        }&vpcName=${fsxDetails?.vpcInfo?.vpcName}`;

                        postBlueXPMessage({
                            type: BlueXPListeners.navigate,
                            payload: {
                                pathname,
                                replace: true
                            }
                        });
                    } else {
                        if (!selectedExistingLink) {
                            dispatch(setShowLinkError(true));
                            return;
                        }

                        dispatch(setAssociateLinkLoading(true));

                        const checkResult: any = await checkExistingLinkApi({ fsxId: fsxDetails?.id });

                        if (checkResult?.data?.count > 0) {
                            const existingLinkId = checkResult?.data?.items?.[0]?.id;
                            await deleteExistingLinkApi({
                                credentialId: credId,
                                region: fsxDetails?.region,
                                fsxId: fsxDetails?.id,
                                linkId: existingLinkId
                            });
                        }

                        const associateResult: any = await associateSelectedLinkApi({
                            credentialId: credId,
                            region: fsxDetails?.region,
                            fsxId: fsxDetails?.id,
                            payload: { linkId: selectedExistingLink?.id }
                        });

                        dispatch(setAssociateLinkLoading(false));

                        if (associateResult?.data === null && !associateResult?.error) {
                            dispatch(
                                addNotification({
                                    notificationType: NOTIFICATION_TYPES.SUCCESS,
                                    message: t('databases.inventory.link-associate')
                                })
                            );
                            if (triggerAssessmentOnSuccess) {
                                runPostLinkAssociateActions();
                            }
                            closeDialog();
                        }
                    }
                };

                const openCRRDataDialog = () => {
                    if (isWad) {
                        setDialog(
                            <DialogComponent
                                header={dialogHeader}
                                content={<CRRDataDiaolgContent isWad={isWad} />}
                                primaryButton={t('databases.general.close')}
                                callback={() => {
                                    closeDialog();
                                }}
                                closeCallback={() => {
                                    closeDialog();
                                }}
                                customClass="oneTimeWADDialog"
                            />
                        );
                    } else {
                        setDialog(
                            <DialogComponent
                                header={dialogHeader}
                                content={<CRRDataDiaolgContent isWad={isWad} />}
                                primaryButton={t('databases.general.continue')}
                                secondaryButton={t('databases.general.close')}
                                callback={() => {
                                    handleNavigation();
                                }}
                                closeCallback={() => {
                                    closeDialog();
                                }}
                                customClass={styles.crrDataDialog}
                                dialogFrom={FROM_DIALOG.CRR_REDIRECTION}
                            />
                        );
                    }
                };

                if (associatedLinksResponse?.data) {
                    dispatch(setAssociatedLinks(associatedLinksResponse.data));
                    if (associatedLinksResponse.data.count === 0) {
                        openCRRDataDialog();
                    } else {
                        const state = store.getState();
                        const { fsxDetails } = state.crrRedirection;
                        const {
                            selectedGwInstanceCredId: credId,
                            selectedResourceId,
                            selectedDatabaseInstance,
                            selectedHostname,
                            selectedDatabaseInstanceName
                        } = state.getWellOptimize;
                        const fsxVolumeId = btoa(JSON.stringify([rowData?.volumeId]));
                        postBlueXPMessage({
                            type: BlueXPListeners.navigate,
                            payload: {
                                pathname: `../../wlmfsx/fsx/clusters/${selectedGwInstanceCredId}/${
                                    fsxDetails?.region
                                }/${
                                    fsxDetails?.id
                                }/replication/create?selectedSrcVolumeIds=${fsxVolumeId}&fromParent=/${
                                    isWorkloadFactory ? 'databases' : 'fsxdb'
                                }/inventory/${credId}/${fsxDetails?.region}/${
                                    fsxDetails?.id
                                }/resource/${selectedResourceId}/instance/${selectedDatabaseInstance}/host/${selectedHostname}/db/${selectedDatabaseInstanceName}/volumeName/${
                                    rowData?.volumeName
                                }/target/crr/comingFrom/replicateWizard`,
                                replace: true
                            }
                        });
                        closeDialog();
                    }
                } else {
                    closeDialog();
                }
            } finally {
                dispatch(setCrrPrefetchLoading(false));
            }
        },
        [
            associateSelectedLinkApi,
            checkExistingLinkApi,
            closeDialog,
            deleteExistingLinkApi,
            dispatch,
            getAssociatedLinksApi,
            getFsxDetailsForLinkRedirectApi,
            runPostLinkAssociateActions,
            setDialog,
            t
        ]
    );

    return { runAssociateLinkPrefetch };
}
