import { useState, useMemo } from 'react';
import { AccordionCard, AccordionCardContent, RadioButton, Typography } from '@netapp/design-system';
import { GENERAL } from '../../../utils/appConstants';
import { optionType, SelectField } from '@netapp/design-system/dist/components/Select';
import styles from './License.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { generateOptionType } from '../../../utils/utilityFunctions';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../store/storeHooks';
import {
    setSelectedCustomAMI,
    setSelectedLicenseId,
    setSelectedLicenseType
} from '../../../store/mssql/mssqlFormSlice';

const License = () => {
    //Store related Data
    const dispatch = useDispatch();
    const licenseType = useAppSelector((state: any) => state.mssqlForm.license.selectedLicenseType);
    const selectedLicenseId = useAppSelector((state: any) => state.mssqlForm.license.selectedLicenseId);
    const selectedCustomAMI = useAppSelector((state: any) => state.mssqlForm.license.selectedCustomAMI);
    const [licenseSelect, setLicenseSelect] = useState(licenseType);

    const amid = ['AMID1', 'AMID2', 'AMID3'];

    //Function to generate the options for Select Field
    const generateAMIId = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        amid?.map((val, idx: number) => {
            const option = generateOptionType(val, val, '', false, '');
            options.push(option);
        });
        return options;
    }, []);

    //Function to generate the options for Select Field for License
    const generateAMIIdForLicense = useMemo<optionType[]>((): optionType[] => {
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
            return <Typography variant="Regular_14">{selectedCustomAMI}</Typography>;
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
                                    dispatch(setSelectedLicenseType(GENERAL.LICENSE_INCLUDED_AMI));
                                }}
                                children={GENERAL.LICENSE_INCLUDED_AMI}
                                className=""
                            />
                            <RadioButton
                                isChecked={licenseSelect === GENERAL.USE_CUSTOM_AMI}
                                onChange={() => {
                                    setLicenseSelect(GENERAL.USE_CUSTOM_AMI);
                                    dispatch(setSelectedLicenseType(GENERAL.USE_CUSTOM_AMI));
                                }}
                                children={GENERAL.USE_CUSTOM_AMI}
                                className=""
                            />
                        </div>
                        {licenseSelect === GENERAL.LICENSE_INCLUDED_AMI && (
                            <div className={styles.handleSelect}>
                                <SelectField
                                    label={'License ID'}
                                    placeholder={GENERAL.SELECT_AMI_ID}
                                    isClearable={false}
                                    onChange={(selectedOptions: any): void => {
                                        dispatch(setSelectedLicenseId(selectedOptions));
                                    }}
                                    value={selectedLicenseId ? selectedLicenseId : undefined}
                                    isSearchable={generateAMIIdForLicense.length > 5}
                                    options={generateAMIIdForLicense}
                                />
                            </div>
                        )}
                        {licenseSelect === GENERAL.USE_CUSTOM_AMI && (
                            <div className={styles.handleSelect}>
                                <SelectField
                                    label={GENERAL.AMI_ID}
                                    placeholder={GENERAL.SELECT_AMI_NAME}
                                    isClearable={false}
                                    onChange={(selectedOptions: any): void => {
                                        dispatch(setSelectedCustomAMI(selectedOptions));
                                    }}
                                    value={selectedCustomAMI ? selectedCustomAMI : undefined}
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
