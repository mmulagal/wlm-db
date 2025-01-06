import { DsTypography, FlashingDotsLoader } from '@netapp/design-system';
import styles from './DashboardSandbox.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';

import useResize from '../../../common/hooks/useResize';
import { GENERAL } from '../../../utils/appConstants';
import { useAppSelector } from '../../../store/storeHooks';

import SandboxChart from '../../Sandbox/SandboxDistributionDate/SandboxChart/SandboxChart';
import { getSandboxDistributionByAgeValue } from '../../Sandbox/SandboxUtility';

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
                        {GENERAL.SANDBOXES_DISTRIBUTION_BY_AGE}
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
                                {GENERAL.ONE_THIRTY_DAYS}
                            </DsTypography>
                        </div>

                        {!isNA && (
                            <>
                                <DsTypography variant="Semibold_14">{`${
                                    getSandboxDistributionByAgeValue(aggregatedSandboxList)['0-30']
                                }`}</DsTypography>
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
                                {GENERAL.THIRTY_SIXTY_DAYS}
                            </DsTypography>
                        </div>

                        {!isNA && (
                            <>
                                <DsTypography variant="Semibold_14">{`${
                                    getSandboxDistributionByAgeValue(aggregatedSandboxList)['31-60']
                                }`}</DsTypography>
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
                                style={{ backgroundColor: isNA ? 'var(--chart-disabled)' : '#FDC300' }}
                            />
                            <DsTypography
                                variant="Regular_14"
                                className={isNA ? `${styles.days} ${CommonStyles.notAvailable}` : styles.days}
                            >
                                {GENERAL.SIXTY_PLUS_DAYS}
                            </DsTypography>
                        </div>

                        {!isNA && (
                            <>
                                <DsTypography variant="Semibold_14">{`${
                                    getSandboxDistributionByAgeValue(aggregatedSandboxList)['61+']
                                }`}</DsTypography>
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
