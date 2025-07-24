import { useDispatch } from 'react-redux';
import { ReactComponent as RefreshIcon } from '@netapp/icons/ic_refresh.svg';
import { useEffect } from 'react';
import { ButtonWithDropdown, Popover, useDialog } from '@netapp/design-system';
import styles from './WellArchitectDashboard.module.scss';
import commonStyles from '../../../utils/CommonStyles.module.scss';
import BreadCrumbs from '../../../common/BreadCrumbs/BreadCrumbs';
import { useAppSelector } from '../../../store/storeHooks';
import {
    AUTHENTICATION_TYPE,
    DETECT_HOST_VAR,
    FROM_DIALOG,
    RESET_PASSWORD_TYPE,
    WELL_ARCHITECTED_TABS,
    WLF_TABS
} from '../../../utils/consts';
import {
    setDefaultFilterOptions,
    setOptimizeFilterTags,
    setSelectedHeaderTab
} from '../../../store/workloadFactory/inventoryV2Slice';
import {
    resetGwData,
    resetVisitedTabs,
    setGwRefreshPage,
    setTabVisited
} from '../../../store/workloadFactory/getWellOptimizeSlice';
import WellArchitectTabs from './WellArchitectTabs/WellArchitectTabs';
import GetWell from '../GetWell';
import DatabaseListTable from '../../ResourcePage/DatabaseListTable/DatabaseListTable';

import ResourceMSSQLOverview from './ResourceMSSQLOverview/ResourceMSSQLOverview';
import { ReactComponent as MenuIcon } from '../../../assets/ic_actions_menu_circle.svg';

import { setRefreshTime } from '../../../store/workloadFactory/headersSlice';
import { getCurrentDateTime } from '../../../utils/utilityFunctions';
import { useRegisterResourceCredentialsBulkMutation, workloadFactoryResourceApiV2 } from '../../../utils/apiService';
import {
    setIsResourceRefresh,
    setPasswordResetLoading,
    resetAllPasswords
} from '../../../store/workloadFactory/workloadFactoryResourceSlice';
import { resetGwValuesOnRefresh } from '../GetWellUtils';
import DialogComponent from '../../../common/Dialog/DialogComponent';
import { GENERAL } from '../../../utils/appConstants';
import { FSXPasswordContent, SQLServerPasswordContent } from './FSXPasswordContent/FSXPasswordContent';
import SandboxInstanceTable from './ResourceMSSQLOverview/SandboxInstanceTable/SandboxInstanceTable';
import {
    setAggregatedSandboxInstanceList,
    setAllSandboxInstanceList,
    setIsRefreshedSandboxInstance
} from '../../../store/workloadFactory/sandboxSlice';
import { addNotification, NOTIFICATION_TYPES } from '../../../store/notificationSlice';
import store from '../../../store/store';
import ErrorInvestigation from './ErrorInvestigation/ErrorInvestigation';
import { resetEiData, setEiRefreshPage, setEiRefreshTimestamp } from '../../../store/workloadFactory/agenticAISlice';
import LogAnalyzerOnboarding from './ErrorInvestigation/LogAnalyzerOnboarding/LogAnalyzerOnboarding';
import ActivatingScreen from './ErrorInvestigation/LogAnalyzerOnboarding/ActivatingScreen/ActivatingScreen';

const WellArchitectDashboard = () => {
    const dispatch = useDispatch();
    const { breadCrumbSelectedFrom } = useAppSelector(state => state.inventoryV2);
    const { setDialog, closeDialog } = useDialog();
    const {
        selectedHostname,
        selectedDatabaseInstanceName,
        selectedWellArchitectTab,
        visitedTabs,
        gwRefreshTimestamp,
        resetDetails
    } = useAppSelector(state => state.getWellOptimize);

    const { refreshTime } = useAppSelector(state => state.headers);
    const { eiRefreshTimestamp } = useAppSelector(state => state.agenticAI);

    const { refreshSandboxInstanceTime, sandboxInstanceLoading } = useAppSelector(state => state.sandbox);
    const [registerResourceCredBulk] = useRegisterResourceCredentialsBulkMutation();

    const {
        resourceLoading: resourceLoadingState,

        selectedResourceCredId,
        selectedResourceRegionId,
        resourceDetails,
        instanceDetailsData: { databaseInstanceName, fsxId, ec2InstanceId }
    } = useAppSelector(state => state.workloadFactoryResource);

    // Reset visited tabs when leaving the dashboard
    useEffect(
        () => () => {
            dispatch(resetVisitedTabs());
            dispatch(setAggregatedSandboxInstanceList([]));
            dispatch(setAllSandboxInstanceList([]));
        },
        [dispatch]
    );

    // Mark the current tab as visited when the component mounts
    useEffect(() => {
        if (!visitedTabs[selectedWellArchitectTab]) {
            const tabValue =
                selectedWellArchitectTab === 'Overview' || selectedWellArchitectTab === 'Databases'
                    ? 'Overview'
                    : selectedWellArchitectTab;
            dispatch(setTabVisited(tabValue));
        }
    }, [selectedWellArchitectTab, visitedTabs, dispatch]);

    const handleRefresh = () => {
        if (
            selectedWellArchitectTab === WELL_ARCHITECTED_TABS.OVERVIEW ||
            (selectedWellArchitectTab === WELL_ARCHITECTED_TABS.DATABASES && !resourceLoadingState)
        ) {
            dispatch(setRefreshTime(getCurrentDateTime()));
            dispatch(workloadFactoryResourceApiV2.util.resetApiState());
            dispatch(setIsResourceRefresh(true));
        } else if (selectedWellArchitectTab === WELL_ARCHITECTED_TABS.WELL_ARCHITECTED_STATUS) {
            dispatch(setOptimizeFilterTags([]));
            dispatch(setDefaultFilterOptions({}));
            resetGwValuesOnRefresh(dispatch);
            dispatch(setGwRefreshPage(true));
        } else if (selectedWellArchitectTab === WELL_ARCHITECTED_TABS.SANDBOXES && !sandboxInstanceLoading) {
            dispatch(setIsRefreshedSandboxInstance(true));
        } else if (selectedWellArchitectTab === WELL_ARCHITECTED_TABS.ERROR_INVESTIGATION) {
            dispatch(resetEiData({}));
            dispatch(setEiRefreshTimestamp(getCurrentDateTime()));
            dispatch(setEiRefreshPage(true));
        }
    };

    const setRefreshTimeOnIcon = () => {
        if (
            selectedWellArchitectTab === WELL_ARCHITECTED_TABS.OVERVIEW ||
            selectedWellArchitectTab === WELL_ARCHITECTED_TABS.DATABASES
        ) {
            return refreshTime;
        }
        if (selectedWellArchitectTab === WELL_ARCHITECTED_TABS.WELL_ARCHITECTED_STATUS) {
            return gwRefreshTimestamp;
        }
        if (selectedWellArchitectTab === WELL_ARCHITECTED_TABS.ERROR_INVESTIGATION) {
            return eiRefreshTimestamp;
        }
        return refreshSandboxInstanceTime;
    };

    const createPayload = () => {
        const state = store.getState();
        const { fsxAdminPasswords } = state.workloadFactoryResource;
        const { password } = fsxAdminPasswords;
        const credList = [];
        credList.push({
            resourceId: fsxId || resourceDetails?.topology?.fileSystemId || resetDetails?.fsxId,
            resourceType: DETECT_HOST_VAR.FSX,
            username: 'fsxadmin',
            password
        });

        return { credentials: credList };
    };

    const createSqlPayload = () => {
        const state = store.getState();
        const { selectedAuthenticationType } = state.workloadFactoryResource;
        const credList = [];
        const { sqlServerPasswords, sqlServerUserName } = state.workloadFactoryResource;
        const { password } = sqlServerPasswords;
        credList.push({
            resourceId: selectedDatabaseInstanceName,
            resourceType:
                selectedAuthenticationType === AUTHENTICATION_TYPE.SQL_SERVER_AUTHENTICATION
                    ? DETECT_HOST_VAR.MSSQL
                    : DETECT_HOST_VAR.WINDOWS,
            username: sqlServerUserName,
            password
        });
        return { credentials: credList };
    };

    const resetPasswords = () => {
        dispatch(resetAllPasswords());
    };

    const handleFSXAdminApply = async (value: string) => {
        dispatch(setPasswordResetLoading(true));
        try {
            const credList = value === RESET_PASSWORD_TYPE.FSXADMIN ? createPayload() : createSqlPayload();
            const payload = {
                items: [
                    {
                        ...credList,
                        ec2InstanceId:
                            ec2InstanceId ||
                            resourceDetails?.nodeTopology?.ec2Details[0]?.id ||
                            resetDetails?.ec2InstanceId,
                        region: selectedResourceRegionId,
                        credentialsId: selectedResourceCredId
                    }
                ]
            };
            const result = await registerResourceCredBulk({ payload });
            if (result && !result?.error && result?.data) {
                if (
                    result?.data?.items?.length > 0 &&
                    !result?.data?.items?.[0]?.registerDetails?.[0]?.databaseServerError &&
                    !result?.data?.items?.[0]?.registerDetails?.[0]?.fsxnError
                ) {
                    dispatch(
                        addNotification({
                            notificationType: NOTIFICATION_TYPES.SUCCESS,
                            message: `${
                                value === RESET_PASSWORD_TYPE.FSXADMIN ? 'fsxadmin' : 'Microsoft SQL Server'
                            } password updated successfully`
                        })
                    );
                } else {
                    dispatch(
                        addNotification({
                            notificationType: NOTIFICATION_TYPES.ERROR,
                            message:
                                result?.data?.items?.[0]?.registerDetails?.[0]?.fsxnError ||
                                result?.data?.items?.[0]?.registerDetails?.[0]?.databaseServerError ||
                                `Failed to update ${
                                    value === RESET_PASSWORD_TYPE.FSXADMIN ? 'fsxadmin' : 'Microsoft SQL Server'
                                } password. `
                        })
                    );
                }
            } else {
                dispatch(
                    addNotification({
                        notificationType: NOTIFICATION_TYPES.ERROR,
                        message:
                            // @ts-ignore
                            result?.error?.data?.message ||
                            `Failed to update ${
                                value === RESET_PASSWORD_TYPE.FSXADMIN ? 'fsxadmin' : 'Microsoft SQL Server'
                            } password. `
                    })
                );
            }
        } catch (error) {
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.ERROR,
                    message: error || 'Failed to update fsxadmin password. '
                })
            );
        } finally {
            resetPasswords();
            dispatch(setPasswordResetLoading(false));
            closeDialog();
        }
    };

    const handleFsxPassword = (type: string) => {
        setDialog(
            <DialogComponent
                header={
                    type === RESET_PASSWORD_TYPE.FSXADMIN
                        ? GENERAL.UPDATE_FSX_ADMIN_PASSWORD
                        : GENERAL.UPDATE_SQL_SERVER_PASSWORD
                }
                content={type === RESET_PASSWORD_TYPE.FSXADMIN ? <FSXPasswordContent /> : <SQLServerPasswordContent />}
                primaryButton={GENERAL.UPDATE}
                secondaryButton={GENERAL.CANCEL}
                callback={() => {
                    handleFSXAdminApply(type);
                }}
                closeCallback={() => {
                    resetPasswords();
                    closeDialog();
                }}
                dialogFrom={type === RESET_PASSWORD_TYPE.FSXADMIN ? FROM_DIALOG.FSXADMIN : FROM_DIALOG.SQLSERVER}
            />
        );
    };

    return (
        <div className={styles['well-architect-dashboard']}>
            <div className={`${commonStyles.commonBreadCrumb} ${styles.breadCrumb}`} style={{ left: '0%' }}>
                <BreadCrumbs
                    items={[
                        {
                            title: breadCrumbSelectedFrom === WLF_TABS.INVENTORY ? 'Inventory' : 'Dashboard',
                            onClick: () => {
                                if (breadCrumbSelectedFrom === WLF_TABS.INVENTORY) {
                                    dispatch(setSelectedHeaderTab(WLF_TABS.INVENTORY));
                                } else {
                                    dispatch(setSelectedHeaderTab(WLF_TABS.DASHBOARD));
                                }
                                dispatch(resetGwData({}));
                            }
                        },
                        {
                            title: `${selectedHostname}/${selectedDatabaseInstanceName}` || 'Host name/instance name'
                        }
                    ]}
                />

                <div className={styles.rightSection}>
                    <Popover
                        popoverClass={styles['copy-popover']}
                        children={`Last update: ${setRefreshTimeOnIcon()}`}
                        trigger="hover"
                        container={
                            <div className={styles.refreshIcon} onClick={handleRefresh}>
                                <RefreshIcon />
                            </div>
                        }
                    />

                    {selectedWellArchitectTab !== WELL_ARCHITECTED_TABS.ERROR_INVESTIGATION && (
                        <div className={styles.buttonContainer}>
                            <ButtonWithDropdown
                                variant="icon"
                                className={styles.buttonWithDropdownContainer}
                                items={[
                                    {
                                        id: 'resetSQLServerPassword',
                                        children: GENERAL.UPDATE_SQL_SERVER_PASSWORD,

                                        onClick: () => {
                                            handleFsxPassword(RESET_PASSWORD_TYPE.SQLSERVER);
                                        }
                                    },
                                    {
                                        id: 'resetFSxAdminPassword',
                                        children: GENERAL.UPDATE_FSX_ADMIN_PASSWORD,

                                        onClick: () => {
                                            handleFsxPassword(RESET_PASSWORD_TYPE.FSXADMIN);
                                        }
                                    }
                                ]}
                            >
                                <MenuIcon />
                            </ButtonWithDropdown>
                        </div>
                    )}
                </div>
            </div>

            <WellArchitectTabs />

            <div className={styles['well-architect-tabs-content']}>
                {selectedWellArchitectTab === WELL_ARCHITECTED_TABS.OVERVIEW && <ResourceMSSQLOverview />}
                {selectedWellArchitectTab === WELL_ARCHITECTED_TABS.WELL_ARCHITECTED_STATUS && <GetWell />}
                {selectedWellArchitectTab === WELL_ARCHITECTED_TABS.ERROR_INVESTIGATION && <ErrorInvestigation />}
                {selectedWellArchitectTab === WELL_ARCHITECTED_TABS.LOG_ANALYZER_ONBOARDING && (
                    <LogAnalyzerOnboarding />
                )}
                {selectedWellArchitectTab === WELL_ARCHITECTED_TABS.ACTIVATING_LOG_ANALYZER && <ActivatingScreen />}

                {selectedWellArchitectTab === WELL_ARCHITECTED_TABS.DATABASES && (
                    <div className={styles.databaseListTable}>
                        <DatabaseListTable />
                    </div>
                )}

                {selectedWellArchitectTab === WELL_ARCHITECTED_TABS.SANDBOXES && <SandboxInstanceTable />}
            </div>
        </div>
    );
};

export default WellArchitectDashboard;
