import React, { useEffect, useMemo, useState } from 'react';
import styles from './HeaderComponent.module.scss';
import DatabaseHomePage from '../DatabaseHomePage';
import { SelectField, Typography } from '@netapp/design-system';
import { optionType } from '@netapp/design-system/dist/components/Select';
import { GENERAL } from '../../../utils/appConstants';
import JobMonitoring from '../../JobMonitoring/JobMonitoring';
import { generateOptionType, getCurrentDateTime } from '../../../utils/utilityFunctions';
import { useAppSelector } from '../../../store/storeHooks';
import { ReactComponent as RefreshIcon } from '@netapp/icons/ic_refresh.svg';
import Inventory from '../../Inventory/Inventory';
import { useDispatch } from 'react-redux';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventorySlice';
import DatabaseHostOverview from '../../ResourcePage/ResourceHomePage/DatabaseHostOverview';
import HeaderComponentApi from './HeaderComponentApis';
import { setHeaderSelectedCred, setHeaderSelectedRegion } from '../../../store/workloadFactory/headersSlice';

const HeaderComponent = () => {
    const dispatch = useDispatch();
    const [selectedTab, setSelectedTab] = useState('Dashboard');
    const [currentTime, setCurrentTime] = useState('');

    const { credentialData, credentialLoading } = useAppSelector(state => state.headers.getCredentials);
    const { regionsData, regionsLoading } = useAppSelector(state => state.headers.getRegions);
    const headerSelectedCred = useAppSelector(state => state.headers.headerSelectedCred);
    const headerSelectedRegion = useAppSelector(state => state.headers.headerSelectedRegion);

    const [selectedCred, setSelectedCred] = useState(headerSelectedCred);
    const [selectedRegion, setSelectedRegion] = useState(headerSelectedRegion);

    const menuSelected = useAppSelector(state => state.inventory.menuSelected);
    const selectedHeaderTab = useAppSelector(state => state.inventory.selectedHeaderTab);

    HeaderComponentApi();

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
            setSelectedCred(options[0]);
            dispatch(setHeaderSelectedCred(options[0]));
        };
        return options;
    }, [credentialData]);

    const generateRegionsData = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        regionsData?.regions?.map((val:any, idx: number) => {
            const regionValue = val.regionName;
            const label2 = val.regionCode;
            const option = generateOptionType(regionValue, regionValue, label2, false, '', val);
            options.push(option);
        });
        if (options.length > 0 && !headerSelectedRegion) {
            setSelectedRegion(options[0]);
            dispatch(setHeaderSelectedRegion(options[0]));
        };
        return options;
    }, [regionsData]);

    const handleClick = (value: string) => {
        setSelectedTab(value);
        dispatch(setSelectedHeaderTab(value));
    };

    useEffect(() => {
        setCurrentTime(getCurrentDateTime());
    }, []);

    const refreshPage = () => {
        setCurrentTime(getCurrentDateTime());
    };

    return (
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
                                value={selectedCred ? [selectedCred] : [generateAWSAccounts[0]]}
                                onChange={(selectedOptions: any): void => {
                                    setSelectedCred(selectedOptions);
                                    dispatch(setHeaderSelectedCred(selectedOptions));
                                }}
                                placeholder="Select a Credential"
                                isSearchable={generateAWSAccounts.length > 5}
                                options={generateAWSAccounts}
                                variant="two-lines"
                            />
                        </div>

                        <div className={styles.secondSelect}>
                            <SelectField
                                isLoading={regionsLoading}
                                isClearable={false}
                                value={selectedRegion ? [selectedRegion] : [generateRegionsData[0]]}
                                onChange={(selectedOptions: any): void => {
                                    setSelectedRegion(selectedOptions);
                                    dispatch(setHeaderSelectedRegion(selectedOptions));
                                }}
                                placeholder="Select a Region"
                                isSearchable={generateRegionsData.length > 5}
                                options={generateRegionsData}
                                variant="two-lines"
                            />
                        </div>

                        <div className={styles.separator} />

                        <div className={styles.refresh}>
                            <div className={styles.refreshIcon} onClick={refreshPage}>
                                <RefreshIcon />
                            </div>
                            <Typography className={styles.date} variant="Regular_14">
                                {currentTime}
                            </Typography>
                        </div>
                    </div>
                </div>

                <div className={styles.secondRow}>
                    <div
                        className={
                            selectedHeaderTab === 'Dashboard' ? `${styles.overviewTabs}` : `${styles.overviewTabs}`
                        }
                    >
                        <Typography
                            variant="Regular_14"
                            className={
                                selectedHeaderTab === 'Dashboard'
                                    ? `${styles.headerPart1} ${styles.active}`
                                    : `${styles.headerPart1}`
                            }
                            onClick={() => handleClick('Dashboard')}
                        >
                            Dashboard
                        </Typography>
                        <Typography
                            variant="Regular_14"
                            className={
                                selectedHeaderTab === 'Inventory' || selectedHeaderTab === 'Overview'
                                    ? `${styles.headerPart2} ${styles.active}`
                                    : `${styles.headerPart2}`
                            }
                            onClick={() => handleClick('Inventory')}
                        >
                            Inventory
                        </Typography>

                        <Typography
                            variant="Regular_14"
                            className={
                                selectedHeaderTab === 'Job monitoring'
                                    ? `${styles.headerPart3} ${styles.active}`
                                    : `${styles.headerPart3}`
                            }
                            onClick={() => handleClick('Job monitoring')}
                        >
                            Job monitoring
                        </Typography>
                    </div>
                </div>
            </div>
            {selectedHeaderTab === 'Dashboard' && <DatabaseHomePage />}
            {selectedHeaderTab === 'Inventory' && <Inventory />}
            {selectedHeaderTab === 'Job monitoring' && <JobMonitoring />}
            {selectedHeaderTab === 'Overview' && <DatabaseHostOverview />}
        </div>
    );
};

export default HeaderComponent;
