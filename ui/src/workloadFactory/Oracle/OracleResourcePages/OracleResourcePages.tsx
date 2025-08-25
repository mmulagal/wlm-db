import { useDispatch } from 'react-redux';
import { useEffect } from 'react';
import { ButtonWithDropdown, Popover, useDialog } from '@netapp/design-system';
import { ReactComponent as RefreshIcon } from '@netapp/icons/ic_refresh.svg';
import { ReactComponent as MenuIcon } from '../../../assets/ic_actions_menu_circle.svg';
import commonStyles from '../../../utils/CommonStyles.module.scss';
import BreadCrumbs from '../../../common/BreadCrumbs/BreadCrumbs';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';
import { resetAllPasswords } from '../../../store/workloadFactory/workloadFactoryResourceSlice';
import styles from './OracleResourcePages.module.scss';
import { WELL_ARCHITECTED_TABS, WLF_TABS, RESET_PASSWORD_TYPE, FROM_DIALOG } from '../../../utils/consts';
import { useAppSelector } from '../../../store/storeHooks';
import OracleTabs from './OracleTabs/OracleTabs';
import OracleWellArchitectDashboard from './OracleWellArchitectDashboard/OracleWellArchitectDashboard';
import OracleOverview from './OracleOverview/OracleOverview';
import { GENERAL } from '../../../utils/appConstants';
import DialogComponent from '../../../common/Dialog/DialogComponent';
import { useRegisterResourceCredentialsBulkMutation } from '../../../utils/apiService';
import {
    FSXPasswordContent,
    OracleServerPasswordContent
} from '../../GetWell/WellArchitectDashboard/FSXPasswordContent/FSXPasswordContent';
import {
    resetOracleResourceVisitedTabs,
    setOracleRefreshTimes,
    setOracleResourceDetails,
    setOracleResourceVisitedTabs,
    setRefreshOracleOverview,
    setRefreshOracleWellArchitect
} from '../../../store/workloadFactory/oracleSlice';
import { handleFSXAdminApply } from '../../../utils/resourceUtils';
import { getCurrentDateTime } from '../../../utils/utilityFunctions';

const OracleResourcePages = () => {
    const dispatch = useDispatch();
    const { setDialog, closeDialog } = useDialog();
    const { breadCrumbSelectedFrom } = useAppSelector(state => state.inventoryV2);
    const { selectedOracleInnerPageTab, visitedTabs, resourceDetails, refreshTimes } = useAppSelector(
        state => state.oracleSlice
    );
    const { selectedHostname, selectedDatabaseInstanceName } = useAppSelector(state => state.getWellOptimize);
    const { selectedResourceCredId, selectedResourceRegionId } = useAppSelector(state => state.workloadFactoryResource);
    const [registerResourceCredBulk] = useRegisterResourceCredentialsBulkMutation();

    // Reset visited tabs when leaving the dashboard
    useEffect(
        () => () => {
            dispatch(resetOracleResourceVisitedTabs());
        },
        [dispatch]
    );

    const handleFsxPassword = (type: string) => {
        let header = GENERAL.UPDATE_FSX_ADMIN_PASSWORD;
        let content = (
            <FSXPasswordContent type={RESET_PASSWORD_TYPE.FSXADMIN} engine={RESET_PASSWORD_TYPE.ORACLESERVER} />
        );

        if (type === RESET_PASSWORD_TYPE.ORACLESERVER) {
            header = GENERAL.UPDATE_ORACLE_SERVER_PASSWORD;
            content = <OracleServerPasswordContent type={RESET_PASSWORD_TYPE.ORACLESERVER} />;
        } else if (type === RESET_PASSWORD_TYPE.ORACLEASM) {
            header = GENERAL.UPDATE_ORACLE_ASM_PASSWORD;
            content = <OracleServerPasswordContent type={GENERAL.ORACLE_ASM_TYPE} />;
        }

        setDialog(
            <DialogComponent
                header={header}
                content={content}
                primaryButton={GENERAL.UPDATE}
                secondaryButton={GENERAL.CANCEL}
                callback={() => {
                    handleFSXAdminApply(
                        type,
                        selectedDatabaseInstanceName,
                        resourceDetails,
                        selectedResourceCredId,
                        selectedResourceRegionId,
                        registerResourceCredBulk,
                        dispatch,
                        closeDialog
                    );
                }}
                closeCallback={() => {
                    dispatch(resetAllPasswords());
                    closeDialog();
                }}
                dialogFrom={type === RESET_PASSWORD_TYPE.FSXADMIN ? FROM_DIALOG.FSXADMIN : FROM_DIALOG.SQLSERVER}
            />
        );
    };

    // Mark the current tab as visited when the component mounts
    useEffect(() => {
        if (!visitedTabs[selectedOracleInnerPageTab]) {
            dispatch(setOracleResourceVisitedTabs(selectedOracleInnerPageTab));
        }
    }, [selectedOracleInnerPageTab, visitedTabs, dispatch]);

    // refresh time on hover
    const setRefreshTimeOnIcon = () => {
        if (selectedOracleInnerPageTab === WELL_ARCHITECTED_TABS.OVERVIEW) {
            return refreshTimes.overviewRefreshTime;
        }
        if (selectedOracleInnerPageTab === WELL_ARCHITECTED_TABS.WELL_ARCHITECTED_STATUS) {
            return refreshTimes.optimizeRefreshTime;
        }
        return '';
    };

    const handleOracleRefresh = () => {
        if (selectedOracleInnerPageTab === WELL_ARCHITECTED_TABS.OVERVIEW) {
            dispatch(setOracleResourceDetails({}));
            dispatch(setRefreshOracleOverview(true));
            dispatch(setOracleRefreshTimes({ overviewRefreshTime: getCurrentDateTime() }));
        } else if (selectedOracleInnerPageTab === WELL_ARCHITECTED_TABS.WELL_ARCHITECTED_STATUS) {
            dispatch(setRefreshOracleWellArchitect(true));
            dispatch(setOracleRefreshTimes({ optimizeRefreshTime: getCurrentDateTime() }));
        }
    };
    return (
        <div className={styles['oracle-inner-pages']}>
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
                            <div className={styles.refreshIcon} onClick={handleOracleRefresh}>
                                <RefreshIcon />
                            </div>
                        }
                    />
                    {selectedOracleInnerPageTab === WELL_ARCHITECTED_TABS.OVERVIEW && (
                        <div className={styles.buttonContainer}>
                            <ButtonWithDropdown
                                variant="icon"
                                className={styles.buttonWithDropdownContainer}
                                items={[
                                    {
                                        id: 'updateOracleServerPassword',
                                        children: GENERAL.UPDATE_ORACLE_SERVER_PASSWORD,

                                        onClick: () => {
                                            handleFsxPassword(RESET_PASSWORD_TYPE.ORACLESERVER);
                                        }
                                    },
                                    {
                                        id: 'updateFsxAdminPassword',
                                        children: GENERAL.UPDATE_FSX_ADMIN_PASSWORD,

                                        onClick: () => {
                                            handleFsxPassword(RESET_PASSWORD_TYPE.FSXADMIN);
                                        }
                                    },
                                    {
                                        id: 'updateOracleASMPassword',
                                        children: GENERAL.UPDATE_ORACLE_ASM_PASSWORD,

                                        onClick: () => {
                                            handleFsxPassword(RESET_PASSWORD_TYPE.ORACLEASM);
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

            <OracleTabs />

            {selectedOracleInnerPageTab === WELL_ARCHITECTED_TABS.WELL_ARCHITECTED_STATUS && (
                <OracleWellArchitectDashboard />
            )}

            {selectedOracleInnerPageTab === WELL_ARCHITECTED_TABS.OVERVIEW && <OracleOverview />}
        </div>
    );
};
export default OracleResourcePages;
