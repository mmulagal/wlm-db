import { FlashingDotsLoader, Typography } from '@netapp/design-system';
import styles from './LoadingCodebox.module.scss';

type textType = {
    text: string;
};

const LoadingCodeBox = ({ text }: textType) => {
    return (
        <Typography variant="Regular_14" className={styles.loadingCodeBox}>
            <FlashingDotsLoader />
            <div>{text}</div>
        </Typography>
    );
};

export default LoadingCodeBox;
