import { DsTypography, FlashingDotsLoader } from '@netapp/design-system';
import styles from './DashboardSandbox.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';

import useResize from '../../../common/hooks/useResize';
import { GENERAL } from '../../../utils/appConstants';
import { useAppSelector } from '../../../store/storeHooks';

import SandboxChart from '../../Sandbox/SandboxDistributionDate/SandboxChart/SandboxChart';
import { getSandboxDistributionByAge } from '../../Sandbox/SandboxUtility';

const DashboardSandbox = () => {
    const windowSize = useResize();
    const loading = useAppSelector(state => state.sandbox.getSandboxList.sandboxListLoading);
    const { isNA, aggregatedSandboxList } = useAppSelector(state => state.sandbox);
    return (
        <div className={styles.dashboardSandbox}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    {GENERAL.SANDBOXES}
                </DsTypography>

                {loading && <FlashingDotsLoader />}
            </div>

            <div className={styles.mainSection}>
                <SandboxChart />

                <div className={styles.rightSide}>
                    <DsTypography variant="Semibold_14" style={{ marginBottom: '16px' }}>
                        Sandboxes distribution by age
                    </DsTypography>
                    <div className={styles.individualRow}>
                        <div className={styles.squareSetup}>
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
                        </div>

                        {!isNA && (
                            <>
                                <DsTypography variant="Semibold_14">{`${
                                    getSandboxDistributionByAge(aggregatedSandboxList)['0-7']
                                } ${GENERAL.SANDBOXES}`}</DsTypography>
                            </>
                        )}

                        {isNA && (
                            <>
                                <DsTypography variant="Regular_14" className={`${CommonStyles.notAvailable} `}>
                                    {GENERAL.NOT_AVAILABLE}
                                </DsTypography>
                            </>
                        )}
                    </div>

                    <div className={styles.individualRow}>
                        <div className={styles.squareSetup}>
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
                        </div>

                        {!isNA && (
                            <>
                                <DsTypography variant="Semibold_14">{`${
                                    getSandboxDistributionByAge(aggregatedSandboxList)['8-14']
                                } ${GENERAL.SANDBOXES}`}</DsTypography>
                            </>
                        )}

                        {isNA && (
                            <>
                                <DsTypography variant="Regular_14" className={`${CommonStyles.notAvailable} `}>
                                    {GENERAL.NOT_AVAILABLE}
                                </DsTypography>
                            </>
                        )}
                    </div>

                    <div className={styles.individualRow}>
                        <div className={styles.squareSetup}>
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
                        </div>

                        {!isNA && (
                            <>
                                <DsTypography variant="Semibold_14">{`${
                                    getSandboxDistributionByAge(aggregatedSandboxList)['15-30']
                                } ${GENERAL.SANDBOXES}`}</DsTypography>
                            </>
                        )}

                        {isNA && (
                            <>
                                <DsTypography variant="Regular_14" className={`${CommonStyles.notAvailable} `}>
                                    {GENERAL.NOT_AVAILABLE}
                                </DsTypography>
                            </>
                        )}
                    </div>

                    <div className={styles.individualRow} style={{ borderBottom: '1px solid var(--border)' }}>
                        <div className={styles.squareSetup}>
                            <div
                                className={styles.square}
                                style={{ backgroundColor: isNA ? 'var(--chart-disabled)' : '#FDC300' }}
                            />
                            <DsTypography
                                variant="Regular_14"
                                className={isNA ? `${styles.days} ${CommonStyles.notAvailable}` : styles.days}
                            >
                                {GENERAL.THIRTY_PLUS_DAYS}
                            </DsTypography>{' '}
                        </div>

                        {!isNA && (
                            <>
                                <DsTypography variant="Semibold_14">{`${
                                    getSandboxDistributionByAge(aggregatedSandboxList)['30+']
                                } ${GENERAL.SANDBOXES}`}</DsTypography>
                            </>
                        )}

                        {isNA && (
                            <>
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

export default DashboardSandbox;
