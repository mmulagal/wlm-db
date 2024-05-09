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

    const [defaultCustomAMILicense, selectedDefaultCustomAMILicense] = useState(selectedCustomAMI);
    const isLoadConfig = useAppSelector(state => state.msSqlAction.isLoadConfig);
    const { movingFromChatbot } = useAppSelector(state => state.chatbot);

    const isLicenseFilled = useAppSelector(state => state.msSqlAction.licenseIdSelected);
    const [licenseSelect, setLicenseSelect] = useState(licenseType);

    // Custom AMI list will be blank for as it is not supported in phase 1
    const customAmiId: any[] = [];

    const data = {
        amis: [
            {
                name: 'Windows_Server-2022-English-Full-SQL_2019_Enterprise-2023.04.12',
                description:
                    'Microsoft Windows Server 2022 Full Locale English with SQL Enterprise 2019 AMI provided by Amazon',
                architecture: 'x86_64',
                imageId: 'ami-0e453a02608af08a9',
                imageLocation: 'amazon/Windows_Server-2022-English-Full-SQL_2019_Enterprise-2023.04.12',
                public: true,
                platform: 'windows',
                platformDetails: 'Windows with SQL Server Enterprise',
                state: 'available',
                hypervisor: 'xen'
            },
            {
                name: 'Windows_Server-2022-English-Full-SQL_2017_Standard-2023.05.10',
                description:
                    'Microsoft Windows Server 2022 Full Locale English with SQL Standard 2017 AMI provided by Amazon',
                architecture: 'x86_64',
                imageId: 'ami-08e92ddb6cc3268e2',
                imageLocation: 'amazon/Windows_Server-2022-English-Full-SQL_2017_Standard-2023.05.10',
                public: true,
                platform: 'windows',
                platformDetails: 'Windows with SQL Server Standard',
                state: 'available',
                hypervisor: 'xen'
            }
        ]
    };

    useEffect(() => {
        if (selectedLicenseId) {
            const newValLicense = {
                ...selectedLicenseId,
                label: `${selectedLicenseId?.label} | ${selectedLicenseId?.label2}`
            };
            selectedDefaultValue(newValLicense);
        } else {
            selectedDefaultValue(null);
        }
    }, [selectedLicenseId]);

    useEffect(() => {
        if (selectedCustomAMI) {
            const newValLicense = {
                ...selectedCustomAMI,
                label: `${selectedCustomAMI?.label} | ${selectedCustomAMI?.label2}`
            };
            selectedDefaultCustomAMILicense(newValLicense);
        } else {
            selectedDefaultCustomAMILicense(null);
        }
    }, [selectedCustomAMI]);

    //Function to generate the options for Select Field
    const generateAMIId = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        data?.amis?.map((val, idx: number) => {
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

    useEffect(() => {
        if (!isLoadConfig && !movingFromChatbot) {
            dispatch(setSelectedCustomAMI(generateAMIIdForLicense[0]));
        }
    }, [dispatch, generateAMIId]);

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
                <Typography variant="Regular_14" className={CommonStyles.setHeaderStyle}>
                    {licenseSelect}
                </Typography>
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
                                    defaultValue={defaultCustomAMILicense}
                                    onChange={(selectedOptions: any): void => {
                                        dispatch(setSelectedCustomAMI(selectedOptions));
                                        dispatch(setIsWizardTouched(true));
                                    }}
                                    variant="two-lines"
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
