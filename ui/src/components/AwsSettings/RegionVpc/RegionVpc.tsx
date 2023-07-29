import { useEffect, useMemo, useState } from 'react';
import { AccordionCard, AccordionCardContent, RadioButton, SelectField, Typography } from '@netapp/design-system';
import { optionType } from '@netapp/design-system/dist/components/Select';
import ActionRequired from '../../../common/ActionRequired/ActionRequired';
import { generateOptionType } from '../../../utils/utilityFunctions';
import styles from './RegionVpc.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { GENERAL } from '../../../utils/appConstants';
import { setSelectedRegionData, setSelectedVPC } from '../../../store/mssql/mssqlFormSlice';
import { useAppDispatch, useAppSelector } from '../../../store/storeHooks';

const RegionVpc = () => {
    const dispatch = useAppDispatch();

    //Getting the Data from state
    const {regionsData, regionsLoading} = useAppSelector((state) => state.mssql.getRegions);
    const {vpcData, vpcLoading} = useAppSelector((state) => state.mssql.getVPCList);
    const selectedRegionData = useAppSelector((state: any) => state.mssqlForm.regionAndVpc.selectedRegion);
    const selectedVPCData = useAppSelector((state: any) => state.mssqlForm.regionAndVpc.selectedVPC);

    //Setup for radio buttons
    const [selectVPC, setSelectVPC] = useState(GENERAL.SELECT_EXISTING_VPC);
    const [selectedRegion, setSelectedRegion] = useState({});
    const [selectedVpc, setSelectedVpc] = useState({});

    //Set up for Region select field
    const regions = regionsData?.regions;
    
    //Function to generate the options for Select Field
    const generateRegionsData = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        regions?.map((val, idx: number) => {
            const regionValue = val.regionCode + " | " + val.regionName;
            const option = generateOptionType(regionValue, regionValue, '', false, '', val);
            options.push(option);
        });

        setSelectedRegion(options[0]);
        return options;
    }, [regions]);

    useEffect(() => {
        dispatch(setSelectedRegionData(selectedRegion));
    }, [dispatch, selectedRegion]);


    //setup for VPC select field
    const vpcs = vpcData?.vpcs;

    //Function to generate the options for Select Field
    const generateVPCOptions = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        vpcs?.map((val, idx: number) => {
            const vpcValue = val.name + " - " + (val.cidrBlock ? val.cidrBlock[0]?.CidrBlock : '');
            const vpcLabel2 = val.id!;
            const vpcData = {
                id: val.id,
                name: val.name,
                cidrBlock: val.cidrBlock ? val.cidrBlock[0]?.CidrBlock : ''
            }
            const option = generateOptionType(vpcValue, vpcValue, vpcLabel2, false, '', vpcData);
            options.push(option);
        });

        setSelectedVpc(options[0]);
        return options;
    }, [vpcs]);

    useEffect(() => {
        dispatch(setSelectedVPC(selectedVpc));
    }, [dispatch, selectedVpc]);

    //Set the Header text here
    const setHeader = () => {
        if (!selectedRegionData || !selectedVPCData) {
            return <ActionRequired />;
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
            <AccordionCard isLoading={regionsLoading || vpcLoading} 
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="2"
                title={<div className={CommonStyles.title}>{GENERAL.REGION_VPC}</div>}
            >
                <AccordionCardContent>
                    <Typography>
                        <SelectField
                            label={GENERAL.REGION}
                            isClearable={false}
                            defaultValue={selectedRegionData ? [selectedRegionData] :[generateRegionsData[0]]}
                            onChange={(selectedOptions: any): void => {
                                setSelectedRegion(selectedOptions);
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
                                    label={GENERAL.VPC}
                                    isClearable={false}
                                    value={selectedVPCData ? selectedVPCData: undefined}
                                    onChange={(selectedOptions: any): void => {
                                        setSelectedVpc(selectedOptions);
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
