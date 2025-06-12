import { FlashingDotsLoader, Typography } from '@netapp/design-system';
import { GENERAL } from '../../utils/appConstants';
import styles from './LoadingComponent.module.scss';

const LoadingComponent = () => (
    <div className={styles.loading}>
        <FlashingDotsLoader />
        <Typography variant="Regular_14">{GENERAL.LOADING_DATA}</Typography>
    </div>
);

export default LoadingComponent;
