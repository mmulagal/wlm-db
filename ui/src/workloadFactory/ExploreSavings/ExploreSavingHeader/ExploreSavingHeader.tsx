import { DsTypography } from '@netapp/design-system';
import { ReactComponent as ExploreSaving } from '../../../assets/explore-saving.svg';
import styles from './ExploreSavingHeader.module.scss';
import ExploreSavingsTable from '../ExploreSavingsTable/ExploreSavingsTable';
import { GENERAL } from '../../../utils/appConstants';
import { useAppSelector } from '../../../store/storeHooks';
import ExploreSavingsTableV2 from '../ExploreSavingsTableV2/ExploreSavingsTableV2';

const ExploreSavingHeader = () => {
    const isInventoryV2 = useAppSelector(state => state.auth.isInventoryV2);

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
                    </div>

                    <DsTypography variant="Regular_16" className={styles.subText}>
                        {GENERAL.ES_HEADER}
                    </DsTypography>
                </div>
            </div>
            {!isInventoryV2 && <ExploreSavingsTable />}
            {isInventoryV2 && <ExploreSavingsTableV2 />}
        </div>
    );
};

export default ExploreSavingHeader;
