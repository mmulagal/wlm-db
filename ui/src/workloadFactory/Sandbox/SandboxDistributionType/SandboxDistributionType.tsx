import { DsTypography } from '@netapp/design-system';
import { ReactComponent as Dev } from '../../../assets/Dev.svg';
import { ReactComponent as Other } from '../../../assets/Other.svg';
import { ReactComponent as Analytics } from '../../../assets/Analytics.svg';
import { ReactComponent as Integration } from '../../../assets/Integration.svg';
import { ReactComponent as QA } from '../../../assets/QA.svg';
import { ReactComponent as Testing } from '../../../assets/Testing.svg';
import ProgressBar from '../../../common/ProgressBar/ProgressBar';
import styles from './SandboxDistributionType.module.scss';

const SandboxDistributionType = () => {
    return (
        <div className={styles.sandboxType}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    Sandboxes distribution by tag
                </DsTypography>
            </div>

            <div className={styles.mainSection}>
                <div className={styles.leftSide}>
                    <div className={styles.singleSection}>
                        <Dev />
                        <div className={styles.valueSection}>
                            <div className={styles.topRow}>
                                <DsTypography variant="Semibold_14" className={styles.name}>
                                    Dev
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
                        <QA />
                        <div className={styles.valueSection}>
                            <div className={styles.topRow}>
                                <DsTypography variant="Semibold_14" className={styles.name}>
                                    QA
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
                        <Integration />
                        <div className={styles.valueSection}>
                            <div className={styles.topRow}>
                                <DsTypography variant="Semibold_14" className={styles.name}>
                                    Integration
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
                        <Testing />
                        <div className={styles.valueSection}>
                            <div className={styles.topRow}>
                                <DsTypography variant="Semibold_14" className={styles.name}>
                                    Training
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
                        <Analytics />
                        <div className={styles.valueSection}>
                            <div className={styles.topRow}>
                                <DsTypography variant="Semibold_14" className={styles.name}>
                                    Analytics
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
                        <Other />
                        <div className={styles.valueSection}>
                            <div className={styles.topRow}>
                                <DsTypography variant="Semibold_14" className={styles.name}>
                                    Other
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
