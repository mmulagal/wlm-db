import React, { useEffect, useMemo, useState } from 'react';
import styles from './HeaderComponent.module.scss';
import DatabaseHomePage from '../DatabaseHomePage';
import { SelectField, Spinner, Typography } from '@netapp/design-system';
import { optionType } from '@netapp/design-system/dist/components/Select';
import { GENERAL } from '../../../utils/appConstants';
import JobMonitoring from '../../JobMonitoring/JobMonitoring';
import { generateOptionType, getCurrentDateTime, regionsSort, resetDBHomePageState } from '../../../utils/utilityFunctions';
import { useAppSelector } from '../../../store/storeHooks';
import { ReactComponent as RefreshIcon } from '@netapp/icons/ic_refresh.svg';
import Inventory from '../../Inventory/Inventory';
import { useDispatch } from 'react-redux';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventorySlice';
import DatabaseHostOverview from '../../ResourcePage/ResourceHomePage/DatabaseHostOverview';
import HeaderComponentApi from './HeaderComponentApis';
import {
    setHeaderSelectedCred,
    setHeaderSelectedRegion,
    setRefreshTime
} from '../../../store/workloadFactory/headersSlice';
import { workloadFactoryResourceApi } from '../../../utils/apiService';
import { setJobsList } from '../../../store/workloadFactory/jobMonitoringSlice';
import { setSelectedCredentials, setSelectedRegionData } from '../../../store/mssql/mssqlFormSlice';
import { WLF_TABS } from '../../../utils/consts';

const HeaderComponent = () => {
    const dispatch = useDispatch();
    const [statusChk, setStatusChk] = useState(false);

    const { statusData, statusLoading } = useAppSelector(state => state.headers.getStatus);

    const [selectedTab, setSelectedTab] = useState(WLF_TABS.DASHBOARD);

    const { credentialData, credentialLoading } = useAppSelector(state => state.headers.getCredentials);
    const { regionsData, regionsLoading } = useAppSelector(state => state.headers.getRegions);
    const headerSelectedCred = useAppSelector(state => state.headers.headerSelectedCred);
    const headerSelectedRegion = useAppSelector(state => state.headers.headerSelectedRegion);
    const refreshTime = useAppSelector(state => state.headers.refreshTime);
    const selectedHeaderTab = useAppSelector(state => state.inventory.selectedHeaderTab);

    HeaderComponentApi();

    useEffect(() => {
        if (statusData && statusData?.isActive) {
            setStatusChk(true);
        } else if (statusData && !statusData?.isActive) {
            window.parent.postMessage(
                { type: 'SERVICE:NAVIGATE', payload: { pathname: './marketing', replace: true } },
                '*'
            );
        } else {
            setStatusChk(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [statusData]);

    //Function to generate the options for Select Field
    const generateAWSAccounts = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        credentialData?.map((val: any, idx: number) => {
            const credValue = val.name;
            const label2 = `Account ID: ${val.providerAccountId}`;
            const option = generateOptionType(credValue, credValue, label2, false, '', val);
            options.push(option);
        });
        if (options.length > 0 && !headerSelectedCred) {
            dispatch(setHeaderSelectedCred(options[0]));
        }
        return options;
    }, [credentialData]);

    const generateRegionsData = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        const sortedRegionsData = regionsSort(regionsData?.regions || []);
        sortedRegionsData?.map((val: any, idx: number) => {
            const regionValue = val.regionName;
            const label2 = val.regionCode;
            const option = generateOptionType(regionValue, regionValue, label2, false, '', val);
            options.push(option);
        });
        if (options.length > 0 && !headerSelectedRegion) {
            dispatch(setHeaderSelectedRegion(options[0]));
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
        dispatch(setRefreshTime(getCurrentDateTime()));
        if (selectedHeaderTab === WLF_TABS.DASHBOARD) {
            resetDBHomePageState(dispatch);
        } else if (selectedHeaderTab === WLF_TABS.INVENTORY) {
            resetDBHomePageState(dispatch); // will add for inventory once API will be available
        } else if (selectedHeaderTab === WLF_TABS.OVERVIEW) {
            resetDBHomePageState(dispatch);
            dispatch(workloadFactoryResourceApi.util.resetApiState());
        } else if (selectedHeaderTab === WLF_TABS.JOB_MONITORING) {
            dispatch(setJobsList([]));
        }
    };

    return statusLoading || !statusChk ? (
        <div className={styles.loader}>
            <Spinner isLarge />
        </div>
    ) : (
        statusChk && (
            <div className={styles.headerComponent}>
                <div className={styles.firstSection}>
                    <div className={styles.firstRow}>
                        <Typography variant="Regular_24" className={styles.heading}>
                            {GENERAL.DATABASES}
                        </Typography>

                        <div className={styles.rightPart}>
                            <div className={styles.firstSelect}>
                                <SelectField
                                    isLoading={credentialLoading}
                                    isClearable={false}
                                    value={headerSelectedCred ? [headerSelectedCred] : [generateAWSAccounts[0]]}
                                    onChange={(selectedOptions: any): void => {
                                        dispatch(setHeaderSelectedCred(selectedOptions));
                                    }}
                                    placeholder="Select a Credential"
                                    isSearchable={generateAWSAccounts.length > 5}
                                    options={generateAWSAccounts}
                                    variant="two-lines"
                                    isReadOnly={selectedHeaderTab === WLF_TABS.OVERVIEW}
                                />
                            </div>

                            <div className={styles.secondSelect}>
                                <SelectField
                                    isLoading={regionsLoading}
                                    isClearable={false}
                                    value={headerSelectedRegion ? [headerSelectedRegion] : [generateRegionsData[0]]}
                                    onChange={(selectedOptions: any): void => {
                                        dispatch(setHeaderSelectedRegion(selectedOptions));
                                    }}
                                    placeholder="Select a Region"
                                    isSearchable={generateRegionsData.length > 5}
                                    options={generateRegionsData}
                                    variant="two-lines"
                                    isReadOnly={selectedHeaderTab === WLF_TABS.OVERVIEW}
                                />
                            </div>

                            <div className={styles.separator} />

                            <div className={styles.refresh}>
                                <div className={styles.refreshIcon} onClick={refreshPage}>
                                    <RefreshIcon />
                                </div>
                                <Typography className={styles.date} variant="Regular_14">
                                    {refreshTime}
                                </Typography>
                            </div>
                        </div>
                    </div>

                    <div className={styles.secondRow}>
                        <div
                            className={styles.overviewTabs}
                        >
                            <Typography
                                variant="Regular_14"
                                className={
                                    selectedHeaderTab === WLF_TABS.DASHBOARD
                                        ? `${styles.headerPart1} ${styles.active}`
                                        : `${styles.headerPart1}`
                                }
                                onClick={() => {
                                    handleClick(WLF_TABS.DASHBOARD);
                                    refreshPage();
                                }}
                            >
                                {GENERAL.TAB_DASHBOARD}
                            </Typography>
                            <Typography
                                variant="Regular_14"
                                className={
                                    selectedHeaderTab === WLF_TABS.INVENTORY || selectedHeaderTab === WLF_TABS.OVERVIEW
                                        ? `${styles.headerPart2} ${styles.active}`
                                        : `${styles.headerPart2}`
                                }
                                onClick={() => {
                                    handleClick(WLF_TABS.INVENTORY);
                                    refreshPage();
                                }}
                            >
                                {GENERAL.TAB_INVENTORY}
                            </Typography>

                            <Typography
                                variant="Regular_14"
                                className={
                                    selectedHeaderTab === WLF_TABS.JOB_MONITORING
                                        ? `${styles.headerPart3} ${styles.active}`
                                        : `${styles.headerPart3}`
                                }
                                onClick={() => {
                                    handleClick(WLF_TABS.JOB_MONITORING);
                                    refreshPage();
                                }}
                            >
                                {GENERAL.TAB_JOB_MONITORING}
                            </Typography>
                        </div>
                    </div>
                </div>
                <div className={styles.extraSpace} />
                {selectedHeaderTab === WLF_TABS.DASHBOARD && <DatabaseHomePage />}
                {selectedHeaderTab === WLF_TABS.INVENTORY && <Inventory />}
                {selectedHeaderTab === WLF_TABS.JOB_MONITORING && <JobMonitoring />}
                {selectedHeaderTab === WLF_TABS.OVERVIEW && <DatabaseHostOverview />}
            </div>
        )
    );
};

export default HeaderComponent;
