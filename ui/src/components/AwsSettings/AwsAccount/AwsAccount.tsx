import { AccordionCard, AccordionCardContent, Typography, Button, SelectField } from '@netapp/design-system';
import { useEffect, useMemo, useState } from 'react';
import { generateOptionType } from '../../../utils/utilityFunctions';
import { GENERAL } from '../../../utils/appConstants';
import { optionType } from '@netapp/design-system/dist/components/Select';
import styles from './AwsAccount.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { useAppDispatch, useAppSelector } from '../../../store/storeHooks';
import { setSelectedCredentials } from '../../../store/mssql/mssqlFormSlice';

const AwsAccount = () => {
    const dispatch = useAppDispatch();
    
    const {credentialData, credentialLoading} = useAppSelector((state) => state.mssql.getCredentials);
    const {selectedCredential} = useAppSelector((state) => state.mssqlForm.awsAccount);

    const [noAccount, setNoAccount] = useState(true);
    const [selectedOption, setSelectedOption] = useState({});
    
    useEffect(() => {
        if(credentialData && credentialData.length > 0){
            setNoAccount(false)
        }else{
            setNoAccount(true)
        }
    }, [credentialData]);

    //Function to generate the options for Select Field
    const generateAWSAccounts = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        credentialData?.map((val, idx: number) => {
            const credValue = val.name + " | Account: " + val.providerAccountId;
            const option = generateOptionType(credValue, credValue, '', false, '', val);
            options.push(option);
        });
        setSelectedOption(options[0]);
        return options;
    }, [credentialData]);

    useEffect(()=> {
        dispatch(setSelectedCredentials(selectedOption));
    }, [dispatch, selectedOption]);

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
            <AccordionCard isLoading={credentialLoading}
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
                                        defaultValue={selectedCredential? [selectedCredential] : [generateAWSAccounts[0]]}
                                        onChange={(selectedOptions: any): void => {
                                            setSelectedOption(selectedOptions);
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
