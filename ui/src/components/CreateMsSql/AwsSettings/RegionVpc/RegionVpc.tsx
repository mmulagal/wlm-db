import { useEffect, useMemo, useRef, useState } from 'react';
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
import { ReactComponent as InfoIcon } from '@netapp/icons/ic_info.svg';
import {
    formatVpcSubnetsData,
    generateOptionType,
    regionsSort,
    sortListOfDict
} from '../../../../utils/utilityFunctions';
import styles from './RegionVpc.module.scss';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import { GENERAL } from '../../../../utils/appConstants';
import { setSelectedRegionData, setSelectedVPC } from '../../../../store/mssql/mssqlFormSlice';
import { useAppSelector } from '../../../../store/storeHooks';
import { useDispatch } from 'react-redux';
import { addNotification, NOTIFICATION_TYPES } from '../../../../store/notificationSlice';
import { setIsWizardTouched } from '../../../../store/chatbot/chatbotSlice';
import { setHeaderSelectedRegion } from '../../../../store/workloadFactory/headersSlice';

const RegionVpc = () => {
    const dispatch = useDispatch();
    const accordionContext = useAccordionContext()?.setOpenChildren!;
    const [isDefaultOpen, setIsDefaultOpen] = useState(false);

    const vpcRef = useRef(null);

    //Getting the Data from state
    const { regionsData, regionsLoading } = useAppSelector(state => state.mssql.getRegions);
    const { credentialData } = useAppSelector(state => state.mssql.getCredentials);
    const { vpcData, vpcLoading } = useAppSelector(state => state.mssql.getVPCList);
    const selectedRegionData = useAppSelector(state => state.mssqlForm.regionAndVpc.selectedRegion);
    const selectedVPCData = useAppSelector(state => state.mssqlForm.regionAndVpc.selectedVPC);
    const isVPCNotFilled = useAppSelector(state => state.msSqlAction.vpcSelected);
    const isCreateHit = useAppSelector(state => state.msSqlAction.isCreateHit);
    const isLoadConfig = useAppSelector(state => state.msSqlAction.isLoadConfig);
    const isDemoMode = useAppSelector(state => state.auth.isDemoMode);
    const deploymentModel = useAppSelector(state => state.mssqlForm.dbDeploymentModel);
    const { movingFromChatbot } = useAppSelector(state => state.chatbot);

    //Function to generate the options for Select Field
    const generateRegionsData = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        const sortedRegionsData = regionsSort(regionsData?.regions || []);
        sortedRegionsData?.map((val, idx: number) => {
            const regionValue = val.regionCode + ' | ' + val.regionName;
            const option = generateOptionType(regionValue, regionValue, '', false, '', val);
            options.push(option);
        });
        return options;
    }, [regionsData]);

    //Update selected region in form data store
    useEffect(() => {
        if (!isLoadConfig && !selectedRegionData && !movingFromChatbot) {
            dispatch(setSelectedRegionData(generateRegionsData[0]));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [generateRegionsData]);

    useEffect(() => {
        const regionValue = selectedRegionData?.data?.regionName;
        if (regionValue) {
            const label2 = selectedRegionData?.data?.regionCode;
            const option = generateOptionType(regionValue, regionValue, label2, false, '', selectedRegionData?.data);
            dispatch(setHeaderSelectedRegion(option));
        }
    }, [selectedRegionData]);

    useEffect(() => {
        if (!isVPCNotFilled && isCreateHit) {
            setTimeout(() => {
                //@ts-ignore
                vpcRef?.current?.focus();
            }, 110);
        }
    }, [isVPCNotFilled, isCreateHit]);

    //Setup for radio buttons
    const [selectVPC, setSelectVPC] = useState(GENERAL.SELECT_EXISTING_VPC);

    //To open accordion if default account is present
    useEffect(() => {
        if (credentialData && credentialData.length > 0 && regionsData && !isDefaultOpen) {
            accordionContext({
                2: true
            });
            setIsDefaultOpen(true);
        } else if (isLoadConfig) {
            accordionContext({
                2: false
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [credentialData, regionsData, isLoadConfig]);

    //Function to generate the options for Select Field
    const generateVPCOptions = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        vpcData?.vpcs?.map((val, idx: number) => {
            const vpcValue =
                (val?.name ? val.name + ' | ' : '') + (val.cidrBlock ? val.cidrBlock[0]?.CidrBlock : '') || '-';
            const vpcLabel2 = val.id!;
            const vpcData = {
                id: val.id,
                name: val.name,
                cidrBlock: val.cidrBlock ? val.cidrBlock[0]?.CidrBlock : '',
                availabilityZones: formatVpcSubnetsData(val)
            };
            const option = generateOptionType(vpcValue, vpcValue, vpcLabel2, false, '', vpcData);
            options.push(option);
        });
        return sortListOfDict(options, 'value');
    }, [vpcData]);

    // On VPC selection needs to check if 2 availability zones are available or not
    useEffect(() => {
        const azData = selectedVPCData?.data?.availabilityZones;
        if (
            !isDemoMode &&
            deploymentModel?.label === GENERAL.FAILOVER_CLUSTER &&
            azData &&
            Object.keys(azData).length < 2
        ) {
            dispatch(
                addNotification({ notificationType: NOTIFICATION_TYPES.ERROR, message: GENERAL.MULTI_AZ_CHECK_MESSAGE })
            );
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedVPCData]);

    //Update selected VPC in form data store
    useEffect(() => {
        if (!isLoadConfig && !movingFromChatbot) {
            dispatch(setSelectedVPC(null));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [generateVPCOptions]);

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
                isLoading={regionsLoading}
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
                                dispatch(setSelectedVPC(null));
                                dispatch(setIsWizardTouched(true));
                            }}
                            isSearchable={generateRegionsData.length > 5}
                            options={generateRegionsData}
                            className={styles.regionSelect}
                        />
                        <Typography variant="Regular_14" className={styles.regionSubText}>
                            {GENERAL.REGION_VPC_TEXT}
                        </Typography>

                        {/* To do- Commenting it until Create new vpc flow implemented */}
                        {/* <div className={styles.handleRadio}>
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
                        </div> */}
                        {selectVPC === GENERAL.SELECT_EXISTING_VPC && (
                            <div className={styles.handleSelect}>
                                <SelectField
                                    isLoading={vpcLoading}
                                    ref={vpcRef}
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
                                        dispatch(setIsWizardTouched(true));
                                    }}
                                    placeholder="Select a VPC"
                                    isSearchable={generateVPCOptions.length > 5}
                                    options={generateVPCOptions}
                                    variant="two-lines"
                                />
                                {/* <div className={styles.noticeVpc}>
                                    <div>
                                        <InfoIcon />
                                    </div>
                                    <Typography variant="Regular_13">{GENERAL.VPC_MESSAGE}</Typography>
                                </div> */}
                            </div>
                        )}
                    </Typography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default RegionVpc;
