import useResize from '../../../common/hooks/useResize';
import { ReactComponent as Savings } from '../../../assets/Savings.svg';
import styles from './SandboxStorageSaving.module.scss';
import { DsTypography, FlashingDotsLoader } from '@netapp/design-system';

const SandboxStorageSaving = () => {
    const windowSize = useResize();
    const loading = false;
    return (
        <div className={styles.sandboxStorageSaving}>
            {windowSize.width > 1500 && (
                <div className={styles.largeContainer}>
                    <div className={styles.firstSegment} style={{ paddingRight: '0', width: '334px' }}>
                        <div className={styles.leftSection}>
                            <Savings />
                        </div>
                        <div className={styles.rightSection}>
                            <DsTypography variant="Regular_32" style={{ lineHeight: 'unset' }}>
                                {loading && (
                                    <div className={styles.loadingContainer}>
                                        <FlashingDotsLoader />
                                    </div>
                                )}
                                {!loading && '78%'}
                            </DsTypography>
                            <DsTypography variant="Regular_14">Sandboxes storage savings</DsTypography>
                        </div>
                    </div>

                    <div className={styles.secondSegment}>
                        <div className={styles.progressBar}>
                            <div
                                className={`${styles.progress} ${styles.leftCurveBar}`}
                                style={{
                                    width: `${70}%`,
                                    backgroundColor: 'var(--chart-4)'
                                }}
                            ></div>
                            <div className={styles.separator}></div>
                            <div
                                className={`${styles.progress} ${styles.rightCurveBar}`}
                                style={{
                                    width: `${30}%`,
                                    backgroundColor: 'var(--chart-9)'
                                }}
                            ></div>
                        </div>

                        <div className={styles.secondRow}>
                            <div className={styles.bottomRow}>
                                <div className={styles.square} style={{ backgroundColor: '#68C6B3' }} />
                                <DsTypography variant="Semibold_14" style={{ lineHeight: 'unset' }}>
                                    {'0.82 TiB'}
                                </DsTypography>

                                <DsTypography variant="Regular_14" style={{ lineHeight: 'unset' }}>
                                    {'Sandboxes storage savings'}
                                </DsTypography>
                            </div>

                            <div className={styles.bottomRow}>
                                <div className={styles.square} style={{ backgroundColor: '#A815F3' }} />
                                <DsTypography variant="Semibold_14" style={{ lineHeight: 'unset' }}>
                                    {'0.82 TiB'}
                                </DsTypography>

                                <DsTypography variant="Regular_14" style={{ lineHeight: 'unset' }}>
                                    {'Consumed storage'}
                                </DsTypography>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {windowSize.width <= 1500 && (
                <div className={styles.smallContainer}>
                    <div className={styles.firstSegment} style={{ paddingRight: '0', width: '294px' }}>
                        <div className={styles.leftSection}>
                            <Savings />
                        </div>
                        <div className={styles.rightSection}>
                            <DsTypography variant="Regular_32" style={{ lineHeight: 'unset' }}>
                                {loading && (
                                    <div className={styles.loadingContainer}>
                                        <FlashingDotsLoader />
                                    </div>
                                )}
                                {!loading && '78%'}
                            </DsTypography>
                            <DsTypography variant="Regular_14">Sandboxes storage savings</DsTypography>
                        </div>
                    </div>

                    <div className={styles.separator} />

                    <div className={styles.consumedSaving}>
                        <div className={styles.valueContainer}>
                            {loading && (
                                <div className={styles.loadingContainer}>
                                    <FlashingDotsLoader />
                                </div>
                            )}
                            {!loading && (
                                <>
                                    <DsTypography variant="Regular_32" style={{ lineHeight: 'unset' }}>
                                        0.82
                                    </DsTypography>
                                    <DsTypography
                                        variant="Semibold_14"
                                        className={styles.setUnit}
                                        style={{ lineHeight: 'unset' }}
                                    >
                                        TiB
                                    </DsTypography>
                                </>
                            )}
                        </div>
                        <DsTypography variant="Regular_14">Sandboxes savings</DsTypography>
                    </div>

                    <div className={styles.separator} />

                    <div className={styles.consumedSaving}>
                        <div className={styles.valueContainer}>
                            {loading && (
                                <div className={styles.loadingContainer}>
                                    <FlashingDotsLoader />
                                </div>
                            )}
                            {!loading && (
                                <>
                                    <DsTypography variant="Regular_32" style={{ lineHeight: 'unset' }}>
                                        0.18
                                    </DsTypography>
                                    <DsTypography
                                        variant="Semibold_14"
                                        className={styles.setUnit}
                                        style={{ lineHeight: 'unset' }}
                                    >
                                        TiB
                                    </DsTypography>
                                </>
                            )}
                        </div>
                        <DsTypography variant="Regular_14">Consumed savings</DsTypography>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SandboxStorageSaving;
