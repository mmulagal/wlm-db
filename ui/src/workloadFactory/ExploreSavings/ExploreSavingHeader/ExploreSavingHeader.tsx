import { DsTypography } from '@netapp/design-system';
import { ReactComponent as ExploreSaving } from '../../../assets/explore-saving.svg';
import styles from './ExploreSavingHeader.module.scss';
import ExploreSavingsTable from '../ExploreSavingsTable/ExploreSavingsTable';

const ExploreSavingHeader = () => {
    return (
        <div className={styles.exploreSavingsHeader}>
            <div className={styles.topPart}>
                <div>
                    <ExploreSaving />
                </div>
                <div className={styles.contentSection}>
                    <DsTypography variant="Semibold_16">Explore savings of selected host</DsTypography>
                    <DsTypography variant="Regular_16" className={styles.subText}>
                        Select Microsoft SQL server host from your list. Upon clicking the "Explore savings" button, we
                        will calculate and present you with your potential savings by moving to Microsoft SQL server
                        using FSx for ONTAP file system.
                    </DsTypography>
                </div>
            </div>

            <ExploreSavingsTable />
        </div>
    );
};

export default ExploreSavingHeader;
