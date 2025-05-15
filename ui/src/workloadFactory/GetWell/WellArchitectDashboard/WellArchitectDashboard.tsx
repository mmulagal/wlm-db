import styles from './WellArchitectDashboard.module.scss';
import commonStyles from '../../../utils/CommonStyles.module.scss';
import BreadCrumbs from '../../../common/BreadCrumbs/BreadCrumbs';
import { useAppSelector } from '../../../store/storeHooks';
import { DETECT_HOST_VAR, FROM_DIALOG, WELL_ARCHITECTED_TABS, WLF_TABS } from '../../../utils/consts';
import { useDispatch } from 'react-redux';
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
import { ReactComponent as RefreshIcon } from '@netapp/icons/ic_refresh.svg';
import WellArchitectTabs from './WellArchitectTabs/WellArchitectTabs';
import GetWell from '../GetWell';
import DatabaseListTable from '../../ResourcePage/DatabaseListTable/DatabaseListTable';

import { useEffect } from 'react';
import ResourceMSSQLOverview from './ResourceMSSQLOverview/ResourceMSSQLOverview';
import { ReactComponent as MenuIcon } from '../../../assets/ic_actions_menu_circle.svg';
import { ButtonWithDropdown, Popover, useDialog } from '@netapp/design-system';
import {
    addInitialDBCreateData,
    initialCreateNewUserState,
    setCdbPageData
} from '../../../store/workloadFactory/createNewDBSlice';
import { updateResourceId } from '../../../store/authSlice';
import { useNavigate } from 'react-router-dom';
import { setRefreshTime } from '../../../store/workloadFactory/headersSlice';
import { getCurrentDateTime } from '../../../utils/utilityFunctions';
import { useRegisterResourceCredentialsMutation, workloadFactoryResourceApiV2 } from '../../../utils/apiService';
import {
    setFsxAdminConfirmPassword,
    setFsxAdminPassword,
    setSqlServerConfirmPassword,
    setSqlServerPassword,
    setIsResourceRefresh,
    setPasswordResetLoading
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
    const navigate = useNavigate();

    const { refreshTime } = useAppSelector(state => state.headers);

    const { refreshSandboxInstanceTime } = useAppSelector(state => state.sandbox);

    const [registerResourceCred] = useRegisterResourceCredentialsMutation();

    const {
        resourceLoading: resourceLoadingState,

        selectedDatabaseInstance,
        selectedResourceId,
        selectedResourceCredId,
        selectedResourceRegionId
    } = useAppSelector(state => state.workloadFactoryResource);

    // Reset visited tabs when leaving the dashboard
    useEffect(() => {
        return () => {
            dispatch(resetVisitedTabs());
            dispatch(setAggregatedSandboxInstanceList([]));
            dispatch(setAllSandboxInstanceList([]));
        };
    }, [dispatch]);

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
            selectedWellArchitectTab === WELL_ARCHITECTED_TABS.DATABASES
        ) {
            dispatch(setRefreshTime(getCurrentDateTime()));
            dispatch(workloadFactoryResourceApiV2.util.resetApiState());
            dispatch(setIsResourceRefresh(true));
        } else if (selectedWellArchitectTab === WELL_ARCHITECTED_TABS.WELL_ARCHITECTED_STATUS) {
            dispatch(setOptimizeFilterTags([]));
            dispatch(setDefaultFilterOptions({}));
            resetGwValuesOnRefresh(dispatch);
            dispatch(setGwRefreshPage(true));
        } else if (selectedWellArchitectTab === WELL_ARCHITECTED_TABS.SANDBOXES) {
            dispatch(setIsRefreshedSandboxInstance(true));
        }
    };

    const setRefreshTimeOnIcon = () => {
        if (
            selectedWellArchitectTab === WELL_ARCHITECTED_TABS.OVERVIEW ||
            selectedWellArchitectTab === WELL_ARCHITECTED_TABS.DATABASES
        ) {
            return refreshTime;
        } else if (selectedWellArchitectTab === WELL_ARCHITECTED_TABS.WELL_ARCHITECTED_STATUS) {
            return gwRefreshTimestamp;
        } else {
            return refreshSandboxInstanceTime;
        }
    };

    const createPayload = () => {
        const state = store.getState();
        const { fsxAdminPasswords } = state.workloadFactoryResource;
        const { password } = fsxAdminPasswords;
        let credList = [];
        credList.push({
            resourceId: resetDetails?.fsxId,
            resourceType: DETECT_HOST_VAR.FSX,
            username: 'fsxadmin',
            password: password
        });

        return { credentials: credList };
    };

    const createSqlPayload = () => {
        const state = store.getState();
        const { sqlServerPasswords } = state.workloadFactoryResource;
        const { password } = sqlServerPasswords;
        let credList = [];
        credList.push({
            resourceId: resetDetails?.sqlServerId,
            resourceType: DETECT_HOST_VAR.MSSQL,
            username: 'sqlserver',
            password: password
        });

        return { credentials: credList };
    };

    const handleFSXAdminApply = async (value: string) => {
        dispatch(setPasswordResetLoading(true));
        try {
            const result: any = await registerResourceCred({
                credentialId: selectedResourceCredId,
                regionId: selectedResourceRegionId,
                instanceId: resetDetails?.ec2InstanceId,
                payload: value === 'fsxReset' ? createPayload() : createSqlPayload()
            });
            if (result && !result?.error) {
                if (!result?.data?.fsxnError && !result?.data?.sqlError) {
                    dispatch(setFsxAdminPassword(''));
                    dispatch(setFsxAdminConfirmPassword(''));
                    dispatch(
                        addNotification({
                            type: NOTIFICATION_TYPES.SUCCESS,
                            message: `${value === 'fsxReset' ? 'FSxadmin' : 'Sql server'} password reset successfully`
                        })
                    );
                } else {
                    dispatch(setFsxAdminPassword(''));
                    dispatch(setFsxAdminConfirmPassword(''));
                    dispatch(
                        addNotification({
                            type: NOTIFICATION_TYPES.ERROR,
                            message:
                                result?.data?.fsxnError ||
                                `Failed to reset ${value === 'fsxReset' ? 'FSxadmin' : 'Sql server'} password. `
                        })
                    );
                }
            } else {
                dispatch(setFsxAdminPassword(''));
                dispatch(setFsxAdminConfirmPassword(''));
                dispatch(
                    addNotification({
                        type: NOTIFICATION_TYPES.ERROR,
                        message:
                            result?.error?.data?.message ||
                            `Failed to reset ${value === 'fsxReset' ? 'FSxadmin' : 'Sql server'} password. `
                    })
                );
            }
        } catch (error) {
            dispatch(setFsxAdminPassword(''));
            dispatch(setFsxAdminConfirmPassword(''));
            dispatch(
                addNotification({
                    type: NOTIFICATION_TYPES.ERROR,
                    message: error || `Failed to reset FSxadmin password. `
                })
            );
        } finally {
            dispatch(setPasswordResetLoading(false));
            closeDialog();
        }
    };

    const handleFsxPassword = () => {
        setDialog(
            <DialogComponent
                header={'Reset FSxadmin password '}
                content={<FSXPasswordContent />}
                primaryButton={GENERAL.APPLY}
                secondaryButton={GENERAL.CANCEL}
                callback={() => {
                    handleFSXAdminApply('fsxRest');
                }}
                closeCallback={() => {
                    closeDialog();
                }}
                dialogFrom={FROM_DIALOG.FSXADMIN}
            />
        );
    };

    const handleSqlPassword = () => {
        setDialog(
            <DialogComponent
                header={'Reset SQL Server password'}
                content={<SQLServerPasswordContent />}
                primaryButton={GENERAL.APPLY}
                secondaryButton={GENERAL.CANCEL}
                callback={() => {
                    handleFSXAdminApply('sqlReset');
                }}
                closeCallback={() => {
                    closeDialog();
                }}
                dialogFrom={FROM_DIALOG.SQLSERVER}
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

                    <div className={styles.buttonContainer}>
                        <ButtonWithDropdown
                            variant="icon"
                            items={[
                                {
                                    id: 'createUserDB',
                                    children: 'Create a user database',
                                    // isDisabled: resourceLoadingState,
                                    onClick: () => {
                                        // if (!resourceLoadingState) {
                                        dispatch(addInitialDBCreateData(initialCreateNewUserState));
                                        dispatch(
                                            setCdbPageData({
                                                dbHostName: selectedHostname,
                                                instanceId: selectedDatabaseInstance,
                                                instanceName: selectedDatabaseInstanceName,
                                                cdbCredId: selectedResourceCredId,
                                                cdbRegionId: selectedResourceRegionId
                                            })
                                        );
                                        dispatch(updateResourceId(selectedResourceId));
                                        navigate('../create-new-user');
                                        // }
                                    }
                                },
                                {
                                    id: 'resetSQLServerPassword',
                                    children: 'Reset SQL server password',

                                    onClick: () => {
                                        handleSqlPassword();
                                    }
                                },
                                {
                                    id: 'resetFSxAdminPassword',
                                    children: 'Reset FSxadmin password',

                                    onClick: () => {
                                        handleFsxPassword();
                                    }
                                }
                            ]}
                        >
                            <MenuIcon />
                        </ButtonWithDropdown>
                    </div>
                </div>
            </div>

            <WellArchitectTabs />

            <div className={styles['well-architect-tabs-content']}>
                {selectedWellArchitectTab === WELL_ARCHITECTED_TABS.OVERVIEW && <ResourceMSSQLOverview />}
                {selectedWellArchitectTab === WELL_ARCHITECTED_TABS.WELL_ARCHITECTED_STATUS && <GetWell />}

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
