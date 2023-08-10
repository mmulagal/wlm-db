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

import { generateOptionType } from '../../../utils/utilityFunctions';
import { GENERAL } from '../../../utils/appConstants';
import { ReactComponent as Bullet } from '../../../assets/ic_bullet.svg';
import { useAppSelector } from '../../../store/storeHooks';
import { setSelectedCredentials } from '../../../store/mssql/mssqlFormSlice';
import { setCreatePressed } from '../../../store/mssql/msSqlActionSlice';
import { CREDENTIAL_PROD_LINK, CREDENTIAL_STAGE_LINK, PRODUCTION } from '../../../utils/consts';

import styles from './AwsAccount.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';

const AwsAccount = () => {
    const accordionContext = useAccordionContext()?.setOpenChildren!;
    const dispatch = useDispatch();

    //Getting the Data from state
    const { credentialData, credentialLoading } = useAppSelector(state => state.mssql.getCredentials);
    const { selectedCredential } = useAppSelector(state => state.mssqlForm.awsAccount);

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
    const isFsxNNameFilled = useAppSelector(state => state.msSqlAction.fsxNNameSelected);
    const isProperDBName = useAppSelector(state => state.msSqlAction.dbNameSelected);

    useEffect(() => {
        if (
            isCreatePresed &&
            (!isVPCNotFilled ||
                !isAZNotFilled ||
                !isDBCredPassword ||
                !isActiveDirectoryFilled ||
                !isFsxNNameFilled ||
                !isProperDBName)
        ) {
            accordionContext({
                2: !isVPCNotFilled ? true : false,
                3: !isAZNotFilled ? true : false,
                11: !isDBCredPassword ? true : false,
                13: !isActiveDirectoryFilled ? true : false,
                15: !isFsxNNameFilled ? true : false,
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
        isProperDBName
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
        dispatch(setSelectedCredentials(generateAWSAccounts[0]));
    }, [dispatch, generateAWSAccounts]);

    //Set the Header text here
    const setHeader = () => {
        if (noAccount) {
            return <Typography variant="Regular_14">No account</Typography>;
        } else {
            return <Typography variant="Regular_14">{selectedCredential?.value}</Typography>;
        }
    };

    // To open new tab with credential page on click of credential link
    const openCredentialTab = () => {
        const url = process.env.REACT_APP_ENVIRONMENT === PRODUCTION ? CREDENTIAL_PROD_LINK : CREDENTIAL_STAGE_LINK;
        window.open(url, '_blank', 'noopener');
    };

    return (
        <div className={styles['aws-account']}>
            <AccordionCard
                isLoading={credentialLoading}
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="1"
                title={<div className={CommonStyles.title}>AWS account</div>}
            >
                <AccordionCardContent>
                    <Typography>
                        {noAccount ? (
                            <div className={styles['aws-account-content']}>
                                <div className={styles['default-sub-text']}>{GENERAL.DEFAULT_AWS_ACCOUNT_SUB_TEXT}</div>
                                <Typography variant="Regular_14" className={styles.lineHeight}>
                                    {GENERAL.DEFAULT_AWS_ACCOUNT_SECOND_LINE}
                                </Typography>
                                <Typography variant="Regular_14" className={styles.thirdLine}>
                                    {GENERAL.DEFAULT_AWS_ACCOUNT_THIRD_LINE}
                                </Typography>
                                <Typography variant="Regular_14" className={styles.lineHeight}>
                                    <span className={styles.bold}>{GENERAL.STEP_ONE}</span> {GENERAL.NAVIGATE_TO}{' '}
                                    <span>
                                        <Button Component="button" onClick={openCredentialTab} variant="text">
                                            {GENERAL.CREDENTIALS}
                                        </Button>
                                    </span>{' '}
                                    {GENERAL.PAGE}
                                </Typography>
                                <Typography variant="Regular_14" className={styles.thirdLine}>
                                    <span className={styles.bold}>{GENERAL.STEP_TWO}</span> {GENERAL.STEP_TWO_TEXT}
                                </Typography>
                                <Typography variant="Regular_14" className={styles.lineHeight}>
                                    {GENERAL.OPTIONS_TEXT}
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
                                            {GENERAL.OPTION_TWO}
                                        </Typography>
                                    </div>
                                </Typography>

                                <Typography variant="Regular_14" className={styles.info}>
                                    {GENERAL.FOR_MORE_INFO}{' '}
                                    <span>
                                        <Button Component="button" variant="link">
                                            {GENERAL.MS_SQL_REQUIRED}
                                        </Button>
                                    </span>
                                </Typography>
                                <Typography variant="Regular_14" className={styles.noteText}>
                                    {GENERAL.NOTE_TEXT}
                                </Typography>
                            </div>
                        ) : (
                            <div className={styles['aws-account-content']}>
                                <div className={styles['sub-text']}>{GENERAL.AWS_ACCOUNT_SUB_TEXT}</div>
                                <Button Component="button" variant="link">
                                    {GENERAL.MS_SQL_REQUIRED}
                                </Button>
                                <div className={styles.selectField}>
                                    <SelectField
                                        label={GENERAL.CREDENTIALS}
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
                                        {GENERAL.CREDENTIALS}
                                    </Button>
                                    .
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
