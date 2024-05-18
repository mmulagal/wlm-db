import useResize from '../../../common/hooks/useResize';
import { ReactComponent as Savings } from '../../../assets/Savings.svg';
import styles from './SandboxStorageSaving.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { DsTypography, FlashingDotsLoader } from '@netapp/design-system';
import { GENERAL } from '../../../utils/appConstants';
import { useAppSelector } from '../../../store/storeHooks';
import { formatSize } from '../../../utils/utilityFunctions';

const SandboxStorageSaving = () => {
    const windowSize = useResize();
    const { isNA, getSandboxSavings } = useAppSelector(state => state.sandbox);
    const { sandboxSavingsLoading: loading, sandboxSavings } = getSandboxSavings;

    const savingsPercentage = sandboxSavings?.sandboxSavingsPercentage
        ? Math.floor(sandboxSavings.sandboxSavingsPercentage)
        : 0;
    const savingsPercentToShow = `${savingsPercentage < 5 ? '<5' : savingsPercentage}%`;

    const handleProgressBar = () => {
        if (savingsPercentage === 0) {
            return (
                <div className={styles.progressBar}>
                    <div
                        className={`${styles.progress} ${styles.leftCurveBar} ${styles.rightCurveBar}`}
                        style={{
                            width: `${100}%`,
                            backgroundColor: 'var(--chart-disabled)'
                        }}
                    ></div>
                </div>
            );
        }
        if (!isNA) {
            return (
                <div className={styles.progressBar}>
                    <div
                        className={`${styles.progress} ${styles.leftCurveBar} ${
                            savingsPercentage === 0 ? styles.rightCurveBar : ''
                        }`}
                        style={{
                            width: `${100 - savingsPercentage}%`,
                            backgroundColor: 'var(--chart-9)'
                        }}
                    ></div>
                    <div className={styles.separator}></div>
                    <div
                        className={`${styles.progress} ${styles.rightCurveBar} ${
                            savingsPercentage === 100 ? styles.leftCurveBar : ''
                        }`}
                        style={{
                            width: `${savingsPercentage}%`,
                            backgroundColor: 'var(--chart-4)'
                        }}
                    ></div>
                </div>
            );
        } else if (isNA) {
            return (
                <div className={styles.progressBar}>
                    <div
                        className={`${styles.progress} ${styles.leftCurveBar} ${styles.rightCurveBar}`}
                        style={{
                            width: `${100}%`,
                            backgroundColor: 'var(--chart-disabled)'
                        }}
                    ></div>
                </div>
            );
        }
    };
    return (
        <div className={styles.sandboxStorageSaving}>
            {windowSize.width > 1500 && (
                <div className={styles.largeContainer}>
                    <div className={styles.firstSegment} style={{ paddingRight: '0', width: '334px' }}>
                        <div className={styles.leftSection}>
                            <Savings />
                        </div>
                        <div className={styles.rightSection}>
                            {!isNA && (
                                <DsTypography variant="Regular_32" style={{ lineHeight: 'unset' }}>
                                    {loading && (
                                        <div className={styles.loadingContainer}>
                                            <FlashingDotsLoader />
                                        </div>
                                    )}
                                    {!loading && savingsPercentToShow}
                                </DsTypography>
                            )}
                            {isNA && (
                                <DsTypography
                                    variant="Regular_14"
                                    className={`${CommonStyles.notAvailable} ${CommonStyles.notAvailableInformation}`}
                                >
                                    {GENERAL.NOT_AVAILABLE}
                                </DsTypography>
                            )}
                            <DsTypography variant="Regular_14" className={isNA ? CommonStyles.notAvailable : ''}>
                                {GENERAL.SANDBOX_STORAGE_SAVINGS}
                            </DsTypography>
                        </div>
                    </div>

                    <div className={styles.secondSegment}>
                        {handleProgressBar()}

                        <div className={styles.secondRow}>
                            <div className={styles.bottomRow}>
                                <div
                                    className={styles.square}
                                    style={{ backgroundColor: isNA ? 'var(--chart-disabled)' : '#A815F3' }}
                                />
                                {!isNA && (
                                    <DsTypography variant="Semibold_14" style={{ lineHeight: 'unset' }}>
                                        {formatSize(sandboxSavings?.consumedStorage)}
                                    </DsTypography>
                                )}

                                <DsTypography variant="Regular_14" style={{ lineHeight: 'unset' }}>
                                    {GENERAL.SANDBOX_CONSUMED_STORAGE}
                                </DsTypography>
                            </div>

                            <div className={styles.bottomRow}>
                                <div
                                    className={styles.square}
                                    style={{ backgroundColor: isNA ? 'var(--chart-disabled)' : '#68C6B3' }}
                                />
                                {!isNA && (
                                    <DsTypography variant="Semibold_14" style={{ lineHeight: 'unset' }}>
                                        {formatSize(sandboxSavings?.savedStorage)}
                                    </DsTypography>
                                )}

                                <DsTypography variant="Regular_14" style={{ lineHeight: 'unset' }}>
                                    {GENERAL.SANDBOX_STORAGE_SAVINGS}
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
                            {!isNA && (
                                <DsTypography variant="Regular_32" style={{ lineHeight: 'unset' }}>
                                    {loading && (
                                        <div className={styles.loadingContainer}>
                                            <FlashingDotsLoader />
                                        </div>
                                    )}
                                    {!loading && savingsPercentToShow}
                                </DsTypography>
                            )}
                            {isNA && (
                                <DsTypography
                                    variant="Regular_14"
                                    className={`${CommonStyles.notAvailable} ${CommonStyles.notAvailableInformation}`}
                                >
                                    {GENERAL.NOT_AVAILABLE}
                                </DsTypography>
                            )}
                            <DsTypography variant="Regular_14" className={isNA ? CommonStyles.notAvailable : ''}>
                                {GENERAL.SANDBOX_STORAGE_SAVINGS}
                            </DsTypography>
                        </div>
                    </div>

                    <div className={styles.separator} />

                    <div className={styles.consumedSaving}>
                        <div className={styles.valueContainer}>
                            {loading && !isNA && (
                                <div className={styles.loadingContainer}>
                                    <FlashingDotsLoader />
                                </div>
                            )}
                            {!loading && !isNA && (
                                <>
                                    <DsTypography variant="Regular_32" style={{ lineHeight: 'unset' }}>
                                        {formatSize(sandboxSavings?.savedStorage).split(' ')[0]}
                                    </DsTypography>
                                    <DsTypography
                                        variant="Semibold_14"
                                        className={styles.setUnit}
                                        style={{ lineHeight: 'unset' }}
                                    >
                                        {formatSize(sandboxSavings?.savedStorage).split(' ')[1]}
                                    </DsTypography>
                                </>
                            )}
                            {isNA && (
                                <DsTypography
                                    variant="Regular_14"
                                    className={`${CommonStyles.notAvailable} ${CommonStyles.notAvailableInformation}`}
                                >
                                    {GENERAL.NOT_AVAILABLE}
                                </DsTypography>
                            )}
                        </div>
                        <DsTypography variant="Regular_14" className={isNA ? CommonStyles.notAvailable : ''}>
                            {GENERAL.SANDBOX_SAVINGS}
                        </DsTypography>
                    </div>

                    <div className={styles.separator} />

                    <div className={styles.consumedSaving}>
                        <div className={styles.valueContainer}>
                            {loading && !isNA && (
                                <div className={styles.loadingContainer}>
                                    <FlashingDotsLoader />
                                </div>
                            )}
                            {!loading && !isNA && (
                                <>
                                    <DsTypography variant="Regular_32" style={{ lineHeight: 'unset' }}>
                                        {formatSize(sandboxSavings?.consumedStorage).split(' ')[0]}
                                    </DsTypography>
                                    <DsTypography
                                        variant="Semibold_14"
                                        className={styles.setUnit}
                                        style={{ lineHeight: 'unset' }}
                                    >
                                        {formatSize(sandboxSavings?.consumedStorage).split(' ')[1]}
                                    </DsTypography>
                                </>
                            )}
                            {isNA && (
                                <DsTypography
                                    variant="Regular_14"
                                    className={`${CommonStyles.notAvailable} ${CommonStyles.notAvailableInformation}`}
                                >
                                    {GENERAL.NOT_AVAILABLE}
                                </DsTypography>
                            )}
                        </div>
                        <DsTypography variant="Regular_14" className={isNA ? CommonStyles.notAvailable : ''}>
                            {GENERAL.SANDBOX_CONSUMED_SAVING}
                        </DsTypography>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SandboxStorageSaving;
