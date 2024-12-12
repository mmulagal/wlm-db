import { DsButton, DsTypography } from '@netapp/design-system';
import styles from './ManagedInstanceOptimizationBreakdownByConfig.module.scss';
import BarComponent from '../BarComponent/BarComponent';
import SeparatorComponent from '../../../common/SeparatorComponent/SeparatorComponent';
import { useDispatch } from 'react-redux';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';
import { WLF_TABS } from '../../../utils/consts';
import { setSelectedConfig } from '../../../store/workloadFactory/databaseHomeSlice';

const ManagedInstanceOptimizationBreakdownByConfig = ({ openAccordion }: boolean | any) => {
    const dispatch = useDispatch();
    const handleOptimize = (type: string) => {
        dispatch(setSelectedHeaderTab(WLF_TABS.DASHBOARD_INNER_PAGE));
        dispatch(setSelectedConfig(type));
    };
    return (
        <div className={styles.managedBreakdown} style={{ height: !openAccordion ? '436px' : '992px' }}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    Managed instances optimization breakdown by configurations
                </DsTypography>

                {/* {loading && <FlashingDotsLoader />} */}
            </div>

            <div className={styles.mainSection} style={{ maxHeight: !openAccordion ? '316px' : '896px' }}>
                <div className={`${styles.tile} ${styles.firstTile}`}>
                    <BarComponent
                        color="#5E8DCD"
                        headingText="Storage tier"
                        percentage={55}
                        beforeOutOf={65}
                        afterOutOf={120}
                        bottomText="Optimized instances:"
                        width="360px"
                        from="dashboard"
                        optimizePercentage={0}
                    />

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton
                            variant="secondary"
                            isThin={true}
                            onClick={() => {
                                handleOptimize('Storage tier');
                            }}
                        >
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
                        from="dashboard"
                        optimizePercentage={10}
                    />

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton
                            variant="secondary"
                            isThin={true}
                            onClick={() => {
                                handleOptimize('File system headroom');
                            }}
                        >
                            Optimize
                        </DsButton>
                    </div>
                </div>

                <div className={styles.tile}>
                    <BarComponent
                        color="#5E8DCD"
                        headingText="Log drive size"
                        percentage={55}
                        beforeOutOf={65}
                        afterOutOf={120}
                        bottomText="Optimized instances:"
                        width="360px"
                        from="dashboard"
                        optimizePercentage={0}
                    />

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton
                            variant="secondary"
                            isThin={true}
                            onClick={() => {
                                handleOptimize('Log drive size');
                            }}
                        >
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
                        from="dashboard"
                        optimizePercentage={0}
                    />

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton
                            variant="secondary"
                            isThin={true}
                            onClick={() => {
                                handleOptimize('TempDB drive size');
                            }}
                        >
                            Optimize
                        </DsButton>
                    </div>
                </div>

                <div className={styles.tile}>
                    <BarComponent
                        color="#5E8DCD"
                        headingText="User data files (.mdf)"
                        percentage={55}
                        beforeOutOf={65}
                        afterOutOf={120}
                        bottomText="Optimized instances:"
                        width="360px"
                        from="dashboard"
                        optimizePercentage={0}
                    />

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton
                            variant="secondary"
                            isThin={true}
                            onClick={() => {
                                handleOptimize('User data files (.mdf)');
                            }}
                        >
                            Optimize
                        </DsButton>
                    </div>
                </div>

                <div className={styles.tile}>
                    <BarComponent
                        color="#5E8DCD"
                        headingText="Log files (.ldf)"
                        percentage={55}
                        beforeOutOf={65}
                        afterOutOf={120}
                        bottomText="Optimized instances:"
                        width="360px"
                        from="dashboard"
                        optimizePercentage={0}
                    />

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton
                            variant="secondary"
                            isThin={true}
                            onClick={() => {
                                handleOptimize('Log files (.ldf)');
                            }}
                        >
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
                        from="dashboard"
                        optimizePercentage={0}
                    />

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton
                            variant="secondary"
                            isThin={true}
                            onClick={() => {
                                handleOptimize('TempDB placement');
                            }}
                        >
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
                        from="dashboard"
                        optimizePercentage={0}
                    />

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton
                            variant="secondary"
                            isThin={true}
                            onClick={() => {
                                handleOptimize('ONTAP configuration');
                            }}
                        >
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
                        from="dashboard"
                        optimizePercentage={0}
                    />

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton
                            variant="secondary"
                            isThin={true}
                            onClick={() => {
                                handleOptimize('Operating system');
                            }}
                        >
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
                        from="dashboard"
                        optimizePercentage={0}
                    />

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton
                            variant="secondary"
                            isThin={true}
                            onClick={() => {
                                handleOptimize('Compute rightsizing');
                            }}
                        >
                            Optimize
                        </DsButton>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ManagedInstanceOptimizationBreakdownByConfig;
