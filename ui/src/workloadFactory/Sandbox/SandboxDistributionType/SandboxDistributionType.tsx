import { DsTypography, FlashingDotsLoader } from '@netapp/design-system';
import { ReactComponent as Dev } from '../../../assets/Dev.svg';
import { ReactComponent as Other } from '../../../assets/Other.svg';
import { ReactComponent as Analytics } from '../../../assets/Analytics.svg';
import { ReactComponent as Integration } from '../../../assets/Integration.svg';
import { ReactComponent as QA } from '../../../assets/QA.svg';
import { ReactComponent as Testing } from '../../../assets/Testing.svg';
import ProgressBar from '../../../common/ProgressBar/ProgressBar';
import styles from './SandboxDistributionType.module.scss';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { GENERAL } from '../../../utils/appConstants';
import { useAppSelector } from '../../../store/storeHooks';

const SandboxDistributionType = () => {
    const loading = false;
    const { isNA } = useAppSelector(state => state.sandbox);
    return (
        <div className={styles.sandboxType}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    {GENERAL.DISTRIBUTION_BY_TAG}
                </DsTypography>

                {loading && <FlashingDotsLoader />}
            </div>

            <div className={styles.mainSection}>
                <div className={styles.leftSide}>
                    <div className={styles.singleSection}>
                        <div className={CommonStyles.circleSVG}>
                            <Dev />
                        </div>

                        <div className={styles.valueSection}>
                            <div className={styles.topRow}>
                                <DsTypography
                                    variant="Semibold_14"
                                    className={isNA ? `${styles.name} ${CommonStyles.notAvailable}` : styles.name}
                                >
                                    {GENERAL.DEVELOPMENT}
                                </DsTypography>
                                {!isNA && (
                                    <DsTypography variant="Regular_24" className={styles.value}>
                                        55
                                    </DsTypography>
                                )}
                                {isNA && (
                                    <DsTypography
                                        variant="Regular_16"
                                        className={`${styles.value} ${CommonStyles.notAvailable}`}
                                    >
                                        {GENERAL.NOT_AVAILABLE}
                                    </DsTypography>
                                )}
                            </div>
                            <div className={styles.progressStyle}>
                                <ProgressBar value={isNA ? 0 : 55} color={isNA ? 'var(--chart-disabled)' : '#5E8DCD'} />
                            </div>
                        </div>
                    </div>

                    <div className={styles.singleSection}>
                        <div className={styles.QASvg}>
                            <QA />
                        </div>

                        <div className={styles.valueSection}>
                            <div className={styles.topRow}>
                                <DsTypography
                                    variant="Semibold_14"
                                    className={isNA ? `${styles.name} ${CommonStyles.notAvailable}` : styles.name}
                                >
                                    {GENERAL.QA}
                                </DsTypography>
                                {!isNA && (
                                    <DsTypography variant="Regular_24" className={styles.value}>
                                        40
                                    </DsTypography>
                                )}
                                {isNA && (
                                    <DsTypography
                                        variant="Regular_16"
                                        className={`${styles.value} ${CommonStyles.notAvailable}`}
                                    >
                                        {GENERAL.NOT_AVAILABLE}
                                    </DsTypography>
                                )}
                            </div>
                            <div className={styles.progressStyle}>
                                <ProgressBar value={isNA ? 0 : 40} color={isNA ? 'var(--chart-disabled)' : '#5E8DCD'} />
                            </div>
                        </div>
                    </div>

                    <div className={styles.singleSection}>
                        <div className={CommonStyles.circleSVG}>
                            <Integration />
                        </div>

                        <div className={styles.valueSection}>
                            <div className={styles.topRow}>
                                <DsTypography
                                    variant="Semibold_14"
                                    className={isNA ? `${styles.name} ${CommonStyles.notAvailable}` : styles.name}
                                >
                                    {GENERAL.INTEGRATION}
                                </DsTypography>
                                {isNA && (
                                    <DsTypography variant="Regular_24" className={styles.value}>
                                        5
                                    </DsTypography>
                                )}
                                {isNA && (
                                    <DsTypography
                                        variant="Regular_16"
                                        className={`${styles.value} ${CommonStyles.notAvailable}`}
                                    >
                                        {GENERAL.NOT_AVAILABLE}
                                    </DsTypography>
                                )}
                            </div>
                            <div className={styles.progressStyle}>
                                <ProgressBar value={isNA ? 0 : 5} color={isNA ? 'var(--chart-disabled)' : '#5E8DCD'} />
                            </div>
                        </div>
                    </div>
                </div>

                <div className={styles.rightSide}>
                    <div className={styles.singleSection}>
                        <div className={CommonStyles.circleSVG}>
                            <Testing />
                        </div>

                        <div className={styles.valueSection}>
                            <div className={styles.topRow}>
                                <DsTypography
                                    variant="Semibold_14"
                                    className={isNA ? `${styles.name} ${CommonStyles.notAvailable}` : styles.name}
                                >
                                    {GENERAL.TRAINING}
                                </DsTypography>
                                {!isNA && (
                                    <DsTypography variant="Regular_24" className={styles.value}>
                                        15
                                    </DsTypography>
                                )}
                                {isNA && (
                                    <DsTypography
                                        variant="Regular_16"
                                        className={`${styles.value} ${CommonStyles.notAvailable}`}
                                    >
                                        {GENERAL.NOT_AVAILABLE}
                                    </DsTypography>
                                )}
                            </div>
                            <div className={styles.progressStyle}>
                                <ProgressBar value={isNA ? 0 : 15} color={isNA ? 'var(--chart-disabled)' : '#5E8DCD'} />
                            </div>
                        </div>
                    </div>

                    <div className={styles.singleSection}>
                        <div className={CommonStyles.circleSVG}>
                            <Analytics />
                        </div>

                        <div className={styles.valueSection}>
                            <div className={styles.topRow}>
                                <DsTypography
                                    variant="Semibold_14"
                                    className={isNA ? `${styles.name} ${CommonStyles.notAvailable}` : styles.name}
                                >
                                    {GENERAL.ANALYTICS}
                                </DsTypography>
                                {!isNA && (
                                    <DsTypography variant="Regular_24" className={styles.value}>
                                        5
                                    </DsTypography>
                                )}
                                {isNA && (
                                    <DsTypography
                                        variant="Regular_16"
                                        className={`${styles.value} ${CommonStyles.notAvailable}`}
                                    >
                                        {GENERAL.NOT_AVAILABLE}
                                    </DsTypography>
                                )}
                            </div>
                            <div className={styles.progressStyle}>
                                <ProgressBar value={isNA ? 0 : 5} color={isNA ? 'var(--chart-disabled)' : '#5E8DCD'} />
                            </div>
                        </div>
                    </div>

                    <div className={styles.singleSection}>
                        <div className={CommonStyles.circleSVG}>
                            <Other />
                        </div>

                        <div className={styles.valueSection}>
                            <div className={styles.topRow}>
                                <DsTypography
                                    variant="Semibold_14"
                                    className={isNA ? `${styles.name} ${CommonStyles.notAvailable}` : styles.name}
                                >
                                    {GENERAL.SANDBOX_OTHER}
                                </DsTypography>
                                {!isNA && (
                                    <DsTypography variant="Regular_24" className={styles.value}>
                                        0
                                    </DsTypography>
                                )}
                                {isNA && (
                                    <DsTypography
                                        variant="Regular_16"
                                        className={`${styles.value} ${CommonStyles.notAvailable}`}
                                    >
                                        {GENERAL.NOT_AVAILABLE}
                                    </DsTypography>
                                )}
                            </div>
                            <div className={styles.progressStyle}>
                                <ProgressBar value={isNA ? 0 : 0} color={isNA ? 'var(--chart-disabled)' : '#5E8DCD'} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SandboxDistributionType;
