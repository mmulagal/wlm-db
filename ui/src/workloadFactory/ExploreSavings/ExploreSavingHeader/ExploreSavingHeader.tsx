import { DsButton, DsTypography } from '@netapp/design-system';
import { ReactComponent as ExploreSaving } from '../../../assets/explore-saving.svg';
import { ReactComponent as ExploreSaving1600 } from '../../../assets/exploreSaving1600.svg';
import { ReactComponent as ExploreSaving1440 } from '../../../assets/exploreSaving1440.svg';
import styles from './ExploreSavingHeader.module.scss';
import ExploreSavingsTable from '../ExploreSavingsTable/ExploreSavingsTable';
import { GENERAL } from '../../../utils/appConstants';
import { useAppSelector } from '../../../store/storeHooks';
import ExploreSavingsTableV2 from '../ExploreSavingsTableV2/ExploreSavingsTableV2';
import { handleManualTCOEBS, handleManualTCOFSXW } from '../ExploreSavingsUtils';
import { useDispatch } from 'react-redux';
import useResize from '../../../common/hooks/useResize';
import { useNavigate } from 'react-router-dom';

const ExploreSavingHeader = () => {
    const isInventoryV2 = useAppSelector(state => state.auth.isInventoryV2);
    const dispatch = useDispatch();
    const windowSize = useResize();
    const navigate = useNavigate();

    return (
        <>
            {windowSize.width > 1823 && (
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
                                    <span>{GENERAL.MANUAL_EXPLORE_SAVINGS_CONTENT}</span>
                                    <span
                                        className={styles.link}
                                        id="explore-savings-manually-ebs"
                                        onClick={() => handleManualTCOEBS(dispatch, navigate)}
                                    >
                                        {GENERAL.EXPLORE_SAVING_MANUALLY}
                                    </span>
                                    <span
                                        className={styles.link}
                                        id="explore-savings-manually-fsxW"
                                        onClick={() => handleManualTCOFSXW(dispatch, navigate)}
                                    >
                                        {GENERAL.EXPLORE_SAVING_MANUALLY_FSX}
                                    </span>
                                </span>
                            </div>
                        </div>
                    </div>
                    {!isInventoryV2 && <ExploreSavingsTable />}
                    {isInventoryV2 && <ExploreSavingsTableV2 />}
                </div>
            )}
            {windowSize.width > 1429 && windowSize.width <= 1823 && (
                <div className={styles.exploreSavingsHeader}>
                    <div className={styles.topPart}>
                        <div className={styles.svgContainer}>
                            <ExploreSaving1600 />
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
                                    <span>{GENERAL.MANUAL_EXPLORE_SAVINGS_CONTENT}</span>
                                    <span
                                        className={styles.link}
                                        id="explore-savings-manually-ebs"
                                        onClick={() => handleManualTCOEBS(dispatch, navigate)}
                                    >
                                        {GENERAL.EXPLORE_SAVING_MANUALLY}
                                    </span>
                                    <span
                                        className={styles.link}
                                        id="explore-savings-manually-fsxW"
                                        style={{ whiteSpace: 'unset' }}
                                        onClick={() => handleManualTCOFSXW(dispatch, navigate)}
                                    >
                                        {GENERAL.EXPLORE_SAVING_MANUALLY_FSX}
                                    </span>
                                </span>
                            </div>
                        </div>
                    </div>
                    {!isInventoryV2 && <ExploreSavingsTable />}
                    {isInventoryV2 && <ExploreSavingsTableV2 />}
                </div>
            )}
            {windowSize.width <= 1428 && (
                <div className={styles.exploreSavingsHeader}>
                    <div className={styles.topPart}>
                        <div className={styles.svgContainer}>
                            <ExploreSaving1440 />
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
                                    <span>{GENERAL.MANUAL_EXPLORE_SAVINGS_CONTENT}</span>
                                    <span
                                        className={styles.link}
                                        id="explore-savings-manually-ebs"
                                        onClick={() => handleManualTCOEBS(dispatch, navigate)}
                                    >
                                        {GENERAL.EXPLORE_SAVING_MANUALLY}
                                    </span>
                                    <span
                                        className={styles.link}
                                        id="explore-savings-manually-fsxW"
                                        onClick={() => handleManualTCOFSXW(dispatch, navigate)}
                                    >
                                        {GENERAL.EXPLORE_SAVING_MANUALLY_FSX}
                                    </span>
                                </span>
                            </div>
                        </div>
                    </div>
                    {!isInventoryV2 && <ExploreSavingsTable />}
                    {isInventoryV2 && <ExploreSavingsTableV2 />}
                </div>
            )}
        </>
    );
};

export default ExploreSavingHeader;
