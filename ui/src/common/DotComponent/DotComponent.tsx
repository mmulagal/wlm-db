import { DsTypography } from '@netapp/design-system';
import styles from './DotComponent.module.scss';

type Dot = {
    color: string;
    value: string;
};

const DotComponent = ({ color, value }: Dot) => {
    return (
        <div className={styles.dot}>
            <div className={styles.dotImage} style={{ backgroundColor: color }} />
            <DsTypography variant="Regular_14">{value}</DsTypography>
        </div>
    );
};

export default DotComponent;
