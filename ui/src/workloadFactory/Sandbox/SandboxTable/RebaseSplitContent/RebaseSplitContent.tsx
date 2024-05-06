import { DsTypography } from '@netapp/design-system';
import styles from './RebaseSplitContent.module.scss';

const RebaseSplitContent = () => {
    return (
        <div className={styles.rebaseSplitContent}>
            <DsTypography variant="Regular_14">
                Are you sure you want to split this sandbox Database name from the source database ?
            </DsTypography>
            <DsTypography variant="Regular_14" className={styles.secondLine}>
                The split will create a new database from this sandbox that will occupy XX GiB in storage.
            </DsTypography>

            <DsTypography variant="Regular_14">
                Once the split is done, the new database will appear in the inventory.
            </DsTypography>

            <DsTypography variant="Regular_14">The sandbox removed from the list after the split.</DsTypography>
        </div>
    );
};

export default RebaseSplitContent;
