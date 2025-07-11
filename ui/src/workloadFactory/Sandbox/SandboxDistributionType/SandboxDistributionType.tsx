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
import { getSandboxDistributionByTag } from '../SandboxUtility';

const SandboxDistributionType = () => {
    const { aggregatedSandboxList, getSandboxList } = useAppSelector(state => state.sandbox);
    const { showNA } = useAppSelector(state => state.headers);
    const { sandboxListLoading: loading } = getSandboxList;
    const distributionByTags = getSandboxDistributionByTag(aggregatedSandboxList);
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
                                    className={showNA ? `${styles.name} ${CommonStyles.notAvailable}` : styles.name}
                                >
                                    {GENERAL.DEVELOPMENT}
                                </DsTypography>
                                {!showNA && (
                                    <DsTypography variant="Regular_24" className={styles.value}>
                                        {distributionByTags[GENERAL.DEVELOPMENT]}
                                    </DsTypography>
                                )}
                                {showNA && (
                                    <DsTypography
                                        variant="Regular_16"
                                        className={`${styles.value} ${CommonStyles.notAvailable}`}
                                    >
                                        {GENERAL.NOT_AVAILABLE}
                                    </DsTypography>
                                )}
                            </div>
                            <div className={styles.progressStyle}>
                                <ProgressBar
                                    max={aggregatedSandboxList.length}
                                    value={showNA || loading ? 0 : distributionByTags[GENERAL.DEVELOPMENT]}
                                    color={showNA || loading ? 'var(--chart-disabled)' : '#5E8DCD'}
                                />
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
                                    className={showNA ? `${styles.name} ${CommonStyles.notAvailable}` : styles.name}
                                >
                                    {GENERAL.QA}
                                </DsTypography>
                                {!showNA && (
                                    <DsTypography variant="Regular_24" className={styles.value}>
                                        {distributionByTags[GENERAL.QA]}
                                    </DsTypography>
                                )}
                                {showNA && (
                                    <DsTypography
                                        variant="Regular_16"
                                        className={`${styles.value} ${CommonStyles.notAvailable}`}
                                    >
                                        {GENERAL.NOT_AVAILABLE}
                                    </DsTypography>
                                )}
                            </div>
                            <div className={styles.progressStyle}>
                                <ProgressBar
                                    max={aggregatedSandboxList.length}
                                    value={showNA || loading ? 0 : distributionByTags[GENERAL.QA]}
                                    color={showNA || loading ? 'var(--chart-disabled)' : '#5E8DCD'}
                                />
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
                                    className={showNA ? `${styles.name} ${CommonStyles.notAvailable}` : styles.name}
                                >
                                    {GENERAL.INTEGRATION}
                                </DsTypography>
                                {!showNA && (
                                    <DsTypography variant="Regular_24" className={styles.value}>
                                        {distributionByTags[GENERAL.INTEGRATION]}
                                    </DsTypography>
                                )}
                                {showNA && (
                                    <DsTypography
                                        variant="Regular_16"
                                        className={`${styles.value} ${CommonStyles.notAvailable}`}
                                    >
                                        {GENERAL.NOT_AVAILABLE}
                                    </DsTypography>
                                )}
                            </div>
                            <div className={styles.progressStyle}>
                                <ProgressBar
                                    max={aggregatedSandboxList.length}
                                    value={showNA || loading ? 0 : distributionByTags[GENERAL.INTEGRATION]}
                                    color={showNA || loading ? 'var(--chart-disabled)' : '#5E8DCD'}
                                />
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
                                    className={showNA ? `${styles.name} ${CommonStyles.notAvailable}` : styles.name}
                                >
                                    {GENERAL.TRAINING}
                                </DsTypography>
                                {!showNA && (
                                    <DsTypography variant="Regular_24" className={styles.value}>
                                        {distributionByTags[GENERAL.TRAINING]}
                                    </DsTypography>
                                )}
                                {showNA && (
                                    <DsTypography
                                        variant="Regular_16"
                                        className={`${styles.value} ${CommonStyles.notAvailable}`}
                                    >
                                        {GENERAL.NOT_AVAILABLE}
                                    </DsTypography>
                                )}
                            </div>
                            <div className={styles.progressStyle}>
                                <ProgressBar
                                    max={aggregatedSandboxList.length}
                                    value={showNA || loading ? 0 : distributionByTags[GENERAL.TRAINING]}
                                    color={showNA || loading ? 'var(--chart-disabled)' : '#5E8DCD'}
                                />
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
                                    className={showNA ? `${styles.name} ${CommonStyles.notAvailable}` : styles.name}
                                >
                                    {GENERAL.ANALYTICS}
                                </DsTypography>
                                {!showNA && (
                                    <DsTypography variant="Regular_24" className={styles.value}>
                                        {distributionByTags[GENERAL.ANALYTICS]}
                                    </DsTypography>
                                )}
                                {showNA && (
                                    <DsTypography
                                        variant="Regular_16"
                                        className={`${styles.value} ${CommonStyles.notAvailable}`}
                                    >
                                        {GENERAL.NOT_AVAILABLE}
                                    </DsTypography>
                                )}
                            </div>
                            <div className={styles.progressStyle}>
                                <ProgressBar
                                    max={aggregatedSandboxList.length}
                                    value={showNA || loading ? 0 : distributionByTags[GENERAL.ANALYTICS]}
                                    color={showNA || loading ? 'var(--chart-disabled)' : '#5E8DCD'}
                                />
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
                                    className={showNA ? `${styles.name} ${CommonStyles.notAvailable}` : styles.name}
                                >
                                    {GENERAL.SANDBOX_OTHER}
                                </DsTypography>
                                {!showNA && (
                                    <DsTypography variant="Regular_24" className={styles.value}>
                                        {distributionByTags[GENERAL.SANDBOX_OTHER]}
                                    </DsTypography>
                                )}
                                {showNA && (
                                    <DsTypography
                                        variant="Regular_16"
                                        className={`${styles.value} ${CommonStyles.notAvailable}`}
                                    >
                                        {GENERAL.NOT_AVAILABLE}
                                    </DsTypography>
                                )}
                            </div>
                            <div className={styles.progressStyle}>
                                <ProgressBar
                                    max={aggregatedSandboxList.length}
                                    value={showNA || loading ? 0 : distributionByTags[GENERAL.SANDBOX_OTHER]}
                                    color={showNA || loading ? 'var(--chart-disabled)' : '#5E8DCD'}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SandboxDistributionType;
