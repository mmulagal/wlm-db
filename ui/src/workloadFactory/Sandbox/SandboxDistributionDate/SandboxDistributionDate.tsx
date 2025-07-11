import { DsTypography, FlashingDotsLoader } from '@netapp/design-system';
import styles from './SandboxDistributionDate.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import SandboxChart from './SandboxChart/SandboxChart';
import useResize from '../../../common/hooks/useResize';
import { GENERAL } from '../../../utils/appConstants';
import { useAppSelector } from '../../../store/storeHooks';
import { getSandboxDistributionByAge } from '../SandboxUtility';

const SandboxDistributionDate = () => {
    const windowSize = useResize();
    const loading = useAppSelector(state => state.sandbox.getSandboxList.sandboxListLoading);
    const { aggregatedSandboxList } = useAppSelector(state => state.sandbox);
    const { showNA } = useAppSelector(state => state.headers);
    return (
        <div className={styles.sandboxDate}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    {GENERAL.SANDBOXES_DISTRIBUTION_BY_AGE}
                </DsTypography>

                {loading && <FlashingDotsLoader />}
            </div>

            <div className={styles.mainSection}>
                <SandboxChart aggregatedSandboxList={aggregatedSandboxList} loading={loading} />

                <div className={styles.rightSide}>
                    <div className={styles.individualRow}>
                        <div
                            className={styles.square}
                            style={{ backgroundColor: showNA ? 'var(--chart-disabled)' : '#68C6B3' }}
                        />
                        <DsTypography
                            variant="Regular_14"
                            className={showNA ? `${styles.days} ${CommonStyles.notAvailable}` : styles.days}
                        >
                            {GENERAL.ONE_THIRTY_DAYS}
                        </DsTypography>
                        {windowSize.width > 1428 && !showNA && (
                            <>
                                <div className={styles.separator} />
                                <DsTypography variant="Semibold_14">{`${
                                    getSandboxDistributionByAge(aggregatedSandboxList)['0-30']
                                } ${GENERAL.SANDBOXES}`}</DsTypography>
                            </>
                        )}
                        {windowSize.width <= 1428 && !showNA && (
                            <DsTypography variant="Regular_14">{`(${
                                getSandboxDistributionByAge(aggregatedSandboxList)['0-30']
                            })`}</DsTypography>
                        )}
                        {showNA && (
                            <>
                                <div className={styles.separator} />
                                <DsTypography variant="Regular_14" className={`${CommonStyles.notAvailable} `}>
                                    {GENERAL.NOT_AVAILABLE}
                                </DsTypography>
                            </>
                        )}
                    </div>

                    <div className={styles.individualRow}>
                        <div
                            className={styles.square}
                            style={{ backgroundColor: showNA ? 'var(--chart-disabled)' : '#A815F3' }}
                        />
                        <DsTypography
                            variant="Regular_14"
                            className={showNA ? `${styles.days} ${CommonStyles.notAvailable}` : styles.days}
                        >
                            {GENERAL.THIRTY_SIXTY_DAYS}
                        </DsTypography>
                        {windowSize.width > 1428 && !showNA && (
                            <>
                                <div className={styles.separator} />
                                <DsTypography variant="Semibold_14">{`${
                                    getSandboxDistributionByAge(aggregatedSandboxList)['31-60']
                                } ${GENERAL.SANDBOXES}`}</DsTypography>
                            </>
                        )}
                        {windowSize.width <= 1428 && !showNA && (
                            <DsTypography variant="Regular_14">{`(${
                                getSandboxDistributionByAge(aggregatedSandboxList)['31-60']
                            })`}</DsTypography>
                        )}
                        {showNA && (
                            <>
                                <div className={styles.separator} />
                                <DsTypography variant="Regular_14" className={`${CommonStyles.notAvailable} `}>
                                    {GENERAL.NOT_AVAILABLE}
                                </DsTypography>
                            </>
                        )}
                    </div>

                    <div className={styles.individualRow}>
                        <div
                            className={styles.square}
                            style={{ backgroundColor: showNA ? 'var(--chart-disabled)' : '#FDC300' }}
                        />
                        <DsTypography
                            variant="Regular_14"
                            className={showNA ? `${styles.days} ${CommonStyles.notAvailable}` : styles.days}
                        >
                            {GENERAL.SIXTY_PLUS_DAYS}
                        </DsTypography>

                        {windowSize.width > 1428 && !showNA && (
                            <>
                                <div className={styles.separator} />
                                <DsTypography variant="Semibold_14">{`${
                                    getSandboxDistributionByAge(aggregatedSandboxList)['61+']
                                } ${GENERAL.SANDBOXES}`}</DsTypography>
                            </>
                        )}

                        {windowSize.width <= 1428 && !showNA && (
                            <DsTypography variant="Regular_14">{`(${
                                getSandboxDistributionByAge(aggregatedSandboxList)['61+']
                            })`}</DsTypography>
                        )}
                        {showNA && (
                            <>
                                <div className={styles.separator} />
                                <DsTypography variant="Regular_14" className={`${CommonStyles.notAvailable} `}>
                                    {GENERAL.NOT_AVAILABLE}
                                </DsTypography>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SandboxDistributionDate;
