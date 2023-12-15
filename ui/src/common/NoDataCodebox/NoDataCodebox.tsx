import { Typography } from '@netapp/design-system';
import styles from './NoDataCodebox.module.scss';
import { ReactComponent as NoDataIcon } from '../../assets/ic_file.svg';

type textType = {
    text: string;
};

const NoDataCodeBox = ({ text }: textType) => {
    return (
        <Typography variant="Regular_14" className={styles.nodataCodeBox}>
            <NoDataIcon />
            <div>{text}</div>
        </Typography>
    );
};

export default NoDataCodeBox;
