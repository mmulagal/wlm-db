import { ReactComponent as OpsCloudIcon } from '../../assets/oops-cloud.svg';
import { Typography } from '@netapp/design-system';
import styles from './ErrorPage.module.scss';

type Props = { message: string | null };

const ErrorPage = ({ message }: Props) => {
    return (
        <div className={styles['error-page']}>
            <OpsCloudIcon className={styles['cloud-icon']} />
            <Typography variant="Semibold_24">Oops! something went wrong</Typography>
            <Typography variant="Regular_14">Please contact support for more information about the error</Typography>
            <Typography variant="Regular_14">{message || 'General Error'}</Typography>
        </div>
    );
};

export default ErrorPage;
