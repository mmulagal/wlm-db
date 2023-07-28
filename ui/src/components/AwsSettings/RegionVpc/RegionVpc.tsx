import { useMemo, useState } from 'react';
import { AccordionCard, AccordionCardContent, RadioButton, SelectField, Typography } from '@netapp/design-system';
import { optionType } from '@netapp/design-system/dist/components/Select';
import ActionRequired from '../../../common/ActionRequired/ActionRequired';
import { generateOptionType } from '../../../utils/utilityFunctions';
import styles from './RegionVpc.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { GENERAL } from '../../../utils/appConstants';
import { useDispatch, useSelector } from 'react-redux';
import { setSelectedRegionData, setSelectedVPC } from '../../../store/mssql/mssqlFormSlice';

const RegionVpc = () => {
    const dispatch = useDispatch();

    //Getting the Data from state
    const selectedRegionData = useSelector((state: any) => state.mssqlForm.regionAndVpc.selectedRegions);
    const selectedVPCData = useSelector((state: any) => state.mssqlForm.regionAndVpc.selectedVPC);

    //Setup for radio buttons
    const [selectVPC, setSelectVPC] = useState(GENERAL.SELECT_EXISTING_VPC);

    //Set up for Region select field
    const regions = ['us-east-1 | US East - N.Virginia', 'us-east-2 | US East - Ohio', 'us-west-2 | US West - Oregon'];

    //Function to generate the options for Select Field
    const generateRegionsData = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        regions?.map((val, idx: number) => {
            const option = generateOptionType(val, val, '', false, '');
            options.push(option);
        });

        dispatch(setSelectedRegionData(options[0]));
        return options;
    }, []);

    //setup for VPC select field
    const vpcs = [
        { label1: 'VPC1 - 10.0.0.0/16', value: 'VPC1 - 10.0.0.0/16', label2: 'vpc-123456' },
        { label1: 'VPC2 - 10.0.0.1/18', value: 'VPC2 - 10.0.0.1/18', label2: 'sg-123456' }
    ];

    //Function to generate the options for Select Field
    const generateVPCOptions = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        vpcs?.map((val, idx: number) => {
            const option = generateOptionType(val.value, val.label1, val.label2, false, '');
            options.push(option);
        });

        return options;
    }, []);

    //Set the Header text here
    const setHeader = () => {
        if (!selectedRegionData || !selectedVPCData) {
            return <ActionRequired />;
        } else {
            return (
                <Typography variant="Regular_14" className={CommonStyles.setHeaderStyle}>
                    {/* @ts-ignore */}
                    <div>{selectedRegionData?.label || selectedRegionData}</div>
                    <div className={CommonStyles.separator} />
                    <div>{selectedVPCData.label}</div>
                </Typography>
            );
        }
    };
    return (
        <div className={styles['region-vpc']}>
            <AccordionCard
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
                                    label={GENERAL.VPC}
                                    isClearable={false}
                                    value={
                                        selectedVPCData
                                            ? generateOptionType(
                                                  selectedVPCData.value,
                                                  selectedVPCData.label,
                                                  selectedVPCData.label2,
                                                  false,
                                                  ''
                                              )
                                            : undefined
                                    }
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
