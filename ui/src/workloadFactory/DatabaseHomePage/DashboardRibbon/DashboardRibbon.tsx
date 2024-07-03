import styles from './DashboardRibbon.module.scss';
import { ReactComponent as Layer } from '../../../assets/Layer_1.svg';
import { DsTypography } from '@netapp/design-system';

const DashboardRibbon = () => {
    return (
        <div className={styles.dashboardRibbon}>
            <div className={styles.imageContainer}>
                <Layer />
            </div>
            <DsTypography variant="Regular_14">
                The dashboard overview contain information of the managed instances and databases only
            </DsTypography>
        </div>
    );
};

export default DashboardRibbon;
