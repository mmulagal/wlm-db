import { DsButton, DsTypography, FlashingDotsLoader } from '@netapp/design-system';
import styles from './ManagedInstanceOptimizationBreakdownByConfig.module.scss';
import BarComponent from '../BarComponent/BarComponent';
import SeparatorComponent from '../../../common/SeparatorComponent/SeparatorComponent';
import { useDispatch } from 'react-redux';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';
import { WLF_TABS } from '../../../utils/consts';
import { setSelectedConfig, setSelectedConfigSummary } from '../../../store/workloadFactory/databaseHomeSlice';
import useResize from '../../../common/hooks/useResize';
import { useAppSelector } from '../../../store/storeHooks';
import { useMemo } from 'react';
import { getAssessmentGroupedByConfigurations } from '../../DatabaseHomePage/DatabaseHomeUtils';
import { GENERAL } from '../../../utils/appConstants';
import TooltipComponent from '../../../common/TooltipComponent/TooltipComponent';
import { setLandingFrom } from '../../../store/workloadFactory/getWellOptimizeSlice';

const ManagedInstanceOptimizationBreakdownByConfig = ({ openAccordion }: boolean | any) => {
    const { allmssqlHostAssessmentData, allmssqlHostAssessmentLoading } = useAppSelector(state => state.inventoryV2);
    const { inProgressOptimizationData } = useAppSelector(state => state.getWellOptimize);
    const dispatch = useDispatch();
    const windowSize = useResize();
    const handleOptimize = (type: string) => {
        dispatch(setSelectedHeaderTab(WLF_TABS.DASHBOARD_INNER_PAGE));
        dispatch(setLandingFrom(WLF_TABS.INVENTORY));
        dispatch(setSelectedConfig(type));
        let configKey = '';
        switch (type) {
            case 'Storage tier':
                configKey = 'storageTier';
                break;
            case 'File system headroom':
                configKey = 'fileSystemHeadroom';
                break;
            case 'Log drive size':
                configKey = 'logDriveSize';
                break;
            case 'TempDB drive size':
                configKey = 'tempdbDriveSize';
                break;
            case 'User data files (.mdf)':
                configKey = 'userDataFiles';
                break;
            case 'Log files (.ldf)':
                configKey = 'logFiles';
                break;
            case 'TempDB placement':
                configKey = 'tempdbPlacement';
                break;
            case 'ONTAP configuration':
                configKey = 'ontapConfiguration';
                break;
            case 'Operating system':
                configKey = 'operatingSystem';
                break;
            case GENERAL.COMPUTE_RIGHTSIZING:
                configKey = 'computeRightsizing';
                break;
            case GENERAL.OPERATING_SYSTEM_PATCH:
                configKey = 'operatingSystemPatch';
                break;
            case GENERAL.APPLICATION_SQL_SERVER:
                configKey = 'applicationSqlServer';
                break;
        }
        const optimizedInstances = configData[configKey] || 0;
        dispatch(
            setSelectedConfigSummary({
                optimizedInstances: optimizedInstances,
                notOptimizedInstances: configData?.total - optimizedInstances,
                optimizationScore: `${Math.round((optimizedInstances / (configData?.total || 1)) * 100)}%`,
                severity: configData?.severityObj?.[configKey] || ''
            })
        );
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
                        optimizePercentage={Math.round(
                            ((inProgressOptimizationData?.['Storage tier']?.length || 0) / (configData.total || 1)) *
                                100
                        )}
                        loading={inProgressOptimizationData['Storage tier']?.length > 0}
                    />

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton
                            variant="secondary"
                            isThin={true}
                            onClick={() => {
                                handleOptimize('Storage tier');
                            }}
                            isDisabled={
                                allmssqlHostAssessmentLoading ||
                                configData?.total === 0 ||
                                configData?.storageTier === configData?.total ||
                                inProgressOptimizationData['Storage tier']?.length > 0
                            }
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
                        optimizePercentage={Math.round(
                            ((inProgressOptimizationData?.['File system headroom']?.length || 0) /
                                (configData.total || 1)) *
                                100
                        )}
                        loading={inProgressOptimizationData['File system headroom']?.length > 0}
                    />

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton
                            variant="secondary"
                            isThin={true}
                            onClick={() => {
                                handleOptimize('File system headroom');
                            }}
                            isDisabled={
                                allmssqlHostAssessmentLoading ||
                                configData?.total === 0 ||
                                configData?.fileSystemHeadroom === configData?.total ||
                                inProgressOptimizationData['File system headroom']?.length > 0
                            }
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
                        optimizePercentage={Math.round(
                            ((inProgressOptimizationData?.['Log drive size']?.length || 0) / (configData.total || 1)) *
                                100
                        )}
                        loading={inProgressOptimizationData['Log drive size']?.length > 0}
                    />

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton
                            variant="secondary"
                            isThin={true}
                            onClick={() => {
                                handleOptimize('Log drive size');
                            }}
                            isDisabled={
                                allmssqlHostAssessmentLoading ||
                                configData?.total === 0 ||
                                configData?.logDriveSize === configData?.total ||
                                inProgressOptimizationData['Log drive size']?.length > 0
                            }
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
                        optimizePercentage={Math.round(
                            ((inProgressOptimizationData?.['TempDB drive size']?.length || 0) /
                                (configData.total || 1)) *
                                100
                        )}
                        loading={inProgressOptimizationData['TempDB drive size']?.length > 0}
                    />

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton
                            variant="secondary"
                            isThin={true}
                            onClick={() => {
                                handleOptimize('TempDB drive size');
                            }}
                            isDisabled={
                                allmssqlHostAssessmentLoading ||
                                configData?.total === 0 ||
                                configData?.tempdbDriveSize === configData?.total ||
                                inProgressOptimizationData['TempDB drive size']?.length > 0
                            }
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
                        optimizePercentage={Math.round(
                            ((inProgressOptimizationData?.['User data files (.mdf)']?.length || 0) /
                                (configData.total || 1)) *
                                100
                        )}
                        loading={inProgressOptimizationData['User data files (.mdf)']?.length > 0}
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
                        headingText="Log files (.ldf)"
                        percentage={Math.round(((configData.logFiles || 0) / (configData.total || 1)) * 100)}
                        beforeOutOf={configData.logFiles}
                        afterOutOf={configData.total}
                        bottomText="Optimized instances:"
                        width={windowSize.width > 1700 ? '360px' : '280px'}
                        from="dashboard"
                        optimizePercentage={Math.round(
                            ((inProgressOptimizationData?.['Log files (.ldf)']?.length || 0) /
                                (configData.total || 1)) *
                                100
                        )}
                        loading={inProgressOptimizationData['Log files (.ldf)']?.length > 0}
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
                        headingText="TempDB placement"
                        percentage={Math.round(((configData.tempdbPlacement || 0) / (configData.total || 1)) * 100)}
                        beforeOutOf={configData.tempdbPlacement}
                        afterOutOf={configData.total}
                        bottomText="Optimized instances:"
                        width={windowSize.width > 1700 ? '360px' : '280px'}
                        from="dashboard"
                        optimizePercentage={Math.round(
                            ((inProgressOptimizationData?.['TempDB placement']?.length || 0) /
                                (configData.total || 1)) *
                                100
                        )}
                        loading={inProgressOptimizationData['TempDB placement']?.length > 0}
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
                        headingText="ONTAP configuration"
                        percentage={Math.round(((configData.ontapConfiguration || 0) / (configData.total || 1)) * 100)}
                        beforeOutOf={configData.ontapConfiguration}
                        afterOutOf={configData.total}
                        bottomText="Optimized instances:"
                        width={windowSize.width > 1700 ? '360px' : '280px'}
                        from="dashboard"
                        optimizePercentage={Math.round(
                            ((inProgressOptimizationData?.['ONTAP configuration']?.length || 0) /
                                (configData.total || 1)) *
                                100
                        )}
                    />

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton
                            variant="secondary"
                            isThin={true}
                            onClick={() => {
                                handleOptimize('ONTAP configuration');
                            }}
                            isDisabled={
                                allmssqlHostAssessmentLoading ||
                                configData?.total === 0 ||
                                configData?.ontapConfiguration === configData?.total
                            }
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
                        optimizePercentage={Math.round(
                            ((inProgressOptimizationData?.['Operating system']?.length || 0) /
                                (configData.total || 1)) *
                                100
                        )}
                    />

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton
                            variant="secondary"
                            isThin={true}
                            onClick={() => {
                                handleOptimize('Operating system');
                            }}
                            isDisabled={
                                allmssqlHostAssessmentLoading ||
                                configData?.total === 0 ||
                                configData?.operatingSystem === configData?.total
                            }
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
                        optimizePercentage={Math.round(
                            ((inProgressOptimizationData?.[GENERAL.COMPUTE_RIGHTSIZING]?.length || 0) /
                                (configData.total || 1)) *
                                100
                        )}
                        loading={inProgressOptimizationData['compute-rightsizing']?.length > 0}
                    />

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton
                            variant="secondary"
                            isThin={true}
                            onClick={() => {
                                handleOptimize(GENERAL.COMPUTE_RIGHTSIZING);
                            }}
                            isDisabled={
                                allmssqlHostAssessmentLoading ||
                                configData?.total === 0 ||
                                configData?.computeRightsizing === configData?.total
                            }
                        >
                            Optimize
                        </DsButton>
                    </div>
                </div>

                <div className={styles.tile}>
                    <BarComponent
                        color="#5E8DCD"
                        headingText={GENERAL.OPERATING_SYSTEM_PATCH}
                        percentage={Math.round(
                            ((configData.operatingSystemPatch || 0) / (configData.total || 1)) * 100
                        )}
                        beforeOutOf={configData.operatingSystemPatch}
                        afterOutOf={configData.total}
                        bottomText="Optimized instances:"
                        width={windowSize.width > 1700 ? '360px' : '280px'}
                        from="dashboard"
                        optimizePercentage={Math.round(
                            ((inProgressOptimizationData?.[GENERAL.OPERATING_SYSTEM_PATCH]?.length || 0) /
                                (configData.total || 1)) *
                                100
                        )}
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
                        percentage={Math.round(
                            ((configData.applicationSqlServer || 0) / (configData.total || 1)) * 100
                        )}
                        beforeOutOf={configData.applicationSqlServer}
                        afterOutOf={configData.total}
                        bottomText="Optimized instances:"
                        width={windowSize.width > 1700 ? '360px' : '280px'}
                        from="dashboard"
                        optimizePercentage={Math.round(
                            ((inProgressOptimizationData?.[GENERAL.APPLICATION_SQL_SERVER]?.length || 0) /
                                (configData.total || 1)) *
                                100
                        )}
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
