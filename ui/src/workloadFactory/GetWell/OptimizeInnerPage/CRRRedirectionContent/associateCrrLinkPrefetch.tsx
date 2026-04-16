import { ReactNode, useCallback } from 'react';
import { BlueXPListeners, postBlueXPMessage } from '@tlveng/wlm-ds';
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
    useAssociateSelectedLinkMutation
} from '../../../../utils/apiService';
import { addNotification, NOTIFICATION_TYPES } from '../../../../store/notificationSlice';
import DialogComponent from '../../../../common/Dialog/DialogComponent';
import CRRDataDiaolgContent from './CRRDataDialogContent';
import styles from './CRRRedirectionContent.module.scss';
import store from '../../../../store/store';
import { FROM_DIALOG } from '../../../../utils/consts';

export type AssociateCrrLinkPrefetchResult = {
    runAssociateLinkPrefetch: (rowData: any, dialogHeader: ReactNode) => Promise<void>;
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

    const runAssociateLinkPrefetch = useCallback(
        async (rowData: any, dialogHeader: ReactNode) => {
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
                        postBlueXPMessage({
                            type: BlueXPListeners.navigate,
                            payload: {
                                pathname: `../../administration/links/create?awsAccount=${
                                    fsxDetails?.awsAccountId
                                }&from=${workloadFactory ? '/databases' : '/fsxdb'}/inventory/${credId}/${
                                    fsxDetails?.region
                                }/${
                                    fsxDetails?.id
                                }/resource/${selectedResourceId}/instance/${selectedDatabaseInstance}/host/${selectedHostname}/db/${selectedDatabaseInstanceName}/volumeName/${
                                    rowData?.volumeName
                                }/target/crr/overview&region=${fsxDetails?.region}&securityGroupId=${
                                    fsxDetails?.securityGroups[0]?.id
                                }&securityGroupName=${fsxDetails?.securityGroups[0]?.name}&subnetCidr=${
                                    fsxDetails?.subnets[0]?.cidrBlock
                                }&subnetId=${fsxDetails?.subnets[0]?.id}&vpcCidr=${
                                    fsxDetails?.vpcInfo?.vpcCidr
                                }&vpcId=${fsxDetails?.subnets[0]?.vpcId}&vpcName=${fsxDetails?.vpcInfo?.vpcName}`,
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
                            closeDialog();
                        }
                    }
                };

                const openCRRDataDialog = () => {
                    setDialog(
                        <DialogComponent
                            header={dialogHeader}
                            content={<CRRDataDiaolgContent />}
                            primaryButton={t('databases.general.continue')}
                            secondaryButton={t('databases.general.cancel')}
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
                };

                if (associatedLinksResponse?.data) {
                    dispatch(setAssociatedLinks(associatedLinksResponse.data));
                    if (associatedLinksResponse.data.count === 0) {
                        openCRRDataDialog();
                    } else {
                        const { fsxDetails } = store.getState().crrRedirection;
                        const fsxVolumeId = btoa(JSON.stringify([rowData?.volumeId]));
                        postBlueXPMessage({
                            type: BlueXPListeners.navigate,
                            payload: {
                                pathname: `../../wlmfsx/fsx/clusters/${selectedGwInstanceCredId}/${
                                    fsxDetails?.region
                                }/${fsxDetails?.id}/replication/create?selectedSrcVolumeIds=${fsxVolumeId}&fromParent=/${
                                    isWorkloadFactory ? 'databases' : 'fsxdb'
                                }/inventory`,
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
            setDialog,
            t
        ]
    );

    return { runAssociateLinkPrefetch };
}
