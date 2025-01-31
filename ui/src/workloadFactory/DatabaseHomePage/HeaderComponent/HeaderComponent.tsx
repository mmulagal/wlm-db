import React, { useEffect, useMemo, useState } from 'react';
import styles from './HeaderComponent.module.scss';

import {
    BlueXPListeners,
    DsBlueXpMenu,
    DsButton,
    DsTypography,
    Popover,
    SelectField,
    Typography,
    postBlueXPMessage
} from '@netapp/design-system';
import { optionType } from '@netapp/design-system/dist/components/Select';
import { GENERAL } from '../../../utils/appConstants';
import JobMonitoring from '../../JobMonitoring/JobMonitoring';
import {
    apiDOCURL,
    checkValueSavedForCred,
    checkValueSavedForRegion,
    generateOptionType,
    getCurrentDateTime,
    handleURL,
    regionsSort,
    resetDBHomePageState,
    setExploreSavingsSubTab,
    setTabValue
} from '../../../utils/utilityFunctions';
import { useAppSelector } from '../../../store/storeHooks';
import { ReactComponent as RefreshIcon } from '@netapp/icons/ic_refresh.svg';
import { ReactComponent as BlueXPDatabase } from '../../../assets/blueXPDatabase.svg';
import { ReactComponent as Close } from '../../../assets/ic_close.svg';
import { useDispatch } from 'react-redux';
import HeaderComponentApi from './HeaderComponentApis';
import {
    setDashboardRefresh,
    setHeaderSelectedCred,
    setHeaderSelectedRegion,
    setRefreshTime
} from '../../../store/workloadFactory/headersSlice';
import {
    inventoryApi,
    inventoryApiV2,
    useCreateDemoResourcesMutation,
    workloadFactoryResourceApiV2
} from '../../../utils/apiService';
import {
    setFromTime,
    setJobsList,
    setSubJobsData,
    setTimeInterval,
    setToTime
} from '../../../store/workloadFactory/jobMonitoringSlice';
import { setSelectedCredentials, setSelectedRegionData } from '../../../store/mssql/mssqlFormSlice';
import {
    DBType,
    SAVINGS_CALC_MODE,
    WLF_TABS,
    WLF_TO_FORM_NAVIGATE,
    WLF_TO_PROTECT_NAVIGATE
} from '../../../utils/consts';
import ComponentLoader from '../../../common/ComponentLoader/ComponentLoader';
import Sandbox from '../../Sandbox/Sandbox';
import DatabaseHomeApis from '../DatabaseHomeApis';
import JobMonitoringApi from '../../JobMonitoring/JobMonitoringApi';
import ExploreSavings from '../../ExploreSavings/ExploreSavings';
import SavingsCalculator from '../../ExploreSavings/SavingsCalculator/SavingsCalulator';
import ViewCalculations from '../../ExploreSavings/ViewCalculations/ViewCalculations';
import SavingsCalculatorApi from '../../ExploreSavings/SavingsCalculator/SavingsCalculatorApi';
import {
    setSavingsCalculatorFrom,
    setSavingsCalculatorRefresh
} from '../../../store/workloadFactory/exploreSavingsSlice';
import SandboxApis from '../../Sandbox/SandboxApis';
import InventoryV2 from '../../InventoryV2/InventoryV2';
import InventoryApisV2 from '../../InventoryV2/InventoryApisV2';
import DatabaseHostOverviewV2 from '../../ResourcePage/ResourceHomePage/DatabaseHostOverviewV2';
import { setIsResourceRefresh } from '../../../store/workloadFactory/workloadFactoryResourceSlice';
import { updateRefreshBlocked } from '../../../store/authSlice';

import SavingsCalculatorManualApi from '../../ExploreSavings/SavingsCalculator/SavingsCalculatorManualAPI';
import { setDatabaseHostEntryPoint } from '../../../store/mssql/msSqlActionSlice';
import { useNavigate } from 'react-router-dom';
import { navigateToCanvas } from '../../../utils/appConfig';
import GetWell from '../../GetWell/GetWell';
import {
    addAllMssqlHostAssessmentData,
    setIsRefreshed,
    setSelectedHeaderTab
} from '../../../store/workloadFactory/inventoryV2Slice';
import { setSelectedDatabaseType } from '../../../store/postgre/postgreFormSlice';
import Dashboard from '../../Dashboard/Dashboard';
import DashboardInnerPage from '../../Dashboard/DashboardInnerPage/DashboardInnerPage';
import { setSandboxAgeRange } from '../../../store/workloadFactory/databaseHomeSlice';
import { useOnPremData } from '../../ExploreSavings/ExploreSavingsOnPremiseTable/useOnPremData';

type Tab = {
    tab: string;
};

const HeaderComponent = ({ tab }: Tab) => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const [statusChk, setStatusChk] = useState(false);
    const { fetchOnPremData } = useOnPremData();

    const { isWorkloadFactory } = useAppSelector(state => state?.auth);

    const { statusData, statusLoading } = useAppSelector(state => state.headers.getStatus);

    const [selectedTab, setSelectedTab] = useState(WLF_TABS.DASHBOARD);
    const [tabInfo, setTabInfo] = useState('');

    const { credentialData, credentialLoading } = useAppSelector(state => state.headers.getCredentials);
    const { regionsData, regionsLoading } = useAppSelector(state => state.headers.getRegions);
    const headerSelectedCred = useAppSelector(state => state.headers.headerSelectedCred);
    const headerSelectedRegion = useAppSelector(state => state.headers.headerSelectedRegion);
    const refreshTime = useAppSelector(state => state.headers.refreshTime);
    const selectedHeaderTab = useAppSelector(state => state.inventoryV2.selectedHeaderTab);
    const isDemoMode = useAppSelector(state => state.auth.isDemoMode);
    const newDashboardItem = localStorage.getItem('newDashboard');
    const setFlagForNewDashboard = newDashboardItem ? JSON.parse(newDashboardItem) : null;
    const selectedExploreSavingsTab = useAppSelector(state => state.exploreSavings.selectedExploreSavingsTab);

    const [createDemoResourcesApi] = useCreateDemoResourcesMutation();

    HeaderComponentApi();
    InventoryApisV2();
    DatabaseHomeApis();
    JobMonitoringApi();
    SavingsCalculatorApi();
    SavingsCalculatorManualApi();
    SandboxApis();

    useEffect(() => {
        let tabValue = setTabValue(tab, selectedHeaderTab);

        setTabInfo(tabValue);
        dispatch(setSelectedHeaderTab(tabValue));
        if (
            tabValue === WLF_TABS.EXPLORE_SAVINGS_EBS ||
            tabValue === WLF_TABS.EXPLORE_SAVINGS_FsxW ||
            tabValue === WLF_TABS.EXPLORE_SAVINGS_ONPREM
        ) {
            setExploreSavingsSubTab(tabValue, dispatch);
        }
    }, [tab]);

    useEffect(() => {
        if (isDemoMode || (statusData && statusData?.isActive)) {
            setStatusChk(true);
        } else if (statusData && !statusData?.isActive) {
            if (
                tabInfo === WLF_TABS.EXPLORE_SAVINGS_EBS ||
                tabInfo === WLF_TABS.EXPLORE_SAVINGS_FsxW ||
                tabInfo === WLF_TABS.EXPLORE_SAVINGS_ONPREM
            ) {
                if (tabInfo === WLF_TABS.EXPLORE_SAVINGS_EBS) {
                    postBlueXPMessage({
                        type: BlueXPListeners.navigate,
                        payload: {
                            pathname: `${
                                isWorkloadFactory
                                    ? './storage-saving-calculator?type=ebs&mode=manual'
                                    : '../fsxdb/storage-saving-calculator?type=ebs&mode=manual'
                            }`,
                            replace: true
                        }
                    });
                    dispatch(setSavingsCalculatorFrom(SAVINGS_CALC_MODE.MANUAL_EBS));
                    dispatch(setSelectedHeaderTab(WLF_TABS.SAVINGS_CALCULATOR));
                } else if (tabInfo === WLF_TABS.EXPLORE_SAVINGS_FsxW) {
                    postBlueXPMessage({
                        type: BlueXPListeners.navigate,
                        payload: {
                            pathname: `${
                                isWorkloadFactory
                                    ? './storage-saving-calculator?type=fsxw&mode=manual'
                                    : '../fsxdb/storage-saving-calculator?type=fsxw&mode=manual'
                            }`,
                            replace: true
                        }
                    });
                    dispatch(setSavingsCalculatorFrom(SAVINGS_CALC_MODE.MANUAL_FSXW));
                    dispatch(setSelectedHeaderTab(WLF_TABS.SAVINGS_CALCULATOR));
                } else {
                    postBlueXPMessage({
                        type: BlueXPListeners.navigate,
                        payload: {
                            pathname: `${
                                isWorkloadFactory
                                    ? './storage-saving-calculator?type=onprem&mode=manual'
                                    : '../fsxdb/storage-saving-calculator?type=onprem&mode=manual'
                            }`,
                            replace: true
                        }
                    });
                    console.log('coming here inside if else in header');
                    dispatch(setSelectedHeaderTab(WLF_TABS.EXPLORE_SAVINGS_ONPREM));
                    setExploreSavingsSubTab(WLF_TABS.EXPLORE_SAVINGS_ONPREM, dispatch);
                }
            } else {
                if (!isWorkloadFactory) {
                    postBlueXPMessage({
                        type: BlueXPListeners.navigate,
                        payload: { pathname: '../fsxdb/marketing', replace: true }
                    });
                } else {
                    postBlueXPMessage({
                        type: BlueXPListeners.navigate,
                        payload: { pathname: './marketing', replace: true }
                    });
                }
            }
        } else {
            setStatusChk(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusData, tabInfo]);

    //Function to generate the options for Select Field
    const generateAWSAccounts = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        credentialData?.map((val: any, idx: number) => {
            const credValue = `${val.name} | ${GENERAL.HEADER_ACCOUNT_ID}: ${val.providerAccountId}`;
            const label2 = `${GENERAL.HEADER_ACCOUNT_ID}: ${val.providerAccountId}`;
            const option = generateOptionType(credValue, credValue, label2, false, '', val);
            options.push(option);
        });
        if (options.length > 0 && !headerSelectedCred) {
            if (localStorage.getItem('selectedCred')) {
                //@ts-ignore
                const value = JSON.parse(localStorage.getItem('selectedCred'));

                if (checkValueSavedForCred(options, value)) {
                    dispatch(setHeaderSelectedCred(value));
                } else {
                    dispatch(setHeaderSelectedCred(options[0]));
                }
            } else {
                dispatch(setHeaderSelectedCred(options[0]));
            }
        }
        return options;
    }, [credentialData]);

    const generateRegionsData = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        const sortedRegionsData = regionsSort(regionsData?.regions || []);
        sortedRegionsData?.map((val: any, idx: number) => {
            const regionValue = `${val.regionName} | ${val.regionCode}`;
            const label2 = val.regionCode;
            const option = generateOptionType(regionValue, regionValue, label2, false, '', val);
            options.push(option);
        });
        if (options.length > 0 && !headerSelectedRegion) {
            const defaultOption: any = options[0];
            if (localStorage.getItem('selectedRegion')) {
                //@ts-ignore
                const regionValue = JSON.parse(localStorage.getItem('selectedRegion'));

                if (checkValueSavedForRegion(options, regionValue)) {
                    if (isDemoMode) {
                        createDemoResourcesApi({
                            credentialsId: headerSelectedCred?.data?.credentialsId,
                            regionId: regionValue?.data?.regionCode
                        }).then(() => {
                            dispatch(setHeaderSelectedRegion(regionValue));
                        });
                    } else {
                        dispatch(setHeaderSelectedRegion(regionValue));
                    }
                } else {
                    if (isDemoMode) {
                        createDemoResourcesApi({
                            credentialsId: headerSelectedCred?.data?.credentialsId,
                            regionId: defaultOption?.data?.regionCode
                        }).then(() => {
                            dispatch(setHeaderSelectedRegion(defaultOption));
                        });
                    } else {
                        dispatch(setHeaderSelectedRegion(defaultOption));
                    }
                }
            } else {
                if (isDemoMode) {
                    createDemoResourcesApi({
                        credentialsId: headerSelectedCred?.data?.credentialsId,
                        regionId: defaultOption?.data?.regionCode
                    }).then(() => {
                        dispatch(setHeaderSelectedRegion(defaultOption));
                    });
                } else {
                    dispatch(setHeaderSelectedRegion(defaultOption));
                }
            }
        }
        return options;
    }, [regionsData]);

    useEffect(() => {
        const credValue = headerSelectedCred?.data?.name + ' | Account: ' + headerSelectedCred?.data?.providerAccountId;
        const option = generateOptionType(credValue, credValue, '', false, '', headerSelectedCred?.data);
        dispatch(setSelectedCredentials(option));
    }, [headerSelectedCred]);

    useEffect(() => {
        const regionValue = headerSelectedRegion?.data?.regionCode + ' | ' + headerSelectedRegion?.data?.regionName;
        const option = generateOptionType(regionValue, regionValue, '', false, '', headerSelectedRegion?.data);
        dispatch(setSelectedRegionData(option));
    }, [headerSelectedRegion]);

    const handleClick = (value: string) => {
        setSelectedTab(value);
        dispatch(setSelectedHeaderTab(value));
        handleURL(value, isWorkloadFactory);
    };

    useEffect(() => {
        dispatch(setRefreshTime(getCurrentDateTime()));
    }, []);

    const refreshPage = () => {
        dispatch(updateRefreshBlocked(false));
        dispatch(setRefreshTime(getCurrentDateTime()));
        if (selectedHeaderTab === WLF_TABS.DASHBOARD) {
            resetDBHomePageState(dispatch);
            dispatch(setDashboardRefresh(true));
            dispatch(inventoryApi.util.resetApiState());
            dispatch(inventoryApiV2.util.resetApiState());
            dispatch(setIsRefreshed(true));
        } else if (selectedHeaderTab === WLF_TABS.INVENTORY || selectedHeaderTab === WLF_TABS.EXPLORE_SAVINGS) {
            resetDBHomePageState(dispatch);
            dispatch(inventoryApi.util.resetApiState());
            dispatch(inventoryApiV2.util.resetApiState());
            dispatch(setIsRefreshed(true));
        } else if (selectedHeaderTab === WLF_TABS.OVERVIEW) {
            dispatch(workloadFactoryResourceApiV2.util.resetApiState());
            dispatch(setIsResourceRefresh(true));
        } else if (selectedHeaderTab === WLF_TABS.JOB_MONITORING) {
            dispatch(setJobsList([]));
            dispatch(setSubJobsData([]));
            dispatch(setIsRefreshed(true));
        } else if (
            selectedHeaderTab === WLF_TABS.SAVINGS_CALCULATOR ||
            selectedHeaderTab === WLF_TABS.VIEW_THE_CALCULATIONS
        ) {
            dispatch(setSavingsCalculatorRefresh(true));
        } else if (selectedHeaderTab === WLF_TABS.SANDBOXES) {
            dispatch(setIsRefreshed(true));
        }
        fetchOnPremData(true);
    };

    const refreshComponent = () => {
        return (
            <div className={styles.refresh}>
                <Popover
                    popoverClass={styles['copy-popover']}
                    children={`Last update: ${refreshTime}`}
                    trigger="hover"
                    container={
                        <div className={styles.refreshIcon} onClick={refreshPage}>
                            <RefreshIcon />
                        </div>
                    }
                />
            </div>
        );
    };

    const selectComponents = () => {
        return (
            <div className={styles.content}>
                <div className={styles.firstSelect} title={headerSelectedCred?.label}>
                    <SelectField
                        isLoading={credentialLoading}
                        isClearable={false}
                        value={headerSelectedCred ? [headerSelectedCred] : [generateAWSAccounts[0]]}
                        onChange={(selectedOptions: any): void => {
                            if (localStorage.getItem('selectedCred')) {
                                localStorage.removeItem('selectedCred');
                            }
                            localStorage.setItem('selectedCred', JSON.stringify(selectedOptions));
                            dispatch(updateRefreshBlocked(false));
                            dispatch(setHeaderSelectedCred(selectedOptions));
                        }}
                        placeholder="Select a Credential"
                        isSearchable={generateAWSAccounts.length > 5}
                        options={generateAWSAccounts}
                        isReadOnly={
                            selectedHeaderTab === WLF_TABS.OVERVIEW ||
                            selectedHeaderTab === WLF_TABS.SAVINGS_CALCULATOR ||
                            selectedHeaderTab === WLF_TABS.VIEW_THE_CALCULATIONS ||
                            selectedHeaderTab === WLF_TABS.EXPLORE_SAVINGS_ONPREM
                        }
                        isDisabled={selectedExploreSavingsTab === WLF_TABS.MSSQL_ON_PREMISES}
                    />
                </div>

                <div className={styles.secondSelect}>
                    <SelectField
                        isLoading={regionsLoading}
                        isClearable={false}
                        value={headerSelectedRegion ? [headerSelectedRegion] : [generateRegionsData[0]]}
                        onChange={(selectedOptions: any): void => {
                            function updateRegion() {
                                if (localStorage.getItem('selectedRegion')) {
                                    localStorage.removeItem('selectedRegion');
                                }
                                localStorage.setItem('selectedRegion', JSON.stringify(selectedOptions));
                                dispatch(updateRefreshBlocked(false));
                                dispatch(setHeaderSelectedRegion(selectedOptions));
                            }
                            if (isDemoMode) {
                                createDemoResourcesApi({
                                    credentialsId: headerSelectedCred?.data?.credentialsId,
                                    regionId: selectedOptions?.data?.regionCode
                                }).then(() => {
                                    updateRegion();
                                });
                            } else {
                                updateRegion();
                            }
                        }}
                        placeholder="Select a Region"
                        isSearchable={generateRegionsData.length > 5}
                        options={generateRegionsData}
                        isReadOnly={
                            selectedHeaderTab === WLF_TABS.OVERVIEW ||
                            selectedHeaderTab === WLF_TABS.SAVINGS_CALCULATOR ||
                            selectedHeaderTab === WLF_TABS.VIEW_THE_CALCULATIONS ||
                            selectedHeaderTab === WLF_TABS.EXPLORE_SAVINGS_ONPREM
                        }
                        isDisabled={selectedExploreSavingsTab === WLF_TABS.MSSQL_ON_PREMISES}
                    />
                </div>
            </div>
        );
    };

    const checkConditionForHeaderComponent = () => {
        if (
            statusChk ||
            (!statusChk &&
                (tabInfo === WLF_TABS.EXPLORE_SAVINGS_EBS ||
                    tabInfo === WLF_TABS.EXPLORE_SAVINGS_FsxW ||
                    tabInfo === WLF_TABS.EXPLORE_SAVINGS_ONPREM))
        ) {
            return true;
        } else {
            return false;
        }
    };

    //Job monitoring select drop down
    //Function to generate the options for Select Field for License
    const generateSelectFieldOptions = useMemo<optionType[]>((): optionType[] => {
        const arr = ['Last 24 hours', 'Last 7 days', 'Last 14 days', 'Last 30 days'];
        const options: optionType[] = [];
        arr?.map((val, idx: number) => {
            const option = generateOptionType(val, val, '', false, '');
            options.push(option);
        });
        // setDropdownValue(options[0]);
        return options;
    }, []);

    const [dropDownValue, setDropdownValue] = useState<any>(null);

    const setTimeRange = (selectedTime: string) => {
        let days = 1;
        if (selectedTime === 'Last 7 days') {
            days = 7;
        } else if (selectedTime === 'Last 14 days') {
            days = 14;
        } else if (selectedTime === 'Last 30 days') {
            days = 30;
        }
        dispatchTimeInterval(days);
    };

    const dispatchTimeInterval = (days: number) => {
        const toDate = Date.now();
        const fromDate = toDate - days * (3600 * 1000 * 24);
        dispatch(setFromTime(fromDate));
        dispatch(setToTime(toDate));
        dispatch(setTimeInterval(days));
    };

    const handleExploreSavingCloseNavigation = () => {
        if (isWorkloadFactory) {
            navigateToCanvas('/');
        } else {
            postBlueXPMessage({
                type: BlueXPListeners.navigate,
                payload: { pathname: '../fsxhome', replace: true }
            });
        }
    };

    return statusLoading && !isDemoMode ? (
        <div className={styles.loader}>
            <ComponentLoader style={{ margin: '0 auto' }} />
        </div>
    ) : (
        checkConditionForHeaderComponent() && (
            <div className={styles.headerComponent}>
                {!statusChk &&
                (tabInfo === WLF_TABS.EXPLORE_SAVINGS_EBS || tabInfo === WLF_TABS.EXPLORE_SAVINGS_FsxW) ? (
                    <div className={styles.exploreSavingHeader}>
                        <DsTypography variant="Regular_20">Explore savings</DsTypography>
                        <div onClick={handleExploreSavingCloseNavigation} className={styles.closeIcon}>
                            <Close />
                        </div>
                    </div>
                ) : (
                    <div className={styles.firstSection}>
                        <div className={styles.withWorkLoad}>
                            <div className={styles.firstRow}>
                                {!isWorkloadFactory && (
                                    <>
                                        <BlueXPDatabase />
                                        <Typography
                                            variant="Regular_20"
                                            className={styles.heading}
                                            style={{
                                                color: 'var(--text-button-primary)',
                                                position: 'relative',
                                                top: '5px'
                                            }}
                                        >
                                            {GENERAL.DATABASES}
                                        </Typography>
                                    </>
                                )}
                                {isWorkloadFactory && (
                                    <Typography variant="Regular_24" className={styles.heading}>
                                        {GENERAL.DATABASES}
                                    </Typography>
                                )}
                            </div>

                            <div className={styles.secondRow}>
                                <div className={styles.overviewTabs}>
                                    <Typography
                                        variant="Regular_14"
                                        className={
                                            selectedHeaderTab === WLF_TABS.DASHBOARD ||
                                            selectedHeaderTab === WLF_TABS.DASHBOARD_INNER_PAGE
                                                ? `${
                                                      isWorkloadFactory
                                                          ? styles.headerPart1
                                                          : `${styles.headerPart1} ${styles.blueXPHeaderClass}`
                                                  } ${
                                                      isWorkloadFactory
                                                          ? styles.active
                                                          : `${styles.active} ${styles.activeBlueXPActive}`
                                                  }`
                                                : `${
                                                      isWorkloadFactory
                                                          ? styles.headerPart1
                                                          : `${styles.headerPart1} ${styles.blueXPHeaderClass}`
                                                  }`
                                        }
                                        onClick={() => {
                                            handleClick(WLF_TABS.DASHBOARD);
                                        }}
                                        id="dashboard"
                                    >
                                        {GENERAL.TAB_DASHBOARD}
                                    </Typography>
                                    <Typography
                                        variant="Regular_14"
                                        className={
                                            selectedHeaderTab === WLF_TABS.INVENTORY ||
                                            selectedHeaderTab === WLF_TABS.OVERVIEW ||
                                            selectedHeaderTab === WLF_TABS.OPTIMIZE
                                                ? `${
                                                      isWorkloadFactory
                                                          ? styles.headerPart2
                                                          : `${styles.headerPart2} ${styles.blueXPHeaderClass}`
                                                  } ${
                                                      isWorkloadFactory
                                                          ? styles.active
                                                          : `${styles.active} ${styles.activeBlueXPActive}`
                                                  }`
                                                : `${
                                                      isWorkloadFactory
                                                          ? styles.headerPart2
                                                          : `${styles.headerPart2} ${styles.blueXPHeaderClass}`
                                                  }`
                                        }
                                        onClick={() => {
                                            handleClick(WLF_TABS.INVENTORY);
                                        }}
                                        id="inventory"
                                    >
                                        {GENERAL.TAB_INVENTORY}
                                    </Typography>

                                    <Typography
                                        variant="Regular_14"
                                        className={
                                            selectedHeaderTab === WLF_TABS.SANDBOXES
                                                ? `${
                                                      isWorkloadFactory
                                                          ? styles.headerPart4
                                                          : `${styles.headerPart4} ${styles.blueXPHeaderClass}`
                                                  } ${
                                                      isWorkloadFactory
                                                          ? styles.active
                                                          : `${styles.active} ${styles.activeBlueXPActive}`
                                                  }`
                                                : `${
                                                      isWorkloadFactory
                                                          ? styles.headerPart4
                                                          : `${styles.headerPart4} ${styles.blueXPHeaderClass}`
                                                  }`
                                        }
                                        onClick={() => {
                                            dispatch(setSandboxAgeRange({ range: '', from: 'Header' }));
                                            handleClick(WLF_TABS.SANDBOXES);
                                        }}
                                        id="sandboxes"
                                    >
                                        Sandboxes
                                    </Typography>

                                    <Typography
                                        variant="Regular_14"
                                        className={
                                            selectedHeaderTab === WLF_TABS.EXPLORE_SAVINGS ||
                                            selectedHeaderTab === WLF_TABS.SAVINGS_CALCULATOR ||
                                            selectedHeaderTab === WLF_TABS.EXPLORE_SAVINGS_FsxW ||
                                            selectedHeaderTab === WLF_TABS.EXPLORE_SAVINGS_EBS ||
                                            selectedHeaderTab === WLF_TABS.VIEW_THE_CALCULATIONS ||
                                            selectedHeaderTab === WLF_TABS.EXPLORE_SAVINGS_ONPREM
                                                ? `${
                                                      isWorkloadFactory
                                                          ? styles.headerPart5
                                                          : `${styles.headerPart5} ${styles.blueXPHeaderClass}`
                                                  } ${
                                                      isWorkloadFactory
                                                          ? styles.active
                                                          : `${styles.active} ${styles.activeBlueXPActive}`
                                                  }`
                                                : `${
                                                      isWorkloadFactory
                                                          ? styles.headerPart5
                                                          : `${styles.headerPart5} ${styles.blueXPHeaderClass}`
                                                  }`
                                        }
                                        onClick={() => {
                                            handleClick(WLF_TABS.EXPLORE_SAVINGS);
                                        }}
                                        id="explore-savings"
                                    >
                                        Explore savings
                                    </Typography>

                                    <Typography
                                        variant="Regular_14"
                                        className={
                                            selectedHeaderTab === WLF_TABS.JOB_MONITORING
                                                ? `${
                                                      isWorkloadFactory
                                                          ? styles.headerPart3
                                                          : `${styles.headerPart3} ${styles.blueXPHeaderClass}`
                                                  } ${
                                                      isWorkloadFactory
                                                          ? styles.active
                                                          : `${styles.active} ${styles.activeBlueXPActive}`
                                                  }`
                                                : `${
                                                      isWorkloadFactory
                                                          ? styles.headerPart3
                                                          : `${styles.headerPart3} ${styles.blueXPHeaderClass}`
                                                  }`
                                        }
                                        onClick={() => {
                                            handleClick(WLF_TABS.JOB_MONITORING);
                                        }}
                                        id="job-monitoring"
                                    >
                                        {GENERAL.TAB_JOB_MONITORING}
                                    </Typography>
                                </div>
                            </div>
                        </div>

                        {!isWorkloadFactory && (
                            <div className={styles.thirdRow}>
                                <DsBlueXpMenu className="hamburgerMenu" domain={process.env.REACT_APP_WF_DOMAIN!} />
                            </div>
                        )}
                    </div>
                )}

                <div className={styles.extraSpace} />
                <div className={styles.selectedTabSection}>
                    {selectedHeaderTab === WLF_TABS.DASHBOARD && (
                        <div className={styles.dashboardSection}>
                            <div className={!setFlagForNewDashboard ? styles.spaceAreaTemp : styles.spaceArea}>
                                <div className={!setFlagForNewDashboard ? styles.contentAreaTemp : styles.contentArea}>
                                    {selectComponents()}
                                    <div className={styles.content}>
                                        <>
                                            <DsButton
                                                children="Deploy host"
                                                variant="Default"
                                                dropDown={{
                                                    trigger: 'click',
                                                    autoPosition: true,
                                                    items: [
                                                        {
                                                            id: 'wlm-db-deploy-mssql-host',
                                                            label: 'Microsoft SQL Server',
                                                            onClick: () => {
                                                                dispatch(setDatabaseHostEntryPoint('database'));
                                                                dispatch(setSelectedDatabaseType(DBType.MSSQL));
                                                                // navigate(WLF_TO_FORM_NAVIGATE);
                                                                if (isWorkloadFactory) {
                                                                    navigate(WLF_TO_FORM_NAVIGATE);
                                                                    postBlueXPMessage({
                                                                        type: BlueXPListeners.navigate,
                                                                        payload: {
                                                                            pathname: './mssql-deploy-wizard',
                                                                            replace: true
                                                                        }
                                                                    });
                                                                } else {
                                                                    navigate('../../fsxdb/mssql-deploy-wizard');
                                                                    postBlueXPMessage({
                                                                        type: BlueXPListeners.navigate,
                                                                        payload: {
                                                                            pathname: '../../fsxdb/mssql-deploy-wizard',
                                                                            replace: true
                                                                        }
                                                                    });
                                                                }
                                                            },
                                                            className: 'mssql-deployment-button'
                                                        },
                                                        {
                                                            id: 'wlm-db-deploy-pgsql-host',
                                                            label: 'PostgreSQL Server',
                                                            onClick: () => {
                                                                dispatch(setDatabaseHostEntryPoint('database'));
                                                                dispatch(setSelectedDatabaseType(DBType.POSTGRESQL));
                                                                if (isWorkloadFactory) {
                                                                    navigate(WLF_TO_PROTECT_NAVIGATE);
                                                                    postBlueXPMessage({
                                                                        type: BlueXPListeners.navigate,
                                                                        payload: {
                                                                            pathname: './postgreSQL-deploy-wizard',
                                                                            replace: true
                                                                        }
                                                                    });
                                                                } else {
                                                                    navigate('../../fsxdb/postgreSQL-deploy-wizard');
                                                                    postBlueXPMessage({
                                                                        type: BlueXPListeners.navigate,
                                                                        payload: {
                                                                            pathname:
                                                                                '../../fsxdb/postgreSQL-deploy-wizard',
                                                                            replace: true
                                                                        }
                                                                    });
                                                                }
                                                            },
                                                            className: 'pgsql-deployment-button'
                                                        }
                                                    ]
                                                }}
                                            />
                                        </>

                                        {refreshComponent()}
                                    </div>
                                </div>
                            </div>

                            <Dashboard />
                        </div>
                    )}
                    {selectedHeaderTab === WLF_TABS.INVENTORY && (
                        <>
                            <div className={styles.inventoryHeaderSection}>
                                <div className={styles.contentArea}>
                                    {selectComponents()}
                                    <div className={styles.content}>{refreshComponent()}</div>
                                </div>
                            </div>
                            <InventoryV2 />
                        </>
                    )}
                    {selectedHeaderTab === WLF_TABS.JOB_MONITORING && (
                        <>
                            <div className={styles.inventoryHeaderSection}>
                                <div className={styles.contentArea}>
                                    <div></div>
                                    <div className={styles.content}>
                                        <div className={styles.selectContainer}>
                                            <SelectField
                                                isClearable={false}
                                                onChange={(selectedOptions: any): void => {
                                                    setDropdownValue(selectedOptions);
                                                    setTimeRange(selectedOptions?.value);
                                                }}
                                                isSearchable={false}
                                                variant="underline"
                                                options={generateSelectFieldOptions}
                                                value={
                                                    dropDownValue
                                                        ? [dropDownValue]
                                                        : isDemoMode
                                                        ? [generateSelectFieldOptions[1]]
                                                        : [generateSelectFieldOptions[0]]
                                                }
                                            />
                                        </div>
                                        {refreshComponent()}
                                    </div>
                                </div>
                            </div>
                            <JobMonitoring
                                dropDownValue={dropDownValue}
                                setDropdownValue={setDropdownValue}
                                generateSelectFieldOptions={generateSelectFieldOptions}
                            />
                        </>
                    )}
                    {selectedHeaderTab === WLF_TABS.OVERVIEW && (
                        <DatabaseHostOverviewV2 refreshTime={refreshTime} refreshPage={refreshPage} />
                    )}

                    {/* For optimize tab */}

                    {selectedHeaderTab === WLF_TABS.OPTIMIZE && <GetWell />}

                    {selectedHeaderTab === WLF_TABS.DASHBOARD_INNER_PAGE && <DashboardInnerPage />}

                    {selectedHeaderTab === WLF_TABS.SANDBOXES && (
                        <>
                            <div className={styles.sandboxSection}>
                                <div className={styles.contentArea}>
                                    {selectComponents()}
                                    <div className={styles.content}>{refreshComponent()}</div>
                                </div>
                            </div>
                            <Sandbox />
                        </>
                    )}
                    {(selectedHeaderTab === WLF_TABS.EXPLORE_SAVINGS ||
                        selectedHeaderTab === WLF_TABS.EXPLORE_SAVINGS_EBS ||
                        selectedHeaderTab === WLF_TABS.EXPLORE_SAVINGS_FsxW ||
                        selectedHeaderTab === WLF_TABS.EXPLORE_SAVINGS_ONPREM) && (
                        <>
                            <div className={styles.exploreSavingSection}>
                                <div className={styles.contentArea}>
                                    {selectComponents()}
                                    <div className={styles.content}>{refreshComponent()}</div>
                                </div>
                            </div>
                            <ExploreSavings />
                        </>
                    )}
                    {selectedHeaderTab === WLF_TABS.SAVINGS_CALCULATOR && <SavingsCalculator statusCheck={statusChk} />}

                    {selectedHeaderTab === WLF_TABS.VIEW_THE_CALCULATIONS && (
                        <ViewCalculations statusCheck={statusChk} />
                    )}
                </div>
            </div>
        )
    );
};

export default HeaderComponent;
