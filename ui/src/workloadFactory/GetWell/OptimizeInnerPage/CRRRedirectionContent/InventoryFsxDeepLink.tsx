import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import HeaderComponent from '../../../DatabaseHomePage/HeaderComponent/HeaderComponent';
import { WLF_TABS } from '../../../../utils/consts';
import { useAssociateSelectedLinkMutation, useCheckExistingLinkMutation } from '../../../../utils/apiService';
import { addNotification, NOTIFICATION_TYPES } from '../../../../store/notificationSlice';

const InventoryFsxDeepLink = () => {
    const { credId, regionId, fsxId } = useParams();
    const dispatch = useDispatch();
    const [checkExistingLinkApi] = useCheckExistingLinkMutation();
    const [associateSelectedLinkApi] = useAssociateSelectedLinkMutation();

    useEffect(() => {
        let cancelled = false;

        const run = async () => {
            const checkResult: any = await checkExistingLinkApi({ fsxId: fsxId as string });

            if (cancelled) return;

            const items = checkResult?.data?.items ?? [];
            const sorted = [...items].sort(
                (a: { creationTime?: number }, b: { creationTime?: number }) =>
                    (b.creationTime ?? 0) - (a.creationTime ?? 0)
            );
            const latest = sorted[0];

            if (latest?.state?.status?.toLowerCase() === 'connected') {
                const associateResult: any = await associateSelectedLinkApi({
                    credentialId: credId as string,
                    region: regionId as string,
                    fsxId: fsxId as string,
                    payload: { linkId: latest.id }
                });

                if (!cancelled && associateResult?.data === null && !associateResult?.error) {
                    dispatch(
                        addNotification({
                            notificationType: NOTIFICATION_TYPES.SUCCESS,
                            message: 'Link associated successfully.'
                        })
                    );
                }
            }
        };

        run();

        return () => {
            cancelled = true;
        };
    }, [credId, regionId, fsxId, checkExistingLinkApi, associateSelectedLinkApi, dispatch]);

    return <HeaderComponent tab={WLF_TABS.INVENTORY} />;
};

export default InventoryFsxDeepLink;
