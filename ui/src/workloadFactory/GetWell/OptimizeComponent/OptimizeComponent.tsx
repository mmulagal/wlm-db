import { DsFlashingDotsLoader, DsTypography } from '@netapp/design-system';
import styles from './OptimizeComponent.module.scss';
import GetWellBar from './GetWellBar/GetWellBar';
import { useAppSelector } from '../../../store/storeHooks';
import { GENERAL } from '../../../utils/appConstants';

type OptimizeComponentType = {
    text: string;
    value: string | any;
    data?: { optimized?: number; total?: number; hasDismissedOrPostponed?: boolean };
    image: any;
    isComingSoon: boolean;
    allConfigurationsDismissed?: boolean;
    isDisabled?: boolean;
};

const OptimizeComponent = ({
    text,
    value,
    data,
    image,
    isComingSoon,
    allConfigurationsDismissed,
    isDisabled = false
}: OptimizeComponentType) => {
    const loading = useAppSelector(state => state.getWellOptimize.optimizePageLoading);
    const isAssessmentAvailable = useAppSelector(state => state.getWellOptimize.isAssessmentAvailable);

    // Simplified disabled state logic
    const isComponentDisabled = !loading && isDisabled;
    const isUnavailable = !loading && !isAssessmentAvailable;
    const shouldShowDisabledState = isComponentDisabled || isUnavailable || allConfigurationsDismissed;
    const showConfigurationDetails = isAssessmentAvailable || isDisabled;

    return (
        <div className={`${styles.optimizeComponent} ${isComponentDisabled ? styles.disabled : ''}`}>
            <div className={styles.svgContainer}>{image}</div>

            <div className={styles.rightSection}>
                <div className={styles.topSection}>
                    <div className={styles.textWithLoading}>
                        <DsTypography variant="Semibold_14" isDisabled={shouldShowDisabledState}>
                            {text}
                        </DsTypography>
                        {loading && !isComingSoon && <DsFlashingDotsLoader />}
                    </div>

                    <div className={styles.optimizeText}>
                        {!isComingSoon &&
                            (shouldShowDisabledState ? (
                                <DsTypography
                                    variant="Regular_14"
                                    style={{ lineHeight: 'unset', marginTop: '5px' }}
                                    isDisabled
                                >
                                    {allConfigurationsDismissed ? 'Dismissed' : GENERAL.NOT_AVAILABLE}
                                </DsTypography>
                            ) : (
                                <DsTypography variant="Regular_20" style={{ lineHeight: 'unset' }}>
                                    {`${value}%`}
                                </DsTypography>
                            ))}
                        {isComingSoon && (
                            <DsTypography variant="Regular_20" style={{ lineHeight: 'unset' }}>
                                {value}
                            </DsTypography>
                        )}
                    </div>
                </div>

                <div className={styles.bottomSection}>
                    <GetWellBar
                        barValue={value}
                        isComingSoon={isComingSoon}
                        allConfigurationsDismissed={allConfigurationsDismissed || isComponentDisabled}
                    />
                </div>

                {!isComingSoon && !allConfigurationsDismissed && (
                    <div className={styles.bottomTextSection}>
                        {isUnavailable && !isDisabled ? (
                            <div style={{ height: '24px' }} />
                        ) : (
                            <div className={styles.tooltipContainer}>
                                <DsTypography variant="Regular_14" isDisabled={isComponentDisabled}>
                                    Well-architected configurations:
                                </DsTypography>
                            </div>
                        )}

                        {!loading &&
                            (showConfigurationDetails ? (
                                <DsTypography variant="Semibold_14" isDisabled={isComponentDisabled}>
                                    {data?.optimized ?? 0} out of {data?.total ?? 0}
                                </DsTypography>
                            ) : (
                                <div style={{ height: '24px' }} />
                            ))}
                        {loading && <DsTypography variant="Semibold_14">0 out of X</DsTypography>}
                    </div>
                )}
                {isComingSoon && <div style={{ height: '24px' }} />}
            </div>
        </div>
    );
};

export default OptimizeComponent;
