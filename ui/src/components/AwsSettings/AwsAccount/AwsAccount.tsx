import { AccordionCard, AccordionCardContent, Typography } from '@netapp/design-system';
import styles from './AwsAccount.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import AWSAccountContent from './AWSAccountContent/AWSAccountContent';
import { useAppSelector } from '../../../store/storeHooks';

const AwsAccount = () => {

    const {credentialLoading} = useAppSelector((state) => state.mssql.getCredentials);

    //Set the Header text here
    const setHeader = () => {
        return 'No account';
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
                        <AWSAccountContent />
                    </Typography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default AwsAccount;
