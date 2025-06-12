import { DsTypography } from '@netapp/design-system';
import { ReactComponent as Warning } from '../../../assets/warning.svg';
import styles from './PartialDataContainer.module.scss';

const PartialDataContainer = () => (
    <div className={styles.partialData}>
        <div className={styles.firstSegment}>
            <Warning />
            <DsTypography variant="Semibold_14">
                Warning: Partial data displayed due to missing permissions
            </DsTypography>
        </div>
        <DsTypography variant="Regular_14" className={styles.secondSegment}>
            Add compute optimizer permissions for getting recommendations on Compute rightsizing based on AWS Cloud
            watch metrics and Compute Optimizer.
        </DsTypography>
    </div>
);

export default PartialDataContainer;
