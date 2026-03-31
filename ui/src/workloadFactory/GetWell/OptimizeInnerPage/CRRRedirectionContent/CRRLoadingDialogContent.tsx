import { useEffect } from 'react';
import { DsSpinner, useDialog } from '@netapp/design-system';
import { BlueXPListeners, DsTypography, postBlueXPMessage } from '@tlveng/wlm-ds';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import {
    setAssociatedLinks,
    setAssociateLinkLoading,
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
import { useAppSelector } from '../../../../store/storeHooks';
import store from '../../../../store/store';

interface CRRLoadingDialogContentProps {
    rowData?: any;
}

const CRRLoadingDialogContent = ({ rowData }: CRRLoadingDialogContentProps) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();

    const { selectedGwInstanceCredId, selectedRowFsxId, selectedGwInstanceRegionId } = useAppSelector(
        state => state.getWellOptimize
    );
    const { isWorkloadFactory } = useAppSelector(state => state.auth);
    const { setDialog, closeDialog } = useDialog();
    const [getAssociatedLinksApi] = useGetAssociatedLinksMutation();
    const [getFsxDetailsForLinkRedirectApi] = useGetFsxDetailsForLinkRedirectMutation();
    const [checkExistingLinkApi] = useCheckExistingLinkMutation();
    const [deleteExistingLinkApi] = useDeleteExistingLinkMutation();
    const [associateSelectedLinkApi] = useAssociateSelectedLinkMutation();

    const dialogHeader = (
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <DsTypography variant="Regular_16">Associate Link</DsTypography>
            <DsTypography variant="Regular_14">{t('databases.inventory.step-1-out-of')}</DsTypography>
        </div>
    );

    const handleNavigation = async () => {
        const state = store.getState();
        const { selectedLinkOption, fsxDetails, selectedExistingLink } = state.crrRedirection;
        if (selectedLinkOption === 'createNewLink') {
            postBlueXPMessage({
                type: BlueXPListeners.navigate,
                payload: {
                    pathname: `../../administration/links/create?awsAccount=${fsxDetails?.awsAccountId}&from=${
                        isWorkloadFactory ? '/databases' : '/fsxdb'
                    }/inventory/${selectedGwInstanceCredId}/${fsxDetails?.region}/${fsxDetails?.id}/overview&region=${
                        fsxDetails?.region
                    }&securityGroupId=${fsxDetails?.securityGroups[0]?.id}&securityGroupName=${
                        fsxDetails?.securityGroups[0]?.name
                    }&subnetCidr=${fsxDetails?.subnets[0]?.cidrBlock}&subnetId=${fsxDetails?.subnets[0]?.id}&vpcCidr=${
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
                    credentialId: selectedGwInstanceCredId,
                    region: fsxDetails?.region,
                    fsxId: fsxDetails?.id,
                    linkId: existingLinkId
                });
            }

            const associateResult: any = await associateSelectedLinkApi({
                credentialId: selectedGwInstanceCredId,
                region: fsxDetails?.region,
                fsxId: fsxDetails?.id,
                payload: { linkId: selectedExistingLink?.id }
            });

            dispatch(setAssociateLinkLoading(false));

            if (associateResult?.data === null && !associateResult?.error) {
                dispatch(
                    addNotification({
                        notificationType: NOTIFICATION_TYPES.SUCCESS,
                        message: 'Link associated successfully.'
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
                primaryButton="Continue"
                secondaryButton="Cancel"
                callback={() => {
                    handleNavigation();
                }}
                closeCallback={() => {
                    closeDialog();
                }}
                customClass={styles.crrDataDialog}
                dialogFrom="crrRedirection"
            />
        );
    };

    useEffect(() => {
        const fetchAssociatedLinks = async () => {
            const associatedLinksResponse: any = await getAssociatedLinksApi({ fsxId: selectedRowFsxId });

            dispatch(setFsxDetailsLoading(true));
            const fsxDetailsResponse = await getFsxDetailsForLinkRedirectApi({
                credentialId: selectedGwInstanceCredId,
                region: selectedGwInstanceRegionId,
                fsxId: selectedRowFsxId
            });
            dispatch(setFsxDetails(fsxDetailsResponse?.data ?? null));
            dispatch(setFsxDetailsLoading(false));

            if (associatedLinksResponse?.data) {
                dispatch(setAssociatedLinks(associatedLinksResponse.data));
                if (associatedLinksResponse.data.count === 0) {
                    openCRRDataDialog();
                } else {
                    const state = store.getState();
                    const { fsxDetails } = state.crrRedirection;
                    const fsxVolumeId = btoa(JSON.stringify([rowData?.volumeId]));
                    postBlueXPMessage({
                        type: BlueXPListeners.navigate,
                        payload: {
                            pathname: `../../wlmfsx/fsx/clusters/${selectedGwInstanceCredId}/${fsxDetails?.region}/${
                                fsxDetails?.id
                            }/replication/create?selectedSrcVolumeIds=${fsxVolumeId}&fromParent=/${
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
        };
        fetchAssociatedLinks();
    }, []);

    return (
        <div className={styles.crrRedirectionContent}>
            <DsSpinner />
        </div>
    );
};

export default CRRLoadingDialogContent;
