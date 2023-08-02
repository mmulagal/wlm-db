import {
    AccordionCard,
    AccordionCardContent,
    Typography,
    Button,
    SelectField,
    useAccordionContext
} from '@netapp/design-system';
import { useEffect, useMemo, useState } from 'react';
import { generateOptionType } from '../../../utils/utilityFunctions';
import { GENERAL } from '../../../utils/appConstants';
import { optionType } from '@netapp/design-system/dist/components/Select';
import styles from './AwsAccount.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { useAppSelector } from '../../../store/storeHooks';
import { setSelectedCredentials } from '../../../store/mssql/mssqlFormSlice';
import { useDispatch } from 'react-redux';
import { setCreatePressed } from '../../../store/mssql/msSqlActionSlice';

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
        } else if (credentialData && credentialData.length === 0) {
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
    const isProperDBName = useAppSelector(state => state.msSqlAction.fsxNNameSelected);

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
        isProperDBName,
        noAccount
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
                                <ul>
                                    <li>
                                        {GENERAL.GO_TO_THE}{' '}
                                        <span>
                                            <Button
                                                Component="button"
                                                onClick={function noRefCheck() {}}
                                                variant="text"
                                            >
                                                {GENERAL.CREDENTIALS}
                                            </Button>
                                        </span>
                                        &nbsp; {GENERAL.AWS_DEFAULT_LIST_FIRST}
                                    </li>
                                    <li>{GENERAL.AWS_ACCOUNT_DEFAULT_LIST_TWO}</li>
                                </ul>
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
                                    <Button Component="button" onClick={function noRefCheck() {}} variant="text">
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
