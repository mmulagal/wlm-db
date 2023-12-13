import {
    AccordionCard,
    AccordionCardContent,
    Typography,
    Button,
    SelectField,
    useAccordionContext
} from '@netapp/design-system';
import { useEffect, useMemo, useState } from 'react';
import { optionType } from '@netapp/design-system/dist/components/Select';
import { useDispatch } from 'react-redux';

import { dbPassVal, fsxPassVal, generateOptionType, openCredentialTab } from '../../../../utils/utilityFunctions';
import { GENERAL } from '../../../../utils/appConstants';
import { ReactComponent as Bullet } from '../../../../assets/ic_bullet.svg';
import { useAppSelector } from '../../../../store/storeHooks';
import { setSelectedCredentials } from '../../../../store/mssql/mssqlFormSlice';
import { setCreatePressed } from '../../../../store/mssql/msSqlActionSlice';
import { CREDENTIAL_PROD_LINK, CREDENTIAL_STAGE_LINK, PRODUCTION } from '../../../../utils/consts';

import styles from './AwsAccount.module.scss';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';

const AwsAccount = () => {
    const accordionContext = useAccordionContext()?.setOpenChildren!;
    const dispatch = useDispatch();

    //Getting the Data from state
    const { credentialData, credentialLoading } = useAppSelector(state => state.mssql.getCredentials);
    const { selectedCredential } = useAppSelector(state => state.mssqlForm.awsAccount);
    const isWorkloadFactoryStatus = useAppSelector(state => state.auth.isWorkloadFactory);

    // To check whether account present or not
    const [noAccount, setNoAccount] = useState(true);

    // To set noAccount flag is present or not
    useEffect(() => {
        if (credentialData && credentialData.length > 0) {
            setNoAccount(false);
            accordionContext({
                1: false
            });
        } else if (!credentialData) {
            accordionContext({
                1: true
            });
        }
    }, [credentialData]);

    //Code to open the Accordion
    const isVPCNotFilled = useAppSelector(state => state.msSqlAction.vpcSelected);
    const isAZNotFilled = useAppSelector(state => state.msSqlAction.availabilityZoneSelected);
    const isCreatePresed = useAppSelector(state => state.msSqlAction.isCreatePressed);
    const isDBCredPassword = useAppSelector(state => state.msSqlAction.dbCredentialPasswordSelected);
    const isActiveDirectoryFilled = useAppSelector(state => state.msSqlAction.activeDirectorySelected);
    const isFsxNNameFilled = useAppSelector(state => state.mssqlForm.fsxN.fsxNPassword);
    const isProperDBName = useAppSelector(state => state.msSqlAction.dbNameSelected);
    const dbCredPassword = useAppSelector(state => state.mssqlForm.dbCredentials?.password);
    const fsxCredPassword = useAppSelector(state => state.mssqlForm.fsxN?.fsxNPassword);
    const licenseIdSelectedCheck = useAppSelector(state => state.msSqlAction.licenseIdSelected);

    useEffect(() => {
        const dbPasswordValPass = !dbPassVal(dbCredPassword) ? true : false;
        const fsxPasswordValPass = !fsxPassVal(fsxCredPassword) ? true : false;
        if (
            isCreatePresed &&
            (!isVPCNotFilled ||
                !isAZNotFilled ||
                !isDBCredPassword ||
                !dbPasswordValPass ||
                !isActiveDirectoryFilled ||
                !isFsxNNameFilled ||
                !fsxPasswordValPass ||
                !licenseIdSelectedCheck ||
                !isProperDBName)
        ) {
            accordionContext({
                2: !isVPCNotFilled ? true : false,
                3: !isAZNotFilled ? true : false,
                11: !isDBCredPassword || !dbPasswordValPass ? true : false,
                13: !isActiveDirectoryFilled ? true : false,
                15: !isFsxNNameFilled || !fsxPasswordValPass ? true : false,
                9: !licenseIdSelectedCheck ? true : false,
                10: !isProperDBName ? true : false
            });
            dispatch(setCreatePressed(false));
        }
    }, [
        dispatch,
        accordionContext,
        isVPCNotFilled,
        isCreatePresed,
        isDBCredPassword,
        isAZNotFilled,
        isActiveDirectoryFilled,
        isFsxNNameFilled,
        isProperDBName,
        dbCredPassword,
        fsxCredPassword,
        licenseIdSelectedCheck
    ]);

    //Function to generate the options for Select Field
    const generateAWSAccounts = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        credentialData?.map((val, idx: number) => {
            const credValue = val.name + ' | Account: ' + val.providerAccountId;
            const option = generateOptionType(credValue, credValue, '', false, '', val);
            options.push(option);
        });
        return options;
    }, [credentialData]);

    // Update selected region in form data store
    useEffect(() => {
        if (!selectedCredential) {
            dispatch(setSelectedCredentials(generateAWSAccounts[0]));
        }
    }, [dispatch, generateAWSAccounts, selectedCredential]);

    //Set the Header text here
    const setHeader = () => {
        if (noAccount) {
            return <Typography variant="Regular_14">{GENERAL.NO_CREDENTIALS}</Typography>;
        } else {
            return <Typography variant="Regular_14">{selectedCredential?.value}</Typography>;
        }
    };

    return (
        <div className={styles['aws-account']}>
            <AccordionCard
                isLoading={credentialLoading}
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="1"
                title={<div className={CommonStyles.title}>{GENERAL.AWS_CREDENTIALS}</div>}
            >
                <AccordionCardContent>
                    <Typography>
                        {noAccount ? (
                            <div className={styles['aws-account-content']}>
                                <div className={styles['default-sub-text']}>{GENERAL.DEFAULT_AWS_ACCOUNT_SUB_TEXT}</div>

                                <Typography variant="Regular_14" className={styles.steps}>
                                    <span className={styles.bold}>{GENERAL.STEP_ONE}</span> {GENERAL.NAVIGATE_TO}{' '}
                                    <span>
                                        <Button Component="button" onClick={openCredentialTab} variant="text">
                                            {GENERAL.CREDENTIALS}
                                        </Button>
                                    </span>
                                </Typography>
                                <Typography variant="Regular_14" className={styles.steps}>
                                    <span className={styles.bold}>{GENERAL.STEP_TWO}</span> {GENERAL.STEP_TWO_TEXT}
                                </Typography>

                                <Typography variant="Regular_14" className={styles.list}>
                                    <div className={styles.listItem}>
                                        <Bullet />
                                        <Typography variant="Regular_14" className={styles.textWidth}>
                                            {GENERAL.OPTION_ONE}
                                        </Typography>
                                    </div>
                                    <div className={styles.listItem}>
                                        <Bullet />
                                        <Typography variant="Regular_14" className={styles.textWidth}>
                                            {isWorkloadFactoryStatus ? GENERAL.OPTION_TWO_WF : GENERAL.OPTION_TWO}
                                        </Typography>
                                    </div>
                                </Typography>

                                {/* <Typography variant="Regular_14" className={styles.info}>
                                    {GENERAL.FOR_MORE_INFO}{' '}
                                    <span>
                                        <Button Component="button" variant="link" className={CommonStyles.buttonClass}>
                                            {GENERAL.REQUIRED_PERMISSION_LINK}
                                        </Button>
                                    </span>
                                </Typography> */}
                            </div>
                        ) : (
                            <div className={styles['aws-account-content']}>
                                {isWorkloadFactoryStatus && (
                                    <div className={styles['sub-text']}>{GENERAL.AWS_ACCOUNT_SUB_TEXT_WF}</div>
                                )}
                                {!isWorkloadFactoryStatus && (
                                    <div className={styles['sub-text']}>{GENERAL.AWS_ACCOUNT_SUB_TEXT}</div>
                                )}
                                {/* <Typography variant="Regular_14" className={styles.buttonStyle}>
                                    {GENERAL.FOR_MORE_INFO}{' '}
                                    <span>
                                        <Button Component="button" variant="link" className={CommonStyles.buttonClass}>
                                            {GENERAL.REQUIRED_PERMISSION_LINK_ACCOUNTS}
                                        </Button>
                                    </span>
                                </Typography> */}

                                <div className={styles.selectField}>
                                    <SelectField
                                        label={GENERAL.CREDENTIAL_WITHOUT_DOT}
                                        isClearable={false}
                                        defaultValue={
                                            selectedCredential ? [selectedCredential] : [generateAWSAccounts[0]]
                                        }
                                        onChange={(selectedOptions: any): void => {
                                            dispatch(setSelectedCredentials(selectedOptions));
                                        }}
                                        isSearchable={generateAWSAccounts.length > 5}
                                        options={generateAWSAccounts}
                                    />
                                </div>
                                <div className={styles.bottomText}>
                                    {GENERAL.ADD_NEW_CREDENTIALS}{' '}
                                    <Button Component="button" onClick={openCredentialTab} variant="text">
                                        {GENERAL.CREDENTIAL}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </Typography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default AwsAccount;
