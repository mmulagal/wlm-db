import { DsTypography, FlashingDotsLoader } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import useResize from '../../../common/hooks/useResize';
import { ReactComponent as Savings } from '../../../assets/Savings.svg';
import styles from './SandboxStorageSaving.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { GENERAL } from '../../../utils/appConstants';
import { useAppSelector } from '../../../store/storeHooks';
import { formatSize } from '../../../utils/utilityFunctions';

const SandboxStorageSaving = () => {
    const { t } = useTranslation();
    const windowSize = useResize();
    const { getSandboxSavings } = useAppSelector(state => state.sandbox);
    const { showNA } = useAppSelector(state => state.headers);
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
                    />
                </div>
            );
        }
        if (!showNA) {
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
                    />
                    <div className={styles.separator} />
                    <div
                        className={`${styles.progress} ${styles.rightCurveBar} ${
                            savingsPercentage === 100 ? styles.leftCurveBar : ''
                        }`}
                        style={{
                            width: `${savingsPercentage}%`,
                            backgroundColor: 'var(--chart-4)'
                        }}
                    />
                </div>
            );
        }
        if (showNA) {
            return (
                <div className={styles.progressBar}>
                    <div
                        className={`${styles.progress} ${styles.leftCurveBar} ${styles.rightCurveBar}`}
                        style={{
                            width: `${100}%`,
                            backgroundColor: 'var(--chart-disabled)'
                        }}
                    />
                </div>
            );
        }
    };
    return (
        <div className={styles.sandboxStorageSaving}>
            {windowSize.width > 1428 && (
                <div className={styles.largeContainer}>
                    <div
                        className={`${styles.firstSegment} ${styles.setWidth}`}
                        style={{ paddingRight: '0', width: '31.39%' }}
                    >
                        <div className={styles.leftSection}>
                            <Savings />
                        </div>
                        <div className={styles.rightSection}>
                            {!showNA && (
                                <DsTypography variant="Regular_32" style={{ lineHeight: 'unset' }}>
                                    {loading && (
                                        <div className={styles.loadingContainer}>
                                            <FlashingDotsLoader />
                                        </div>
                                    )}
                                    {!loading && savingsPercentToShow}
                                </DsTypography>
                            )}
                            {showNA && (
                                <DsTypography
                                    variant="Regular_14"
                                    className={`${CommonStyles.notAvailable} ${CommonStyles.notAvailableInformation}`}
                                >
                                    {t('databases.general.not-available')}
                                </DsTypography>
                            )}
                            <DsTypography variant="Regular_14" className={showNA ? CommonStyles.notAvailable : ''}>
                                Sandboxes storage savings
                            </DsTypography>
                        </div>
                    </div>

                    <div className={styles.secondSegment}>
                        {handleProgressBar()}

                        <div className={styles.secondRow}>
                            <div className={styles.bottomRow}>
                                <div
                                    className={styles.square}
                                    style={{ backgroundColor: showNA ? 'var(--chart-disabled)' : '#A815F3' }}
                                />
                                {!showNA && (
                                    <DsTypography variant="Semibold_14" style={{ lineHeight: 'unset' }}>
                                        {formatSize(sandboxSavings?.consumedStorage)}
                                    </DsTypography>
                                )}

                                <DsTypography
                                    variant="Regular_14"
                                    style={{ lineHeight: 'unset' }}
                                    className={showNA ? CommonStyles.notAvailable : ''}
                                >
                                    {GENERAL.SANDBOX_CONSUMED_STORAGE}
                                </DsTypography>
                            </div>

                            <div className={styles.bottomRow}>
                                <div
                                    className={styles.square}
                                    style={{ backgroundColor: showNA ? 'var(--chart-disabled)' : '#68C6B3' }}
                                />
                                {!showNA && (
                                    <DsTypography variant="Semibold_14" style={{ lineHeight: 'unset' }}>
                                        {formatSize(sandboxSavings?.savedStorage)}
                                    </DsTypography>
                                )}

                                <DsTypography
                                    variant="Regular_14"
                                    style={{ lineHeight: 'unset' }}
                                    className={showNA ? CommonStyles.notAvailable : ''}
                                >
                                    {windowSize.width > 1872 ? GENERAL.SANDBOX_STORAGE_SAVINGS : GENERAL.SAVINGS}
                                </DsTypography>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {windowSize.width <= 1428 && (
                <div className={styles.smallContainer}>
                    <div className={styles.firstSegment} style={{ paddingRight: '0', width: '250px' }}>
                        <div className={styles.leftSection}>
                            <Savings />
                        </div>
                        <div className={styles.rightSection}>
                            {!showNA && (
                                <DsTypography variant="Regular_32" style={{ lineHeight: 'unset' }}>
                                    {loading && (
                                        <div className={styles.loadingContainer}>
                                            <FlashingDotsLoader />
                                        </div>
                                    )}
                                    {!loading && savingsPercentToShow}
                                </DsTypography>
                            )}
                            {showNA && (
                                <DsTypography
                                    variant="Regular_14"
                                    className={`${CommonStyles.notAvailable} ${CommonStyles.notAvailableInformation}`}
                                >
                                    {t('databases.general.not-available')}
                                </DsTypography>
                            )}
                            <DsTypography variant="Regular_14" className={showNA ? CommonStyles.notAvailable : ''}>
                                {GENERAL.SANDBOX_STORAGE_SAVINGS}
                            </DsTypography>
                        </div>
                    </div>

                    <div className={styles.separator} />

                    <div className={styles.consumedSaving}>
                        <div className={styles.valueContainer}>
                            {loading && !showNA && (
                                <div className={styles.loadingContainer}>
                                    <FlashingDotsLoader />
                                </div>
                            )}
                            {!loading && !showNA && (
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
                            {showNA && (
                                <DsTypography
                                    variant="Regular_14"
                                    className={`${CommonStyles.notAvailable} ${CommonStyles.notAvailableInformation}`}
                                >
                                    {t('databases.general.not-available')}
                                </DsTypography>
                            )}
                        </div>
                        <DsTypography variant="Regular_14" className={showNA ? CommonStyles.notAvailable : ''}>
                            {GENERAL.SANDBOX_SAVINGS}
                        </DsTypography>
                    </div>

                    <div className={styles.separator} />

                    <div className={styles.consumedSaving}>
                        <div className={styles.valueContainer}>
                            {loading && !showNA && (
                                <div className={styles.loadingContainer}>
                                    <FlashingDotsLoader />
                                </div>
                            )}
                            {!loading && !showNA && (
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
                            {showNA && (
                                <DsTypography
                                    variant="Regular_14"
                                    className={`${CommonStyles.notAvailable} ${CommonStyles.notAvailableInformation}`}
                                >
                                    {t('databases.general.not-available')}
                                </DsTypography>
                            )}
                        </div>
                        <DsTypography variant="Regular_14" className={showNA ? CommonStyles.notAvailable : ''}>
                            {GENERAL.SANDBOX_CONSUMED_SAVING}
                        </DsTypography>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SandboxStorageSaving;
