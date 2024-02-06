import { useEffect, useMemo, useState, useRef } from 'react';
import ActionRequired from '../../../../common/ActionRequired/ActionRequired';
import { AccordionCard, AccordionCardContent, SelectField, Typography } from '@netapp/design-system';
import { ReactComponent as WarningIcon } from '@netapp/icons/ic_notice_triangle.svg';
import { optionType } from '@netapp/design-system/dist/components/Select';
import { GENERAL } from '../../../../utils/appConstants';
import { generateOptionType } from '../../../../utils/utilityFunctions';
import styles from './AvailabilityZone.module.scss';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../../store/storeHooks';
import {
    setSelectedAzNode1,
    setSelectedAzNode2,
    setSelectedSubnetNode1,
    setSelectedSubnetNode2
} from '../../../../store/mssql/mssqlFormSlice';
import { Subnets } from '../../../../utils/types/mssqlTypes';
import { addNotification, NOTIFICATION_TYPES } from '../../../../store/notificationSlice';
import { setIsWizardTouched } from '../../../../store/chatbot/chatbotSlice';

const AvailabilityZone = () => {
    const dispatch = useDispatch();

    const selectedVPCData = useAppSelector(state => state.mssqlForm.regionAndVpc.selectedVPC);
    const selectedZone1 = useAppSelector(state => state.mssqlForm.availabilityZones.selectedAzNode1);
    const selectedZone2 = useAppSelector(state => state.mssqlForm.availabilityZones.selectedAzNode2);
    const selectedSubnet1 = useAppSelector(state => state.mssqlForm.availabilityZones.selectedSubnetNode1);
    const selectedSubnet2 = useAppSelector(state => state.mssqlForm.availabilityZones.selectedSubnetNode2);
    const deploymentMode = useAppSelector(state => state.mssqlForm.dbDeploymentModel);

    const isAZNotFilled = useAppSelector(state => state.msSqlAction.availabilityZoneSelected);
    const { credentialData } = useAppSelector(state => state.mssql.getCredentials);
    const isCreateHit = useAppSelector(state => state.msSqlAction.isCreateHit);
    const isLoadConfig = useAppSelector(state => state.msSqlAction.isLoadConfig);
    const isDemoMode = useAppSelector(state => state.auth.isDemoMode);
    const { movingFromChatbot } = useAppSelector(state => state.chatbot);

    const [routeTable1, setRouteTable1] = useState(undefined);
    const [routeTable2, setRouteTable2] = useState(undefined);

    // Backup of AZ 2 if switches between FCI and standalone
    const [backupAzNode2, setBackupAzNode2] = useState(undefined);
    const [backupSubnetNode2, setBackupSubnetNode2] = useState(undefined);
    const [backupRouteTable2, setBackupRouteTable2] = useState(undefined);

    //Refs
    const az1Ref = useRef(null);
    const az2Ref = useRef(null);
    const sub1Ref = useRef(null);
    const sub2Ref = useRef(null);

    useEffect(() => {
        if (!isLoadConfig && !movingFromChatbot) {
            dispatch(setSelectedAzNode1(null));
            dispatch(setSelectedAzNode2(null));
            dispatch(setSelectedSubnetNode1(null));
            dispatch(setSelectedSubnetNode2(null));
            setRouteTable1(undefined);
            setRouteTable2(undefined);
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedVPCData]);

    useEffect(() => {
        if (deploymentMode?.label === GENERAL.SINGLE_INSTANCE) {
            setBackupAzNode2(selectedZone2);
            setBackupSubnetNode2(selectedSubnet2);
            setBackupRouteTable2(selectedSubnet2?.data?.routeTableId);
            dispatch(setSelectedAzNode2(null));
            dispatch(setSelectedSubnetNode2(null));
            setRouteTable2(undefined);
        }
        if (deploymentMode?.label === GENERAL.FAILOVER_CLUSTER && backupAzNode2 && backupSubnetNode2) {
            dispatch(setSelectedAzNode2(backupAzNode2));
            dispatch(setSelectedSubnetNode2(backupSubnetNode2));
            setRouteTable2(backupRouteTable2);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [deploymentMode]);

    // Clear AZ 2 backup when user changes AZ 1
    useEffect(() => {
        setBackupAzNode2(undefined);
        setBackupSubnetNode2(undefined);
        setBackupRouteTable2(undefined);
    }, [selectedZone1]);

    //Function to generate the options for Select Field for Zone 1
    const generateZones1 = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        const azData = selectedVPCData?.data?.availabilityZones;
        const zones = azData ? Object.keys(azData) : [];
        zones
            ?.filter(key => key !== selectedZone2?.value)
            .map((val, idx: number) => {
                const subnetsList: Array<string> = [];
                azData[val].map((per: any) => (per?.id ? subnetsList.push(per.id) : ''));
                const data = {
                    availabilityZone: val,
                    subnets: subnetsList
                };
                const option = generateOptionType(val, val, '', false, '', data);
                options.push(option);
            });
        return options;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedVPCData, selectedZone2]);

    //Function to generate the options for Select Field for Zone 2
    const generateZones2 = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        const azData = selectedVPCData?.data?.availabilityZones;
        const zones = azData ? Object.keys(azData) : [];
        zones
            ?.filter(key => key !== selectedZone1?.value)
            .map((val, idx: number) => {
                const subnetsList: Array<string> = [];
                azData[val].map((per: any) => (per?.id ? subnetsList.push(per.id) : ''));
                const data = {
                    availabilityZone: val,
                    subnets: subnetsList
                };
                const option = generateOptionType(val, val, '', false, '', data);
                options.push(option);
            });
        return options;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedVPCData, selectedZone1]);

    //Subnet related code

    //Function to generate the options for Select Field subnet 1
    const generateSubnet1Options = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        let subnetsList: Subnets[] = [];
        const azData = selectedVPCData?.data?.availabilityZones;
        if (azData && azData.hasOwnProperty(selectedZone1?.value)) {
            subnetsList = azData[selectedZone1?.value];
        }
        subnetsList?.map((val: Subnets, idx: number) => {
            const label2 = val?.id;
            const value = val?.cidrBlock;
            const label = (val?.name ? val.name + ' | ' : '') + val?.cidrBlock;
            const option = generateOptionType(value, label, label2, false, '', val);
            options.push(option);
        });
        return options;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedVPCData, selectedZone1]);

    useEffect(() => {
        if (!isLoadConfig && !movingFromChatbot) {
            dispatch(setSelectedSubnetNode1(generateSubnet1Options[0]));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [generateSubnet1Options]);

    useEffect(() => {
        if (isCreateHit) {
            if (!isAZNotFilled && !selectedZone1) {
                setTimeout(() => {
                    //@ts-ignore
                    az1Ref?.current?.focus();
                }, 100);
            }
            if (!isAZNotFilled && !selectedSubnet1) {
                setTimeout(() => {
                    //@ts-ignore
                    sub1Ref?.current?.focus();
                }, 90);
            }
            if (!isAZNotFilled && !selectedZone2) {
                setTimeout(() => {
                    //@ts-ignore
                    az2Ref?.current?.focus();
                }, 80);
            }

            if (!isAZNotFilled && !selectedSubnet2) {
                setTimeout(() => {
                    //@ts-ignore
                    sub2Ref?.current?.focus();
                }, 70);
            }
        }
    }, [isAZNotFilled, selectedZone1, selectedSubnet1, selectedZone2, selectedSubnet2, isCreateHit]);

    //Function to generate the options for Select Field subnet 2
    const generateSubnet2Options = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        let subnetsList: Subnets[] = [];
        const azData = selectedVPCData?.data?.availabilityZones;
        if (azData && azData.hasOwnProperty(selectedZone2?.value)) {
            subnetsList = azData[selectedZone2?.value];
        }
        subnetsList?.map((val: Subnets, idx: number) => {
            const label2 = val?.id;
            const value = val?.cidrBlock;
            const label = (val?.name ? val.name + ' | ' : '') + val?.cidrBlock;
            const option = generateOptionType(value, label, label2, false, '', val);
            options.push(option);
        });
        return options;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedVPCData, selectedZone2]);

    useEffect(() => {
        if (!isLoadConfig && !movingFromChatbot) {
            dispatch(setSelectedSubnetNode2(generateSubnet2Options[0]));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [generateSubnet2Options]);

    //Set the Header text here
    const setHeader = () => {
        if (!credentialData || (credentialData && !credentialData.length)) {
            return (
                <Typography variant="Regular_14" className={CommonStyles['text-disabled']}>
                    {GENERAL.SELECT_ANY_ACCOUNT}
                </Typography>
            );
        } else if (!selectedVPCData) {
            return <ActionRequired disabled />;
        }

        if (deploymentMode?.label === GENERAL.FAILOVER_CLUSTER) {
            if (!selectedZone1?.label || !selectedZone2?.label || !selectedSubnet1?.value || !selectedSubnet2?.value) {
                return <ActionRequired error={!isAZNotFilled ? true : false} />;
            } else {
                return (
                    <div className={CommonStyles.setHeaderStyle}>
                        <div className={CommonStyles.regular}>
                            Node 1:{selectedZone1?.label} ({selectedSubnet1?.value})
                        </div>
                        <div className={CommonStyles.separator} />
                        <div className={CommonStyles.regular}>
                            Node 2:{selectedZone2?.label} ({selectedSubnet2?.value})
                        </div>
                    </div>
                );
            }
        } else {
            if (!selectedZone1?.label || !selectedSubnet1?.label) {
                return <ActionRequired error={!isAZNotFilled ? true : false} />;
            } else {
                return (
                    <div className={CommonStyles.setHeaderStyle}>
                        <div className={CommonStyles.regular}>
                            Node 1:{selectedZone1?.label} ({selectedSubnet1?.label})
                        </div>
                    </div>
                );
            }
        }
    };

    useEffect(() => {
        if (!isDemoMode && routeTable1 && routeTable2 && routeTable1 === routeTable2) {
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.ERROR,
                    message: GENERAL.SAME_ROUTE_SUBNET_ERROR
                })
            );
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [routeTable1, routeTable2]);

    return (
        <div className={styles['availability-zone']}>
            <AccordionCard
                isDisabled={!credentialData || (credentialData && !credentialData.length) || !selectedVPCData}
                isExpandDisabled={!credentialData || (credentialData && !credentialData.length) || !selectedVPCData}
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="3"
                title={<div className={CommonStyles.title}>Availability zones</div>}
            >
                <AccordionCardContent>
                    <Typography>
                        <Typography variant="Regular_14" className={styles.subText}>
                            {GENERAL.AZ_TEXT}
                        </Typography>

                        <div className={styles.firstContainer}>
                            <Typography variant="Regular_14">{GENERAL.CLUSTER_CONFIG_NODE_1}</Typography>
                            <SelectField
                                label={GENERAL.AZ_Zone}
                                ref={az1Ref}
                                placeholder="Select an availability zone"
                                isClearable={false}
                                value={selectedZone1 ? selectedZone1 : undefined}
                                onChange={(selectedOptions: any): void => {
                                    dispatch(setSelectedAzNode1(selectedOptions));
                                    dispatch(setIsWizardTouched(true));
                                }}
                                error={!isAZNotFilled && !selectedZone1 ? GENERAL.ACTION_REQUIRED : ''}
                                //@ts-ignore
                                isErrorPrefixHidden
                                customErrorWarningIcon={
                                    <WarningIcon
                                        style={{
                                            width: '16px',
                                            height: '16px',
                                            //@ts-ignore
                                            '--icon-primary-color': 'var(--error'
                                        }}
                                    />
                                }
                                isSearchable={generateZones1.length > 5}
                                options={generateZones1}
                                className={styles.selectField}
                            />

                            <SelectField
                                label={GENERAL.SUBNET}
                                placeholder="Select a subnet"
                                ref={sub1Ref}
                                isClearable={false}
                                error={!isAZNotFilled && !selectedSubnet1 ? GENERAL.ACTION_REQUIRED : ''}
                                //@ts-ignore
                                isErrorPrefixHidden
                                customErrorWarningIcon={
                                    <WarningIcon
                                        style={{
                                            width: '16px',
                                            height: '16px',
                                            //@ts-ignore
                                            '--icon-primary-color': 'var(--error'
                                        }}
                                    />
                                }
                                value={selectedSubnet1 ? selectedSubnet1 : undefined}
                                onChange={(selectedOptions: any): void => {
                                    dispatch(setSelectedSubnetNode1(selectedOptions));
                                    setRouteTable1(selectedOptions?.data?.routeTableId);
                                    dispatch(setIsWizardTouched(true));
                                }}
                                isSearchable={generateSubnet1Options.length > 5}
                                options={generateSubnet1Options}
                                className={styles.selectField}
                                variant="two-lines"
                            />
                        </div>

                        {deploymentMode?.label === GENERAL.FAILOVER_CLUSTER && (
                            <div className={styles.firstContainer}>
                                <Typography variant="Regular_14">{GENERAL.CLUSTER_CONFIG_NODE_2}</Typography>
                                <SelectField
                                    label={GENERAL.AZ_Zone}
                                    placeholder="Select an availability zone"
                                    ref={az2Ref}
                                    isClearable={false}
                                    value={selectedZone2 ? selectedZone2 : undefined}
                                    error={!isAZNotFilled && !selectedZone2 ? GENERAL.ACTION_REQUIRED : ''}
                                    //@ts-ignore
                                    isErrorPrefixHidden
                                    customErrorWarningIcon={
                                        <WarningIcon
                                            style={{
                                                width: '16px',
                                                height: '16px',
                                                //@ts-ignore
                                                '--icon-primary-color': 'var(--error'
                                            }}
                                        />
                                    }
                                    onChange={(selectedOptions: any): void => {
                                        dispatch(setSelectedAzNode2(selectedOptions));
                                        dispatch(setIsWizardTouched(true));
                                    }}
                                    isSearchable={generateZones2.length > 5}
                                    options={generateZones2}
                                    className={styles.selectField}
                                />

                                <SelectField
                                    label={GENERAL.SUBNET}
                                    placeholder="Select a subnet"
                                    isClearable={false}
                                    ref={sub2Ref}
                                    value={selectedSubnet2 ? selectedSubnet2 : undefined}
                                    error={!isAZNotFilled && !selectedSubnet2 ? GENERAL.ACTION_REQUIRED : ''}
                                    //@ts-ignore
                                    isErrorPrefixHidden
                                    customErrorWarningIcon={
                                        <WarningIcon
                                            style={{
                                                width: '16px',
                                                height: '16px',
                                                //@ts-ignore
                                                '--icon-primary-color': 'var(--error'
                                            }}
                                        />
                                    }
                                    onChange={(selectedOptions: any): void => {
                                        dispatch(setSelectedSubnetNode2(selectedOptions));
                                        setRouteTable2(selectedOptions?.data?.routeTableId);
                                        dispatch(setIsWizardTouched(true));
                                    }}
                                    isSearchable={generateSubnet2Options.length > 5}
                                    options={generateSubnet2Options}
                                    className={styles.selectField}
                                    variant="two-lines"
                                />
                            </div>
                        )}
                    </Typography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};
export default AvailabilityZone;
