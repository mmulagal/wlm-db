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
    const { isNA, aggregatedSandboxList } = useAppSelector(state => state.sandbox);
    return (
        <div className={styles.sandboxDate}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    {GENERAL.SANDBOXES_DISTRIBUTION_BY_AGE}
                </DsTypography>

                {loading && <FlashingDotsLoader />}
            </div>

            <div className={styles.mainSection}>
                <SandboxChart />

                <div className={styles.rightSide}>
                    <div className={styles.individualRow}>
                        <div
                            className={styles.square}
                            style={{ backgroundColor: isNA ? 'var(--chart-disabled)' : '#68C6B3' }}
                        />
                        <DsTypography
                            variant="Regular_14"
                            className={isNA ? `${styles.days} ${CommonStyles.notAvailable}` : styles.days}
                        >
                            {GENERAL.ONE_SEVEN_DAYS}
                        </DsTypography>
                        {windowSize.width > 1500 && !isNA && (
                            <>
                                <div className={styles.separator} />
                                <DsTypography variant="Semibold_14">{`${
                                    getSandboxDistributionByAge(aggregatedSandboxList)['0-7']
                                } ${GENERAL.SANDBOXES}`}</DsTypography>
                            </>
                        )}
                        {windowSize.width <= 1500 && !isNA && (
                            <DsTypography variant="Regular_14">{`(${
                                getSandboxDistributionByAge(aggregatedSandboxList)['0-7']
                            })`}</DsTypography>
                        )}
                        {isNA && (
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
                            style={{ backgroundColor: isNA ? 'var(--chart-disabled)' : '#0BAFFC' }}
                        />
                        <DsTypography
                            variant="Regular_14"
                            className={isNA ? `${styles.days} ${CommonStyles.notAvailable}` : styles.days}
                        >
                            {GENERAL.SEVEN_FOURTEEN_DAYS}
                        </DsTypography>
                        {windowSize.width > 1500 && !isNA && (
                            <>
                                <div className={styles.separator} />
                                <DsTypography variant="Semibold_14">{`${
                                    getSandboxDistributionByAge(aggregatedSandboxList)['8-14']
                                } ${GENERAL.SANDBOXES}`}</DsTypography>
                            </>
                        )}
                        {windowSize.width <= 1500 && !isNA && (
                            <DsTypography variant="Regular_14">{`(${
                                getSandboxDistributionByAge(aggregatedSandboxList)['8-14']
                            })`}</DsTypography>
                        )}
                        {isNA && (
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
                            style={{ backgroundColor: isNA ? 'var(--chart-disabled)' : '#A815F3' }}
                        />
                        <DsTypography
                            variant="Regular_14"
                            className={isNA ? `${styles.days} ${CommonStyles.notAvailable}` : styles.days}
                        >
                            {GENERAL.FOURTEEN_THIRTY_DAYS}
                        </DsTypography>

                        {windowSize.width > 1500 && !isNA && (
                            <>
                                <div className={styles.separator} />
                                <DsTypography variant="Semibold_14">{`${
                                    getSandboxDistributionByAge(aggregatedSandboxList)['15-30']
                                } ${GENERAL.SANDBOXES}`}</DsTypography>
                            </>
                        )}

                        {windowSize.width <= 1500 && !isNA && (
                            <DsTypography variant="Regular_14">{`(${
                                getSandboxDistributionByAge(aggregatedSandboxList)['15-30']
                            })`}</DsTypography>
                        )}
                        {isNA && (
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
                            style={{ backgroundColor: isNA ? 'var(--chart-disabled)' : '#FDC300' }}
                        />
                        <DsTypography
                            variant="Regular_14"
                            className={isNA ? `${styles.days} ${CommonStyles.notAvailable}` : styles.days}
                        >
                            {GENERAL.THIRTY_PLUS_DAYS}
                        </DsTypography>
                        {windowSize.width > 1500 && !isNA && (
                            <>
                                <div className={styles.separator} />
                                <DsTypography variant="Semibold_14">{`${
                                    getSandboxDistributionByAge(aggregatedSandboxList)['30+']
                                } ${GENERAL.SANDBOXES}`}</DsTypography>
                            </>
                        )}

                        {windowSize.width <= 1500 && !isNA && (
                            <DsTypography variant="Regular_14">{`(${
                                getSandboxDistributionByAge(aggregatedSandboxList)['30+']
                            })`}</DsTypography>
                        )}
                        {isNA && (
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
