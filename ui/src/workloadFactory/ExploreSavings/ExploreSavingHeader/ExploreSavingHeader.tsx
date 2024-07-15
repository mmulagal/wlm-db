import { DsButton, DsTypography } from '@netapp/design-system';
import { ReactComponent as ExploreSaving } from '../../../assets/explore-saving.svg';
import styles from './ExploreSavingHeader.module.scss';
import ExploreSavingsTable from '../ExploreSavingsTable/ExploreSavingsTable';
import { GENERAL } from '../../../utils/appConstants';
import { useAppSelector } from '../../../store/storeHooks';
import ExploreSavingsTableV2 from '../ExploreSavingsTableV2/ExploreSavingsTableV2';
import { handleManualTCO } from '../ExploreSavingsUtils';
import { useDispatch } from 'react-redux';

const ExploreSavingHeader = () => {
    const isInventoryV2 = useAppSelector(state => state.auth.isInventoryV2);
    const dispatch = useDispatch();

    return (
        <div className={styles.exploreSavingsHeader}>
            <div className={styles.topPart}>
                <div className={styles.svgContainer}>
                    <ExploreSaving />
                </div>
                <div className={styles.contentSection}>
                    <div className={styles.leftSide}>
                        <div className={styles.headingPart}>
                            <DsTypography variant="Semibold_16" style={{ lineHeight: '32px' }}>
                                {GENERAL.ES_HEADING}
                            </DsTypography>
                        </div>

                        <DsTypography variant="Regular_16" className={styles.subText}>
                            {GENERAL.ES_HEADER}
                        </DsTypography>
                    </div>

                    <div className={styles.rightSide}>
                        <div className={styles.headingPart}>
                            <DsTypography variant="Semibold_16" style={{ lineHeight: '32px' }}>
                                {GENERAL.MANUAL_EXLORE_SAVINGS}
                            </DsTypography>
                        </div>

                        <span className={styles.subText}>
                            <span>{GENERAL.MANUAL_EXPLORE_SAVINGS_CONTENT}</span> &nbsp;
                            {/* <span className={styles.link} onClick={() => handleManualTCO(dispatch)}>
                                {GENERAL.EXPLORE_SAVING_MANUALLY}
                            </span> */}
                            <span className={styles.link}>{GENERAL.EXPLORE_SAVING_MANUALLY}</span>
                        </span>
                    </div>
                </div>
            </div>
            {!isInventoryV2 && <ExploreSavingsTable />}
            {isInventoryV2 && <ExploreSavingsTableV2 />}
        </div>
    );
};

export default ExploreSavingHeader;
