import { DsFlashingDotsLoader, DsTypography, TooltipInfo } from '@netapp/design-system';
import { ReactComponent as DevCircle } from '../../../assets/DevCircle.svg';
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
};

const OptimizeComponent = ({
    text,
    value,
    data,
    image,
    isComingSoon,
    allConfigurationsDismissed
}: OptimizeComponentType) => {
    const loading = useAppSelector(state => state.getWellOptimize.optimizePageLoading);
    const isAssessmentAvailable = useAppSelector(state => state.getWellOptimize.isAssessmentAvailable);

    return (
        <div className={styles.optimizeComponent}>
            <div className={styles.svgContainer}>{image}</div>

            <div className={styles.rightSection}>
                <div className={styles.topSection}>
                    <div className={styles.textWithLoading}>
                        {(!isAssessmentAvailable && !loading) || allConfigurationsDismissed ? (
                            <DsTypography variant="Semibold_14" isDisabled>
                                {text}
                            </DsTypography>
                        ) : (
                            <DsTypography variant="Semibold_14">{text}</DsTypography>
                        )}

                        {loading && !isComingSoon && <DsFlashingDotsLoader />}
                    </div>

                    <div className={styles.optimizeText}>
                        {!isComingSoon &&
                            ((!isAssessmentAvailable && !loading) || allConfigurationsDismissed ? (
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

                        {/* <DsTypography variant="Regular_14">Optimized</DsTypography> */}
                    </div>
                </div>

                <div className={styles.bottomSection}>
                    <GetWellBar
                        barValue={value}
                        isComingSoon={isComingSoon}
                        allConfigurationsDismissed={allConfigurationsDismissed}
                    />
                </div>

                {!isComingSoon && !allConfigurationsDismissed && (
                    <div className={styles.bottomTextSection}>
                        {!loading && !isAssessmentAvailable ? (
                            <div style={{ height: '24px' }} />
                        ) : (
                            <div className={styles.tooltipContainer}>
                                <DsTypography variant="Regular_14">Well-architected configurations:</DsTypography>
                            </div>
                        )}

                        {!loading &&
                            (isAssessmentAvailable ? (
                                <DsTypography variant="Semibold_14">
                                    {data?.optimized} out of {data?.total}
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
