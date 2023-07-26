import { Button, SelectField } from '@netapp/design-system';
import { useMemo } from 'react';
import { GENERAL } from '../../../../utils/appConstants';
import { optionType } from '@netapp/design-system/dist/components/Select';
import styles from './AWSAccountContent.module.scss';
import { generateOptionType } from '../../../../utils/utilityFunctions';
import { useAppSelector } from '../../../../store/storeHooks';

const AWSAccountContent = () => {

    const {credentialData} = useAppSelector((state) => state.mssql.getCredentials);

    //Mock data to be removed later
    const accountType: string = 'accounts';
    const awsAccounts = credentialData;
    // const awsAccounts = ['FSxCredentials | Account ID: 123456', 'FSxCredentials | Account ID: 543211'];

    //Function to generate the options for Select Field
    const generateAWSAccounts = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        awsAccounts?.map((val, idx: number) => {
            const credId = val.credentialsId;
            const option = generateOptionType(credId, credId, '', false, '');
            options.push(option);
        });
        return options;
    }, []);
    return accountType === 'No accounts' ? (
        <div className={styles['aws-account-content']}>
            <div className={styles['default-sub-text']}>{GENERAL.DEFAULT_AWS_ACCOUNT_SUB_TEXT}</div>
            <ul>
                <li>
                    {GENERAL.GO_TO_THE}{' '}
                    <span>
                        <Button Component="button" onClick={function noRefCheck() {}} variant="text">
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
                        console.log(selectedOptions);
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
    );
};

export default AWSAccountContent;
