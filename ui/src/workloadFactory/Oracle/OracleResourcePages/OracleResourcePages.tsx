import { useDispatch } from 'react-redux';
import { useEffect, useMemo, useRef } from 'react';
import { ButtonWithDropdown, Popover, useDialog } from '@netapp/design-system';
import { ReactComponent as RefreshIcon } from '@netapp/icons/ic_refresh.svg';
import { ReactComponent as MenuIcon } from '../../../assets/ic_actions_menu_circle.svg';
import commonStyles from '../../../utils/CommonStyles.module.scss';
import BreadCrumbs from '../../../common/BreadCrumbs/BreadCrumbs';
import { resetAllPasswords } from '../../../store/workloadFactory/workloadFactoryResourceSlice';
import styles from './OracleResourcePages.module.scss';
import { WELL_ARCHITECTED_TABS, WLF_TABS, RESET_PASSWORD_TYPE, FROM_DIALOG, DBType } from '../../../utils/consts';
import { useAppSelector } from '../../../store/storeHooks';
import OracleTabs from './OracleTabs/OracleTabs';
import OracleWellArchitectDashboard from './OracleWellArchitectDashboard/OracleWellArchitectDashboard';
import OracleOverview from './OracleOverview/OracleOverview';
import { GENERAL } from '../../../utils/appConstants';
import DialogComponent from '../../../common/Dialog/DialogComponent';
import { useRegisterResourceCredentialsBulkMutation } from '../../../utils/apiService';
import { OracleServerPasswordContent } from '../../GetWell/WellArchitectDashboard/ServerPasswordContent/ServerPasswordContent';
import OraclePDB from './OraclePDB/OraclePDB';
import {
    resetOracleResourceVisitedTabs,
    setOracleRefreshTimes,
    setOracleResourceDetails,
    setOracleResourceVisitedTabs,
    setRefreshOracleOverview,
    setRefreshOracleWellArchitect
} from '../../../store/workloadFactory/oracleSlice';
import { handleOracleServerPasswordApply } from '../../../utils/resourceUtils';
import { getCurrentDateTime } from '../../../utils/utilityFunctions';
import { instanceBreadCrumbSelectedFrom, selectHeaderTabFromBreadCrumb } from '../../GetWell/GetWellUtils';
import OracleErrorInvestigationTab from './OracleErrorInvestigation/OracleErrorInvestigationTab';
import { resetEiData, setEiRefreshPage, setEiRefreshTimestamp } from '../../../store/workloadFactory/agenticAISlice';
import { resolveUnregisteredDatabasesAndPasswordRestriction } from '../../InventoryV2/InventoryUtilsV2';

const OracleResourcePages = () => {
    const dispatch = useDispatch();
    const { setDialog, closeDialog } = useDialog();
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const { breadCrumbSelectedFrom } = useAppSelector(state => state.inventoryV2);
    const { selectedOracleInnerPageTab, visitedTabs, resourceDetails, refreshTimes } = useAppSelector(
        state => state.oracleSlice
    );
    const {
        selectedHostname,
        selectedDatabaseInstanceName,
        innerPageDetails,
        isWad,
        gwRefreshTimestamp,
        isAssessmentAvailable,
        isUnregistered,
        hostManageReadiness,
        selectedResourceId: gwSelectedResourceId,
        selectedGwInstanceCredId,
        selectedGwInstanceRegionId,
        selectedDatabaseInstance
    } = useAppSelector(state => state.getWellOptimize);
    const { inventoryTableData } = useAppSelector(state => state.inventoryV2);
    const { selectedResourceCredId, selectedResourceRegionId, selectedResourceId } = useAppSelector(
        state => state.workloadFactoryResource
    );

    const { eiRefreshTimestamp } = useAppSelector(state => state.agenticAI);
    const [registerResourceCredBulk] = useRegisterResourceCredentialsBulkMutation();

    const restrictDatabasesAndPassword = useMemo(
        () =>
            resolveUnregisteredDatabasesAndPasswordRestriction({
                isWad,
                isUnregistered,
                hostManageReadinessFromStore: hostManageReadiness,
                inventoryTableData,
                resourceId: gwSelectedResourceId,
                credId: selectedGwInstanceCredId,
                regionId: selectedGwInstanceRegionId,
                instanceId: selectedDatabaseInstance,
                instanceName: selectedDatabaseInstanceName
            }),
        [
            isWad,
            isUnregistered,
            hostManageReadiness,
            inventoryTableData,
            gwSelectedResourceId,
            selectedGwInstanceCredId,
            selectedGwInstanceRegionId,
            selectedDatabaseInstance,
            selectedDatabaseInstanceName
        ]
    );

    // Reset visited tabs when leaving the dashboard
    useEffect(
        () => () => {
            dispatch(resetOracleResourceVisitedTabs());
        },
        [dispatch]
    );

    const handleUpdatePassword = () => {
        setDialog(
            <DialogComponent
                header={GENERAL.UPDATE_ORACLE_SERVER_PASSWORD}
                content={<OracleServerPasswordContent type={RESET_PASSWORD_TYPE.ORACLESERVER} />}
                primaryButton={GENERAL.UPDATE}
                secondaryButton={GENERAL.CANCEL}
                callback={() => {
                    handleOracleServerPasswordApply(
                        selectedDatabaseInstanceName,
                        resourceDetails,
                        innerPageDetails,
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
                dialogFrom={FROM_DIALOG.SQLSERVER}
            />
        );
    };

    // Scroll to top when selected resource changes (e.g. when navigating from Data Guard replica link)
    useEffect(() => {
        window.scrollTo(0, 0);
        const el = scrollContainerRef.current;
        if (el) el.scrollTop = 0;
    }, [selectedResourceId]);

    // Mark the current tab as visited when the component mounts
    useEffect(() => {
        if (!visitedTabs[selectedOracleInnerPageTab]) {
            dispatch(setOracleResourceVisitedTabs(selectedOracleInnerPageTab));
        }
    }, [selectedOracleInnerPageTab, visitedTabs, dispatch]);

    // refresh time on hover
    const setRefreshTimeOnIcon = () => {
        if (
            selectedOracleInnerPageTab === WELL_ARCHITECTED_TABS.OVERVIEW ||
            selectedOracleInnerPageTab === WELL_ARCHITECTED_TABS.PDB
        ) {
            return refreshTimes.overviewRefreshTime;
        }
        if (selectedOracleInnerPageTab === WELL_ARCHITECTED_TABS.WELL_ARCHITECTED_STATUS) {
            return gwRefreshTimestamp;
        }
        if (selectedOracleInnerPageTab === WELL_ARCHITECTED_TABS.ERROR_INVESTIGATION) {
            return eiRefreshTimestamp;
        }
        return '';
    };

    const refreshTimeOnIcon = setRefreshTimeOnIcon();
    const showLastUpdatePopover =
        selectedOracleInnerPageTab !== WELL_ARCHITECTED_TABS.WELL_ARCHITECTED_STATUS ||
        (isAssessmentAvailable && !!refreshTimeOnIcon && refreshTimeOnIcon !== '0');

    const handleOracleRefresh = () => {
        if (
            selectedOracleInnerPageTab === WELL_ARCHITECTED_TABS.OVERVIEW ||
            selectedOracleInnerPageTab === WELL_ARCHITECTED_TABS.PDB
        ) {
            dispatch(setOracleResourceDetails({}));
            dispatch(setRefreshOracleOverview(true));
            dispatch(setOracleRefreshTimes({ overviewRefreshTime: getCurrentDateTime() }));
        } else if (selectedOracleInnerPageTab === WELL_ARCHITECTED_TABS.WELL_ARCHITECTED_STATUS) {
            dispatch(setRefreshOracleWellArchitect(true));
        } else if (selectedOracleInnerPageTab === WELL_ARCHITECTED_TABS.ERROR_INVESTIGATION) {
            dispatch(resetEiData({ dbType: DBType.ORACLE }));
            dispatch(setEiRefreshTimestamp(getCurrentDateTime()));
            dispatch(setEiRefreshPage(true));
        }
    };
    return (
        <div ref={scrollContainerRef} className={styles['oracle-inner-pages']}>
            <div className={`${commonStyles.commonBreadCrumb} ${styles.breadCrumb}`} style={{ left: '0%' }}>
                <BreadCrumbs
                    items={[
                        {
                            title: instanceBreadCrumbSelectedFrom(breadCrumbSelectedFrom),
                            onClick: () => {
                                selectHeaderTabFromBreadCrumb(breadCrumbSelectedFrom, dispatch);
                            }
                        },
                        {
                            title: `${selectedHostname}/${selectedDatabaseInstanceName}` || 'Host name/instance name'
                        }
                    ]}
                />
                <div className={styles.rightSection}>
                    {showLastUpdatePopover && (
                        <Popover
                            popoverClass={styles['copy-popover']}
                            children={`Last update: ${refreshTimeOnIcon}`}
                            trigger="hover"
                            container={
                                <div className={styles.refreshIcon} onClick={handleOracleRefresh}>
                                    <RefreshIcon />
                                </div>
                            }
                        />
                    )}
                    {!showLastUpdatePopover && (
                        <div className={styles.refreshIcon} onClick={handleOracleRefresh}>
                            <RefreshIcon />
                        </div>
                    )}

                    {selectedOracleInnerPageTab !== WELL_ARCHITECTED_TABS.ERROR_INVESTIGATION &&
                        !isWad &&
                        !restrictDatabasesAndPassword && (
                            <div className={styles.buttonContainer}>
                                <ButtonWithDropdown
                                    variant="icon"
                                    className={styles.buttonWithDropdownContainer}
                                    items={[
                                        {
                                            id: 'updateOracleServerPassword',
                                            children: GENERAL.UPDATE_ORACLE_SERVER_PASSWORD,
                                            onClick: handleUpdatePassword
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

            {selectedOracleInnerPageTab === WELL_ARCHITECTED_TABS.PDB && <OraclePDB />}

            {selectedOracleInnerPageTab === WELL_ARCHITECTED_TABS.ERROR_INVESTIGATION && (
                <OracleErrorInvestigationTab />
            )}
        </div>
    );
};
export default OracleResourcePages;
