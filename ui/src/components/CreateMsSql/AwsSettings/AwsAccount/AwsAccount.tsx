import {
    AccordionCard,
    AccordionCardContent,
    Typography,
    Button,
    SelectField,
    useAccordionContext,
    useDialog
} from '@netapp/design-system';
import { useEffect, useMemo, useRef, useState } from 'react';
import { optionType } from '@netapp/design-system/dist/components/Select';
import { useDispatch } from 'react-redux';

import { dbPassVal, fsxPassVal, generateOptionType } from '../../../../utils/utilityFunctions';
import { GENERAL } from '../../../../utils/appConstants';
import { ReactComponent as Bullet } from '../../../../assets/ic_bullet.svg';
import { useAppSelector } from '../../../../store/storeHooks';
import { setSelectedCredentials } from '../../../../store/mssql/mssqlFormSlice';
import {
    setCreatePressed,
    setDeployRedirectToCfLink,
    setPermissionWarning
} from '../../../../store/mssql/msSqlActionSlice';
import { CREDENTIAL_PROD_LINK, CREDENTIAL_STAGE_LINK, PRODUCTION } from '../../../../utils/consts';

import styles from './AwsAccount.module.scss';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import DialogComponent from '../../../../common/Dialog/DialogComponent';
import ViewDialog from '../../../../common/ViewDialog/ViewDialog';
import { ReactComponent as ErrorIcon } from '../../../../assets/error-icon.svg';
import { setIsWizardTouched } from '../../../../store/chatbot/chatbotSlice';
import MissingPermissionsMsg from './MissingPermissionsMsg';
import { setHeaderSelectedCred } from '../../../../store/workloadFactory/headersSlice';

const AwsAccount = () => {
    const { setDialog } = useDialog();
    const accordionContext = useAccordionContext()?.setOpenChildren!;
    const dispatch = useDispatch();

    const noCredRef = useRef(null);
    const perWarningRef = useRef(null);

    //Getting the Data from state
    const { credentialData, credentialLoading } = useAppSelector(state => state.mssql.getCredentials);
    const { selectedCredential } = useAppSelector(state => state.mssqlForm.awsAccount);
    const isWorkloadFactoryStatus = useAppSelector(state => state.auth.isWorkloadFactory);
    const isCreateHit = useAppSelector(state => state.msSqlAction.isCreateHit);
    const permissionWarning = useAppSelector(state => state.msSqlAction.permissionWarning);
    const { policiesList } = useAppSelector(state => state.mssql.getPolicies);

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

    useEffect(() => {
        if (isCreateHit) {
            if (permissionWarning) {
                setTimeout(() => {
                    //@ts-ignore
                    perWarningRef?.current?.focus();
                }, 120);
            }
            if (noAccount) {
                setTimeout(() => {
                    //@ts-ignore
                    noCredRef?.current?.focus();
                }, 120);
            }
        }
    }, [permissionWarning, isCreateHit, noAccount]);

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
            (noAccount ||
                permissionWarning ||
                !isVPCNotFilled ||
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
                1: noAccount || permissionWarning ? true : false,
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
        licenseIdSelectedCheck,
        permissionWarning
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
        dispatch(setPermissionWarning(false));
        dispatch(setDeployRedirectToCfLink(null));
        if (!selectedCredential) {
            dispatch(setSelectedCredentials(generateAWSAccounts[0]));
        }
    }, [dispatch, generateAWSAccounts, selectedCredential]);

    useEffect(() => {
        const credValue = selectedCredential?.data?.name;
        const label2 = `Account ID: ${selectedCredential?.data?.providerAccountId}`;
        const option = generateOptionType(credValue, credValue, label2, false, '', selectedCredential?.data);
        dispatch(setHeaderSelectedCred(option));
    }, [selectedCredential]);

    //Set the Header text here
    const setHeader = () => {
        if (noAccount) {
            return <Typography variant="Regular_14">{GENERAL.NO_CREDENTIALS}</Typography>;
        } else {
            return <Typography variant="Regular_14">{selectedCredential?.value}</Typography>;
        }
    };

    // To open new tab with credential page on click of credential link
    const openCredentialTab = () => {
        let url;
        if (isWorkloadFactoryStatus) {
            url = process.env.REACT_APP_CREDENTIAL_WF_LINK;
        } else {
            url = process.env.REACT_APP_ENVIRONMENT === PRODUCTION ? CREDENTIAL_PROD_LINK : CREDENTIAL_STAGE_LINK;
        }
        return url;
        // window.open(url, '_blank', 'noopener');
    };

    const openDialog = (type: string) => {
        const data = JSON.stringify(type === 'view' ? policiesList?.view : policiesList?.operate, null, 2);
        setDialog(
            <DialogComponent
                header={type === 'view' ? GENERAL.REQUIRED_VIEW_PERMISSIONS : GENERAL.REQUIRED_OPERATE_PERMISSIONS}
                content={<ViewDialog data={data} />}
                primaryButton={GENERAL.CLOSE}
                callback={() => {}}
            />
        );
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
                            <div className={styles['noaccount']}>
                                <div className={styles['default-sub-text']}>{GENERAL.DEFAULT_AWS_ACCOUNT_SUB_TEXT}</div>
                                <div className={styles.noaccount_options}>
                                    <Typography variant="Semibold_14">{GENERAL.STEP_ONE}</Typography>
                                    <div>
                                        <Typography variant="Regular_14">
                                            {GENERAL.NAVIGATE_TO[0]}{' '}
                                            <span>
                                                <a
                                                    href={openCredentialTab()}
                                                    className={styles.openIntab}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    ref={noCredRef}
                                                >
                                                    {GENERAL.CREDENTIALS}
                                                </a>
                                            </span>{' '}
                                            {GENERAL.NAVIGATE_TO[1]}
                                        </Typography>
                                    </div>
                                </div>
                                <div className={styles.noaccount_options}>
                                    <Typography variant="Semibold_14">{GENERAL.STEP_TWO}</Typography>
                                    <div>
                                        <Typography variant="Regular_14">{GENERAL.STEP_TWO_TEXT[0]}</Typography>
                                        <Typography variant="Regular_14">{GENERAL.STEP_TWO_TEXT[1]}</Typography>
                                        <Button
                                            Component="button"
                                            onClick={() => openDialog('operate')}
                                            variant="text"
                                            className={CommonStyles.buttonClass}
                                        >
                                            {GENERAL.STEP_TWO_TEXT[2]}
                                        </Button>
                                    </div>
                                </div>
                                {noAccount && isCreateHit !== 0 && (
                                    <div className={styles.options}>
                                        <ErrorIcon className={styles.icon} />
                                        <div className={styles.noaccount_options}>
                                            <Typography variant="Semibold_14">{GENERAL.ERROR}</Typography>
                                            <Typography variant="Regular_14" className={styles.noteText}>
                                                {GENERAL.NO_CRED}
                                            </Typography>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className={styles['aws-account-content']}>
                                <div className={styles.listItem}>
                                    <Bullet />
                                    <Typography variant="Regular_14" className={styles.buttonStyle}>
                                        {isWorkloadFactoryStatus
                                            ? GENERAL.AWS_ACCOUNT_SUB_TEXT_WF_READ
                                            : GENERAL.AWS_ACCOUNT_SUB_TEXT_READ}{' '}
                                        <span>
                                            <Button
                                                Component="button"
                                                variant="text"
                                                onClick={() => openDialog('view')}
                                                className={CommonStyles.buttonClass}
                                            >
                                                {GENERAL.REQUIRED_PERMISSION_LINK_ACCOUNTS2}
                                            </Button>
                                        </span>
                                    </Typography>
                                </div>
                                <div className={styles.listItem}>
                                    <Bullet />
                                    <Typography variant="Regular_14" className={styles.buttonStyle}>
                                        {isWorkloadFactoryStatus
                                            ? GENERAL.AWS_ACCOUNT_SUB_TEXT_WF_AUTOMATE
                                            : GENERAL.AWS_ACCOUNT_SUB_TEXT_AUTOMATE}{' '}
                                        <span>
                                            <Button
                                                Component="button"
                                                variant="text"
                                                onClick={() => openDialog('operate')}
                                                className={CommonStyles.buttonClass}
                                            >
                                                {GENERAL.REQUIRED_PERMISSION_LINK_ACCOUNTS}
                                            </Button>
                                        </span>
                                    </Typography>
                                </div>
                                <div className={styles.selectField}>
                                    <SelectField
                                        ref={perWarningRef}
                                        label={GENERAL.CREDENTIAL_WITHOUT_DOT}
                                        isClearable={false}
                                        defaultValue={
                                            selectedCredential ? [selectedCredential] : [generateAWSAccounts[0]]
                                        }
                                        onChange={(selectedOptions: any): void => {
                                            dispatch(setIsWizardTouched(true));
                                            dispatch(setSelectedCredentials(selectedOptions));
                                        }}
                                        isSearchable={generateAWSAccounts.length > 5}
                                        options={generateAWSAccounts}
                                    />
                                </div>
                                <div className={styles.bottomText}>
                                    {GENERAL.ADD_NEW_CREDENTIALS}{' '}
                                    <a
                                        href={openCredentialTab()}
                                        className={styles.openIntab}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        {GENERAL.CREDENTIALS}.
                                    </a>
                                </div>
                                {permissionWarning && isCreateHit !== 0 && (
                                    <div className={styles.permissionError}>
                                        <ErrorIcon className={styles.icon} />
                                        <div className={styles.noaccount_options}>
                                            <Typography variant="Semibold_14">{GENERAL.ERROR}</Typography>
                                            <Typography variant="Regular_14" className={styles.noteText}>
                                                <MissingPermissionsMsg />
                                            </Typography>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </Typography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default AwsAccount;
