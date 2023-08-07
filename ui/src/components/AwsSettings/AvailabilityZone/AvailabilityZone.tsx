import { useEffect, useMemo } from 'react';
import ActionRequired from '../../../common/ActionRequired/ActionRequired';
import { AccordionCard, AccordionCardContent, SelectField, Typography } from '@netapp/design-system';
import { ReactComponent as WarningIcon } from '@netapp/icons/ic_notice_triangle.svg';
import { optionType } from '@netapp/design-system/dist/components/Select';
import { GENERAL } from '../../../utils/appConstants';
import { generateOptionType } from '../../../utils/utilityFunctions';
import styles from './AvailabilityZone.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../store/storeHooks';
import {
    setSelectedAzNode1,
    setSelectedAzNode2,
    setSelectedSubnetNode1,
    setSelectedSubnetNode2
} from '../../../store/mssql/mssqlFormSlice';

const AvailabilityZone = () => {
    const dispatch = useDispatch();

    const selectedVPCData = useAppSelector(state => state.mssqlForm.regionAndVpc.selectedVPC);
    const selectedZone1 = useAppSelector(state => state.mssqlForm.availabilityZones.selectedAzNode1);
    const selectedZone2 = useAppSelector(state => state.mssqlForm.availabilityZones.selectedAzNode2);
    const selectedSubnet1 = useAppSelector(state => state.mssqlForm.availabilityZones.selectedSubnetNode1);
    const selectedSubnet2 = useAppSelector(state => state.mssqlForm.availabilityZones.selectedSubnetNode2);
    const isAZNotFilled = useAppSelector(state => state.msSqlAction.availabilityZoneSelected);
    const { credentialData } = useAppSelector(state => state.mssql.getCredentials);

    useEffect(() => {
        dispatch(setSelectedAzNode1(null));
        dispatch(setSelectedAzNode2(null));
        dispatch(setSelectedSubnetNode1(null));
        dispatch(setSelectedSubnetNode2(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedVPCData]);

    //Function to generate the options for Select Field for Zone 1
    const generateZones1 = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        const azData = selectedVPCData?.data?.availabilityZones;
        const zones = azData ? Object.keys(azData) : [];
        zones?.filter(key => key !== selectedZone2?.value)
        .map((val:any, idx: number) => {
            const option = generateOptionType(val, val, '', false, '');
            options.push(option);
        });
        return options;
    }, [selectedVPCData, selectedZone2]);

    //Function to generate the options for Select Field for Zone 2
    const generateZones2 = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        const azData = selectedVPCData?.data?.availabilityZones;
        const zones = azData ? Object.keys(azData) : [];
        zones?.filter(key => key !== selectedZone1?.value)
        .map((val:any, idx: number) => {
            const option = generateOptionType(val, val, '', false, '');
            options.push(option);
        });
        return options;
    }, [selectedVPCData, selectedZone1]);

    //Subnet related code

    //Function to generate the options for Select Field subnet 1
    const generateSubnet1Options = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        const azData = selectedVPCData?.data?.availabilityZones;
        let subnetsList = [];
        if(azData && azData.hasOwnProperty(selectedZone1?.value)){
            subnetsList = azData[selectedZone1?.value];
        }
        subnetsList?.map((val:any, idx: number) => {
            const label2 = val?.id;
            const value = val?.cidrBlock;
            const option = generateOptionType(value, value, label2, false, '', val);
            options.push(option);
        });

        return options;
    }, [selectedVPCData, selectedZone1]);

    //Function to generate the options for Select Field subnet 2
    const generateSubnet2Options = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        const azData = selectedVPCData?.data?.availabilityZones;
        let subnetsList = [];
        if(azData && azData.hasOwnProperty(selectedZone2?.value)){
            subnetsList = azData[selectedZone2?.value];
        }
        subnetsList?.map((val:any, idx: number) => {
            const label2 = val?.id;
            const value = val?.cidrBlock;
            const option = generateOptionType(value, value, label2, false, '', val);
            options.push(option);
        });

        return options;
    }, [selectedVPCData, selectedZone2]);

    //Set the Header text here
    const setHeader = () => {
        if (!credentialData || (credentialData && !credentialData.length)) {
            return (
                <Typography variant="Regular_14" className={CommonStyles['text-disabled']}>
                    {GENERAL.SELECT_ANY_ACCOUNT}
                </Typography>
            );
        }
        if (!selectedZone1?.label || !selectedZone2?.label || !selectedSubnet1?.label || !selectedSubnet2?.label) {
            return <ActionRequired error={!isAZNotFilled ? true : false} />;
        } else {
            return (
                <div className={CommonStyles.setHeaderStyle}>
                    <div className={CommonStyles.regular}>
                        Node 1:{selectedZone1?.label} ({selectedSubnet1?.label})
                    </div>
                    <div className={CommonStyles.separator} />
                    <div className={CommonStyles.regular}>
                        Node 2:{selectedZone2?.label} ({selectedSubnet2?.label})
                    </div>
                </div>
            );
        }
    };
    return (
        <div className={styles['availability-zone']}>
            <AccordionCard
                isDisabled={!credentialData || (credentialData && !credentialData.length)}
                isExpandDisabled={!credentialData || (credentialData && !credentialData.length)}
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
                                placeholder="Select an availability zone"
                                isClearable={false}
                                value={selectedZone1 ? selectedZone1 : undefined}
                                onChange={(selectedOptions: any): void => {
                                    dispatch(setSelectedAzNode1(selectedOptions));
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
                                }}
                                isSearchable={generateSubnet1Options.length > 5}
                                options={generateSubnet1Options}
                                className={styles.selectField}
                                variant="two-lines"
                            />
                        </div>

                        <div className={styles.firstContainer}>
                            <Typography variant="Regular_14">{GENERAL.CLUSTER_CONFIG_NODE_2}</Typography>
                            <SelectField
                                label={GENERAL.AZ_Zone}
                                placeholder="Select an availability zone"
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
                                }}
                                isSearchable={generateZones2.length > 5}
                                options={generateZones2}
                                className={styles.selectField}
                            />

                            <SelectField
                                label={GENERAL.SUBNET}
                                placeholder="Select a subnet"
                                isClearable={false}
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
                                }}
                                isSearchable={generateSubnet2Options.length > 5}
                                options={generateSubnet2Options}
                                className={styles.selectField}
                                variant="two-lines"
                            />
                        </div>
                    </Typography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};
export default AvailabilityZone;
