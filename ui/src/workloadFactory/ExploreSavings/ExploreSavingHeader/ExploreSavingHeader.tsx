import { DsTypography } from '@netapp/design-system';
import { ReactComponent as ExploreSaving } from '../../../assets/explore-saving.svg';
import styles from './ExploreSavingHeader.module.scss';
import ExploreSavingsTable from '../ExploreSavingsTable/ExploreSavingsTable';
import { ReactComponent as ComingSoon } from '../../../assets/comingSoon2.svg';
import { GENERAL } from '../../../utils/appConstants';

const ExploreSavingHeader = () => {
    return (
        <div className={styles.exploreSavingsHeader}>
            <div className={styles.topPart}>
                <div>
                    <ExploreSaving />
                </div>
                <div className={styles.contentSection}>
                    <div className={styles.headingPart}>
                        <DsTypography variant="Semibold_16" style={{ lineHeight: '32px' }}>
                            {GENERAL.ES_HEADING}
                        </DsTypography>
                        <div>
                            <ComingSoon />
                        </div>
                    </div>

                    <DsTypography variant="Regular_16" className={styles.subText}>
                        {GENERAL.ES_HEADER}
                    </DsTypography>
                </div>
            </div>

            <ExploreSavingsTable />
        </div>
    );
};

export default ExploreSavingHeader;
