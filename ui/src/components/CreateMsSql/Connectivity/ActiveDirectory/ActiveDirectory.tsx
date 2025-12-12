import { useEffect, useMemo, useState, useRef } from 'react';
import { AccordionCard, AccordionCardContent, PasswordField, TextField, Typography } from '@netapp/design-system';
import { optionType, SelectField } from '@netapp/design-system/dist/components/Select';
import { ReactComponent as WarningIcon } from '@netapp/icons/ic_notice_triangle.svg';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import ActionRequired from '../../../../common/ActionRequired/ActionRequired';
import AccordionError from '../../../../common/AccordionError/AccordionError';
import { GENERAL, SELECT_CONFIG } from '../../../../utils/appConstants';
import styles from './ActiveDirectory.module.scss';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import { adPassVal, generateOptionType, sortListOfDict, isValidOUPath } from '../../../../utils/utilityFunctions';
import { useAppSelector } from '../../../../store/storeHooks';
import {
    setSelectedADDomainAddress,
    setSelectedADDomainName,
    setSelectedADPassword,
    setSelectedADScenarioType,
    setSelectedADUserName,
    setActiveDirectoryFields,
    resetADAdvancedFields
} from '../../../../store/mssql/mssqlFormSlice';
import { AWS_MANAGED_AD, USER_MANAGED_AD } from '../../../../utils/consts';
import { setIsWizardTouched } from '../../../../store/chatbot/chatbotSlice';
import { setOUPathValue } from '../../../../store/mssql/msSqlActionSlice';

const delay = () =>
    new Promise(resolve => {
        setTimeout(() => {
            resolve('');
        }, 2000);
    });

const ActiveDirectory = () => {
    const dispatch = useDispatch();
    const { t } = useTranslation();

    const { adsData, adsLoading } = useAppSelector(state => state.mssql.getAdsList);
    const { credentialData } = useAppSelector(state => state.mssql.getCredentials);

    const selectedADDomainName = useAppSelector(state => state.mssqlForm.activeDirectory.domainName);
    const selectedADDomainAddress = useAppSelector(state => state.mssqlForm.activeDirectory.domainAddress);
    const selectedVPCData = useAppSelector(state => state.mssqlForm.regionAndVpc.selectedVPC);

    const isADNotFilled = useAppSelector(state => state.msSqlAction.activeDirectorySelected);
    const isCreateHit = useAppSelector(state => state.msSqlAction.isCreateHit);
    const isOUPathValid = useAppSelector(state => state.msSqlAction.ouPathValid);

    const isLoadConfig = useAppSelector(state => state.msSqlAction.isLoadConfig);
    const { movingFromChatbot } = useAppSelector(state => state.chatbot);

    const userName = useAppSelector(state => state.mssqlForm.activeDirectory.userName);
    const password = useAppSelector(state => state.mssqlForm.activeDirectory.password);
    const preferredDC = useAppSelector(state => state.mssqlForm.activeDirectory.preferredDomainController);
    const preferredOUPath = useAppSelector(state => state.mssqlForm.activeDirectory.preferredOUPath);
    const targetADGroup = useAppSelector(state => state.mssqlForm.activeDirectory.targetADGroup);
    const useManagedServiceAccount = useAppSelector(state => state.mssqlForm.activeDirectory.useManagedServiceAccount);
    const selectConfig = useAppSelector(state => state.mssqlForm.selectConfig);

    // Refs
    const domainNameRef = useRef(null);
    const DNSAddressRef = useRef(null);
    const userNameRef = useRef(null);
    const passwordRefAD = useRef(null);
    const ouPathRef = useRef<HTMLInputElement>(null);

    const [versions, setVersions] = useState<
        {
            securityGroupId: string;
            domainName: string;
            dnsIpAddress: string;
            adScenarioType: string;
        }[]
    >([]);
    const [isCreating, setIsCreating] = useState(false);

    const addNewOption = async (option: any) => {
        setIsCreating(true);
        const newVer = [
            ...versions,
            { domainName: option, dnsIpAddress: '', securityGroupId: '', adScenarioType: USER_MANAGED_AD }
        ];
        setVersions(sortListOfDict(newVer, 'domainName'));
        await delay();
        dispatch(setSelectedADDomainAddress(''));
        dispatch(setSelectedADScenarioType(USER_MANAGED_AD));
        dispatch(setIsWizardTouched(true));
        setIsCreating(false);

        return generateOptionType(option, option, '', false, '');
    };

    // Initial versions list
    useEffect(() => {
        const verList: any[] = [];
        adsData?.directories?.map((val, ids: number) => {
            const adState = val?.status;
            if (adState && adState === 'Active') {
                const newItem = {
                    domainName: val?.domainName,
                    dnsIpAddress: val?.dnsIpAddress,
                    securityGroupId: val?.vpcSettings?.securityGroupId,
                    adScenarioType: AWS_MANAGED_AD
                };
                verList.push(newItem);
            }
        });
        setVersions(sortListOfDict(verList, 'domainName'));
    }, [adsData]);

    // Function to generate the options for Select Field
    const generateActiveDirectories = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        versions?.map((val, idx: number) => {
            const verVal = val?.domainName;
            const data = {
                domainName: val?.domainName,
                dnsIpAddress: (val?.dnsIpAddress || '').toString(),
                securityGroupId: val?.securityGroupId,
                adScenarioType: val?.adScenarioType
            };
            const option = generateOptionType(verVal, verVal, '', false, '', data);
            options.push(option);
        });
        return options;
    }, [versions]);

    useEffect(() => {
        if (!isLoadConfig && !movingFromChatbot) {
            dispatch(setSelectedADDomainName(null));
            dispatch(setSelectedADDomainAddress(''));
            dispatch(setSelectedADScenarioType(''));
            dispatch(setSelectedADUserName(''));
            dispatch(setSelectedADPassword(''));
            dispatch(resetADAdvancedFields());
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [generateActiveDirectories]);

    // Refs to highlight required field
    useEffect(() => {
        if (isCreateHit) {
            if (!isADNotFilled && !selectedADDomainName) {
                setTimeout(() => {
                    // @ts-ignore
                    domainNameRef?.current?.focus();
                }, 50);
            }

            if (!isADNotFilled && !selectedADDomainAddress) {
                setTimeout(() => {
                    // @ts-ignore
                    DNSAddressRef?.current?.focus();
                }, 40);
            }

            if (!isADNotFilled && !userName) {
                setTimeout(() => {
                    // @ts-ignore
                    userName?.current?.focus();
                }, 30);
            }
            if (!isADNotFilled && !password) {
                setTimeout(() => {
                    // @ts-ignore
                    passwordRefAD?.current?.focus();
                }, 20);
            }
        }
    }, [
        isADNotFilled,
        selectedADDomainName,
        selectedADDomainAddress,
        userName,
        password,
        useManagedServiceAccount,
        isCreateHit
    ]);

    useEffect(() => {
        if (!isOUPathValid && isCreateHit) {
            setTimeout(() => {
                ouPathRef?.current?.focus();
            }, 60);
        }
    }, [isOUPathValid, isCreateHit]);

    // Set the Header text here
    const setHeader = () => {
        if (!credentialData || (credentialData && !credentialData.length)) {
            return (
                <Typography variant="Regular_14" className={CommonStyles['text-disabled']}>
                    {GENERAL.SELECT_ANY_ACCOUNT}
                </Typography>
            );
        }
        if (!selectedVPCData) {
            return <ActionRequired disabled />;
        }

        // Check for validation errors first (even if fields are filled)
        const passwordError = password && adPassVal(password);
        const ouPathError = isValidOUPath(preferredOUPath, t);

        if (passwordError || ouPathError) {
            return <AccordionError />;
        }

        // Check for required fields
        if (!selectedADDomainName?.label || !selectedADDomainAddress || !userName || !password) {
            return <ActionRequired error={!isADNotFilled} />;
        }
        return (
            <Typography variant="Regular_14" className={CommonStyles.setHeaderStyle}>
                <div>{selectedADDomainName?.label}</div>
                <div className={CommonStyles.separator} />
                <div>{selectedADDomainAddress}</div>
                <div className={CommonStyles.separator} />
                <div>{userName}</div>
            </Typography>
        );
    };
    return (
        <div className={styles.active}>
            <AccordionCard
                isLoading={adsLoading}
                isDisabled={!credentialData || (credentialData && !credentialData.length) || !selectedVPCData}
                isExpandDisabled={!credentialData || (credentialData && !credentialData.length) || !selectedVPCData}
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="13"
                title={<div className={CommonStyles.title}>{GENERAL.ACTIVE_DIRECTORY}</div>}
            >
                <AccordionCardContent>
                    <Typography>
                        <Typography variant="Regular_14" className={styles.adText}>
                            {GENERAL.AD_TEXT}
                        </Typography>
                        <div className={styles.firstContainer}>
                            <SelectField
                                label={GENERAL.DOMAIN_NAME}
                                ref={domainNameRef}
                                isClearable={false}
                                isCreatingOption={isCreating}
                                isOptionsAddingEnabled
                                // @ts-ignore
                                onCreateOption={addNewOption}
                                defaultValue={selectedADDomainName || null}
                                onChange={(selectedOptions: any): void => {
                                    dispatch(setSelectedADDomainName(selectedOptions));
                                    dispatch(setSelectedADDomainAddress(selectedOptions?.data?.dnsIpAddress));
                                    dispatch(
                                        setSelectedADScenarioType(
                                            selectedOptions?.data?.adScenarioType || USER_MANAGED_AD
                                        )
                                    );
                                    dispatch(setIsWizardTouched(true));
                                }}
                                placeholder="example.com"
                                isSearchable
                                options={generateActiveDirectories}
                                className={styles.textField}
                                error={!isADNotFilled && !selectedADDomainName ? GENERAL.ACTION_REQUIRED : ''}
                                // @ts-ignore
                                isErrorPrefixHidden
                                customErrorWarningIcon={
                                    <WarningIcon
                                        style={{
                                            width: '16px',
                                            height: '16px',
                                            // @ts-ignore
                                            '--icon-primary-color': 'var(--error'
                                        }}
                                    />
                                }
                            />

                            <TextField
                                label={GENERAL.DNS_ADDRESS}
                                placeholder="DNS IP addresses"
                                ref={DNSAddressRef}
                                error={!isADNotFilled && !selectedADDomainAddress ? GENERAL.ACTION_REQUIRED : ''}
                                // @ts-ignore
                                isErrorPrefixHidden
                                customErrorWarningIcon={
                                    <WarningIcon
                                        style={{
                                            width: '16px',
                                            height: '16px',
                                            // @ts-ignore
                                            '--icon-primary-color': 'var(--error'
                                        }}
                                    />
                                }
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    const inputVal = e.target.value.replace(/[^0-9.,]/g, '');
                                    dispatch(setSelectedADDomainAddress(inputVal));
                                    dispatch(setIsWizardTouched(true));
                                }}
                                value={selectedADDomainAddress || ''}
                                className={styles.textField}
                            />
                        </div>
                        <div className={styles.secondContainer}>
                            <TextField
                                label={GENERAL.USER_NAME}
                                placeholder="Username"
                                error={!isADNotFilled && !userName ? GENERAL.ACTION_REQUIRED : ''}
                                ref={userNameRef}
                                // @ts-ignore
                                isErrorPrefixHidden
                                customErrorWarningIcon={
                                    <WarningIcon
                                        style={{
                                            width: '16px',
                                            height: '16px',
                                            // @ts-ignore
                                            '--icon-primary-color': 'var(--error'
                                        }}
                                    />
                                }
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    dispatch(setSelectedADUserName(e.target.value));
                                    dispatch(setIsWizardTouched(true));
                                }}
                                value={userName}
                                className={styles.textField}
                            />
                            <PasswordField
                                label={GENERAL.PASSWORD}
                                ref={passwordRefAD}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    dispatch(setSelectedADPassword(e.target.value));
                                    dispatch(setIsWizardTouched(true));
                                }}
                                error={!isADNotFilled && !password ? GENERAL.ACTION_REQUIRED : adPassVal(password)}
                                // @ts-ignore
                                isErrorPrefixHidden
                                customErrorWarningIcon={
                                    <WarningIcon
                                        style={{
                                            width: '16px',
                                            height: '16px',
                                            // @ts-ignore
                                            '--icon-primary-color': 'var(--error'
                                        }}
                                    />
                                }
                                value={password}
                                className={styles.textFieldPassword}
                            />
                        </div>

                        {selectConfig === SELECT_CONFIG.STANDARD_CREATE && (
                            <>
                                <div className={styles.optionalFieldsContainer}>
                                    <TextField
                                        label={t('databases.general.preferred-domain-controller')}
                                        isOptional
                                        info={t('databases.general.preferred-domain-controller-tooltip')}
                                        placeholder=""
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                            dispatch(
                                                setActiveDirectoryFields({
                                                    preferredDomainController: e.target.value
                                                })
                                            );
                                            dispatch(setIsWizardTouched(true));
                                        }}
                                        value={preferredDC}
                                        className={styles.textField}
                                    />
                                    <TextField
                                        label={t('databases.general.preferred-ou-path')}
                                        isOptional
                                        info={t('databases.general.preferred-ou-path-tooltip')}
                                        placeholder=""
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                            dispatch(setActiveDirectoryFields({ preferredOUPath: e.target.value }));
                                            dispatch(setIsWizardTouched(true));
                                            dispatch(setOUPathValue(true));
                                        }}
                                        value={preferredOUPath}
                                        error={isValidOUPath(preferredOUPath, t)}
                                        className={styles.textField}
                                        ref={ouPathRef}
                                    />
                                </div>
                                <div className={styles.thirdFieldContainer}>
                                    <TextField
                                        label={t('databases.general.target-ad-group')}
                                        isOptional
                                        info={t('databases.general.target-ad-group-tooltip')}
                                        placeholder=""
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                            dispatch(setActiveDirectoryFields({ targetADGroup: e.target.value }));
                                            dispatch(setIsWizardTouched(true));
                                        }}
                                        value={targetADGroup}
                                        className={styles.textField}
                                    />
                                </div>
                            </>
                        )}
                    </Typography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default ActiveDirectory;
