import { useState, useMemo, useEffect } from 'react';
import { AccordionCard, AccordionCardContent, Button, RadioButton, Typography } from '@netapp/design-system';
import { ReactComponent as WarningIcon } from '@netapp/icons/ic_notice_triangle.svg';
import { GENERAL } from '../../../../utils/appConstants';
import { optionType, SelectField } from '@netapp/design-system/dist/components/Select';
import styles from './License.module.scss';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import { generateOptionType } from '../../../../utils/utilityFunctions';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../../store/storeHooks';
import {
    setSelectedCustomAMI,
    setSelectedLicenseId,
    setSelectedLicenseType
} from '../../../../store/mssql/mssqlFormSlice';
import { LICENSE_URL } from '../../../../utils/consts';
import { setIsWizardTouched } from '../../../../store/chatbot/chatbotSlice';

const License = () => {
    //Store related Data
    const dispatch = useDispatch();

    // This is to get license included AMI data
    const { amiData, amiLoading } = useAppSelector(state => state.mssql.getAmiList);

    const { credentialData } = useAppSelector(state => state.mssql.getCredentials);

    const licenseType = useAppSelector(state => state.mssqlForm.license.selectedLicenseType);
    const selectedLicenseId = useAppSelector(state => state.mssqlForm.license.selectedLicenseId);
    const selectedCustomAMI = useAppSelector(state => state.mssqlForm.license.selectedCustomAMI);
    const [defaultValeLicense, selectedDefaultValue] = useState(selectedLicenseId);
    const isLoadConfig = useAppSelector(state => state.msSqlAction.isLoadConfig);
    const { movingFromChatbot } = useAppSelector(state => state.chatbot);

    const isLicenseFilled = useAppSelector(state => state.msSqlAction.licenseIdSelected);
    const [licenseSelect, setLicenseSelect] = useState(licenseType);

    // Custom AMI list will be blank for as it is not supported in phase 1
    const customAmiId: any[] = [];

    useEffect(() => {
        const newValLicense = {
            ...selectedLicenseId,
            label: `${selectedLicenseId.label} | ${selectedLicenseId.label2}`
        };
        selectedDefaultValue(newValLicense);
    }, [selectedLicenseId]);

    //Function to generate the options for Select Field
    const generateAMIId = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        customAmiId?.map((val, idx: number) => {
            const option = generateOptionType(val, val, '', false, '');
            options.push(option);
        });
        return options;
    }, []);

    //Function to generate the options for Select Field for License
    const generateAMIIdForLicense = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        amiData?.amis?.map((val, idx: number) => {
            const amiVal = val?.imageId;
            const amiName = val?.name;
            const data = {
                architecture: val?.architecture,
                amiVal: val?.imageId,
                amiName: val?.name
            };
            const option = generateOptionType(amiVal, amiVal, amiName, false, '', data);
            options.push(option);
        });
        return options;
    }, [amiData]);

    useEffect(() => {
        if (!isLoadConfig && !movingFromChatbot) {
            dispatch(setSelectedLicenseId(generateAMIIdForLicense[0]));
        }
    }, [dispatch, generateAMIIdForLicense]);

    //Set the Header text here
    const setHeader = () => {
        if (!credentialData || (credentialData && !credentialData.length)) {
            return (
                <Typography variant="Regular_14" className={CommonStyles['text-disabled']}>
                    {GENERAL.SELECT_ANY_ACCOUNT}
                </Typography>
            );
        }
        if (licenseSelect === GENERAL.LICENSE_INCLUDED_AMI) {
            return (
                <Typography variant="Regular_14">{selectedLicenseId?.value || GENERAL.LICENSE_INCLUDED_AMI}</Typography>
            );
        }
        if (licenseSelect === GENERAL.USE_CUSTOM_AMI) {
            return <Typography variant="Regular_14">{selectedCustomAMI?.value || GENERAL.USE_CUSTOM_AMI}</Typography>;
        }
    };

    // To open new tab with credential page on click of credential link
    const openCredentialTab = () => {
        const url = LICENSE_URL;
        window.open(url, '_blank', 'noopener');
    };
    return (
        <div className={styles.license}>
            <AccordionCard
                isLoading={amiLoading}
                isDisabled={!credentialData || (credentialData && !credentialData.length)}
                isExpandDisabled={!credentialData || (credentialData && !credentialData.length)}
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="9"
                title={<div className={CommonStyles.title}>{GENERAL.SQL_SERVER_INSTALL_TYPE}</div>}
            >
                <AccordionCardContent>
                    <Typography>
                        <div className={styles.licenseText}>{GENERAL.LICENSE_TEXT}</div>
                        <Button
                            Component="button"
                            variant="link"
                            className={CommonStyles.buttonClass}
                            onClick={openCredentialTab}
                        >
                            {GENERAL.VIEW_THE_REQ}
                        </Button>
                        <div className={styles['radio-container']}>
                            <RadioButton
                                isChecked={licenseSelect === GENERAL.LICENSE_INCLUDED_AMI}
                                onChange={() => {
                                    setLicenseSelect(GENERAL.LICENSE_INCLUDED_AMI);
                                    dispatch(setSelectedLicenseType(GENERAL.LICENSE_INCLUDED_AMI));
                                    dispatch(setSelectedCustomAMI(null));
                                    dispatch(setIsWizardTouched(true));
                                }}
                                children={GENERAL.LICENSE_INCLUDED_AMI}
                                className=""
                            />
                            <RadioButton
                                isChecked={licenseSelect === GENERAL.USE_CUSTOM_AMI}
                                onChange={() => {
                                    setLicenseSelect(GENERAL.USE_CUSTOM_AMI);
                                    dispatch(setSelectedLicenseType(GENERAL.USE_CUSTOM_AMI));
                                    dispatch(setSelectedLicenseId(null));
                                    dispatch(setIsWizardTouched(true));
                                }}
                                children={GENERAL.USE_CUSTOM_AMI}
                                className=""
                                isDisabled
                            />
                        </div>
                        {licenseSelect === GENERAL.LICENSE_INCLUDED_AMI && (
                            <div className={styles.handleSelect}>
                                <SelectField
                                    label={GENERAL.LICENSE_ID}
                                    error={!isLicenseFilled ? GENERAL.ACTION_REQUIRED : ''}
                                    //@ts-ignore
                                    isErrorPrefixHidden
                                    customErrorWarningIcon={
                                        <WarningIcon
                                            //@ts-ignore
                                            style={{
                                                width: '16px',
                                                height: '16px',
                                                //@ts-ignore
                                                '--icon-primary-color': 'var(--error'
                                            }}
                                        />
                                    }
                                    placeholder={GENERAL.SELECT_AMI_ID}
                                    isClearable={false}
                                    defaultValue={defaultValeLicense}
                                    value={defaultValeLicense}
                                    onChange={(selectedOptions: any): void => {
                                        dispatch(setSelectedLicenseId(selectedOptions));
                                        dispatch(setIsWizardTouched(true));
                                    }}
                                    isSearchable={generateAMIIdForLicense.length > 5}
                                    variant="two-lines"
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
                                    defaultValue={selectedCustomAMI}
                                    onChange={(selectedOptions: any): void => {
                                        dispatch(setSelectedCustomAMI(selectedOptions));
                                        dispatch(setIsWizardTouched(true));
                                    }}
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
