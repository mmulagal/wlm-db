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
    setDBVersion,
    setSelectedCustomAMI,
    setSelectedDBEdition,
    setSelectedLicenseId,
    setSelectedLicenseType,
    setSelectedOperatingSystem
} from '../../../../store/mssql/mssqlFormSlice';
import {
    DB_EDITIONS,
    DB_VERSIONS,
    DB_VERSIONS_EXCLUDING_2016,
    DB_VERSIONS_EXCLUDING_2022,
    FORM_OPTIONS,
    LICENSE_URL,
    OS_VERSIONS_LIST
} from '../../../../utils/consts';
import { setIsWizardTouched } from '../../../../store/chatbot/chatbotSlice';

const License = () => {
    //Store related Data
    const dispatch = useDispatch();

    // This is to get license included AMI data
    const { amiData, amiLoading } = useAppSelector(state => state.mssql.getAmiList);
    const { customAmiData, customAmiLoading } = useAppSelector(state => state.mssql.getCustomAmiList);
    const { credentialData } = useAppSelector(state => state.mssql.getCredentials);
    const licenseType = useAppSelector(state => state.mssqlForm.license.selectedLicenseType);
    const selectedLicenseId = useAppSelector(state => state.mssqlForm.license.selectedLicenseId);
    const selectedCustomAMI = useAppSelector(state => state.mssqlForm.license.selectedCustomAMI);
    const [defaultValeLicense, selectedDefaultValue] = useState(selectedLicenseId);
    const [defaultCustomAMILicense, selectedDefaultCustomAMILicense] = useState(selectedCustomAMI);
    const isLoadConfig = useAppSelector(state => state.msSqlAction.isLoadConfig);
    const { movingFromChatbot } = useAppSelector(state => state.chatbot);
    const isLicenseFilled = useAppSelector(state => state.msSqlAction.licenseIdSelected);
    const { operatingSystem, dbVersion, dbEdition } = useAppSelector(state => state.mssqlForm);
    const [versionArray, setVersionArray] = useState(DB_VERSIONS);

    // Set OS versions
    useEffect(() => {
        if (!isLoadConfig && !movingFromChatbot) {
            dispatch(setSelectedOperatingSystem(OS_VERSIONS_LIST[0]));
        }
    }, []);

    // Set DB editions
    useEffect(() => {
        if (!isLoadConfig && !movingFromChatbot) {
            dispatch(setSelectedDBEdition(DB_EDITIONS[0]));
        }
    }, []);

    // Set DB versions
    useEffect(() => {
        if (operatingSystem?.value === '2022') {
            setVersionArray(DB_VERSIONS_EXCLUDING_2016);
        } else if (operatingSystem?.value === '2016') {
            setVersionArray(DB_VERSIONS_EXCLUDING_2022);
        } else {
            setVersionArray(DB_VERSIONS);
        }
    }, [operatingSystem]);

    //Function to generate the options for Select Field
    //@ts-ignore
    const generateDbVersions = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        versionArray?.map((val, idx: number) => {
            // If win 2016 is selected than dont show 2022 SQL server in dropdown list
            const option = generateOptionType(val.value, val.label, '', false, '');
            options.push(option);
        });
        return options;
    }, [versionArray]);

    useEffect(() => {
        if (!isLoadConfig && !movingFromChatbot) {
            dispatch(setDBVersion(generateDbVersions[0]));
        }
    }, [dispatch, generateDbVersions]);

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
    const generateCustomAMIId = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        customAmiData?.amis?.map((val, idx: number) => {
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
    }, [customAmiData]);

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
        if ((!isLoadConfig && !movingFromChatbot) || !selectedLicenseId) {
            dispatch(setSelectedLicenseId(generateAMIIdForLicense[0]));
        }
    }, [dispatch, generateAMIIdForLicense]);

    useEffect(() => {
        if ((!isLoadConfig && !movingFromChatbot) || !selectedCustomAMI) {
            dispatch(setSelectedCustomAMI(generateCustomAMIId[0]));
        }
    }, [dispatch, generateCustomAMIId]);

    //Set the Header text here
    const setHeader = () => {
        if (!credentialData || (credentialData && !credentialData.length)) {
            return (
                <Typography variant="Regular_14" className={CommonStyles['text-disabled']}>
                    {GENERAL.SELECT_ANY_ACCOUNT}
                </Typography>
            );
        }
        if (licenseType === FORM_OPTIONS.CUSTOM_AMI) {
            return <Typography variant="Regular_14">{GENERAL.CUSTOM_AMI}</Typography>;
        } else {
            return (
                <Typography variant="Regular_14" className={CommonStyles.setHeaderStyle}>
                    {GENERAL.LICENSE_INCLUDED_AMI}
                </Typography>
            );
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
                                id="select-license-ami"
                                isChecked={licenseType === FORM_OPTIONS.LICENSE_AMI}
                                onChange={() => {
                                    dispatch(setSelectedLicenseType(FORM_OPTIONS.LICENSE_AMI));
                                    dispatch(setIsWizardTouched(true));
                                }}
                                children={GENERAL.LICENSE_INCLUDED_AMI}
                                className=""
                            />
                            <RadioButton
                                id="select-custom-ami"
                                isChecked={licenseType === FORM_OPTIONS.CUSTOM_AMI}
                                onChange={() => {
                                    dispatch(setSelectedLicenseType(FORM_OPTIONS.CUSTOM_AMI));
                                    dispatch(setIsWizardTouched(true));
                                }}
                                children={GENERAL.USE_CUSTOM_AMI}
                                className=""
                            />
                        </div>
                        {licenseType === FORM_OPTIONS.LICENSE_AMI && (
                            <div>
                                <div className={styles.headings}>
                                    <Typography variant="Semibold_14">{GENERAL.FILTER_SQL_SERVER_AMI}</Typography>
                                    <div className={styles.filterVersions}>
                                        <div className={styles.selectVersion}>
                                            <SelectField
                                                label={GENERAL.OPERATING_SYSTEM}
                                                isClearable={false}
                                                value={operatingSystem}
                                                onChange={(selectedOptions: any): void => {
                                                    dispatch(setSelectedOperatingSystem(selectedOptions));
                                                    dispatch(setIsWizardTouched(true));
                                                }}
                                                isSearchable={OS_VERSIONS_LIST.length > 5}
                                                options={OS_VERSIONS_LIST}
                                            />
                                        </div>
                                        <div className={styles.selectVersion}>
                                            <SelectField
                                                label={GENERAL.DATABASE_EDITION}
                                                isClearable={false}
                                                value={dbEdition}
                                                onChange={(selectedOptions: any): void => {
                                                    dispatch(setSelectedDBEdition(selectedOptions));
                                                    dispatch(setIsWizardTouched(true));
                                                }}
                                                isSearchable={DB_EDITIONS.length > 5}
                                                options={DB_EDITIONS}
                                            />
                                        </div>
                                        <div className={styles.selectVersion}>
                                            <SelectField
                                                label={GENERAL.DATABASE_VERSION}
                                                isClearable={false}
                                                value={dbVersion ? [dbVersion] : [generateDbVersions[0]]}
                                                onChange={(selectedOptions: any): void => {
                                                    dispatch(setDBVersion(selectedOptions));
                                                    dispatch(setIsWizardTouched(true));
                                                }}
                                                isSearchable={generateDbVersions.length > 5}
                                                options={generateDbVersions}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className={styles.headings}>
                                    <Typography variant="Semibold_14">{GENERAL.SELECT_SQL_SERVER_AMI}</Typography>
                                    <div className={styles.handleSelect} title={defaultValeLicense?.label}>
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
                                            isLoading={amiLoading}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                        {licenseType === FORM_OPTIONS.CUSTOM_AMI && (
                            <div className={styles.headings}>
                                <Typography variant="Semibold_14">{GENERAL.SELECT_AMI_ID}</Typography>
                                <div className={styles.handleSelect} title={defaultCustomAMILicense?.label}>
                                    <SelectField
                                        label={GENERAL.AMI_ID}
                                        placeholder={GENERAL.SELECT_AMI_NAME}
                                        isClearable={false}
                                        defaultValue={defaultCustomAMILicense}
                                        value={defaultCustomAMILicense}
                                        onChange={(selectedOptions: any): void => {
                                            dispatch(setSelectedCustomAMI(selectedOptions));
                                            dispatch(setIsWizardTouched(true));
                                        }}
                                        variant="two-lines"
                                        isSearchable={generateCustomAMIId.length > 5}
                                        options={generateCustomAMIId}
                                        isLoading={customAmiLoading}
                                    />
                                </div>
                            </div>
                        )}
                    </Typography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default License;
