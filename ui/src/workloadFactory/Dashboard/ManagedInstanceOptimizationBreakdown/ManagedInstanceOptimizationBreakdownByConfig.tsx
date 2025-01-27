import { DsButton, DsTypography, FlashingDotsLoader } from '@netapp/design-system';
import styles from './ManagedInstanceOptimizationBreakdownByConfig.module.scss';
import BarComponent from '../BarComponent/BarComponent';
import SeparatorComponent from '../../../common/SeparatorComponent/SeparatorComponent';
import { useDispatch } from 'react-redux';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';
import { ASSESSMENT_CONFIG_NAMES, WLF_TABS } from '../../../utils/consts';
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
            case ASSESSMENT_CONFIG_NAMES.STORAGE_TIER:
                configKey = 'storageTier';
                break;
            case ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM:
                configKey = 'fileSystemHeadroom';
                break;
            case ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE:
                configKey = 'logDriveSize';
                break;
            case ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE:
                configKey = 'tempdbDriveSize';
                break;
            case ASSESSMENT_CONFIG_NAMES.DATA_FILES_MDF:
                configKey = 'userDataFiles';
                break;
            case ASSESSMENT_CONFIG_NAMES.LOG_FILES_LDF:
                configKey = 'logFiles';
                break;
            case ASSESSMENT_CONFIG_NAMES.TEMPDB_PLACEMENT:
                configKey = 'tempdbPlacement';
                break;
            case 'ONTAP':
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
            case GENERAL.RSS_CONFIGURATION:
                configKey = 'rssConfiguration';
                break;
            case GENERAL.LICENSE_SQL_SERVER:
                configKey = 'applicationSqlServer';
                break;
            case GENERAL.MICROSOFT_SQL_PATCH:
                configKey = 'microsoftSqlPatch';
                break;
            case GENERAL.MAXDOP_PATCH:
                configKey = 'maxdopPatch';
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
        <div className={styles.managedBreakdown}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    Managed instances optimization breakdown by configurations
                </DsTypography>

                {allmssqlHostAssessmentLoading && <FlashingDotsLoader />}
            </div>

            <div className={styles.mainSection}>
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
                            ((inProgressOptimizationData?.[ASSESSMENT_CONFIG_NAMES.STORAGE_TIER]?.length || 0) /
                                (configData.total || 1)) *
                                100
                        )}
                        loading={inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.STORAGE_TIER]?.length > 0}
                    />

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton
                            variant="secondary"
                            isThin={true}
                            onClick={() => {
                                handleOptimize(ASSESSMENT_CONFIG_NAMES.STORAGE_TIER);
                            }}
                            data-testid="optimize-storage-tier"
                            isDisabled={
                                allmssqlHostAssessmentLoading ||
                                configData?.total === 0 ||
                                configData?.storageTier === configData?.total ||
                                inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.STORAGE_TIER]?.length > 0
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
                            ((inProgressOptimizationData?.[ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM]?.length || 0) /
                                (configData.total || 1)) *
                                100
                        )}
                        loading={inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM]?.length > 0}
                    />

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton
                            variant="secondary"
                            isThin={true}
                            data-testid="optimize-file-system-headroom"
                            onClick={() => {
                                handleOptimize(ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM);
                            }}
                            isDisabled={
                                allmssqlHostAssessmentLoading ||
                                configData?.total === 0 ||
                                configData?.fileSystemHeadroom === configData?.total ||
                                inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM]?.length > 0
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
                            ((inProgressOptimizationData?.[ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE]?.length || 0) /
                                (configData.total || 1)) *
                                100
                        )}
                        loading={inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE]?.length > 0}
                    />

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton
                            variant="secondary"
                            isThin={true}
                            onClick={() => {
                                handleOptimize(ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE);
                            }}
                            data-testid="optimize-log-drive-size"
                            isDisabled={
                                allmssqlHostAssessmentLoading ||
                                configData?.total === 0 ||
                                configData?.logDriveSize === configData?.total ||
                                inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE]?.length > 0
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
                            ((inProgressOptimizationData?.[ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE]?.length || 0) /
                                (configData.total || 1)) *
                                100
                        )}
                        loading={inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE]?.length > 0}
                    />

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton
                            variant="secondary"
                            isThin={true}
                            data-testid="optimize-temdb-drive-size"
                            onClick={() => {
                                handleOptimize(ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE);
                            }}
                            isDisabled={
                                allmssqlHostAssessmentLoading ||
                                configData?.total === 0 ||
                                configData?.tempdbDriveSize === configData?.total ||
                                inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE]?.length > 0
                            }
                        >
                            Optimize
                        </DsButton>
                    </div>
                </div>

                <div className={styles.tile}>
                    <BarComponent
                        color="#5E8DCD"
                        headingText="Data files (.mdf)"
                        percentage={Math.round(((configData.userDataFiles || 0) / (configData.total || 1)) * 100)}
                        beforeOutOf={configData.userDataFiles}
                        afterOutOf={configData.total}
                        bottomText="Optimized instances:"
                        width={windowSize.width > 1700 ? '360px' : '280px'}
                        from="dashboard"
                        optimizePercentage={Math.round(
                            ((inProgressOptimizationData?.[ASSESSMENT_CONFIG_NAMES.DATA_FILES_MDF]?.length || 0) /
                                (configData.total || 1)) *
                                100
                        )}
                        loading={inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.DATA_FILES_MDF]?.length > 0}
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
                                <DsButton data-testid="optimize-data-files" variant="secondary" isDisabled={true}>
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
                            ((inProgressOptimizationData?.[ASSESSMENT_CONFIG_NAMES.LOG_FILES_LDF]?.length || 0) /
                                (configData.total || 1)) *
                                100
                        )}
                        loading={inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.LOG_FILES_LDF]?.length > 0}
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
                                <DsButton data-testid="optimize-log-files" variant="secondary" isDisabled={true}>
                                    Optimize
                                </DsButton>
                            </div>
                        </TooltipComponent>
                    </div>
                </div>

                <div className={styles.tile}>
                    <BarComponent
                        color="#5E8DCD"
                        headingText={ASSESSMENT_CONFIG_NAMES.TEMPDB_PLACEMENT}
                        percentage={Math.round(((configData.tempdbPlacement || 0) / (configData.total || 1)) * 100)}
                        beforeOutOf={configData.tempdbPlacement}
                        afterOutOf={configData.total}
                        bottomText="Optimized instances:"
                        width={windowSize.width > 1700 ? '360px' : '280px'}
                        from="dashboard"
                        optimizePercentage={Math.round(
                            ((inProgressOptimizationData?.[ASSESSMENT_CONFIG_NAMES.TEMPDB_PLACEMENT]?.length || 0) /
                                (configData.total || 1)) *
                                100
                        )}
                        loading={inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.TEMPDB_PLACEMENT]?.length > 0}
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
                                <DsButton data-testid="optimize-temdb-placement" variant="secondary" isDisabled={true}>
                                    Optimize
                                </DsButton>
                            </div>
                        </TooltipComponent>
                    </div>
                </div>

                <div className={styles.tile}>
                    <BarComponent
                        color="#5E8DCD"
                        headingText="ONTAP"
                        percentage={Math.round(((configData.ontapConfiguration || 0) / (configData.total || 1)) * 100)}
                        beforeOutOf={configData.ontapConfiguration}
                        afterOutOf={configData.total}
                        bottomText="Optimized instances:"
                        width={windowSize.width > 1700 ? '360px' : '280px'}
                        from="dashboard"
                        optimizePercentage={Math.round(
                            ((inProgressOptimizationData?.['ONTAP']?.length || 0) / (configData.total || 1)) * 100
                        )}
                    />

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton
                            variant="secondary"
                            isThin={true}
                            data-testid="optimize-ontap"
                            onClick={() => {
                                handleOptimize('ONTAP');
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
                            data-testid="optimize-operating-system"
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
                            data-testid="optimize-compute-right-sizing"
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
                                <DsButton
                                    data-testid="optimize-operating-system-patch"
                                    variant="secondary"
                                    isDisabled={true}
                                >
                                    Optimize
                                </DsButton>
                            </div>
                        </TooltipComponent>
                    </div>
                </div>

                <div className={styles.tile}>
                    <BarComponent
                        color="#5E8DCD"
                        headingText={GENERAL.RSS_CONFIGURATION}
                        percentage={Math.round(((configData.rssConfiguration || 0) / (configData.total || 1)) * 100)}
                        beforeOutOf={configData.rssConfiguration}
                        afterOutOf={configData.total}
                        bottomText="Optimized instances:"
                        width={windowSize.width > 1700 ? '360px' : '280px'}
                        from="dashboard"
                        optimizePercentage={Math.round(
                            ((inProgressOptimizationData?.[GENERAL.RSS_CONFIGURATION]?.length || 0) /
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
                                <DsButton
                                    data-testid="optimize-rss-configuration"
                                    variant="secondary"
                                    isDisabled={true}
                                >
                                    Optimize
                                </DsButton>
                            </div>
                        </TooltipComponent>
                    </div>
                </div>

                <div className={styles.tile}>
                    <BarComponent
                        color="#5E8DCD"
                        headingText={GENERAL.LICENSE_SQL_SERVER}
                        percentage={Math.round(
                            ((configData.applicationSqlServer || 0) / (configData.total || 1)) * 100
                        )}
                        beforeOutOf={configData.applicationSqlServer}
                        afterOutOf={configData.total}
                        bottomText="Optimized instances:"
                        width={windowSize.width > 1700 ? '360px' : '280px'}
                        from="dashboard"
                        optimizePercentage={Math.round(
                            ((inProgressOptimizationData?.[GENERAL.LICENSE_SQL_SERVER]?.length || 0) /
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
                                <DsButton
                                    data-testid="optimize-license-sql-server"
                                    variant="secondary"
                                    isDisabled={true}
                                >
                                    Optimize
                                </DsButton>
                            </div>
                        </TooltipComponent>
                    </div>
                </div>

                <div className={styles.tile}>
                    <BarComponent
                        color="#5E8DCD"
                        headingText={GENERAL.MICROSOFT_SQL_PATCH}
                        percentage={Math.round(((configData.microsoftSqlPatch || 0) / (configData.total || 1)) * 100)}
                        beforeOutOf={configData.microsoftSqlPatch}
                        afterOutOf={configData.total}
                        bottomText="Optimized instances:"
                        width={windowSize.width > 1700 ? '360px' : '280px'}
                        from="dashboard"
                        optimizePercentage={Math.round(
                            ((inProgressOptimizationData?.[GENERAL.MICROSOFT_SQL_PATCH]?.length || 0) /
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
                                <DsButton
                                    data-testid="optimize-microsoft-sql-server"
                                    variant="secondary"
                                    isDisabled={true}
                                >
                                    Optimize
                                </DsButton>
                            </div>
                        </TooltipComponent>
                    </div>
                </div>

                <div className={styles.tile}>
                    <BarComponent
                        color="#5E8DCD"
                        headingText={GENERAL.MAXDOP_PATCH}
                        percentage={Math.round(((configData.maxdopPatch || 0) / (configData.total || 1)) * 100)}
                        beforeOutOf={configData.maxdopPatch}
                        afterOutOf={configData.total}
                        bottomText="Optimized instances:"
                        width={windowSize.width > 1700 ? '360px' : '280px'}
                        from="dashboard"
                        optimizePercentage={Math.round(
                            ((inProgressOptimizationData?.[GENERAL.MAXDOP_PATCH]?.length || 0) /
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
                                <DsButton data-testid="optimize-maxdop-patch" variant="secondary" isDisabled={true}>
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
