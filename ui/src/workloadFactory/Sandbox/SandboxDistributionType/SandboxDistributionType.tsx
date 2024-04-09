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

const SandboxDistributionType = () => {
    const loading = false;
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
                                <DsTypography variant="Semibold_14" className={styles.name}>
                                    {GENERAL.DEVELOPMENT}
                                </DsTypography>
                                <DsTypography variant="Regular_24" className={styles.value}>
                                    55
                                </DsTypography>
                            </div>
                            <div className={styles.progressStyle}>
                                <ProgressBar value={55} color={'#5E8DCD'} />
                            </div>
                        </div>
                    </div>

                    <div className={styles.singleSection}>
                        <div className={styles.QASvg}>
                            <QA />
                        </div>

                        <div className={styles.valueSection}>
                            <div className={styles.topRow}>
                                <DsTypography variant="Semibold_14" className={styles.name}>
                                    {GENERAL.QA}
                                </DsTypography>
                                <DsTypography variant="Regular_24" className={styles.value}>
                                    40
                                </DsTypography>
                            </div>
                            <div className={styles.progressStyle}>
                                <ProgressBar value={40} color={'#5E8DCD'} />
                            </div>
                        </div>
                    </div>

                    <div className={styles.singleSection}>
                        <div className={CommonStyles.circleSVG}>
                            <Integration />
                        </div>

                        <div className={styles.valueSection}>
                            <div className={styles.topRow}>
                                <DsTypography variant="Semibold_14" className={styles.name}>
                                    {GENERAL.INTEGRATION}
                                </DsTypography>
                                <DsTypography variant="Regular_24" className={styles.value}>
                                    5
                                </DsTypography>
                            </div>
                            <div className={styles.progressStyle}>
                                <ProgressBar value={5} color={'#5E8DCD'} />
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
                                <DsTypography variant="Semibold_14" className={styles.name}>
                                    {GENERAL.TRAINING}
                                </DsTypography>
                                <DsTypography variant="Regular_24" className={styles.value}>
                                    15
                                </DsTypography>
                            </div>
                            <div className={styles.progressStyle}>
                                <ProgressBar value={15} color={'#5E8DCD'} />
                            </div>
                        </div>
                    </div>

                    <div className={styles.singleSection}>
                        <div className={CommonStyles.circleSVG}>
                            <Analytics />
                        </div>

                        <div className={styles.valueSection}>
                            <div className={styles.topRow}>
                                <DsTypography variant="Semibold_14" className={styles.name}>
                                    {GENERAL.ANALYTICS}
                                </DsTypography>
                                <DsTypography variant="Regular_24" className={styles.value}>
                                    5
                                </DsTypography>
                            </div>
                            <div className={styles.progressStyle}>
                                <ProgressBar value={5} color={'#5E8DCD'} />
                            </div>
                        </div>
                    </div>

                    <div className={styles.singleSection}>
                        <div className={CommonStyles.circleSVG}>
                            <Other />
                        </div>

                        <div className={styles.valueSection}>
                            <div className={styles.topRow}>
                                <DsTypography variant="Semibold_14" className={styles.name}>
                                    {GENERAL.SANDBOX_OTHER}
                                </DsTypography>
                                <DsTypography variant="Regular_24" className={styles.value}>
                                    0
                                </DsTypography>
                            </div>
                            <div className={styles.progressStyle}>
                                <ProgressBar value={0} color={'#5E8DCD'} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SandboxDistributionType;
