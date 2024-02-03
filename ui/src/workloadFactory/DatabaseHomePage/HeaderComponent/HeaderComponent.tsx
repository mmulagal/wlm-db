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

const HeaderComponent = () => {
    const dispatch = useDispatch();
    const [selectedTab, setSelectedTab] = useState('Dashboard');
    const [currentTime, setCurrentTime] = useState('');
    const { selectedCredential } = useAppSelector(state => state.mssqlForm.awsAccount);
    const menuSelected = useAppSelector(state => state.inventory.menuSelected);
    const selectedHeaderTab = useAppSelector(state => state.inventory.selectedHeaderTab);

    const handleClick = (value: string) => {
        setSelectedTab(value);
        dispatch(setSelectedHeaderTab(value));
    };

    useEffect(() => {
        setCurrentTime(getCurrentDateTime());
    }, []);

    const credentialData = [
        {
            credentialsId: '3ad8702c-a2fd-48d2-be50-1ba6ce83acd5',
            name: 'mock-ui-creds-1',
            arn: 'arn:aws:iam::464262061435:role/Fsx-role',
            providerAccountId: '464262061435'
        },
        {
            credentialsId: '3ad8702c-a2fd-48d2-be50-1ba6ce83acd6',
            name: 'mock-ui-creds-2',
            arn: 'arn:aws:iam::464262061436:role/Fsx-role',
            providerAccountId: '464262061436'
        }
    ];

    const regionData = [
        {
            regionCode: 'us-east-1',
            regionName: 'US East (N. Virginia)'
        },
        {
            regionCode: 'us-east-2',
            regionName: 'US East (Ohio)'
        },
        {
            regionCode: 'us-west-1',
            regionName: 'US West (N. California)'
        },
        {
            regionCode: 'us-west-2',
            regionName: 'US West (Oregon)'
        },
        {
            regionCode: 'eu-west-1',
            regionName: 'Europe (Ireland)'
        }
    ];

    //Function to generate the options for Select Field
    const generateAWSAccounts = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        credentialData?.map((val, idx: number) => {
            const credValue = val.name;
            const label2 = `Account ID: ${val.providerAccountId}`;
            const option = generateOptionType(credValue, credValue, label2, false, '', val);
            options.push(option);
        });
        return options;
    }, [credentialData]);

    const generateRegionsData = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        regionData?.map((val, idx: number) => {
            const regionValue = val.regionName;
            const label2 = val.regionCode;
            const option = generateOptionType(regionValue, regionValue, label2, false, '', val);
            options.push(option);
        });
        return options;
    }, [regionData]);

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
                                isClearable={false}
                                defaultValue={selectedCredential ? [selectedCredential] : [generateAWSAccounts[0]]}
                                onChange={(selectedOptions: any): void => {}}
                                placeholder="Select a Credential"
                                isSearchable={generateAWSAccounts.length > 5}
                                options={generateAWSAccounts}
                                variant="two-lines"
                            />
                        </div>

                        <div className={styles.secondSelect}>
                            <SelectField
                                isClearable={false}
                                defaultValue={selectedCredential ? [selectedCredential] : [generateAWSAccounts[0]]}
                                onChange={(selectedOptions: any): void => {}}
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
