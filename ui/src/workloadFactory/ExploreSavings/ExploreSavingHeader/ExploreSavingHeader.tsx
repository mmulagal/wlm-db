import { DsTypography } from '@netapp/design-system';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as ExploreSaving } from '../../../assets/ES_252.svg';
import { ReactComponent as ExploreSaving1600 } from '../../../assets/exploreSaving1600.svg';
import { ReactComponent as ExploreSavingCommon } from '../../../assets/exploreSavingsCommon.svg';
import { ReactComponent as ExploreSaving1440 } from '../../../assets/exploreSaving1440.svg';
import { ReactComponent as ExploreSavingOnPrem } from '../../../assets/explore-saving-onprem.svg';
import styles from './ExploreSavingHeader.module.scss';

import { GENERAL } from '../../../utils/appConstants';

import ExploreSavingsTableV2 from '../ExploreSavingsTableV2/ExploreSavingsTableV2';
import { handleManualTCOEBS, handleManualTCOFSXW } from '../ExploreSavingsUtils';
import useResize from '../../../common/hooks/useResize';
import { useAppSelector } from '../../../store/storeHooks';
import { WLF_TABS } from '../../../utils/consts';
import ExploreSavingsOnPremiseTable from '../ExploreSavingsOnPremiseTable/ExploreSavingsOnPremiseTable';
import SeparatorComponent from '../../../common/SeparatorComponent/SeparatorComponent';
import ExploreSavingsFsxTable from '../ExploreSavingsTableV2/ExploreSavingsFsxTable';
import TCOBanner from '../TCOBanner/TCOBanner';

const ExploreSavingHeader = () => {
    const dispatch = useDispatch();
    const windowSize = useResize();
    const navigate = useNavigate();
    const { isWorkloadFactory } = useAppSelector(state => state.auth);
    const selectedExploreSavingsTab = useAppSelector(state => state.exploreSavings.selectedExploreSavingsTab);

    const renderTCOTable = () => {
        if (selectedExploreSavingsTab === WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE) {
            return <ExploreSavingsTableV2 />;
        }
        return <ExploreSavingsFsxTable />;
    };

    return (
        <>
            {windowSize.width > 1823 && (
                <>
                    {/* For on-premise */}
                    {selectedExploreSavingsTab === WLF_TABS.MSSQL_ON_PREMISES && (
                        <div className={`${styles.exploreSavingsHeader} ${styles.exploreSavingsHeaderOnPrem}`}>
                            <TCOBanner />
                            {selectedExploreSavingsTab === WLF_TABS.MSSQL_ON_PREMISES && (
                                <ExploreSavingsOnPremiseTable />
                            )}
                        </div>
                    )}
                    {/* For non - on premise */}
                    {selectedExploreSavingsTab !== WLF_TABS.MSSQL_ON_PREMISES && (
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
                                            {selectedExploreSavingsTab === WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE && (
                                                <span
                                                    className={styles.link}
                                                    id="explore-savings-manually-ebs"
                                                    onClick={() =>
                                                        handleManualTCOEBS(dispatch, navigate, isWorkloadFactory)
                                                    }
                                                    style={{ marginTop: '12px' }}
                                                >
                                                    {GENERAL.EXPLORE_SAVING_MANUALLY}
                                                </span>
                                            )}
                                            {selectedExploreSavingsTab === WLF_TABS.MSSQL_FSX_FOR_WINDOWS && (
                                                <span
                                                    className={styles.link}
                                                    id="explore-savings-manually-fsxW"
                                                    onClick={() =>
                                                        handleManualTCOFSXW(dispatch, navigate, isWorkloadFactory)
                                                    }
                                                    style={{ marginTop: '12px' }}
                                                >
                                                    {GENERAL.EXPLORE_SAVING_MANUALLY_FSX}
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            {selectedExploreSavingsTab === WLF_TABS.MSSQL_ON_PREMISES && (
                                <ExploreSavingsOnPremiseTable />
                            )}
                            {selectedExploreSavingsTab !== WLF_TABS.MSSQL_ON_PREMISES && renderTCOTable()}
                        </div>
                    )}
                </>
            )}
            {windowSize.width > 1471 && windowSize.width <= 1823 && (
                <>
                    {selectedExploreSavingsTab === WLF_TABS.MSSQL_ON_PREMISES && (
                        <div className={`${styles.exploreSavingsHeader} ${styles.exploreSavingsHeaderOnPrem}`}>
                            <TCOBanner />
                            {selectedExploreSavingsTab === WLF_TABS.MSSQL_ON_PREMISES && (
                                <ExploreSavingsOnPremiseTable />
                            )}
                        </div>
                    )}
                    {selectedExploreSavingsTab !== WLF_TABS.MSSQL_ON_PREMISES && (
                        <div className={styles.exploreSavingsHeader}>
                            <div className={styles.topPart}>
                                {windowSize.width > 1621 && windowSize.width <= 1822 ? (
                                    <div className={styles.svgContainer1600}>
                                        <ExploreSavingCommon />
                                    </div>
                                ) : (
                                    <div>
                                        <ExploreSaving1600 />
                                        {/* <ExploreSavingCommon /> */}
                                    </div>
                                )}

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
                                            {selectedExploreSavingsTab === WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE && (
                                                <span
                                                    className={styles.link}
                                                    id="explore-savings-manually-ebs"
                                                    style={{ whiteSpace: 'unset' }}
                                                    onClick={() =>
                                                        handleManualTCOEBS(dispatch, navigate, isWorkloadFactory)
                                                    }
                                                >
                                                    {GENERAL.EXPLORE_SAVING_MANUALLY}
                                                </span>
                                            )}
                                            {selectedExploreSavingsTab === WLF_TABS.MSSQL_FSX_FOR_WINDOWS && (
                                                <span
                                                    className={styles.link}
                                                    id="explore-savings-manually-fsxW"
                                                    style={{ whiteSpace: 'unset' }}
                                                    onClick={() =>
                                                        handleManualTCOFSXW(dispatch, navigate, isWorkloadFactory)
                                                    }
                                                >
                                                    {GENERAL.EXPLORE_SAVING_MANUALLY_FSX}
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            {selectedExploreSavingsTab === WLF_TABS.MSSQL_ON_PREMISES && (
                                <ExploreSavingsOnPremiseTable />
                            )}
                            {selectedExploreSavingsTab !== WLF_TABS.MSSQL_ON_PREMISES && renderTCOTable()}
                        </div>
                    )}
                </>
            )}
            {windowSize.width <= 1470 && (
                <>
                    {selectedExploreSavingsTab === WLF_TABS.MSSQL_ON_PREMISES && (
                        <div className={`${styles.exploreSavingsHeader} ${styles.exploreSavingsHeaderOnPrem}`}>
                            <TCOBanner />
                            {selectedExploreSavingsTab === WLF_TABS.MSSQL_ON_PREMISES && (
                                <ExploreSavingsOnPremiseTable />
                            )}
                        </div>
                    )}
                    {selectedExploreSavingsTab !== WLF_TABS.MSSQL_ON_PREMISES && (
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
                                            {selectedExploreSavingsTab === WLF_TABS.MSSQL_ELASTIC_BLOCK_STORE && (
                                                <span
                                                    className={styles.link}
                                                    id="explore-savings-manually-ebs"
                                                    onClick={() =>
                                                        handleManualTCOEBS(dispatch, navigate, isWorkloadFactory)
                                                    }
                                                >
                                                    {GENERAL.EXPLORE_SAVING_MANUALLY}
                                                </span>
                                            )}
                                            {selectedExploreSavingsTab === WLF_TABS.MSSQL_FSX_FOR_WINDOWS && (
                                                <span
                                                    className={styles.link}
                                                    id="explore-savings-manually-fsxW"
                                                    onClick={() =>
                                                        handleManualTCOFSXW(dispatch, navigate, isWorkloadFactory)
                                                    }
                                                >
                                                    {GENERAL.EXPLORE_SAVING_MANUALLY_FSX}
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {selectedExploreSavingsTab === WLF_TABS.MSSQL_ON_PREMISES && (
                                <ExploreSavingsOnPremiseTable />
                            )}
                            {selectedExploreSavingsTab !== WLF_TABS.MSSQL_ON_PREMISES && renderTCOTable()}
                        </div>
                    )}
                </>
            )}
        </>
    );
};

export default ExploreSavingHeader;
