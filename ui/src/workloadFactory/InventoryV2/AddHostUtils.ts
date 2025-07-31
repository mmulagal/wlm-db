import { addNotification } from '../../store/notificationSlice';
import store from '../../store/store';
import { setDataForRow, setWorkSpaceData } from '../../store/workloadFactory/snapcenterSlice';
import { PRODUCTION, RBAC_PROD_ROLE_ID, RBAC_STAGE_ROLE_ID } from '../../utils/consts';

export const isCancelled = (key: any) => store.getState().snapCenter.dataMap[key]?.cancelled;

const proceedWithProtection = (data: any, rowData: any, showNoAgentDialog: any, showSingleAgentDialog: any) => {
    const activeAgents = data?.occms?.filter((item: any) => item.agent.status === 'active') || [];

    if (activeAgents.length === 0) {
        showNoAgentDialog();
    }
    if (activeAgents.length > 0) {
        // Single Connector case
        showSingleAgentDialog(activeAgents, false, rowData);
    }
};

export const handleProtectionUtil = async (
    rowData: any,
    {
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
        getRBACPrivileges
    }: any
) => {
    const key = `${rowData.databaseInstanceName}_${rowData.name}_${rowData.credentialId}_${rowData.regionId}`;
    const existingData = store.getState().snapCenter.dataMap[key] || {};

    dispatch(setDataForRow({ key, stepData: { cancelled: false } }));

    fetchDialog(key);

    if (existingData.initialHostCheck) {
        if (existingData.isHostManaged) {
            return showSingleAgentDialog([], true, rowData);
        }
        // else proceed to normal flow
    } else {
        // FIRST host API call under fetching dialog
        const hostsRes = await listExistingHosts({ accountID: store.getState().auth.accountId });
        if (isCancelled(key)) return;

        let hostExists = false;

        // Getting workspace id
        const workSpaceRes = await getWorkSpaceID({ accountID: store.getState().auth.accountId });
        if (workSpaceRes?.data?.items?.length) {
            dispatch(setWorkSpaceData(workSpaceRes.data.items[0]));
        }

        if (hostsRes?.data?.hosts?.length > 0) {
            const foundHost = hostsRes?.data?.hosts?.find((host: any) => {
                const hostNameBeforeDot = host.name.split('.')[0];
                return hostNameBeforeDot === rowData.hostRow.name;
            });

            if (foundHost && foundHost?.overallStatus !== 'NoPlugins' && foundHost?.overallStatus !== 'Stopped') {
                hostExists = true;
            }
        }

        // Always store result so next time we skip API call
        dispatch(
            setDataForRow({
                key,
                stepData: {
                    initialHostCheck: true,
                    hostChecked: true,
                    isHostManaged: hostExists
                }
            })
        );

        if (hostExists) {
            return showSingleAgentDialog([], true, rowData);
        }
    }

    if (existingData.connectors) {
        await handleFsxFlow(rowData, key, existingData, {
            dispatch,
            getFsxDetails,
            getWorkSpaceID,
            discoverExistingFsxN,
            assignRBACPrivileges,
            listExistingHosts,
            getRBACPrivileges,
            showNoAgentDialog,
            showSingleAgentDialog
        });
        return;
    }

    const res = await getConnector({ accountID: store.getState().auth.accountId });
    if (isCancelled(key)) return;

    if (res?.data?.occms) {
        if (res.data.occms.length > 0) {
            dispatch(setDataForRow({ key, stepData: { connectors: res.data } }));
            await handleFsxFlow(
                rowData,
                key,
                { connectors: res.data },
                {
                    dispatch,
                    getFsxDetails,
                    getWorkSpaceID,
                    discoverExistingFsxN,
                    assignRBACPrivileges,
                    listExistingHosts,
                    getRBACPrivileges,
                    showNoAgentDialog,
                    showSingleAgentDialog
                }
            );
        } else {
            showNoAgentDialog();
        }
    } else {
        closeDialog();
    }
};

export const handleFsxFlow = async (
    rowData: any,
    key: string,
    stepData: any,
    {
        dispatch,
        getFsxDetails,
        getWorkSpaceID,
        discoverExistingFsxN,
        assignRBACPrivileges,
        listExistingHosts,
        getRBACPrivileges,
        showNoAgentDialog,
        showSingleAgentDialog
    }: any
) => {
    // if already have fsx info, skip
    if (!stepData.fsxChecked) {
        const fsxRes = await getFsxDetails({ accountID: store.getState().auth.accountId });
        if (isCancelled(key)) return;

        const fsxExists = fsxRes?.data?.some((item: any) => item.id === rowData.fsxId);
        const workSpaceIdExists = store.getState().snapCenter.workSpaceData?.id;

        let workSpaceRes = '';
        if (!workSpaceIdExists) {
            const workSpaceResponse = await getWorkSpaceID({ accountID: store.getState().auth.accountId });
            if (workSpaceResponse?.data?.items?.length) {
                workSpaceRes = workSpaceResponse.data.items[0].id;
                dispatch(setWorkSpaceData(workSpaceResponse.data.items[0]));
            }
        } else {
            workSpaceRes = workSpaceIdExists;
        }

        if (!fsxExists) {
            if (isCancelled(key)) return;

            await discoverExistingFsxN({
                accountID: store.getState().auth.accountId,
                credentialID: rowData.credentialId,
                workSpaceID: workSpaceRes,
                regionID: rowData.regionId,
                payload: [rowData.fsxId]
            });

            if (isCancelled(key)) return;
        }
        dispatch(setDataForRow({ key, stepData: { fsxChecked: true } }));
    }

    if (!stepData.rbac) {
        const rbacRes = await getRBACPrivileges({ accountID: store.getState().auth.accountId });
        if (rbacRes?.data?.items && rbacRes?.data?.items?.length > 0) {
            const emailID = store.getState().auth.userMetadata?.email;
            const matchingUser = rbacRes.data.items.find((item: any) => item.email === emailID);
            if (matchingUser?.roles) {
                const roleCheck =
                    import.meta.env.VITE_APP_ENVIRONMENT === PRODUCTION ? RBAC_PROD_ROLE_ID : RBAC_STAGE_ROLE_ID;
                const hasRequiredRole = matchingUser?.roles.includes(roleCheck);
                if (!hasRequiredRole) {
                    await assignRBACPrivileges({
                        accountID: store.getState().auth.accountId,
                        payload: {
                            type: 'application/vnd.netapp.bxp.userbulk',
                            users: [{ userId: matchingUser?.id }],
                            version: '1.0'
                        }
                    });
                }
            }
        }
        if (isCancelled(key)) return;

        dispatch(setDataForRow({ key, stepData: { rbac: rbacRes } }));
    }

    if (!stepData.hostChecked) {
        const hostsRes = await listExistingHosts({ accountID: store.getState().auth.accountId });
        if (isCancelled(key)) return;

        if (hostsRes?.error?.data === 'Unauthorized') {
            dispatch(
                addNotification({
                    notificationType: 'ERROR',
                    message: 'Unauthorized'
                })
            );
        }

        if (hostsRes?.data?.hosts?.length > 0) {
            const hostExists = hostsRes.data.hosts.some((host: any) => {
                const hostNameBeforeDot = host.name.split('.')[0];
                return hostNameBeforeDot === rowData.hostRow.name;
            });
            dispatch(setDataForRow({ key, stepData: { hostChecked: true, isHostManaged: hostExists } }));
        } else {
            dispatch(setDataForRow({ key, stepData: { hostChecked: true, isHostManaged: false } }));
        }
    }

    if (isCancelled(key)) return;

    proceedWithProtection(stepData.connectors, rowData, showNoAgentDialog, showSingleAgentDialog);
};
