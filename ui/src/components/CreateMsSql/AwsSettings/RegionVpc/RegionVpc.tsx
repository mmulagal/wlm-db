import { useEffect, useMemo, useState } from 'react';
import {
    AccordionCard,
    AccordionCardContent,
    RadioButton,
    SelectField,
    Typography,
    useAccordionContext
} from '@netapp/design-system';
import { ReactComponent as WarningIcon } from '@netapp/icons/ic_notice_triangle.svg';
import { optionType } from '@netapp/design-system/dist/components/Select';
import ActionRequired from '../../../../common/ActionRequired/ActionRequired';
import { generateOptionType, formatVpcSubnetsData } from '../../../../utils/utilityFunctions';
import styles from './RegionVpc.module.scss';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import { GENERAL } from '../../../../utils/appConstants';
import { setSelectedRegionData, setSelectedVPC } from '../../../../store/mssql/mssqlFormSlice';
import { useAppSelector } from '../../../../store/storeHooks';
import { useDispatch } from 'react-redux';
import { addNotification, NOTIFICATION_TYPES } from '../../../../store/notificationSlice';

const RegionVpc = () => {
    const dispatch = useDispatch();
    const accordionContext = useAccordionContext()?.setOpenChildren!;
    const [isDefaultOpen, setIsDefaultOpen] = useState(false);

    //Getting the Data from state
    const { regionsData, regionsLoading } = useAppSelector(state => state.mssql.getRegions);
    const { credentialData } = useAppSelector(state => state.mssql.getCredentials);
    const { vpcData, vpcLoading } = useAppSelector(state => state.mssql.getVPCList);
    const selectedRegionData = useAppSelector(state => state.mssqlForm.regionAndVpc.selectedRegion);
    const selectedVPCData = useAppSelector(state => state.mssqlForm.regionAndVpc.selectedVPC);
    const isVPCNotFilled = useAppSelector(state => state.msSqlAction.vpcSelected);

    //Function to generate the options for Select Field
    const generateRegionsData = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        regionsData?.regions?.map((val, idx: number) => {
            const regionValue = val.regionCode + ' | ' + val.regionName;
            const option = generateOptionType(regionValue, regionValue, '', false, '', val);
            options.push(option);
        });
        return options;
    }, [regionsData]);

    //Update selected region in form data store
    useEffect(() => {
        dispatch(setSelectedRegionData(generateRegionsData[0]));
    }, [dispatch, generateRegionsData]);

    //Setup for radio buttons
    const [selectVPC, setSelectVPC] = useState(GENERAL.SELECT_EXISTING_VPC);

    //To open accordion if default account is present
    useEffect(() => {
        if (credentialData && credentialData.length > 0 && regionsData && !isDefaultOpen) {
            accordionContext({
                2: true
            });
            setIsDefaultOpen(true);
        }
    }, [credentialData, regionsData]);

    //Function to generate the options for Select Field
    const generateVPCOptions = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        vpcData?.vpcs?.map((val, idx: number) => {
            const vpcValue = (val.name || '-') + ' - ' + (val.cidrBlock ? val.cidrBlock[0]?.CidrBlock : '');
            const vpcLabel2 = val.id!;
            const vpcData = {
                id: val.id,
                name: val.name,
                cidrBlock: val.cidrBlock ? val.cidrBlock[0]?.CidrBlock : '',
                subnets: val?.subnets,
                availabilityZones: formatVpcSubnetsData(val),
                securityGroups: val?.securityGroups
            };
            const option = generateOptionType(vpcValue, vpcValue, vpcLabel2, false, '', vpcData);
            options.push(option);
        });
        return options;
    }, [vpcData]);

    // On VPC selection needs to check if 2 availability zones are available or not
    useEffect(() => {
        const azData = selectedVPCData?.data?.availabilityZones;
        if (azData && Object.keys(azData).length < 2) {
            dispatch(
                addNotification({ notificationType: NOTIFICATION_TYPES.ERROR, message: GENERAL.MULTI_AZ_CHECK_MESSAGE })
            );
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedVPCData]);

    //Update selected VPC in form data store
    useEffect(() => {
        dispatch(setSelectedVPC(null));
    }, [dispatch, generateVPCOptions]);

    //Set the Header text here
    const setHeader = () => {
        if (!credentialData || (credentialData && !credentialData.length)) {
            return (
                <Typography variant="Regular_14" className={CommonStyles['text-disabled']}>
                    {GENERAL.SELECT_ANY_ACCOUNT}
                </Typography>
            );
        }
        if (!selectedRegionData || !selectedVPCData) {
            return <ActionRequired error={!isVPCNotFilled ? true : false} />;
        } else {
            return (
                <Typography variant="Regular_14" className={CommonStyles.setHeaderStyle}>
                    {/* @ts-ignore */}
                    <div>{selectedRegionData.value}</div>
                    <div className={CommonStyles.separator} />
                    <div>{selectedVPCData.value}</div>
                </Typography>
            );
        }
    };
    return (
        <div className={styles['region-vpc']}>
            <AccordionCard
                isDisabled={!credentialData || (credentialData && !credentialData.length)}
                isExpandDisabled={!credentialData || (credentialData && !credentialData.length)}
                isLoading={regionsLoading || vpcLoading}
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="2"
                title={<div className={CommonStyles.title}>{GENERAL.REGION_VPC}</div>}
            >
                <AccordionCardContent>
                    <Typography>
                        <SelectField
                            label={GENERAL.REGION}
                            isClearable={false}
                            defaultValue={selectedRegionData ? [selectedRegionData] : [generateRegionsData[0]]}
                            onChange={(selectedOptions: any): void => {
                                dispatch(setSelectedRegionData(selectedOptions));
                            }}
                            isSearchable={generateRegionsData.length > 5}
                            options={generateRegionsData}
                            className={styles.regionSelect}
                        />
                        <Typography variant="Regular_14" className={styles.regionSubText}>
                            {GENERAL.REGION_VPC_TEXT}
                        </Typography>

                        <div className={styles.handleRadio}>
                            <RadioButton
                                isChecked={selectVPC === GENERAL.SELECT_EXISTING_VPC}
                                onChange={() => {
                                    setSelectVPC(GENERAL.SELECT_EXISTING_VPC);
                                }}
                                children={GENERAL.SELECT_EXISTING_VPC}
                                className=""
                            />
                            <RadioButton
                                isChecked={selectVPC === GENERAL.CREATE_NEW_VPC}
                                onChange={() => {
                                    setSelectVPC(GENERAL.CREATE_NEW_VPC);
                                }}
                                children={GENERAL.CREATE_NEW_VPC}
                                className=""
                                isDisabled
                            />
                        </div>
                        {selectVPC === GENERAL.SELECT_EXISTING_VPC && (
                            <div className={styles.handleSelect}>
                                <SelectField
                                    isLoading={vpcLoading}
                                    label={GENERAL.VPC}
                                    error={!isVPCNotFilled && !selectedVPCData ? GENERAL.ACTION_REQUIRED : ''}
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
                                    isClearable={false}
                                    value={selectedVPCData ? selectedVPCData : null}
                                    onChange={(selectedOptions: any): void => {
                                        dispatch(setSelectedVPC(selectedOptions));
                                    }}
                                    placeholder="Select a VPC"
                                    isSearchable={generateVPCOptions.length > 5}
                                    options={generateVPCOptions}
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

export default RegionVpc;
