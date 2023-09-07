import { Typography } from '@netapp/design-system';
import { GENERAL } from '../../../utils/appConstants';
import { ReactComponent as CloudWatch } from '../../../assets/CloudWatch.svg';
import { ReactComponent as ProtectBackup } from '../../../assets/AWS Backup.svg';
import { ReactComponent as SageMaker } from '../../../assets/AWS SageMaker.svg';
import { ReactComponent as AD } from '../../../assets/Active Directory.svg';
import styles from './DatabaseAWSIntegration.module.scss';

const DatabaseAWSIntegration = () => {
    return (
        <div className={styles.awsIntegration}>
            <Typography variant="Semibold_14">{GENERAL.AWS_INTEGRATION}</Typography>
            <div className={styles.awsCardContainer}>
                <div className={styles.cardContent}>
                    <div className={styles.imageContainer}>
                        <CloudWatch />
                    </div>
                    <div className={styles.text}>
                        <Typography variant="Regular_14">{GENERAL.CONFIG_CLOUDWATCH}</Typography>
                    </div>
                </div>

                <div className={styles.cardContent}>
                    <div className={styles.imageContainer}>
                        <ProtectBackup />
                    </div>
                    <div className={styles.text}>
                        <Typography variant="Regular_14">{GENERAL.PROTECT_AWS_BACKUP}</Typography>
                    </div>
                </div>

                <div className={styles.cardContent}>
                    <div className={styles.imageContainer}>
                        <SageMaker />
                    </div>
                    <div className={styles.text}>
                        <Typography variant="Regular_14">{GENERAL.CONNECT_TO_AWS_SAGE}</Typography>
                    </div>
                </div>

                <div className={styles.cardContent}>
                    <div className={styles.imageContainer}>
                        <AD />
                    </div>
                    <div className={styles.text}>
                        <Typography variant="Regular_14">{GENERAL.CONNECT_TO_AD}</Typography>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DatabaseAWSIntegration;
