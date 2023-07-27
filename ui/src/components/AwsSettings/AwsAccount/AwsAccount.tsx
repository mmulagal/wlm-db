import { AccordionCard, AccordionCardContent, Typography, Button, SelectField } from '@netapp/design-system';
import { useEffect, useMemo, useState } from 'react';
import { generateOptionType } from '../../../utils/utilityFunctions';
import { GENERAL } from '../../../utils/appConstants';
import { optionType } from '@netapp/design-system/dist/components/Select';
import styles from './AwsAccount.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { useAppSelector } from '../../../store/storeHooks';

const AwsAccount = () => {
    const {credentialData, credentialLoading} = useAppSelector((state) => state.mssql.getCredentials);

    //Mock data to be removed later
    const accountType: string = 'accounts';
    // const awsAccounts = ['FSxCredentials | Account ID: 123456', 'FSxCredentials | Account ID: 543211'];

    const [accountSelected, setAccountSelected] = useState('');

    //Function to generate the options for Select Field
    const generateAWSAccounts = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        credentialData?.map((val, idx: number) => {
            const credValue = val.name + " | Account: " + val.providerAccountId;
            const option = generateOptionType(credValue, credValue, '', false, '');
            options.push(option);
        });
        return options;
    }, [credentialData]);

    useEffect(() => {
        setAccountSelected(generateAWSAccounts[0]?.label);
    }, [generateAWSAccounts])

    //Set the Header text here
    const setHeader = () => {
        if (accountType === 'No accounts') {
            return <Typography variant="Regular_14">No account</Typography>;
        } else {
            return <Typography variant="Regular_14">{accountSelected}</Typography>;
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
                        {accountType === 'No accounts' ? (
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
                                        defaultValue={[generateAWSAccounts[0]]}
                                        onChange={(selectedOptions: any): void => {
                                            setAccountSelected(selectedOptions.label);
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
