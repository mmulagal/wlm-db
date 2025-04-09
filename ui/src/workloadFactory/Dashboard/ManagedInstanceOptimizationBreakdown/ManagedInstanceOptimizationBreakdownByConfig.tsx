import { DsButton, DsTypography, FlashingDotsLoader } from '@netapp/design-system';
import styles from './ManagedInstanceOptimizationBreakdownByConfig.module.scss';
import BarComponent from '../BarComponent/BarComponent';
import SeparatorComponent from '../../../common/SeparatorComponent/SeparatorComponent';
import { useDispatch } from 'react-redux';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';
import { ASSESSMENT_CONFIG_NAMES, WLF_TABS } from '../../../utils/consts';
import { setSelectedConfig } from '../../../store/workloadFactory/databaseHomeSlice';
import useResize from '../../../common/hooks/useResize';
import { useAppSelector } from '../../../store/storeHooks';
import { useMemo } from 'react';
import { getAssessmentGroupedByConfigurations } from '../../DatabaseHomePage/DatabaseHomeUtils';
import { GENERAL } from '../../../utils/appConstants';
import TooltipComponent from '../../../common/TooltipComponent/TooltipComponent';
import { setLandingFrom } from '../../../store/workloadFactory/getWellOptimizeSlice';
import { setOptimizeInnerpageSummary } from '../../GetWell/GetWellUtils';

const ManagedInstanceOptimizationBreakdownByConfig = ({ openAccordion }: boolean | any) => {
    const { allmssqlHostAssessmentData, allmssqlHostAssessmentLoading } = useAppSelector(state => state.inventoryV2);
    const { inProgressOptimizationData } = useAppSelector(state => state.getWellOptimize);
    const dispatch = useDispatch();
    const windowSize = useResize();
    const handleOptimize = (type: string) => {
        dispatch(setSelectedHeaderTab(WLF_TABS.DASHBOARD_INNER_PAGE));
        dispatch(setLandingFrom(WLF_TABS.INVENTORY));
        dispatch(setSelectedConfig(type));
        setOptimizeInnerpageSummary(type, configData, dispatch);
    };
    const { multiDataLoading } = useAppSelector(state => state.headers);

    const loading = useMemo(() => {
        return allmssqlHostAssessmentLoading || multiDataLoading;
    }, [allmssqlHostAssessmentLoading, multiDataLoading]);

    const configData = useMemo(() => {
        return getAssessmentGroupedByConfigurations(allmssqlHostAssessmentData);
    }, [allmssqlHostAssessmentData]);

    return (
        <div className={styles.managedBreakdown}>
            <div className={styles.headSection}>
                <DsTypography variant="Regular_16" className={styles.title}>
                    Managed instances optimization breakdown by configurations
                </DsTypography>

                {loading && <FlashingDotsLoader />}
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
                        loading={
                            loading || inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.STORAGE_TIER]?.length > 0
                        }
                    />

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton
                            variant="secondary"
                            isThin={true}
                            onClick={() => {
                                handleOptimize(ASSESSMENT_CONFIG_NAMES.STORAGE_TIER);
                            }}
                            data-testid="wlm-db-optimize-storage-tier"
                            isDisabled={
                                loading ||
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
                        loading={
                            loading ||
                            inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM]?.length > 0
                        }
                    />

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton
                            variant="secondary"
                            isThin={true}
                            data-testid="wlm-db-optimize-file-system-headroom"
                            onClick={() => {
                                handleOptimize(ASSESSMENT_CONFIG_NAMES.FILE_SYSTEM_HEADROOM);
                            }}
                            isDisabled={
                                loading ||
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
                        loading={
                            loading || inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE]?.length > 0
                        }
                    />

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton
                            variant="secondary"
                            isThin={true}
                            onClick={() => {
                                handleOptimize(ASSESSMENT_CONFIG_NAMES.LOG_DRIVE_SIZE);
                            }}
                            data-testid="wlm-db-optimize-log-drive-size"
                            isDisabled={
                                loading ||
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
                        loading={
                            loading || inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE]?.length > 0
                        }
                    />

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton
                            variant="secondary"
                            isThin={true}
                            data-testid="wlm-db-optimize-temdb-drive-size"
                            onClick={() => {
                                handleOptimize(ASSESSMENT_CONFIG_NAMES.TEMPDB_DRIVE_SIZE);
                            }}
                            isDisabled={
                                loading ||
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
                        loading={
                            loading || inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.DATA_FILES_MDF]?.length > 0
                        }
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
                                    data-testid="wlm-db-optimize-data-files"
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
                        loading={
                            loading || inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.LOG_FILES_LDF]?.length > 0
                        }
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
                                <DsButton data-testid="wlm-db-optimize-log-files" variant="secondary" isDisabled={true}>
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
                        loading={
                            loading || inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.TEMPDB_PLACEMENT]?.length > 0
                        }
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
                                    data-testid="wlm-db-optimize-temdb-placement"
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
                        loading={loading || inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.ONTAP]?.length > 0}
                    />

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton
                            variant="secondary"
                            isThin={true}
                            data-testid="wlm-db-optimize-ontap"
                            onClick={() => {
                                handleOptimize('ONTAP');
                            }}
                            isDisabled={
                                loading ||
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
                        loading={loading || inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.OS]?.length > 0}
                    />

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton
                            variant="secondary"
                            isThin={true}
                            data-testid="wlm-db-optimize-operating-system"
                            onClick={() => {
                                handleOptimize('Operating system');
                            }}
                            isDisabled={
                                loading || configData?.total === 0 || configData?.operatingSystem === configData?.total
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
                        loading={loading || inProgressOptimizationData['compute-rightsizing']?.length > 0}
                    />

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton
                            variant="secondary"
                            isThin={true}
                            data-testid="wlm-db-optimize-compute-right-sizing"
                            onClick={() => {
                                handleOptimize(GENERAL.COMPUTE_RIGHTSIZING);
                            }}
                            isDisabled={
                                loading ||
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
                        loading={
                            loading ||
                            inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM_PATCH]?.length > 0
                        }
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
                                    data-testid="wlm-db-optimize-operating-system-patch"
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
                        loading={
                            loading || inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.RSS_CONFIGURATION]?.length > 0
                        }
                    />

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton
                            variant="secondary"
                            isThin={true}
                            onClick={() => {
                                handleOptimize(GENERAL.RSS_CONFIGURATION);
                            }}
                            data-testid="wlm-db-optimize-maxdop"
                            isDisabled={
                                loading ||
                                configData?.total === 0 ||
                                configData.rssConfiguration === configData?.total ||
                                inProgressOptimizationData[GENERAL.RSS_CONFIGURATION]?.length > 0
                            }
                        >
                            Optimize
                        </DsButton>
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
                        loading={loading || inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.LICENSE]?.length > 0}
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
                                    data-testid="wlm-db-optimize-license-sql-server"
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
                        percentage={Math.round(((configData.mssqlPatch || 0) / (configData.total || 1)) * 100)}
                        beforeOutOf={configData.mssqlPatch}
                        afterOutOf={configData.total}
                        bottomText="Optimized instances:"
                        width={windowSize.width > 1700 ? '360px' : '280px'}
                        from="dashboard"
                        optimizePercentage={Math.round(
                            ((inProgressOptimizationData?.[GENERAL.MICROSOFT_SQL_PATCH]?.length || 0) /
                                (configData.total || 1)) *
                            100
                        )}
                        loading={
                            loading ||
                            inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.MICROSOFT_SQL_SERVER_PATCH]?.length > 0
                        }
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
                                    data-testid="wlm-db-optimize-microsoft-sql-server"
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
                        loading={loading || inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.MAXDOP]?.length > 0}
                    />

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton
                            variant="secondary"
                            isThin={true}
                            onClick={() => {
                                handleOptimize(ASSESSMENT_CONFIG_NAMES.MAXDOP);
                            }}
                            data-testid="wlm-db-optimize-maxdop"
                            isDisabled={
                                loading ||
                                configData?.total === 0 ||
                                configData?.maxdopPatch === configData?.total ||
                                inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.MAXDOP]?.length > 0
                            }
                        >
                            Optimize
                        </DsButton>
                    </div>
                </div>

                <div className={styles.tile}>
                    <BarComponent
                        color="#5E8DCD"
                        headingText={GENERAL.SCHEDULED_LOCAL_SNAPSHOT}
                        percentage={Math.round(
                            ((configData.scheduledLocalSnapshot || 0) / (configData.total || 1)) * 100
                        )}
                        beforeOutOf={configData.scheduledLocalSnapshot}
                        afterOutOf={configData.total}
                        bottomText="Optimized instances:"
                        width={windowSize.width > 1700 ? '360px' : '280px'}
                        from="dashboard"
                        optimizePercentage={Math.round(
                            ((inProgressOptimizationData?.[ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT]?.length ||
                                0) /
                                (configData.total || 1)) *
                            100
                        )}
                        loading={
                            loading ||
                            inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT]?.length > 0
                        }
                    />

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton
                            variant="secondary"
                            isThin={true}
                            onClick={() => {
                                handleOptimize(ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT);
                            }}
                            data-testid="wlm-db-optimize-maxdop"
                            isDisabled={
                                loading ||
                                configData?.total === 0 ||
                                configData?.scheduledLocalSnapshot === configData?.total ||
                                inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.SCHEDULED_LOCAL_SNAPSHOT]?.length > 0
                            }
                        >
                            Optimize
                        </DsButton>
                    </div>
                </div>

                <div className={styles.tile}>
                    <BarComponent
                        color="#5E8DCD"
                        headingText={GENERAL.CRR}
                        percentage={Math.round(((configData.crr || 0) / (configData.total || 1)) * 100)}
                        beforeOutOf={configData.crr}
                        afterOutOf={configData.total}
                        bottomText="Optimized instances:"
                        width={windowSize.width > 1700 ? '360px' : '280px'}
                        from="dashboard"
                        optimizePercentage={Math.round(
                            ((inProgressOptimizationData?.[ASSESSMENT_CONFIG_NAMES.CRR]?.length || 0) /
                                (configData.total || 1)) *
                            100
                        )}
                        loading={loading || inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.CRR]?.length > 0}
                    />

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <TooltipComponent title={''} placement="bottom" width="120px" height="30px">
                            <div>
                                <DsButton data-testid="wlm-db-optimize-crr" variant="secondary" isDisabled={true}>
                                    Optimize
                                </DsButton>
                            </div>
                        </TooltipComponent>
                    </div>
                </div>

                <div className={styles.tile}>
                    <BarComponent
                        color="#5E8DCD"
                        headingText={GENERAL.SCHEDULED_FSX_FOR_ONTAP_BACKUPS}
                        percentage={Math.round(((configData.scheduledawsBackup || 0) / (configData.total || 1)) * 100)}
                        beforeOutOf={configData.scheduledawsBackup}
                        afterOutOf={configData.total}
                        bottomText="Optimized instances:"
                        width={windowSize.width > 1700 ? '360px' : '280px'}
                        from="dashboard"
                        optimizePercentage={Math.round(
                            ((inProgressOptimizationData?.[ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS]
                                ?.length || 0) /
                                (configData.total || 1)) *
                            100
                        )}
                        loading={
                            loading ||
                            inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS]
                                ?.length > 0
                        }
                    />

                    <SeparatorComponent variant="vertical" height="60px" />

                    <div className={styles.buttonContainer}>
                        <DsButton
                            variant="secondary"
                            isThin={true}
                            onClick={() => {
                                handleOptimize(ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS);
                            }}
                            data-testid="wlm-db-optimize-maxdop"
                            isDisabled={
                                loading ||
                                configData?.total === 0 ||
                                configData?.scheduledawsBackup === configData?.total ||
                                inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.SCHEDULED_FSX_FOR_ONTAP_BACKUPS]
                                    ?.length > 0
                            }
                        >
                            Optimize
                        </DsButton>
                    </div>
                </div>


                <div className={styles.tile}>
                    <BarComponent
                        color="#5E8DCD"
                        headingText={GENERAL.CLONE_MANAGEMENT}
                        percentage={Math.round(
                            ((configData.clone_management || 0) / (configData.total || 1)) * 100
                        )}
                        beforeOutOf={configData.cloneManagement}
                        afterOutOf={configData.total}
                        bottomText="Optimized databases:"
                        width={windowSize.width > 1700 ? '360px' : '280px'}
                        from="dashboard"
                        optimizePercentage={Math.round(
                            ((inProgressOptimizationData?.[ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT]?.length ||
                                0) /
                                (configData.total || 1)) *
                            100
                        )}
                        loading={
                            inProgressOptimizationData[ASSESSMENT_CONFIG_NAMES.CLONE_MANAGEMENT]?.length > 0
                        }
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
                                    data-testid="wlm-db-optimize-clone-management"
                                    variant="secondary"
                                    isDisabled={true}
                                >
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
