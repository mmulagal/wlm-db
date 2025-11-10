import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
    BlueXPListeners,
    DsSelect,
    DsTypography,
    Popover,
    SelectField,
    Typography,
    postBlueXPMessage
} from '@netapp/design-system';
// @ts-ignore
import { optionType, optionTypeMulti } from '@netapp/design-system/dist/components/Select';
import { ReactComponent as RefreshIcon } from '@netapp/icons/ic_refresh.svg';
import { useDispatch } from 'react-redux';
import { useNavigate, useNavigationType, NavigationType } from 'react-router-dom';
import styles from './HeaderComponent.module.scss';

// @ts-ignore
import { GENERAL } from '../../../utils/appConstants';
import JobMonitoring from '../../JobMonitoring/JobMonitoring';
import {
    checkValueSavedForCred,
    checkValueSavedForRegion,
    generateMultipleOptionType,
    generateOptionType,
    getCurrentDateTime,
    handleURL,
    handleURLFromDashboard,
    regionsSort,
    resetDBHomePageState,
    setExploreSavingsSubTab,
    setTabValue
} from '../../../utils/utilityFunctions';
import { useAppSelector } from '../../../store/storeHooks';
import { ReactComponent as BlueXPDatabase } from '../../../assets/blueXPDatabase.svg';
import { ReactComponent as Close } from '../../../assets/ic_close.svg';
import HeaderComponentApi from './HeaderComponentApis';
import {
    setDashboardRefresh,
    setHeaderSelectedCredSandbox,
    setHeaderSelectedMultiCred,
    setHeaderSelectedMultiRegion,
    setHeaderSelectedRegionSandbox,
    setMultiDataLoading,
    setMultiDataStatus,
    setRefreshTime,
    setRefreshTimeJobMonitor,
    setRefreshTimeSandbox,
    setSingleComboCredAndRegion
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
import { LOCAL, SAVINGS_CALC_MODE, STAGING, WLF_TABS } from '../../../utils/consts';
import ComponentLoader from '../../../common/ComponentLoader/ComponentLoader';
import Sandbox from '../../Sandbox/Sandbox';
import DatabaseHomeApis from '../DatabaseHomeApis';
import NoCredBanner from './NoCredBanner/NoCredBanner';

import ExploreSavings from '../../ExploreSavings/ExploreSavings';
import SavingsCalculator from '../../ExploreSavings/SavingsCalculator/SavingsCalulator';
import ViewCalculations from '../../ExploreSavings/ViewCalculations/ViewCalculations';
import SavingsCalculatorApi from '../../ExploreSavings/SavingsCalculator/SavingsCalculatorApi';
import {
    addExploreSavingsInitialData,
    setSavingsCalculatorFrom,
    setSavingsCalculatorRefresh,
    setUnmanagedExploreSavingsHost
} from '../../../store/workloadFactory/exploreSavingsSlice';
import InventoryV2 from '../../InventoryV2/InventoryV2';
import DatabaseHostOverviewV2 from '../../ResourcePage/ResourceHomePage/DatabaseHostOverviewV2';
import { setIsResourceRefresh } from '../../../store/workloadFactory/workloadFactoryResourceSlice';
import { updateRefreshBlocked } from '../../../store/authSlice';

import SavingsCalculatorManualApi from '../../ExploreSavings/SavingsCalculator/SavingsCalculatorManualAPI';
import { navigateToCanvas } from '../../../utils/appConfig';

import {
    resetInventoryLoading,
    resetRefreshData,
    setIsRefreshed,
    setLandingFromWizard,
    setSelectedHeaderTab
} from '../../../store/workloadFactory/inventoryV2Slice';

import DashboardInnerPage from '../../Dashboard/DashboardInnerPage/DashboardInnerPage';
import {
    addInitialData,
    initialDBHomepageState,
    setPotentialSavingsValues,
    setSandboxAgeRange
} from '../../../store/workloadFactory/databaseHomeSlice';
import { useOnPremData } from '../../ExploreSavings/ExploreSavingsOnPremiseTable/useOnPremData';
import FetchingDataNotification from '../FetchingDataNotification/FetchingDataNotification';
import OptimizeInnerPage from '../../GetWell/OptimizeInnerPage/OptimizeInnerPage';
import OptimizeOntapInnerPage from '../../GetWell/OptimizeInnerPage/OptimizeOntapInnerPage';
import Marketing from '../../../Marketing/Marketing';
import InventoryApisV3 from '../../InventoryV2/InventoryApisV3';
import { setIsRefreshedSandbox } from '../../../store/workloadFactory/sandboxSlice';
import store from '../../../store/store';
import DashboardDismissPage from '../../Dashboard/DashboardInnerPage/DashboardDismissPage';
import DashboardOptimizeInnerPage from '../../Dashboard/DashboardInnerPage/DashboardOptimizeInnerPage';
import { DsBlueXpMenu } from '../../../common/DsMenuBlueXP/DsBlueXpMenu';
import WellArchitectDashboard from '../../GetWell/WellArchitectDashboard/WellArchitectDashboard';
import RegisterWizard from '../../InventoryV2/InventoryTablesComponent/ManageInstanceWizard/RegisterWizard';
import DummySelect from '../../../common/DummySelect/DummySelect';
import OracleResourcePages from '../../Oracle/OracleResourcePages/OracleResourcePages';
import { clearDataMap } from '../../../store/workloadFactory/snapcenterSlice';
import DashboardOverview from '../../Dashboard/DashboardOverview/DashboardOverview';
import WellArchitectedTab from '../../WellArchitectedTab/WellArchitectedTab';

type Tab = {
    tab: string;
};

const HeaderComponent = ({ tab }: Tab) => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const [statusChk, setStatusChk] = useState(false);
    const [pendingQueriesCounter, setPendingQueriesCounter] = useState(0);
    const { fetchOnPremData } = useOnPremData();

    const { isWorkloadFactory } = useAppSelector(state => state?.auth);

    const { statusData, statusLoading } = useAppSelector(state => state.headers.getStatus);

    const [selectedTab, setSelectedTab] = useState(WLF_TABS.DASHBOARD);
    const [tabInfo, setTabInfo] = useState('');

    const { credentialData, credentialLoading } = useAppSelector(state => state.headers.getCredentials);
    const { regionsData, regionsLoading } = useAppSelector(state => state.headers.getRegions);
    const {
        headerSelectedCred,
        headerSelectedMultiCred,
        headerSelectedMultiRegion,
        headerSelectedRegion,
        headerSelectedCredSandbox,
        headerSelectedRegionSandbox,
        multiDataStatus,
        multiDataLoading,
        showNA
    } = useAppSelector(state => state.headers);
    const {
        isManagedHostListLoading,
        allmssqlHostAssessmentLoading,
        allOracleHostAssessmentLoading,
        allLogAnalysisLoading,
        fsxCredentialStatusLoading,
        fsxCredentialStatusLoadingOracle,
        mssqlInstancesData,
        pgsqlInstancesData,
        oracleInstancesData,
        perfMssqlInstancesData,
        potentialSavingsHostData,
        createResourceApiLoading,
        landingFromWizard
    } = useAppSelector(state => state.inventoryV2);
    const { databaseHostsLoading, fullHostDataLoading } = useAppSelector(state => state.inventoryV2.getDatabaseHosts);
    const { databaseHostsLoading: pgsqlDatabaseHostsLoading, fullHostDataLoading: pgsqlFullHostDataLoading } =
        useAppSelector(state => state.inventoryV2.getPgSqlDatabaseHosts);
    const { loading: dashSandboxListLoading } = useAppSelector(state => state.inventoryV2.dashSandboxList);
    const { loading: dashSandboxSavingsLoading } = useAppSelector(state => state.inventoryV2.dashSandboxSavings);
    const { discoverHostLoading } = useAppSelector(state => state.inventoryV2.discoveredHosts);
    const { discoverOracleHostLoading } = useAppSelector(state => state.inventoryV2.discoveredOracleHosts);
    const { discoverPgsqlHostLoading } = useAppSelector(state => state.inventoryV2.discoveredPgsqlHosts);
    // Added for widget
    const [currentCred, setCurrentCred] = useState<string | null>(null);
    const [currentRegion, setCurrentRegion] = useState<string | null>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [queue, setQueue] = useState<any>([]);
    // const [multiDataStatus, setMultiDataStatus] = useState<any>({});

    const { refreshTime, refreshTimeSandbox, secondaryCTAFlow } = useAppSelector(state => state.headers);
    const selectedHeaderTab = useAppSelector(state => state.inventoryV2.selectedHeaderTab);
    const isDemoMode = useAppSelector(state => state.auth.isDemoMode);
    const selectedExploreSavingsTab = useAppSelector(state => state.exploreSavings.selectedExploreSavingsTab);
    const isRefreshed = useAppSelector(state => state.inventoryV2.isRefreshed);
    const topBarFlag = useAppSelector(state => state?.auth?.features?.active['NetApp.NewNav/*']);

    const [createDemoResourcesApi] = useCreateDemoResourcesMutation();

    const multiDataStatusRef: any = useRef(null);

    const navType = useNavigationType();

    useEffect(() => {
        multiDataStatusRef.current = multiDataStatus;
    }, [multiDataStatus]);

    HeaderComponentApi();
    InventoryApisV3();
    DatabaseHomeApis();
    SavingsCalculatorApi();
    SavingsCalculatorManualApi();

    useEffect(
        () => () => {
            dispatch(setLandingFromWizard(false));
        },
        [dispatch]
    );

    useEffect(() => {
        const tabValue = setTabValue(tab, selectedHeaderTab);

        setTabInfo(tabValue);
        dispatch(setSelectedHeaderTab(tabValue));
        if (
            tabValue === WLF_TABS.EXPLORE_SAVINGS_EBS ||
            tabValue === WLF_TABS.EXPLORE_SAVINGS_FsxW ||
            tabValue === WLF_TABS.EXPLORE_SAVINGS_ONPREM
        ) {
            setExploreSavingsSubTab(tabValue, dispatch);
        }

        if (navType === NavigationType.Pop && isWorkloadFactory) {
            handleURL(tab, isWorkloadFactory);
        }
    }, [tab, isWorkloadFactory]);

    useEffect(() => {
        if (isDemoMode || (statusData && statusData?.isActive)) {
            setStatusChk(true);
        } else if (statusData && !statusData?.isActive) {
            if (secondaryCTAFlow) {
                setStatusChk(true);
                return;
            }
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

                    dispatch(setSelectedHeaderTab(WLF_TABS.EXPLORE_SAVINGS_ONPREM));
                    setExploreSavingsSubTab(WLF_TABS.EXPLORE_SAVINGS_ONPREM, dispatch);
                }
            }
        } else {
            setStatusChk(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusData, tabInfo]);

    // Function to generate the options for Select Field
    const generateSandboxAWSAccounts = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        credentialData?.map((val: any, idx: number) => {
            const credValue = `${val.name} | ${GENERAL.HEADER_ACCOUNT_ID}: ${val.providerAccountId}`;
            const label2 = `${GENERAL.HEADER_ACCOUNT_ID}: ${val.providerAccountId}`;
            const option = generateOptionType(credValue, credValue, label2, false, '', val);
            options.push(option);
        });
        if (options.length > 0 && !headerSelectedCredSandbox) {
            if (localStorage.getItem('selectedSandboxCred')) {
                // @ts-ignore
                const value = JSON.parse(localStorage.getItem('selectedSandboxCred'));

                if (checkValueSavedForCred(options, value)) {
                    dispatch(setHeaderSelectedCredSandbox(value));
                } else {
                    dispatch(setHeaderSelectedCredSandbox(options[0]));
                }
            } else {
                dispatch(setHeaderSelectedCredSandbox(options[0]));
            }
        }
        return options;
    }, [credentialData]);

    // Function to generate the options for Multi Select Field
    const generateAccountsForMultiSelect = useMemo<optionTypeMulti[]>((): optionTypeMulti[] => {
        const options: optionTypeMulti[] = [];
        credentialData?.map((val: any, idx: number) => {
            const credValue = `${val.name} | ${GENERAL.HEADER_ACCOUNT_ID}: ${val.providerAccountId}`;
            const label2 = `${GENERAL.HEADER_ACCOUNT_ID}: ${val.providerAccountId}`;
            const option = generateMultipleOptionType(credValue, credValue, val?.credentialsId, false, '', val);
            options.push(option);
        });
        if (options.length > 0 && !headerSelectedMultiCred) {
            if (localStorage.getItem('selectedCred')) {
                // @ts-ignore
                const value = JSON.parse(localStorage.getItem('selectedCred'));

                if (checkValueSavedForCred(options, value)) {
                    dispatch(setHeaderSelectedMultiCred([value]));
                } else {
                    dispatch(setHeaderSelectedMultiCred([options[0]]));
                }
            } else {
                dispatch(setHeaderSelectedMultiCred([options[0]]));
            }
        }
        return options;
    }, [credentialData]);

    // Function to generate the options for Multi Select Field
    const generateRegionsForMultiSelect = useMemo<optionTypeMulti[]>((): optionTypeMulti[] => {
        const options: optionTypeMulti[] = [];
        const sortedRegionsData = regionsSort(regionsData?.regions || []);
        sortedRegionsData?.map((val: any, idx: number) => {
            const regionValue = `${val.regionName} | ${val.regionCode}`;
            const label2 = val.regionCode;
            const option = generateMultipleOptionType(regionValue, regionValue, label2, false, '', val);
            options.push(option);
        });
        if (options.length > 0 && !headerSelectedMultiRegion) {
            const defaultOption: any = options[0];
            if (localStorage.getItem('selectedRegion')) {
                // @ts-ignore
                const regionValue = JSON.parse(localStorage.getItem('selectedRegion'));

                if (checkValueSavedForRegion(options, regionValue)) {
                    dispatch(setHeaderSelectedMultiRegion([regionValue]));
                } else {
                    dispatch(setHeaderSelectedMultiRegion([defaultOption]));
                }
            } else {
                dispatch(setHeaderSelectedMultiRegion([defaultOption]));
            }
        }
        return options;
    }, [regionsData]);

    const generateSandboxRegionsData = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        const sortedRegionsData = regionsSort(regionsData?.regions || []);
        sortedRegionsData?.map((val: any, idx: number) => {
            const regionValue = `${val.regionName} | ${val.regionCode}`;
            const label2 = val.regionCode;
            const option = generateOptionType(regionValue, regionValue, label2, false, '', val);
            options.push(option);
        });
        if (options.length > 0 && !headerSelectedRegionSandbox) {
            const defaultOption: any = options[0];
            if (localStorage.getItem('selectedSandboxRegion')) {
                // @ts-ignore
                const regionValue = JSON.parse(localStorage.getItem('selectedSandboxRegion'));

                if (checkValueSavedForRegion(options, regionValue)) {
                    if (isDemoMode) {
                        createDemoResourcesApi({
                            credentialsId: headerSelectedCredSandbox?.data?.credentialsId,
                            regionId: regionValue?.data?.regionCode
                        }).then(() => {
                            dispatch(setHeaderSelectedRegionSandbox(regionValue));
                        });
                    } else {
                        dispatch(setHeaderSelectedRegionSandbox(regionValue));
                    }
                } else if (isDemoMode) {
                    createDemoResourcesApi({
                        credentialsId: headerSelectedCredSandbox?.data?.credentialsId,
                        regionId: defaultOption?.data?.regionCode
                    }).then(() => {
                        dispatch(setHeaderSelectedRegionSandbox(defaultOption));
                    });
                } else {
                    dispatch(setHeaderSelectedRegionSandbox(defaultOption));
                }
            } else if (isDemoMode) {
                createDemoResourcesApi({
                    credentialsId: headerSelectedCredSandbox?.data?.credentialsId,
                    regionId: defaultOption?.data?.regionCode
                }).then(() => {
                    dispatch(setHeaderSelectedRegionSandbox(defaultOption));
                });
            } else {
                dispatch(setHeaderSelectedRegionSandbox(defaultOption));
            }
        }
        return options;
    }, [regionsData]);

    useEffect(() => {
        if (headerSelectedMultiCred?.length > 0) {
            const credValue = `${headerSelectedMultiCred?.[0]?.data?.name} | Account: ${headerSelectedMultiCred?.[0]?.data?.providerAccountId}`;
            const option = generateOptionType(credValue, credValue, '', false, '', headerSelectedMultiCred?.[0]?.data);
            dispatch(setSelectedCredentials(option));

            if (localStorage.getItem('selectedCred')) {
                localStorage.removeItem('selectedCred');
            }
            localStorage.setItem('selectedCred', JSON.stringify(option));
        }
    }, [headerSelectedMultiCred]);

    useEffect(() => {
        if (headerSelectedMultiRegion?.length > 0) {
            const regionValue = `${headerSelectedMultiRegion?.[0]?.data?.regionCode} | ${headerSelectedMultiRegion?.[0]?.data?.regionName}`;
            const option = generateOptionType(
                regionValue,
                regionValue,
                '',
                false,
                '',
                headerSelectedMultiRegion?.[0]?.data
            );
            dispatch(setSelectedRegionData(option));

            if (localStorage.getItem('selectedRegion')) {
                localStorage.removeItem('selectedRegion');
            }
            localStorage.setItem('selectedRegion', JSON.stringify(option));
        }
    }, [headerSelectedMultiRegion]);

    useEffect(() => {
        if (
            headerSelectedCred &&
            headerSelectedRegion &&
            !createResourceApiLoading &&
            !isManagedHostListLoading &&
            !databaseHostsLoading &&
            !fullHostDataLoading &&
            !pgsqlDatabaseHostsLoading &&
            !pgsqlFullHostDataLoading &&
            !allmssqlHostAssessmentLoading &&
            !allOracleHostAssessmentLoading &&
            !allLogAnalysisLoading &&
            !dashSandboxListLoading &&
            !dashSandboxSavingsLoading &&
            !discoverHostLoading &&
            !discoverOracleHostLoading &&
            !discoverPgsqlHostLoading &&
            !fsxCredentialStatusLoading &&
            !fsxCredentialStatusLoadingOracle
        ) {
            const currentCredId = headerSelectedCred?.data?.credentialsId;
            const currentRegionId = headerSelectedRegion?.data?.regionCode;

            const state = store.getState();
            const {
                mssqlInstancesData: mssqlInstancesDataLatest,
                pgsqlInstancesData: pgsqlInstancesDataLatest,
                oracleInstancesData: oracleInstancesDataLatest,
                perfMssqlInstancesData: perfMssqlInstancesDataLatest,
                potentialSavingsHostData: potentialSavingsHostDataLatest
            } = state.inventoryV2;

            let isMssqlInstanceDataLoading = false;
            if (mssqlInstancesDataLatest) {
                Object.keys(mssqlInstancesDataLatest)?.map((key: any) => {
                    const keyList = key.split('_');
                    if (
                        keyList?.length === 3 &&
                        keyList[1] === currentCredId &&
                        keyList[2] === currentRegionId &&
                        mssqlInstancesDataLatest?.[key]?.loading
                    ) {
                        isMssqlInstanceDataLoading = true;
                    }
                });
            }

            let isPgsqlInstanceDataLoading = false;
            if (pgsqlInstancesDataLatest) {
                Object.keys(pgsqlInstancesDataLatest)?.map((key: any) => {
                    const keyList = key.split('_');
                    if (
                        keyList?.length === 3 &&
                        keyList[1] === currentCredId &&
                        keyList[2] === currentRegionId &&
                        pgsqlInstancesDataLatest?.[key]?.loading
                    ) {
                        isPgsqlInstanceDataLoading = true;
                    }
                });
            }

            let isOracleInstanceDataLoading = false;
            if (oracleInstancesDataLatest) {
                Object.keys(oracleInstancesDataLatest)?.map((key: any) => {
                    const keyList = key.split('_');
                    if (
                        keyList?.length === 3 &&
                        keyList[1] === currentCredId &&
                        keyList[2] === currentRegionId &&
                        oracleInstancesDataLatest?.[key]?.loading
                    ) {
                        isOracleInstanceDataLoading = true;
                    }
                });
            }

            let perfMssqlInstancesDataLoading = false;
            if (perfMssqlInstancesDataLatest) {
                Object.keys(perfMssqlInstancesDataLatest)?.map((key: any) => {
                    const keyList = key.split('_');
                    if (
                        keyList?.length === 3 &&
                        keyList[1] === currentCredId &&
                        keyList[2] === currentRegionId &&
                        perfMssqlInstancesDataLatest?.[key]?.loading
                    ) {
                        perfMssqlInstancesDataLoading = true;
                    }
                });
            }

            let potentialSavingsHostDataLoading = false;
            if (potentialSavingsHostDataLatest) {
                Object.keys(potentialSavingsHostDataLatest)?.map((key: any) => {
                    const keyList = key.split('_');
                    if (
                        keyList?.length === 3 &&
                        keyList[1] === currentCredId &&
                        keyList[2] === currentRegionId &&
                        potentialSavingsHostDataLatest?.[key]?.loading
                    ) {
                        potentialSavingsHostDataLoading = true;
                    }
                });
            }

            if (
                !isMssqlInstanceDataLoading &&
                !perfMssqlInstancesDataLoading &&
                !potentialSavingsHostDataLoading &&
                !isPgsqlInstanceDataLoading &&
                !isOracleInstanceDataLoading
            ) {
                const newStatus = { ...multiDataStatusRef.current };
                newStatus[`${currentCredId}_${currentRegionId}`] = true;
                dispatch(setMultiDataStatus(newStatus));
            }
        }
    }, [
        createResourceApiLoading,
        isManagedHostListLoading,
        databaseHostsLoading,
        fullHostDataLoading,
        pgsqlDatabaseHostsLoading,
        pgsqlFullHostDataLoading,
        allmssqlHostAssessmentLoading,
        allOracleHostAssessmentLoading,
        allLogAnalysisLoading,
        dashSandboxListLoading,
        dashSandboxSavingsLoading,
        discoverHostLoading,
        discoverOracleHostLoading,
        discoverPgsqlHostLoading,
        fsxCredentialStatusLoading,
        fsxCredentialStatusLoadingOracle,
        mssqlInstancesData,
        pgsqlInstancesData,
        oracleInstancesData,
        perfMssqlInstancesData,
        potentialSavingsHostData
    ]);

    // Function to check if all APIs are completed for a cred-region set
    const isApiCompletedForSet = (cred: string, region: string) => {
        if (multiDataStatusRef.current) {
            return multiDataStatusRef.current[`${cred}_${region}`];
        }
        return false;
    };

    useEffect(() => {
        if (isRefreshed) {
            dispatch(resetRefreshData(null));
            // Explore savings data
            dispatch(setUnmanagedExploreSavingsHost([]));
            dispatch(setPotentialSavingsValues(null));
            dispatch(addInitialData(initialDBHomepageState));
            dispatch(setIsRefreshed(false));

            dispatch(setMultiDataStatus({}));
            const total = headerSelectedMultiCred.length * headerSelectedMultiRegion.length;
            setPendingQueriesCounter(total);
            dispatch(
                setSingleComboCredAndRegion({
                    cred: null,
                    region: null
                })
            );
            setCurrentIndex(0);
            setTimeout(() => {
                initialMultiCall();
            }, 10);
        }
    }, [isRefreshed]);

    const initialMultiCall = () => {
        if (
            headerSelectedMultiCred &&
            headerSelectedMultiCred.length > 0 &&
            headerSelectedMultiRegion &&
            headerSelectedMultiRegion.length > 0
        ) {
            if (headerSelectedMultiCred[0] !== undefined && headerSelectedMultiRegion[0] !== undefined) {
                const total = headerSelectedMultiCred.length * headerSelectedMultiRegion.length;
                setPendingQueriesCounter(total);
                const queueLength = queue?.length;
                const newQueue: any = [...queue];
                const newQueueForLoop: any = [...newQueue];
                const newMultiDataStatus: any = { ...multiDataStatusRef.current };
                // using diff queue variable for loop as we update newQueue in the loop
                newQueueForLoop?.forEach((item: any, index: number) => {
                    let isPresent = false;
                    for (const cred of headerSelectedMultiCred) {
                        for (const region of headerSelectedMultiRegion) {
                            if (
                                item.cred?.data?.credentialsId === cred?.data?.credentialsId &&
                                item.region?.data?.regionCode === region?.data?.regionCode
                            ) {
                                isPresent = true;
                            }
                        }
                    }
                    if (!isPresent) {
                        // If any combo is removed and added back again than not calling apis again
                        // const key = `${newQueue[index]?.cred?.data?.credentialsId}_${newQueue[index]?.region?.data?.regionCode}`;
                        // delete newMultiDataStatus[key];
                        const index = newQueue?.findIndex(
                            (perItem: any) =>
                                item.cred?.data?.credentialsId === perItem.cred?.data?.credentialsId &&
                                item.region?.data?.regionCode === perItem.region?.data?.regionCode
                        );
                        newQueue.splice(index, 1);
                    }
                });
                for (const cred of headerSelectedMultiCred) {
                    for (const region of headerSelectedMultiRegion) {
                        const isAlreadyInQueue = newQueue?.filter(
                            (item: any) =>
                                item.cred?.data?.credentialsId === cred?.data?.credentialsId &&
                                item.region?.data?.regionCode === region?.data?.regionCode
                        );
                        if (isAlreadyInQueue?.length === 0) {
                            newQueue.push({ cred, region });
                            // If any combo is removed and added back again than not calling apis again
                            if (!newMultiDataStatus?.[`${cred?.data?.credentialsId}_${region?.data?.regionCode}`]) {
                                newMultiDataStatus[`${cred?.data?.credentialsId}_${region?.data?.regionCode}`] = false;
                            }
                        }
                    }
                }
                setQueue(newQueue);
                dispatch(setMultiDataStatus(newMultiDataStatus));
                if (queueLength === 0 || !headerSelectedCred || !headerSelectedRegion) {
                    setCurrentIndex(0);
                } else {
                    let isPresentVal = false;
                    newQueue?.forEach((item: any, index: number) => {
                        if (
                            item.cred?.data?.credentialsId === headerSelectedCred?.data?.credentialsId &&
                            item.region?.data?.regionCode === headerSelectedRegion?.data?.regionCode
                        ) {
                            isPresentVal = true;
                            setCurrentIndex(index);
                        }
                    });
                    if (!isPresentVal) {
                        setCurrentIndex(0);
                    }
                }
            }
        } else {
            setQueue([]);
            setCurrentIndex(0);
            setPendingQueriesCounter(0);
            dispatch(resetInventoryLoading());
            dispatch(
                setSingleComboCredAndRegion({
                    cred: null,
                    region: null
                })
            );
        }
    };

    // Compute total queries count and initialize queue
    useEffect(() => {
        initialMultiCall();
    }, [headerSelectedMultiCred, headerSelectedMultiRegion]);

    const isItemCompleted = (item: any): boolean => {
        const { cred, region } = item;
        return isApiCompletedForSet(cred?.data?.credentialsId, region?.data?.regionCode);
    };

    const updateCurrentItem = (item: any): void => {
        const { cred, region } = item;
        setCurrentCred(cred?.data?.name || '');
        setCurrentRegion(region?.value);
        dispatch(
            setSingleComboCredAndRegion({
                cred,
                region
            })
        );
    };

    const processNextIncompleteItem = (): boolean => {
        let nextIndex = currentIndex + 1;

        while (nextIndex < queue.length) {
            const nextItem = queue[nextIndex];
            if (nextItem && nextItem.cred && nextItem.region) {
                if (isItemCompleted(nextItem)) {
                    // Advance if the item is complete.
                    setCurrentIndex(prev => prev + 1);
                } else {
                    // Found an incomplete item: update the current item and exit.
                    setCurrentIndex(prev => prev + 1);
                    updateCurrentItem(nextItem);
                    return true;
                }
            }
            nextIndex++;
        }
        return false;
    };

    const queueProcess = () => {
        if (!queue.length || currentIndex >= queue.length) {
            // No more items to process: reset pending queries counter.
            setPendingQueriesCounter(0);
            return;
        }

        // Handle the current item.
        const currentItem = queue[currentIndex];
        const completed = isItemCompleted(currentItem);

        if (currentIndex === 0 && !completed) {
            // For the very first item that is not complete, update state and initiate API call.
            updateCurrentItem(currentItem);
            return;
        }

        if (completed) {
            // If the current item is complete, check and process the next incomplete item.
            const foundNext = processNextIncompleteItem();
            if (!foundNext) {
                // No incomplete item was found: reset the pending queries.
                setPendingQueriesCounter(0);
                dispatch(
                    setSingleComboCredAndRegion({
                        cred: null,
                        region: null
                    })
                );
            }
        }
    };

    useEffect(() => {
        if (pendingQueriesCounter > 0 && !multiDataLoading) {
            dispatch(setMultiDataLoading(true));
        } else if (pendingQueriesCounter === 0 && multiDataLoading) {
            dispatch(setMultiDataLoading(false));
        }
    }, [pendingQueriesCounter]);

    useEffect(() => {
        queueProcess();
    }, [currentIndex, queue, multiDataStatus]);

    const handleClick = (value: string) => {
        setSelectedTab(value);
        dispatch(setSelectedHeaderTab(value));
        dispatch(addExploreSavingsInitialData(null));
        if (isWorkloadFactory) {
            handleURLFromDashboard(value, isWorkloadFactory, navigate);
        } else {
            handleURL(value, isWorkloadFactory);
        }
    };

    useEffect(() => {
        dispatch(setRefreshTime(getCurrentDateTime()));
        dispatch(setRefreshTimeSandbox(getCurrentDateTime()));
    }, []);

    const refreshPage = () => {
        dispatch(updateRefreshBlocked(false));
        if (selectedHeaderTab === WLF_TABS.DASHBOARD || selectedHeaderTab === WLF_TABS.WELL_ARCHITECTED_TAB) {
            dispatch(setRefreshTime(getCurrentDateTime()));
            resetDBHomePageState(dispatch);
            dispatch(setDashboardRefresh(true));
            dispatch(inventoryApi.util.resetApiState());
            dispatch(inventoryApiV2.util.resetApiState());
            dispatch(setIsRefreshed(true));
        } else if (
            selectedHeaderTab === WLF_TABS.INVENTORY ||
            selectedHeaderTab === WLF_TABS.EXPLORE_SAVINGS ||
            selectedHeaderTab.includes(WLF_TABS.EXPLORE_SAVINGS)
        ) {
            dispatch(setRefreshTime(getCurrentDateTime()));
            resetDBHomePageState(dispatch);
            dispatch(inventoryApi.util.resetApiState());
            dispatch(inventoryApiV2.util.resetApiState());
            dispatch(setIsRefreshed(true));
            dispatch(clearDataMap());
            fetchOnPremData(true);
        } else if (selectedHeaderTab === WLF_TABS.OVERVIEW) {
            dispatch(setRefreshTime(getCurrentDateTime()));
            dispatch(workloadFactoryResourceApiV2.util.resetApiState());
            dispatch(setIsResourceRefresh(true));
        } else if (selectedHeaderTab === WLF_TABS.JOB_MONITORING) {
            dispatch(setRefreshTimeJobMonitor(getCurrentDateTime()));
            dispatch(setJobsList([]));
            dispatch(setSubJobsData([]));
        } else if (
            selectedHeaderTab === WLF_TABS.SAVINGS_CALCULATOR ||
            selectedHeaderTab === WLF_TABS.VIEW_THE_CALCULATIONS
        ) {
            dispatch(setRefreshTime(getCurrentDateTime()));
            dispatch(setSavingsCalculatorRefresh(true));
        } else if (selectedHeaderTab === WLF_TABS.SANDBOXES) {
            dispatch(setRefreshTimeSandbox(getCurrentDateTime()));
            dispatch(setIsRefreshedSandbox(true));
        }
    };

    const refreshComponent = () => (
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

    const refreshComponentSandbox = () => (
        <div className={styles.refresh}>
            <Popover
                popoverClass={styles['copy-popover']}
                children={`Last update: ${refreshTimeSandbox}`}
                trigger="hover"
                container={
                    <div className={styles.refreshIcon} onClick={refreshPage}>
                        <RefreshIcon />
                    </div>
                }
            />
        </div>
    );

    const labelForMultiSelectCred = () => {
        if (headerSelectedMultiCred && headerSelectedMultiCred.length === 1) {
            const credValue = headerSelectedMultiCred[0]?.value;
            return credValue;
        }
        if (headerSelectedMultiCred && headerSelectedMultiCred?.length === credentialData?.length) {
            return GENERAL.ALL_CRED_SELECTED;
        }
        if (headerSelectedMultiCred && headerSelectedMultiCred.length >= 1) {
            return `${headerSelectedMultiCred.length} credentials selected`;
        }
        return GENERAL.NO_CRED_SELECTED;
    };

    const labelForMultiSelectRegion = () => {
        if (headerSelectedMultiRegion && headerSelectedMultiRegion.length === 1) {
            const regionValue = headerSelectedMultiRegion[0]?.value;
            return regionValue;
        }
        if (headerSelectedMultiRegion && headerSelectedMultiRegion?.length === regionsData?.regions?.length) {
            return GENERAL.ALL_REGIONS_SELECTED;
        }
        if (headerSelectedMultiRegion && headerSelectedMultiRegion.length >= 1) {
            return `${headerSelectedMultiRegion.length} regions selected`;
        }
        return GENERAL.NO_REGIONS_SELECTED;
    };

    const disableCredDropdown = () => {
        if (
            !credentialData ||
            credentialData.length === 0 ||
            ((selectedHeaderTab === WLF_TABS.EXPLORE_SAVINGS || selectedHeaderTab === WLF_TABS.EXPLORE_SAVINGS_EBS) &&
                selectedExploreSavingsTab === WLF_TABS.MSSQL_ON_PREMISES) ||
            (selectedHeaderTab === WLF_TABS.EXPLORE_SAVINGS_ONPREM &&
                selectedExploreSavingsTab === WLF_TABS.MSSQL_ON_PREMISES)
        ) {
            return true;
        }
        return false;
    };

    const disableRegionDropDown = () => {
        if (
            !credentialData ||
            credentialData.length === 0 ||
            ((selectedHeaderTab === WLF_TABS.EXPLORE_SAVINGS || selectedHeaderTab === WLF_TABS.EXPLORE_SAVINGS_EBS) &&
                selectedExploreSavingsTab === WLF_TABS.MSSQL_ON_PREMISES) ||
            (selectedHeaderTab === WLF_TABS.EXPLORE_SAVINGS_ONPREM &&
                selectedExploreSavingsTab === WLF_TABS.MSSQL_ON_PREMISES)
        ) {
            return true;
        }
        return false;
    };

    const selectMultipleComponents = () => (
        <div className={styles.content}>
            <div className={styles.firstSelect}>
                <DsSelect
                    isLoading={credentialLoading}
                    title=""
                    formatLabel={() => labelForMultiSelectCred()}
                    selectedOptionIds={
                        headerSelectedMultiCred && headerSelectedMultiCred.length > 0
                            ? headerSelectedMultiCred.map((cred: any) => cred?.data?.credentialsId)
                            : []
                    }
                    className={styles.multiSelect}
                    // @ts-ignore
                    options={generateAccountsForMultiSelect}
                    selectionType="multi"
                    isWithActions
                    variant="underline"
                    onSelect={(option: any) => {
                        dispatch(setHeaderSelectedMultiCred(option));
                    }}
                    placeholder="No credentials selected"
                    isCleanable={false}
                    isSelectAll
                    dropDown={{
                        isCloseOnClickOutside: true
                    }}
                    searchMethod={{
                        method: 'smart'
                    }}
                    isReadOnly={
                        selectedHeaderTab === WLF_TABS.OVERVIEW ||
                        selectedHeaderTab === WLF_TABS.SAVINGS_CALCULATOR ||
                        selectedHeaderTab === WLF_TABS.VIEW_THE_CALCULATIONS
                    }
                    isDisabled={disableCredDropdown()}
                    disabledReason={!credentialData || credentialData.length === 0 ? 'No credentials' : ''}
                />
            </div>

            <div className={styles.secondSelect}>
                <DsSelect
                    isLoading={credentialLoading || regionsLoading}
                    title=""
                    className={styles.multiSelect}
                    formatLabel={() => labelForMultiSelectRegion()}
                    // @ts-ignore
                    options={generateRegionsForMultiSelect}
                    selectedOptionIds={
                        headerSelectedMultiRegion && headerSelectedMultiRegion.length > 0
                            ? headerSelectedMultiRegion.map((region: any) => region?.data?.regionCode)
                            : []
                    }
                    searchMethod={{
                        method: 'smart'
                    }}
                    selectionType="multi"
                    isWithActions
                    placeholder="No regions selected"
                    variant="underline"
                    onSelect={(option: any) => {
                        dispatch(setHeaderSelectedMultiRegion(option));
                    }}
                    isCleanable={false}
                    isSelectAll
                    dropDown={{
                        isCloseOnClickOutside: true
                    }}
                    isReadOnly={
                        selectedHeaderTab === WLF_TABS.OVERVIEW ||
                        selectedHeaderTab === WLF_TABS.SAVINGS_CALCULATOR ||
                        selectedHeaderTab === WLF_TABS.VIEW_THE_CALCULATIONS
                    }
                    isDisabled={disableRegionDropDown()}
                    disabledReason={!credentialData || credentialData.length === 0 ? 'No regions' : ''}
                />
            </div>
        </div>
    );

    const selectSandboxComponents = () => (
        <div className={styles.content}>
            <div className={styles.firstSelect} title={headerSelectedCredSandbox?.label}>
                <SelectField
                    isLoading={credentialLoading}
                    isClearable={false}
                    value={headerSelectedCredSandbox ? [headerSelectedCredSandbox] : [generateSandboxAWSAccounts[0]]}
                    onChange={(selectedOptions: any): void => {
                        if (localStorage.getItem('selectedSandboxCred')) {
                            localStorage.removeItem('selectedSandboxCred');
                        }
                        localStorage.setItem('selectedSandboxCred', JSON.stringify(selectedOptions));
                        dispatch(updateRefreshBlocked(false));
                        dispatch(setHeaderSelectedCredSandbox(selectedOptions));
                    }}
                    placeholder="Select a Credential"
                    isSearchable={generateSandboxAWSAccounts.length > 5}
                    options={generateSandboxAWSAccounts}
                    className={
                        (selectedHeaderTab === WLF_TABS.EXPLORE_SAVINGS &&
                            selectedExploreSavingsTab === WLF_TABS.MSSQL_ON_PREMISES) ||
                        (selectedHeaderTab === WLF_TABS.EXPLORE_SAVINGS_ONPREM &&
                            selectedExploreSavingsTab === WLF_TABS.MSSQL_ON_PREMISES)
                            ? styles.regionSelect
                            : ''
                    }
                    isReadOnly={
                        selectedHeaderTab === WLF_TABS.OVERVIEW ||
                        selectedHeaderTab === WLF_TABS.SAVINGS_CALCULATOR ||
                        selectedHeaderTab === WLF_TABS.VIEW_THE_CALCULATIONS
                    }
                    isDisabled={
                        !credentialData ||
                        credentialData.length === 0 ||
                        (selectedHeaderTab === WLF_TABS.EXPLORE_SAVINGS &&
                            selectedExploreSavingsTab === WLF_TABS.MSSQL_ON_PREMISES) ||
                        (selectedHeaderTab === WLF_TABS.EXPLORE_SAVINGS_ONPREM &&
                            selectedExploreSavingsTab === WLF_TABS.MSSQL_ON_PREMISES)
                    }
                />
            </div>

            <div className={styles.secondSelect}>
                <SelectField
                    isLoading={credentialLoading || regionsLoading}
                    isClearable={false}
                    value={
                        headerSelectedRegionSandbox ? [headerSelectedRegionSandbox] : [generateSandboxRegionsData[0]]
                    }
                    onChange={(selectedOptions: any): void => {
                        function updateRegion() {
                            if (localStorage.getItem('selectedSandboxRegion')) {
                                localStorage.removeItem('selectedSandboxRegion');
                            }
                            localStorage.setItem('selectedSandboxRegion', JSON.stringify(selectedOptions));
                            dispatch(updateRefreshBlocked(false));
                            dispatch(setHeaderSelectedRegionSandbox(selectedOptions));
                        }
                        if (isDemoMode) {
                            createDemoResourcesApi({
                                credentialsId: headerSelectedCredSandbox?.data?.credentialsId,
                                regionId: selectedOptions?.data?.regionCode
                            }).then(() => {
                                updateRegion();
                            });
                        } else {
                            updateRegion();
                        }
                    }}
                    placeholder="Select a Region"
                    isSearchable={generateSandboxRegionsData.length > 5}
                    options={generateSandboxRegionsData}
                    className={
                        (selectedHeaderTab === WLF_TABS.EXPLORE_SAVINGS &&
                            selectedExploreSavingsTab === WLF_TABS.MSSQL_ON_PREMISES) ||
                        (selectedHeaderTab === WLF_TABS.EXPLORE_SAVINGS_ONPREM &&
                            selectedExploreSavingsTab === WLF_TABS.MSSQL_ON_PREMISES)
                            ? styles.regionSelect
                            : ''
                    }
                    isReadOnly={
                        selectedHeaderTab === WLF_TABS.OVERVIEW ||
                        selectedHeaderTab === WLF_TABS.SAVINGS_CALCULATOR ||
                        selectedHeaderTab === WLF_TABS.VIEW_THE_CALCULATIONS
                    }
                    isDisabled={
                        !credentialData ||
                        credentialData.length === 0 ||
                        (selectedHeaderTab === WLF_TABS.EXPLORE_SAVINGS &&
                            selectedExploreSavingsTab === WLF_TABS.MSSQL_ON_PREMISES) ||
                        (selectedHeaderTab === WLF_TABS.EXPLORE_SAVINGS_ONPREM &&
                            selectedExploreSavingsTab === WLF_TABS.MSSQL_ON_PREMISES)
                    }
                />
            </div>
        </div>
    );

    const checkConditionForHeaderComponent = () => {
        if (
            statusChk ||
            (!statusChk &&
                (tabInfo === WLF_TABS.EXPLORE_SAVINGS_EBS ||
                    tabInfo === WLF_TABS.EXPLORE_SAVINGS_FsxW ||
                    tabInfo === WLF_TABS.EXPLORE_SAVINGS_ONPREM ||
                    landingFromWizard))
        ) {
            return true;
        }
        return false;
    };

    // Job monitoring select drop down
    // Function to generate the options for Select Field for License
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
    ) : checkConditionForHeaderComponent() ? (
        tab === WLF_TABS.REGISTER_COMPONENT ? (
            <RegisterWizard />
        ) : (
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
                    <>
                        {import.meta.env.VITE_APP_ENVIRONMENT === LOCAL && (
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
                                                    selectedHeaderTab === WLF_TABS.DASHBOARD_DISMISS_PAGE
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
                                                    selectedHeaderTab === WLF_TABS.OPTIMIZE ||
                                                    selectedHeaderTab === WLF_TABS.ORACLE_WELL_ARCHITECTED ||
                                                    selectedHeaderTab ===
                                                        WLF_TABS.ORACLE_WELL_ARCHITECTED_FROM_WELL_ARCHITECTED_TAB ||
                                                    selectedHeaderTab === WLF_TABS.OPTIMIZE_FROM_WELL_ARCHITECTED_TAB
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
                                                    selectedHeaderTab === WLF_TABS.WELL_ARCHITECTED_TAB ||
                                                    selectedHeaderTab === WLF_TABS.DASHBOARD_INNER_PAGE
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
                                                    handleClick(WLF_TABS.WELL_ARCHITECTED_TAB);
                                                }}
                                                id="well-architected"
                                            >
                                                Well-architected
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
                                        <DsBlueXpMenu
                                            className="hamburgerMenu"
                                            domain={import.meta.env.VITE_APP_WF_DOMAIN!}
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}

                {import.meta.env.VITE_APP_ENVIRONMENT !== STAGING && <div className={styles.extraSpace} />}
                <div className={styles.selectedTabSection}>
                    {selectedHeaderTab === WLF_TABS.DASHBOARD && (
                        <div className={styles.dashboardSection}>
                            <div className={styles.spaceAreaTemp}>
                                <div className={styles.contentAreaTemp}>
                                    {selectMultipleComponents()}
                                    <div className={styles.content}>{refreshComponent()}</div>
                                </div>
                            </div>

                            {/* Add based on noCred flag */}
                            {showNA && (
                                <div className={styles.noCredBanner}>
                                    <NoCredBanner width="100%" />
                                </div>
                            )}

                            <DashboardOverview />
                            {/* <Dashboard /> */}
                        </div>
                    )}
                    {selectedHeaderTab === WLF_TABS.INVENTORY && (
                        <>
                            <div className={styles.inventoryHeaderSection}>
                                <div className={styles.contentArea}>
                                    {selectMultipleComponents()}
                                    <div className={styles.content}>{refreshComponent()}</div>
                                </div>
                            </div>

                            {/* Add based on noCred flag */}
                            {showNA && (
                                <div className={styles.noCredBanner}>
                                    <NoCredBanner width="100%" />
                                </div>
                            )}

                            <InventoryV2 />
                        </>
                    )}

                    {selectedHeaderTab === WLF_TABS.WELL_ARCHITECTED_TAB && (
                        <>
                            <div className={styles.inventoryHeaderSection}>
                                <div className={styles.contentArea}>
                                    {selectMultipleComponents()}
                                    <div className={styles.content}>{refreshComponent()}</div>
                                </div>
                            </div>

                            {/* Add based on noCred flag */}
                            {showNA && (
                                <div className={styles.noCredBanner}>
                                    <NoCredBanner width="100%" />
                                </div>
                            )}

                            <WellArchitectedTab />
                        </>
                    )}
                    {selectedHeaderTab === WLF_TABS.JOB_MONITORING && (
                        <>
                            <div className={styles.inventoryHeaderSection}>
                                <div className={styles.contentArea}>
                                    {showNA && <DummySelect fromJM />}
                                    {!showNA && <div />}
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

                            {/* Add based on noCred flag */}
                            {/* <div className={styles.noCredBanner}>
                                <NoCredBanner width={'87.3%'} />
                            </div> */}

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

                    {(selectedHeaderTab === WLF_TABS.OPTIMIZE ||
                        selectedHeaderTab === WLF_TABS.OPTIMIZE_FROM_WELL_ARCHITECTED_TAB) && (
                        <WellArchitectDashboard />
                    )}

                    {/* Route for oracle resource screen */}
                    {(selectedHeaderTab === WLF_TABS.ORACLE_WELL_ARCHITECTED ||
                        selectedHeaderTab === WLF_TABS.ORACLE_WELL_ARCHITECTED_FROM_WELL_ARCHITECTED_TAB) && (
                        <OracleResourcePages />
                    )}

                    {selectedHeaderTab === WLF_TABS.DASHBOARD_INNER_PAGE && <DashboardInnerPage />}

                    {selectedHeaderTab === WLF_TABS.DASHBOARD_DISMISS_PAGE && <DashboardDismissPage />}

                    {selectedHeaderTab === WLF_TABS.OPTIMIZE_INNER_PAGE && <OptimizeInnerPage />}
                    {selectedHeaderTab === WLF_TABS.DASHBOARD_OPTIMIZE_INNER_PAGE && <DashboardOptimizeInnerPage />}
                    {selectedHeaderTab === WLF_TABS.OPTIMIZE_ONTAP_INNER_PAGE && <OptimizeOntapInnerPage />}

                    {selectedHeaderTab === WLF_TABS.SANDBOXES && (
                        <>
                            <div className={styles.sandboxSection}>
                                <div className={styles.contentArea}>
                                    {!showNA && selectSandboxComponents()}
                                    {showNA && <DummySelect fromJM={false} />}
                                    <div className={styles.content}>{refreshComponentSandbox()}</div>
                                </div>
                            </div>

                            {/* Add based on noCred flag */}
                            {showNA && (
                                <div className={styles.noCredBanner}>
                                    <NoCredBanner width="100%" />
                                </div>
                            )}

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
                                    {selectMultipleComponents()}
                                    <div className={styles.content}>{refreshComponent()}</div>
                                </div>
                            </div>

                            {/* Add based on noCred flag */}
                            {showNA && (
                                <div className={styles.noCredBanner}>
                                    <NoCredBanner width="100%" />
                                </div>
                            )}
                            <ExploreSavings />
                        </>
                    )}
                    {selectedHeaderTab === WLF_TABS.SAVINGS_CALCULATOR && <SavingsCalculator statusCheck={statusChk} />}

                    {selectedHeaderTab === WLF_TABS.VIEW_THE_CALCULATIONS && (
                        <ViewCalculations statusCheck={statusChk} />
                    )}
                </div>
                {/* Will enable this once multi cred and region is ready
                 */}

                {pendingQueriesCounter > 0 &&
                    (selectedHeaderTab === WLF_TABS.INVENTORY ||
                        selectedHeaderTab === WLF_TABS.DASHBOARD ||
                        selectedHeaderTab === WLF_TABS.WELL_ARCHITECTED_TAB ||
                        selectedHeaderTab === WLF_TABS.EXPLORE_SAVINGS ||
                        selectedHeaderTab === WLF_TABS.EXPLORE_SAVINGS_EBS ||
                        selectedHeaderTab === WLF_TABS.EXPLORE_SAVINGS_FsxW) && (
                        <FetchingDataNotification
                            pendingQueriesCounter={pendingQueriesCounter}
                            completedTask={currentIndex}
                            regions={currentRegion}
                            credentials={currentCred}
                        />
                    )}
            </div>
        )
    ) : (
        <Marketing />
    );
};

export default HeaderComponent;
