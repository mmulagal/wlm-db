import { useState, useMemo } from 'react';
import { AccordionCard, AccordionCardContent, RadioButton, Typography } from '@netapp/design-system';
import { GENERAL } from '../../../utils/appConstants';
import { optionType, SelectField } from '@netapp/design-system/dist/components/Select';
import styles from './License.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { generateOptionType } from '../../../utils/utilityFunctions';

const License = () => {
    const [licenseSelect, setLicenseSelect] = useState(GENERAL.LICENSE_INCLUDED_AMI);

    const amid = ['AMID1', 'AMID2', 'AMID3'];
    const [amiID, setAmiID] = useState('');

    //Function to generate the options for Select Field
    const generateAMIId = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        amid?.map((val, idx: number) => {
            const option = generateOptionType(val, val, '', false, '');
            options.push(option);
        });
        return options;
    }, []);
    //Set the Header text here
    const setHeader = () => {
        if (licenseSelect === GENERAL.LICENSE_INCLUDED_AMI) {
            return <Typography variant="Regular_14">{GENERAL.LICENSE_INCLUDED_AMI}</Typography>;
        }
        if (licenseSelect === GENERAL.USE_CUSTOM_AMI) {
            return <Typography variant="Regular_14">{amiID}</Typography>;
        }
    };
    return (
        <div className={styles.license}>
            <AccordionCard
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="9"
                title={<div className={CommonStyles.title}>{GENERAL.LICENSE}</div>}
            >
                <AccordionCardContent>
                    <Typography>
                        <div className={styles.licenseText}>{GENERAL.LICENSE_TEXT}</div>
                        <div className={styles['radio-container']}>
                            <RadioButton
                                isChecked={licenseSelect === GENERAL.LICENSE_INCLUDED_AMI}
                                onChange={() => {
                                    setLicenseSelect(GENERAL.LICENSE_INCLUDED_AMI);
                                }}
                                children={GENERAL.LICENSE_INCLUDED_AMI}
                                className=""
                            />
                            <RadioButton
                                isChecked={licenseSelect === GENERAL.USE_CUSTOM_AMI}
                                onChange={() => {
                                    setLicenseSelect(GENERAL.USE_CUSTOM_AMI);
                                }}
                                children={GENERAL.USE_CUSTOM_AMI}
                                className=""
                            />
                        </div>
                        {licenseSelect === GENERAL.USE_CUSTOM_AMI && (
                            <div className={styles.handleSelect}>
                                <SelectField
                                    label={GENERAL.AMI_ID}
                                    placeholder={GENERAL.SELECT_AMI_ID}
                                    isClearable={false}
                                    onChange={(selectedOptions: any): void => {
                                        setAmiID(selectedOptions.label);
                                    }}
                                    defaultValue={[generateAMIId[0]]}
                                    isSearchable={generateAMIId.length > 5}
                                    options={generateAMIId}
                                />
                            </div>
                        )}
                    </Typography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default License;
