import { useMemo, useState } from 'react';
import { AccordionCard, AccordionCardContent, RadioButton, SelectField, Typography } from '@netapp/design-system';
import { optionType } from '@netapp/design-system/dist/components/Select';
import ActionRequired from '../../../common/ActionRequired/ActionRequired';
import { generateOptionType } from '../../../utils/utilityFunctions';
import styles from './RegionVpc.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { GENERAL } from '../../../utils/appConstants';

const RegionVpc = () => {
    //Setup for radio buttons
    const [selectVPC, setSelectVPC] = useState(GENERAL.SELECT_EXISTING_VPC);
    const [optionSelected, setOptionSelected] = useState<any>(''); //This is for select VPC in drop down

    //Set up for Region select field
    const regions = ['us-east-1 | US East - N.Virginia', 'us-east-2 | US East - Ohio', 'us-west-2 | US West - Oregon'];
    const [selectedRegion, setSelectedRegion] = useState(''); //This is for selected region in drop down

    //Function to generate the options for Select Field
    const generateRegionsData = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        regions?.map((val, idx: number) => {
            const option = generateOptionType(val, val, '', false, '');
            options.push(option);
        });
        //@ts-ignore
        setSelectedRegion(options[0]);
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
        if (!selectedRegion || !optionSelected) {
            return <ActionRequired />;
        } else {
            return (
                <Typography variant="Regular_14" className={CommonStyles.setHeaderStyle}>
                    {/* @ts-ignore */}
                    <div>{selectedRegion?.label || selectedRegion}</div>
                    <div className={CommonStyles.separator} />
                    <div>{optionSelected.label}</div>
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
                            defaultValue={[generateRegionsData[0]]}
                            onChange={(selectedOptions: any): void => {
                                setSelectedRegion(selectedOptions.label);
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
                                        optionSelected
                                            ? generateOptionType(
                                                  optionSelected.value,
                                                  optionSelected.label,
                                                  optionSelected.label2,
                                                  false,
                                                  ''
                                              )
                                            : undefined
                                    }
                                    onChange={(selectedOptions: any): void => {
                                        setOptionSelected(selectedOptions);
                                        console.log(selectedOptions);
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
