import { DsTypography } from '@netapp/design-system';
import { useEffect, useState } from 'react';
import { useAppSelector } from '../../../../store/storeHooks';
import styles from './OptimizeCard.module.scss';
import { GENERAL } from '../../../../utils/appConstants';
import { WLF_TABS, ASSESSMENT_CONFIG_NAMES } from '../../../../utils/consts';
import RecommendationText from '../../RecommendationText/RecommendationText';

const OptimizeCard = ({ fromPage = '', recommendationHeight }: any) => {
    const selectedOptimizeConfig = useAppSelector(state => state.inventoryV2.selectedOptimizeConfig);
    const { cloneDashboardData } = useAppSelector(state => state.getWellOptimize);
    const [setCardData, setSetCardData] = useState<any>({});

    useEffect(() => {
        if (selectedOptimizeConfig && !fromPage) {
            let dataObj = {};
            dataObj = {
                ...selectedOptimizeConfig?.data,
                impactedCount: selectedOptimizeConfig?.data?.block_six?.count?.totalObjectsInViolation,
                severity: selectedOptimizeConfig?.data?.block_four?.value,
                tags: selectedOptimizeConfig?.data?.tags
            };
            const data = getCardData(selectedOptimizeConfig?.type, dataObj);
            setSetCardData(data);
        }
    }, [selectedOptimizeConfig]);

    useEffect(() => {
        if (cloneDashboardData && fromPage === WLF_TABS.DASHBOARD) {
            let dataObj = {};
            dataObj = {
                ...cloneDashboardData,
                impactedCount: cloneDashboardData?.objectsInViolation?.filter((item: any) => !item.isOptimized).length
            };
            const data = getCardData(cloneDashboardData?.type, dataObj);
            setSetCardData(data);
        }
    }, [cloneDashboardData]);

    const getCardData = (config: string, data: any) => {
        switch (config) {
            case 'Storage tier':
            case 'ONTAP / Tiering policy':
                return {
                    block_one: { type: 'Impacted volumes', value: data.impactedCount || '0' },
                    block_two: { type: 'Severity', value: data.severity || 'Warning' },
                    block_three: { type: 'Tags', value: data.tags },
                    recommendationText: { type: 'View recommendation', value: data?.recommendationText },
                    data: data?.recommendation
                };
            case 'File system headroom':
                return {
                    block_one: { type: 'Impacted databases', value: data.impactedCount || '0' },
                    block_two: { type: 'Severity', value: data.severity || 'Warning' },
                    block_three: { type: 'Tags', value: data.tags },
                    recommendationText: { type: 'View recommendation', value: data?.recommendationText }
                };
            case 'Log drive size':
                return {
                    block_one: { type: 'Impacted drives', value: data.impactedCount || '0' },
                    block_two: { type: 'Severity', value: data.severity || 'Warning' },
                    block_three: { type: 'Tags', value: data.tags },
                    recommendationText: {
                        type: 'View recommendation',
                        value: data?.recommendationText,
                        valueHeading: data?.recommendation?.valuesHeading,
                        values: data?.recommendation?.values
                    },
                    data: data?.recommendation
                };
            case 'Data files':
                return {
                    block_one: { type: 'Impacted databases', value: data.impactedCount || '0' },
                    block_two: { type: 'Severity', value: data.severity || 'Warning' },
                    block_three: { type: 'Tags', value: data.tags },
                    recommendationText: { type: 'View recommendation', value: data?.recommendation?.description },
                    data: data?.recommendation
                };
            case 'Log files':
                return {
                    block_one: { type: 'Impacted databases', value: data.impactedCount || '0' },
                    block_two: { type: 'Severity', value: data.severity || 'Warning' },
                    block_three: { type: 'Tags', value: data.tags },
                    recommendationText: {
                        type: 'View recommendation',
                        value: data?.recommendation?.description
                    },
                    data: data?.recommendation
                };
            case 'Thin provisioning':
            case 'Autosize':
            case 'Autosize-mode':
            case 'Fractional reserve':
            case 'Snapshot copy reserve':
            case 'Snapshot autodelete':
            case 'Space management':
                return {
                    block_one: { type: 'Impacted volumes', value: data.totalObjectsInViolation || '0' },
                    block_two: { type: 'Severity', value: data.severity || 'Warning' },
                    block_three: { type: 'Tags', value: data.tags },
                    recommendationText: { type: 'View recommendation', value: data?.recommendation },
                    data: {
                        title: `${config} recommendation`,
                        description: data?.recommendation
                    }
                };
            case 'Tiering policy':
            case 'Tiering minimum cooling days':
                return {
                    block_one: { type: 'Impacted volumes', value: data.totalObjectsInViolation || '0' },
                    block_two: { type: 'Severity', value: data.severity || 'Warning' },
                    block_three: { type: 'Tags', value: data.tags },
                    recommendationText: { type: 'View recommendation', value: data?.recommendation },
                    data: {
                        title: `${config} recommendation`,
                        description: data?.recommendation
                    }
                };
            case 'OS type':
                return {
                    block_one: { type: 'Impacted LUNs', value: data.totalObjectsInViolation || '0' },
                    block_two: { type: 'Severity', value: data.severity || 'Warning' },
                    block_three: { type: 'Tags', value: data.tags },
                    recommendationText: { type: 'View recommendation', value: data?.recommendation },
                    data: {
                        title: `${config} recommendation`,
                        description: data?.recommendation
                    }
                };
            case 'Space reservation':
            case 'Space allocation':
                return {
                    block_one: { type: 'Impacted LUNs', value: data.totalObjectsInViolation || '0' },
                    block_two: { type: 'Severity', value: data.severity || 'Warning' },
                    block_three: { type: 'Tags', value: data.tags },
                    recommendationText: { type: 'View recommendation', value: data?.recommendation },
                    data: {
                        title: `${config} recommendation`,
                        description: data?.recommendation
                    }
                };
            case 'Multipath I/O Policy':
                return {
                    block_one: { type: 'Impacted drives', value: data.totalObjectsInViolation || '0' },
                    block_two: { type: 'Severity', value: data.severity || 'Warning' },
                    block_three: { type: 'Tags', value: data.tags },
                    recommendationText: { type: 'View recommendation', value: data?.recommendation },
                    data: {
                        title: `${config} recommendation`,
                        description: data?.recommendation
                    }
                };
            case 'NTFS allocation unit size':
                return {
                    block_one: { type: 'Impacted drives', value: data.totalObjectsInViolation || '0' },
                    block_two: { type: 'Severity', value: data.severity || 'Warning' },
                    block_three: { type: 'Tags', value: data.tags },
                    recommendationText: { type: 'View recommendation', value: data?.recommendation },
                    data: {
                        title: `${config} recommendation`,
                        description: data?.recommendation
                    }
                };
            case 'Network adapter settings':
            case 'Network adapters':
                return {
                    block_one: { type: 'Impacted network adapters', value: data.impactedCount || '0' },
                    block_two: { type: 'Severity', value: data.severity || 'Warning' },
                    block_three: { type: 'Tags', value: data.tags },
                    recommendationText: {
                        type: 'View recommendation',
                        value: data?.recommendation?.descriptionRssConfig
                    },
                    data: data?.recommendation
                };
            case GENERAL.SCHEDULED_LOCAL_SNAPSHOT:
                return {
                    block_one: { type: 'Impacted volumes', value: data.impactedCount || '0' },
                    block_two: { type: 'Severity', value: data.severity || 'Warning' },
                    block_three: { type: 'Tags', value: data.tags },
                    recommendationText: { type: 'View recommendation', value: data?.recommendationText },
                    data: data?.recommendation
                };

            case GENERAL.SCHEDULED_FSX_FOR_ONTAP_BACKUPS:
                return {
                    block_one: { type: 'File system Name', value: data.impactedCount || '0' },
                    block_two: { type: 'Severity', value: data.severity || 'Warning' },
                    block_three: { type: 'Tags', value: data.tags },
                    recommendationText: { type: 'View recommendation', value: data?.recommendationText },
                    data: data?.recommendation
                };
            case ASSESSMENT_CONFIG_NAMES.MSSQL_HIGH_AVAILABILITY:
            case ASSESSMENT_CONFIG_NAMES.HEARTBEAT_SETTINGS:
            case ASSESSMENT_CONFIG_NAMES.CLUSTER_QUORUM:
            case ASSESSMENT_CONFIG_NAMES.SQL_SERVER_SERVICE:
                return {
                    block_one: { type: 'Impacted EC2 instances', value: data.totalObjectsInViolation || '0' },
                    block_two: { type: 'Severity', value: data.severity || 'Critical' },
                    block_three: { type: 'Tags', value: data.tags },
                    recommendationText: { type: 'View recommendation', value: data?.recommendation },
                    data: {
                        title: `${config} recommendation`,
                        description: data?.recommendation
                    }
                };
            case ASSESSMENT_CONFIG_NAMES.SHARED_STORAGE:
                return {
                    block_one: { type: 'Impacted LUNs', value: data.totalObjectsInViolation || '0' },
                    block_two: { type: 'Severity', value: data.severity || 'Critical' },
                    block_three: { type: 'Tags', value: data.tags },
                    recommendationText: { type: 'View recommendation', value: data?.recommendation },
                    data: {
                        title: `${config} recommendation`,
                        description: data?.recommendation
                    }
                };
            case GENERAL.CRR:
                return {
                    block_one: { type: 'Impacted volumes', value: data.impactedCount || '0' },
                    block_two: { type: 'Severity', value: data.severity || 'Warning' },
                    block_three: { type: 'Tags', value: data.tags },
                    recommendationText: { type: 'View recommendation', value: data?.recommendationText },
                    data: data?.recommendation
                };
            case GENERAL.CLONE_MANAGEMENT:
                return {
                    block_one: { type: 'Impacted databases', value: data.impactedCount || '0' },
                    block_two: { type: 'Severity', value: data.severity || 'Warning' },
                    block_three: { type: 'Tags', value: data.tags },
                    recommendationText: {
                        type: 'View recommendation',
                        value: data?.recommendation?.description
                    },
                    data: data?.recommendation
                };
            default:
                return null;
        }
    };

    return (
        <div className={styles.optimizeCardContainer}>
            <div className={styles.optimizeCard}>
                <div className={styles.section}>
                    <div className={styles.leftSide}>
                        <div className={styles.commonRow}>
                            <DsTypography variant="Regular_24" style={{ lineHeight: 'unset' }}>
                                {setCardData?.block_one?.value}
                            </DsTypography>
                            <DsTypography variant="Regular_14">{setCardData?.block_one?.type}</DsTypography>
                        </div>

                        <div className={styles.commonRow}>
                            <DsTypography variant="Semibold_14">{setCardData?.block_two?.value}</DsTypography>
                            <DsTypography variant="Regular_14">{setCardData?.block_two?.type}</DsTypography>
                        </div>
                    </div>
                </div>
            </div>

            <div className={styles.recommendation} style={{ height: recommendationHeight }}>
                <RecommendationText data={setCardData?.data} from="dashboard" cardName={setCardData?.cardName} />
            </div>
        </div>
    );
};

export default OptimizeCard;
