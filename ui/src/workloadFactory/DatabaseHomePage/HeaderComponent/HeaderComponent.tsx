import React, { useEffect, useMemo, useRef, useState } from 'react';
import styles from './HeaderComponent.module.scss';
import DatabaseHomePage from '../DatabaseHomePage';
import { BlueXPListeners, Button, Popover, SelectField, Typography, postBlueXPMessage } from '@netapp/design-system';
import { optionType } from '@netapp/design-system/dist/components/Select';
import { GENERAL } from '../../../utils/appConstants';
import JobMonitoring from '../../JobMonitoring/JobMonitoring';
import {
    checkValueSavedForCred,
    checkValueSavedForRegion,
    generateOptionType,
    getCurrentDateTime,
    regionsSort,
    resetDBHomePageState
} from '../../../utils/utilityFunctions';
import { useAppSelector } from '../../../store/storeHooks';
import { ReactComponent as RefreshIcon } from '@netapp/icons/ic_refresh.svg';
import { ReactComponent as BlueXPDatabase } from '../../../assets/blueXPDatabase.svg';
import { ReactComponent as Menu } from '../../../assets/ic_menu.svg';
import Inventory from '../../Inventory/Inventory';
import { useDispatch } from 'react-redux';
import { setIsRefreshed, setSelectedHeaderTab } from '../../../store/workloadFactory/inventorySlice';
import DatabaseHostOverview from '../../ResourcePage/ResourceHomePage/DatabaseHostOverview';
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
    workloadFactoryResourceApi,
    workloadFactoryResourceApiV2
} from '../../../utils/apiService';
import { setJobsList, setSubJobsData } from '../../../store/workloadFactory/jobMonitoringSlice';
import { setSelectedCredentials, setSelectedRegionData } from '../../../store/mssql/mssqlFormSlice';
import { SAVINGS_CALC_MODE, WLF_TABS, WLF_TO_FORM_NAVIGATE, WLF_TO_PROTECT_NAVIGATE } from '../../../utils/consts';
import ComponentLoader from '../../../common/ComponentLoader/ComponentLoader';
import Sandbox from '../../Sandbox/Sandbox';
import InventoryApis from '../../Inventory/InventoryApis';
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
import RedirectComponent from '../../ExploreSavings/SavingsCalculator/RedirectComponent';
import SavingsCalculatorManualApi from '../../ExploreSavings/SavingsCalculator/SavingsCalculatorManualAPI';
import { setDatabaseHostEntryPoint } from '../../../store/mssql/msSqlActionSlice';
import { useNavigate } from 'react-router-dom';
import MenuPopover from '../../../common/MenuPopover/MenuPopover';
import { parentNavigate } from '../../../utils/bxpUtils';

type Tab = {
    tab: string;
};

const HeaderComponent = ({ tab }: Tab) => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const [statusChk, setStatusChk] = useState(false);
    const [menuOpenedRow, setOpenedRow] = useState<null | boolean>(null);

    const { isWorkloadFactory } = useAppSelector(state => state?.auth);
    const menuOpenedRowDetail: any = useRef(null);

    const { statusData, statusLoading } = useAppSelector(state => state.headers.getStatus);

    const [selectedTab, setSelectedTab] = useState(WLF_TABS.DASHBOARD);
    const [tabInfo, setTabInfo] = useState('');

    const { credentialData, credentialLoading } = useAppSelector(state => state.headers.getCredentials);
    const { regionsData, regionsLoading } = useAppSelector(state => state.headers.getRegions);
    const headerSelectedCred = useAppSelector(state => state.headers.headerSelectedCred);
    const headerSelectedRegion = useAppSelector(state => state.headers.headerSelectedRegion);
    const refreshTime = useAppSelector(state => state.headers.refreshTime);
    const selectedHeaderTab = useAppSelector(state => state.inventory.selectedHeaderTab);
    const isDemoMode = useAppSelector(state => state.auth.isDemoMode);
    const isInventoryV2 = useAppSelector(state => state.auth.isInventoryV2);

    HeaderComponentApi();
    if (isInventoryV2) {
        InventoryApisV2();
    } else {
        InventoryApis();
    }
    DatabaseHomeApis();
    JobMonitoringApi();
    SavingsCalculatorApi();
    SavingsCalculatorManualApi();
    SandboxApis();

    useEffect(() => {
        let tabValue = '';
        if (tab === WLF_TABS.INVENTORY) {
            tabValue = WLF_TABS.INVENTORY;
        } else if (tab === WLF_TABS.EXPLORE_SAVINGS_EBS) {
            tabValue = WLF_TABS.EXPLORE_SAVINGS_EBS;
        } else if (tab === WLF_TABS.EXPLORE_SAVINGS_FsxW) {
            tabValue = WLF_TABS.EXPLORE_SAVINGS_FsxW;
        } else {
            tabValue = selectedHeaderTab;
        }
        setTabInfo(tabValue);
        dispatch(setSelectedHeaderTab(tabValue));
    }, [tab]);

    useEffect(() => {
        if (isDemoMode || (statusData && statusData?.isActive)) {
            setStatusChk(true);
        } else if (statusData && !statusData?.isActive) {
            if (tabInfo === WLF_TABS.EXPLORE_SAVINGS_EBS || tabInfo === WLF_TABS.EXPLORE_SAVINGS_FsxW) {
                if (tabInfo === WLF_TABS.EXPLORE_SAVINGS_EBS) {
                    dispatch(setSavingsCalculatorFrom(SAVINGS_CALC_MODE.MANUAL_EBS));
                    dispatch(setSelectedHeaderTab(WLF_TABS.SAVINGS_CALCULATOR));
                } else {
                    dispatch(setSavingsCalculatorFrom(SAVINGS_CALC_MODE.MANUAL_FSXW));
                    dispatch(setSelectedHeaderTab(WLF_TABS.SAVINGS_CALCULATOR));
                }
            } else {
                if (!isWorkloadFactory) {
                    postBlueXPMessage({
                        type: BlueXPListeners.navigate,
                        payload: { pathname: './fsxdb/marketing', replace: true }
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
            if (localStorage.getItem('selectedRegion')) {
                //@ts-ignore
                const regionValue = JSON.parse(localStorage.getItem('selectedRegion'));

                if (checkValueSavedForRegion(options, regionValue)) {
                    dispatch(setHeaderSelectedRegion(regionValue));
                } else {
                    dispatch(setHeaderSelectedRegion(options[0]));
                }
            } else {
                dispatch(setHeaderSelectedRegion(options[0]));
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
            if (isInventoryV2) {
                dispatch(workloadFactoryResourceApiV2.util.resetApiState());
                dispatch(setIsResourceRefresh(true));
            } else {
                dispatch(workloadFactoryResourceApi.util.resetApiState());
            }
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
                            selectedHeaderTab === WLF_TABS.VIEW_THE_CALCULATIONS
                        }
                    />
                </div>

                <div className={styles.secondSelect}>
                    <SelectField
                        isLoading={regionsLoading}
                        isClearable={false}
                        value={headerSelectedRegion ? [headerSelectedRegion] : [generateRegionsData[0]]}
                        onChange={(selectedOptions: any): void => {
                            if (localStorage.getItem('selectedRegion')) {
                                localStorage.removeItem('selectedRegion');
                            }
                            localStorage.setItem('selectedRegion', JSON.stringify(selectedOptions));
                            dispatch(updateRefreshBlocked(false));
                            dispatch(setHeaderSelectedRegion(selectedOptions));
                        }}
                        placeholder="Select a Region"
                        isSearchable={generateRegionsData.length > 5}
                        options={generateRegionsData}
                        isReadOnly={
                            selectedHeaderTab === WLF_TABS.OVERVIEW ||
                            selectedHeaderTab === WLF_TABS.SAVINGS_CALCULATOR ||
                            selectedHeaderTab === WLF_TABS.VIEW_THE_CALCULATIONS
                        }
                    />
                </div>
            </div>
        );
    };

    const TopBarComponent = () => {
        const toShowPostgress = localStorage.getItem('postgress');
        return (
            <div className={styles.spaceArea}>
                <div className={styles.contentArea}>
                    {selectComponents()}
                    <div className={styles.content}>
                        <Button
                            variant="primary"
                            onClick={() => {
                                dispatch(setDatabaseHostEntryPoint('database'));
                                navigate(WLF_TO_FORM_NAVIGATE);
                            }}
                            id={'deploy-button'}
                        >
                            <div className={styles.buttonStyle}>{GENERAL.DEPLOY_NEW_DATABASE}</div>
                        </Button>

                        {toShowPostgress && (
                            <Button
                                variant="primary"
                                onClick={() => {
                                    navigate(WLF_TO_PROTECT_NAVIGATE);
                                }}
                                id={'deploy-button'}
                            >
                                <div className={styles.buttonStyle}>{'Deploy Postgress'}</div>
                            </Button>
                        )}

                        {refreshComponent()}
                    </div>
                </div>
            </div>
        );
    };
    const checkConditionForHeaderComponent = () => {
        if (
            statusChk ||
            (!statusChk && (tabInfo === WLF_TABS.EXPLORE_SAVINGS_EBS || tabInfo === WLF_TABS.EXPLORE_SAVINGS_FsxW))
        ) {
            return true;
        } else {
            return false;
        }
    };

    const menuItems = () => {
        return [
            {
                id: 'links',
                displayName: 'Links'
            },
            {
                id: 'workLoadFactoryCredentials',
                displayName: 'Workload Factory credentials'
            },
            {
                id: 'apiHub',
                displayName: 'API Hub'
            },
            {
                id: 'monitoringGitHubRepository',
                displayName: 'Monitoring GitHub repository'
            },
            {
                id: 'subscribeToRss',
                displayName: 'Subscribe to RSS'
            },
            {
                id: 'feedback',
                displayName: 'Feedback'
            }
        ];
    };

    return statusLoading && !isDemoMode ? (
        <div className={styles.loader}>
            <ComponentLoader style={{ margin: '0 auto' }} />
        </div>
    ) : (
        checkConditionForHeaderComponent() && (
            <div className={styles.headerComponent}>
                <div className={styles.firstSection}>
                    <div className={styles.withWorkLoad}>
                        <div className={styles.firstRow}>
                            {!isWorkloadFactory && (
                                <>
                                    <BlueXPDatabase />
                                    <Typography
                                        variant="Regular_24"
                                        className={styles.heading}
                                        style={{ color: 'var(--text-button-primary)' }}
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
                                        selectedHeaderTab === WLF_TABS.DASHBOARD
                                            ? `${
                                                  isWorkloadFactory
                                                      ? styles.headerPart1
                                                      : `${styles.headerPart1} ${styles.blueXPHeaderClass}`
                                              } ${styles.active}`
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
                                        selectedHeaderTab === WLF_TABS.OVERVIEW
                                            ? `${
                                                  isWorkloadFactory
                                                      ? styles.headerPart2
                                                      : `${styles.headerPart2} ${styles.blueXPHeaderClass}`
                                              } ${styles.active}`
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
                                              } ${styles.active}`
                                            : `${
                                                  isWorkloadFactory
                                                      ? styles.headerPart4
                                                      : `${styles.headerPart4} ${styles.blueXPHeaderClass}`
                                              }`
                                    }
                                    onClick={() => {
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
                                        selectedHeaderTab === WLF_TABS.VIEW_THE_CALCULATIONS
                                            ? `${
                                                  isWorkloadFactory
                                                      ? styles.headerPart5
                                                      : `${styles.headerPart5} ${styles.blueXPHeaderClass}`
                                              } ${styles.active}`
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
                                              } ${styles.active}`
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
                            <Menu />
                            <div className={styles.menuPopOverHide}>
                                <MenuPopover
                                    isMenuOpen={menuOpenedRow === true}
                                    menuItems={menuItems()}
                                    toggleMenu={(toggleType: string, menuId: string) => {
                                        if (toggleType === 'close') {
                                            setOpenedRow(null);
                                        } else if (toggleType === 'open') {
                                            setOpenedRow(true);
                                        } else if (toggleType === 'selectedOption') {
                                            setOpenedRow(null);

                                            switch (menuId) {
                                                case 'links':
                                                    postBlueXPMessage({
                                                        type: BlueXPListeners.navigate,
                                                        payload: { pathname: './fsxhome/links', replace: true }
                                                    });

                                                    break;
                                                case 'workLoadFactoryCredentials':
                                                    postBlueXPMessage({
                                                        type: BlueXPListeners.navigate,
                                                        payload: { pathname: './fsxhome/credentials', replace: true }
                                                    });

                                                    break;
                                                case 'apiHub':
                                                    postBlueXPMessage({
                                                        type: BlueXPListeners.navigate,
                                                        payload: {
                                                            pathname: '%VITE_WORKLOAD_IFRAME_URL%/api-doc',
                                                            replace: true
                                                        }
                                                    });

                                                    break;
                                                case 'monitoringGitHubRepository':
                                                    postBlueXPMessage({
                                                        type: BlueXPListeners.navigate,
                                                        payload: {
                                                            pathname:
                                                                'https://github.com/NetApp/FSx-ONTAP-samples-scripts/tree/main/Monitoring',
                                                            replace: true
                                                        }
                                                    });

                                                    break;
                                                case 'subscribeToRss':
                                                    postBlueXPMessage({
                                                        type: BlueXPListeners.navigate,
                                                        payload: { pathname: './links', replace: true }
                                                    });

                                                    break;
                                                case 'feedback':
                                                    postBlueXPMessage({
                                                        type: BlueXPListeners.navigate,
                                                        payload: { pathname: './fsxhome/feedback', replace: true }
                                                    });

                                                    break;
                                            }
                                        }
                                    }}
                                    CustomMenu={undefined}
                                    disabledText={undefined}
                                />
                            </div>
                        </div>
                    )}
                </div>
                <div className={styles.extraSpace} />
                <div className={styles.selectedTabSection}>
                    {selectedHeaderTab === WLF_TABS.DASHBOARD && (
                        <div className={styles.dashboardSection}>
                            <DatabaseHomePage TopBarComponent={TopBarComponent} />
                        </div>
                    )}
                    {selectedHeaderTab === WLF_TABS.INVENTORY && !isInventoryV2 && <Inventory />}
                    {selectedHeaderTab === WLF_TABS.INVENTORY && isInventoryV2 && (
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
                            <JobMonitoring SelectComponent={selectComponents} RefreshComponent={refreshComponent} />
                        </>
                    )}
                    {selectedHeaderTab === WLF_TABS.OVERVIEW && isInventoryV2 && (
                        <DatabaseHostOverviewV2 refreshTime={refreshTime} refreshPage={refreshPage} />
                    )}
                    {selectedHeaderTab === WLF_TABS.OVERVIEW && !isInventoryV2 && <DatabaseHostOverview />}
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
                        selectedHeaderTab === WLF_TABS.EXPLORE_SAVINGS_FsxW) && (
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
                    {selectedHeaderTab === WLF_TABS.SAVINGS_CALCULATOR && <SavingsCalculator />}
                    {/* {selectedHeaderTab === WLF_TABS.REDIRECT_COMPONENT && <RedirectComponent />} */}
                    {selectedHeaderTab === WLF_TABS.VIEW_THE_CALCULATIONS && <ViewCalculations />}
                </div>
            </div>
        )
    );
};

export default HeaderComponent;
