import { DsButton, DsTypography, FlashingDotsLoader } from '@netapp/design-system';
import styles from './ManagedInstanceOptimizationBreakdownByConfig.module.scss';
import BarComponent from '../BarComponent/BarComponent';
import SeparatorComponent from '../../../common/SeparatorComponent/SeparatorComponent';
import { useDispatch } from 'react-redux';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';
import { WLF_TABS } from '../../../utils/consts';
import { setSelectedConfig } from '../../../store/workloadFactory/databaseHomeSlice';
import useResize from '../../../common/hooks/useResize';
import { useAppSelector } from '../../../store/storeHooks';
import { useMemo } from 'react';
import { getAssessmentGroupedByConfigurations } from '../../DatabaseHomePage/DatabaseHomeUtils';
import { GENERAL } from '../../../utils/appConstants';
import TooltipComponent from '../../../common/TooltipComponent/TooltipComponent';

const ManagedInstanceOptimizationBreakdownByConfig = ({ openAccordion }: boolean | any) => {
    const { allmssqlHostAssessmentData, allmssqlHostAssessmentLoading } = useAppSelector(state => state.inventoryV2);
    const dispatch = useDispatch();
    const windowSize = useResize();
    const handleOptimize = (type: string) => {
        dispatch(setSelectedHeaderTab(WLF_TABS.DASHBOARD_INNER_PAGE));
        dispatch(setSelectedConfig(type));
    };

    const configData = useMemo(() => {
        return getAssessmentGroupedByConfigurations(allmssqlHostAssessmentData);
    }, [allmssqlHostAssessmentData]);

    return (
        <div className={styles.managedBreakdown} style={{ height: !openAccordion ? '436px' : '992px' }}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    Managed instances optimization breakdown by configurations
                </DsTypography>

                {allmssqlHostAssessmentLoading && <FlashingDotsLoader />}
            </div>

            <div className={styles.mainSection} style={{ maxHeight: !openAccordion ? '316px' : '896px' }}>
                <div className={`${styles.tile} ${styles.firstTile}`}>
                    <BarComponent
                        color="#5E8DCD"
                        headingText="Storage tier"
                        percentage={Math.round(((configData?.storageTier || 0) / (configData.total || 1)) * 100)}
                        beforeOutOf={configData?.storageTier || 0}
                        afterOutOf={configData?.total || 0}
                        bottomText="Optimized instances:"
                        width={windowSize.width > 1700 ? '360px' : '280px'}
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
                        percentage={Math.round(((configData.fileSystemHeadroom || 0) / (configData.total || 1)) * 100)}
                        beforeOutOf={configData.fileSystemHeadroom}
                        afterOutOf={configData.total}
                        bottomText="Optimized instances:"
                        width={windowSize.width > 1700 ? '360px' : '280px'}
                        from="dashboard"
                        optimizePercentage={0}
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
                        percentage={Math.round(((configData.logDriveSize || 0) / (configData.total || 1)) * 100)}
                        beforeOutOf={configData.logDriveSize}
                        afterOutOf={configData.total}
                        bottomText="Optimized instances:"
                        width={windowSize.width > 1700 ? '360px' : '280px'}
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
                        percentage={Math.round(((configData.tempdbDriveSize || 0) / (configData.total || 1)) * 100)}
                        beforeOutOf={configData.tempdbDriveSize}
                        afterOutOf={configData.total}
                        bottomText="Optimized instances:"
                        width={windowSize.width > 1700 ? '360px' : '280px'}
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
                        percentage={Math.round(((configData.userDataFiles || 0) / (configData.total || 1)) * 100)}
                        beforeOutOf={configData.userDataFiles}
                        afterOutOf={configData.total}
                        bottomText="Optimized instances:"
                        width={windowSize.width > 1700 ? '360px' : '280px'}
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
                        percentage={Math.round(((configData.logFiles || 0) / (configData.total || 1)) * 100)}
                        beforeOutOf={configData.logFiles}
                        afterOutOf={configData.total}
                        bottomText="Optimized instances:"
                        width={windowSize.width > 1700 ? '360px' : '280px'}
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
                        percentage={Math.round(((configData.tempdbPlacement || 0) / (configData.total || 1)) * 100)}
                        beforeOutOf={configData.tempdbPlacement}
                        afterOutOf={configData.total}
                        bottomText="Optimized instances:"
                        width={windowSize.width > 1700 ? '360px' : '280px'}
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
                        percentage={Math.round(((configData.ontapConfiguration || 0) / (configData.total || 1)) * 100)}
                        beforeOutOf={configData.ontapConfiguration}
                        afterOutOf={configData.total}
                        bottomText="Optimized instances:"
                        width={windowSize.width > 1700 ? '360px' : '280px'}
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
                        percentage={Math.round(((configData.operatingSystem || 0) / (configData.total || 1)) * 100)}
                        beforeOutOf={configData.operatingSystem}
                        afterOutOf={configData.total}
                        bottomText="Optimized instances:"
                        width={windowSize.width > 1700 ? '360px' : '280px'}
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
                        headingText={GENERAL.COMPUTE_RIGHTSIZING}
                        percentage={Math.round(((configData.computeRightsizing || 0) / (configData.total || 1)) * 100)}
                        beforeOutOf={configData.computeRightsizing}
                        afterOutOf={configData.total}
                        bottomText="Optimized instances:"
                        width={windowSize.width > 1700 ? '360px' : '280px'}
                        from="dashboard"
                        optimizePercentage={0}
                    />

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton
                            variant="secondary"
                            isThin={true}
                            onClick={() => {
                                handleOptimize(GENERAL.COMPUTE_RIGHTSIZING);
                            }}
                        >
                            Optimize
                        </DsButton>
                    </div>
                </div>

                <div className={styles.tile}>
                    <BarComponent
                        color="#5E8DCD"
                        headingText={GENERAL.OPERATING_SYSTEM_PATCH}
                        percentage={Math.round(((configData.operatingSystemPatch || 0) / (configData.total || 1)) * 100)}
                        beforeOutOf={configData.operatingSystemPatch}
                        afterOutOf={configData.total}
                        bottomText="Optimized instances:"
                        width={windowSize.width > 1700 ? '360px' : '280px'}
                        from="dashboard"
                        optimizePercentage={0}
                    />

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <TooltipComponent
                            title={GENERAL.OPTIMIZATION_NOT_SUPPORTED}
                            placement="bottom"
                            width="120px"
                            height="30px"
                        >
                            <div>
                                <DsButton variant="secondary" isDisabled={true}>
                                    Optimize
                                </DsButton>
                            </div>
                        </TooltipComponent>
                    </div>
                </div>

                <div className={styles.tile}>
                    <BarComponent
                        color="#5E8DCD"
                        headingText={GENERAL.APPLICATION_SQL_SERVER}
                        percentage={Math.round(((configData.applicationSqlServer || 0) / (configData.total || 1)) * 100)}
                        beforeOutOf={configData.applicationSqlServer}
                        afterOutOf={configData.total}
                        bottomText="Optimized instances:"
                        width={windowSize.width > 1700 ? '360px' : '280px'}
                        from="dashboard"
                        optimizePercentage={0}
                    />

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <TooltipComponent
                            title={GENERAL.OPTIMIZATION_NOT_SUPPORTED}
                            placement="bottom"
                            width="120px"
                            height="30px"
                        >
                            <div>
                                <DsButton variant="secondary" isDisabled={true}>
                                    Optimize
                                </DsButton>
                            </div>
                        </TooltipComponent>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ManagedInstanceOptimizationBreakdownByConfig;
