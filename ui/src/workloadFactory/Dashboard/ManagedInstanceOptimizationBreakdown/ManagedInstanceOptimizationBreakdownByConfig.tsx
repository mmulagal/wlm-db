import { DsButton, DsTypography } from '@netapp/design-system';
import styles from './ManagedInstanceOptimizationBreakdownByConfig.module.scss';
import BarComponent from '../BarComponent/BarComponent';
import SeparatorComponent from '../../../common/SeparatorComponent/SeparatorComponent';

const ManagedInstanceOptimizationBreakdownByConfig = () => {
    return (
        <div className={styles.managedBreakdown}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    Managed instances optimization breakdown by configurations
                </DsTypography>

                {/* {loading && <FlashingDotsLoader />} */}
            </div>

            <div className={styles.mainSection}>
                <div className={`${styles.tile} ${styles.firstTile}`}>
                    <BarComponent
                        color="#5E8DCD"
                        headingText="Storage tier"
                        percentage={55}
                        beforeOutOf={65}
                        afterOutOf={120}
                        bottomText="Optimized instances:"
                        width="360px"
                    />

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton variant="secondary" isThin={true} onClick={() => {}}>
                            Optimize
                        </DsButton>
                    </div>
                </div>

                <div className={styles.tile}>
                    <BarComponent
                        color="#5E8DCD"
                        headingText="File system headroom"
                        percentage={55}
                        beforeOutOf={65}
                        afterOutOf={120}
                        bottomText="Optimized instances:"
                        width="360px"
                    />

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton variant="secondary" isThin={true} onClick={() => {}}>
                            Optimize
                        </DsButton>
                    </div>
                </div>

                <div className={styles.tile}>
                    <BarComponent
                        color="#5E8DCD"
                        headingText="Log drive size "
                        percentage={55}
                        beforeOutOf={65}
                        afterOutOf={120}
                        bottomText="Optimized instances:"
                        width="360px"
                    />

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton variant="secondary" isThin={true} onClick={() => {}}>
                            Optimize
                        </DsButton>
                    </div>
                </div>

                <div className={styles.tile}>
                    <BarComponent
                        color="#5E8DCD"
                        headingText="TempDB drive size"
                        percentage={55}
                        beforeOutOf={65}
                        afterOutOf={120}
                        bottomText="Optimized instances:"
                        width="360px"
                    />

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton variant="secondary" isThin={true} onClick={() => {}}>
                            Optimize
                        </DsButton>
                    </div>
                </div>

                <div className={styles.tile}>
                    <BarComponent
                        color="#5E8DCD"
                        headingText="User data files (.mdf) "
                        percentage={55}
                        beforeOutOf={65}
                        afterOutOf={120}
                        bottomText="Optimized instances:"
                        width="360px"
                    />

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton variant="secondary" isThin={true} onClick={() => {}}>
                            Optimize
                        </DsButton>
                    </div>
                </div>

                <div className={styles.tile}>
                    <BarComponent
                        color="#5E8DCD"
                        headingText="Log files (.ldf) "
                        percentage={55}
                        beforeOutOf={65}
                        afterOutOf={120}
                        bottomText="Optimized instances:"
                        width="360px"
                    />

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton variant="secondary" isThin={true} onClick={() => {}}>
                            Optimize
                        </DsButton>
                    </div>
                </div>

                <div className={styles.tile}>
                    <BarComponent
                        color="#5E8DCD"
                        headingText="TempDB placement"
                        percentage={55}
                        beforeOutOf={65}
                        afterOutOf={120}
                        bottomText="Optimized instances:"
                        width="360px"
                    />

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton variant="secondary" isThin={true} onClick={() => {}}>
                            Optimize
                        </DsButton>
                    </div>
                </div>

                <div className={styles.tile}>
                    <BarComponent
                        color="#5E8DCD"
                        headingText="ONTAP configuration"
                        percentage={55}
                        beforeOutOf={65}
                        afterOutOf={120}
                        bottomText="Optimized instances:"
                        width="360px"
                    />

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton variant="secondary" isThin={true} onClick={() => {}}>
                            Optimize
                        </DsButton>
                    </div>
                </div>

                <div className={styles.tile}>
                    <BarComponent
                        color="#5E8DCD"
                        headingText="Operating system"
                        percentage={55}
                        beforeOutOf={65}
                        afterOutOf={100}
                        bottomText="Optimized instances:"
                        width="360px"
                    />

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton variant="secondary" isThin={true} onClick={() => {}}>
                            Optimize
                        </DsButton>
                    </div>
                </div>

                <div className={styles.tile}>
                    <BarComponent
                        color="#5E8DCD"
                        headingText="Compute rightsizing"
                        percentage={55}
                        beforeOutOf={65}
                        afterOutOf={100}
                        bottomText="Optimized instances:"
                        width="360px"
                    />

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton variant="secondary" isThin={true} onClick={() => {}}>
                            Optimize
                        </DsButton>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ManagedInstanceOptimizationBreakdownByConfig;
