import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useSearchParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import HeaderComponent from '../../../DatabaseHomePage/HeaderComponent/HeaderComponent';
import ComponentLoader from '../../../../common/ComponentLoader/ComponentLoader';
import { ASSESSMENT_CONFIG_NAMES, DBType, GETWELL_STATUS, WLF_TABS } from '../../../../utils/consts';
import {
    useAssociateSelectedLinkMutation,
    useGetExistingLinksMutation,
    useCheckExistingLinkMutation,
    useDeleteExistingLinkMutation,
    useGetOracleAssessmentDataMutation
} from '../../../../utils/apiService';
import { addNotification, NOTIFICATION_TYPES } from '../../../../store/notificationSlice';
import {
    setBreadCrumbSelectedFrom,
    setRegisterHostType,
    setSelectedOptimizeConfig,
    setWizardOperationType
} from '../../../../store/workloadFactory/inventoryV2Slice';
import {
    setFSXId,
    setGwPageLoadInstanceData,
    setIsAssessmentAvailable,
    setLandingFrom,
    setOptimizePageLoading,
    setGwSelectedRowFsxId,
    setDriftAssessmentData
} from '../../../../store/workloadFactory/getWellOptimizeSlice';
import {
    resetWorkloadFactoryResourceData,
    setSelectedHostname,
    setSelectedResourcePageHostData
} from '../../../../store/workloadFactory/workloadFactoryResourceSlice';
import { resetEiData } from '../../../../store/workloadFactory/agenticAISlice';
import store from '../../../../store/store';
import {
    formatOracleWellArchitectedData,
    oracleCardData
} from '../../../Oracle/OracleResourcePages/OracleWellArchitectDashboard/OracleWellArchitectedUtils';
import { generateDynamicOracleStorageMockData, updateAccountLevelAssessmentData } from '../../GetWellUtils';

const INVENTORY_CRR_TARGET = 'crr';

const safeDecode = (value: string | undefined) => {
    if (value == null || value === '') return '';
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
};

const buildOracleCrrFallbackCard = () => ({
    ...oracleCardData.crr,
    block_two: { ...oracleCardData.crr.block_two, value: GETWELL_STATUS.NOT_OPTIMIZED },
    block_four: { ...oracleCardData.crr.block_four, value: GETWELL_STATUS.WARNING },
    block_five: { ...oracleCardData.crr.block_five, value: 'Volume' },
    block_six: {
        ...oracleCardData.crr.block_six,
        value: '0 out of 0',
        count: { totalObjectsAssessed: 0, totalObjectsInViolation: 0 }
    },
    objectsInViolation: [],
    recommendationText: oracleCardData.crr.recommendation?.description
});

const InventoryFsxDeepLink = () => {
    const dispatch = useDispatch();
    const [searchParams] = useSearchParams();
    const ec2InstanceIdFromQuery = searchParams.get('ec2InstanceId') || '';
    const asmManagedFromQuery = searchParams.get('asmManaged') === 'true';

    const params = useParams<{
        credId: string;
        regionId: string;
        fsxId: string;
        /** Set only for `/inventory/.../:fsxId/:tab` (short FSx associate route), not for CRR `/.../:fsxId/resource/...`. */
        tab?: string;
        resourceId?: string;
        instanceId?: string;
        hostname?: string;
        dbInstanceName?: string;
        /** Present when URL includes `/volumeName/:volumeName/` before `/target/`. */
        volumeName?: string;
        target?: string;
    }>();

    const {
        credId,
        regionId,
        fsxId,
        resourceId: resourceIdParam,
        instanceId: instanceIdParam,
        hostname: hostnameParam,
        dbInstanceName: dbInstanceParam,
        target: targetParam
    } = params;

    const [getExistingLinkApi] = useGetExistingLinksMutation();
    const [associateSelectedLinkApi] = useAssociateSelectedLinkMutation();
    const [checkExistingLinkApi] = useCheckExistingLinkMutation();
    const [deleteExistingLinkApi] = useDeleteExistingLinkMutation();
    const [getOracleAssessmentDataApi] = useGetOracleAssessmentDataMutation();
    const { t } = useTranslation();

    /** Oracle CRR optimize-inner deep link only; `target` === `crr` in the URL. */
    const isCrrDeepLink = useMemo(() => targetParam?.toLowerCase() === INVENTORY_CRR_TARGET, [targetParam]);

    const [crrPrepareDone, setCrrPrepareDone] = useState(!isCrrDeepLink);

    useEffect(() => {
        let cancelled = false;

        const runAssociateFsxLink = async () => {
            const checkResult: any = await getExistingLinkApi({});

            if (cancelled) return;

            const items = checkResult?.data?.items ?? [];
            const sorted = [...items].sort(
                (a: { creationTime?: number }, b: { creationTime?: number }) =>
                    (b.creationTime ?? 0) - (a.creationTime ?? 0)
            );
            const latest = sorted[0];

            if (latest?.state?.status?.toLowerCase() === 'connected') {
                const linkCheck: any = await checkExistingLinkApi({ fsxId });

                if (linkCheck?.data?.count > 0) {
                    const existingLinkId = linkCheck?.data?.items?.[0]?.id;
                    await deleteExistingLinkApi({
                        credentialId: credId,
                        region: regionId,
                        fsxId,
                        linkId: existingLinkId
                    });
                }
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
                            message: t('databases.inventory.link-associate')
                        })
                    );
                }
            }
        };

        const applyOracleCrrInventoryContext = () => {
            const hostLabel = safeDecode(hostnameParam);
            const dbName = safeDecode(dbInstanceParam);
            const resourceId = resourceIdParam as string;
            const instanceId = instanceIdParam as string;
            const ec2InstanceId = ec2InstanceIdFromQuery;
            const asmManaged = asmManagedFromQuery;

            dispatch(setLandingFrom(WLF_TABS.INVENTORY));
            dispatch(setBreadCrumbSelectedFrom(WLF_TABS.INVENTORY));
            dispatch(setRegisterHostType(DBType.ORACLE));
            dispatch(setWizardOperationType('single'));
            dispatch(
                setFSXId({
                    fsxId: fsxId as string,
                    ec2InstanceId,
                    isInstanceStorageAsmManaged: asmManaged
                })
            );
            dispatch(
                setGwPageLoadInstanceData({
                    hostname: hostLabel,
                    resourceId,
                    instanceId,
                    instanceName: dbName,
                    credId: credId as string,
                    regionId: regionId as string,
                    storageType: ''
                })
            );
            dispatch(resetWorkloadFactoryResourceData());
            dispatch(setSelectedHostname(hostLabel));
            dispatch(
                setSelectedResourcePageHostData({
                    resourceId,
                    databaseInstanceId: instanceId,
                    databaseInstanceName: dbName,
                    credentialId: credId as string,
                    regionId: regionId as string
                })
            );
            dispatch(resetEiData({}));
        };

        const loadOracleAssessmentForCrr = async () => {
            dispatch(setOptimizePageLoading(true));
            try {
                const result: any = await getOracleAssessmentDataApi({
                    credentialId: credId as string,
                    regionId: regionId as string,
                    databaseHostId: resourceIdParam as string,
                    instanceId: instanceIdParam as string
                });

                if (cancelled) return;

                if (result && !result?.error && result?.data) {
                    if (!result.data.storage) {
                        const dynamicMockData = generateDynamicOracleStorageMockData(result.data);
                        result.data = { ...result.data, ...dynamicMockData };
                    }
                    dispatch(setDriftAssessmentData(result.data));
                    formatOracleWellArchitectedData(dispatch, result.data, false, true);
                    updateAccountLevelAssessmentData(
                        dispatch,
                        result.data,
                        {
                            databaseHostId: resourceIdParam as string,
                            databaseInstanceId: instanceIdParam as string,
                            credentialId: credId as string,
                            regionId: regionId as string
                        },
                        DBType.ORACLE
                    );
                    dispatch(setOptimizePageLoading(false));
                    dispatch(setIsAssessmentAvailable(true));
                    dispatch(setGwSelectedRowFsxId(result?.data?.fileSystemId));

                    const crrCard = store.getState().getWellOptimize.cardData?.crr ?? buildOracleCrrFallbackCard();
                    dispatch(
                        setSelectedOptimizeConfig({
                            type: ASSESSMENT_CONFIG_NAMES.CRR,
                            data: crrCard,
                            engineType: DBType.ORACLE
                        })
                    );
                } else {
                    dispatch(setOptimizePageLoading(false));
                    dispatch(setIsAssessmentAvailable(false));
                    dispatch(
                        setSelectedOptimizeConfig({
                            type: ASSESSMENT_CONFIG_NAMES.CRR,
                            data: buildOracleCrrFallbackCard(),
                            engineType: DBType.ORACLE
                        })
                    );
                    dispatch(
                        addNotification({
                            notificationType: NOTIFICATION_TYPES.ERROR,
                            message:
                                'Could not load assessment data for Cross-Region Replication. Showing empty details.'
                        })
                    );
                }
            } catch {
                if (!cancelled) {
                    dispatch(setOptimizePageLoading(false));
                    dispatch(setIsAssessmentAvailable(false));
                    dispatch(
                        setSelectedOptimizeConfig({
                            type: ASSESSMENT_CONFIG_NAMES.CRR,
                            data: buildOracleCrrFallbackCard(),
                            engineType: DBType.ORACLE
                        })
                    );
                }
            }
        };

        const run = async () => {
            if (!credId || !regionId || !fsxId) return;

            await runAssociateFsxLink();

            if (cancelled) return;

            if (
                isCrrDeepLink &&
                resourceIdParam &&
                instanceIdParam &&
                hostnameParam != null &&
                dbInstanceParam != null
            ) {
                applyOracleCrrInventoryContext();
                await loadOracleAssessmentForCrr();
                if (!cancelled) setCrrPrepareDone(true);
                return;
            }

            if (isCrrDeepLink) {
                dispatch(
                    addNotification({
                        notificationType: NOTIFICATION_TYPES.ERROR,
                        message:
                            'Invalid CRR deep link: resource, instance, host, and database name are required in the URL.'
                    })
                );
                if (!cancelled) setCrrPrepareDone(true);
            }
        };

        run();

        return () => {
            cancelled = true;
        };
    }, [
        credId,
        regionId,
        fsxId,
        ec2InstanceIdFromQuery,
        asmManagedFromQuery,
        isCrrDeepLink,
        resourceIdParam,
        instanceIdParam,
        hostnameParam,
        dbInstanceParam,
        getExistingLinkApi,
        associateSelectedLinkApi,
        checkExistingLinkApi,
        deleteExistingLinkApi,
        getOracleAssessmentDataApi,
        dispatch
    ]);

    if (isCrrDeepLink && !crrPrepareDone) {
        return <ComponentLoader />;
    }

    const headerTab = isCrrDeepLink && crrPrepareDone ? WLF_TABS.OPTIMIZE_INNER_PAGE : WLF_TABS.INVENTORY;

    return <HeaderComponent tab={headerTab} />;
};

export default InventoryFsxDeepLink;
