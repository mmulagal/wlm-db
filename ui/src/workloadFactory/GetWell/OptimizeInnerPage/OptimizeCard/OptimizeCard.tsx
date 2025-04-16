import { DsTypography, TooltipInfo } from '@netapp/design-system';
import { useAppSelector } from '../../../../store/storeHooks';
import styles from './OptimizeCard.module.scss';
import Tag from '../../../../common/Tag/Tag';
import { useEffect, useState } from 'react';
import { GENERAL } from '../../../../utils/appConstants';
import { ReactComponent as Bullet } from '../../../../assets/ic_bullet.svg';
import { WLF_TABS } from '../../../../utils/consts';

const OptimizeCard = ({ fromPage = '' }: any) => {
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
                impactedCount: cloneDashboardData?.objectsInViolation?.length
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
                    recommendationText: { type: 'View recommendation', value: data?.recommendationText }
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
                    }
                };
            case 'Data files':
                return {
                    block_one: { type: 'Impacted databases', value: data.impactedCount || '0' },
                    block_two: { type: 'Severity', value: data.severity || 'Warning' },
                    block_three: { type: 'Tags', value: data.tags },
                    recommendationText: { type: 'View recommendation', value: data?.recommendation?.description }
                };
            case 'Log files':
                return {
                    block_one: { type: 'Impacted databases', value: data.impactedCount || '0' },
                    block_two: { type: 'Severity', value: data.severity || 'Warning' },
                    block_three: { type: 'Tags', value: data.tags },
                    recommendationText: {
                        type: 'View recommendation',
                        value: data?.recommendation?.description
                    }
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
                    recommendationText: { type: 'View recommendation', value: data?.recommendation }
                };
            case 'Tiering policy':
            case 'Tiering minimum cooling days':
                return {
                    block_one: { type: 'Impacted volumes', value: data.totalObjectsInViolation || '0' },
                    block_two: { type: 'Severity', value: data.severity || 'Warning' },
                    block_three: { type: 'Tags', value: data.tags },
                    recommendationText: { type: 'View recommendation', value: data?.recommendation }
                };
            case 'OS type':
                return {
                    block_one: { type: 'Impacted LUNs', value: data.totalObjectsInViolation || '0' },
                    block_two: { type: 'Severity', value: data.severity || 'Warning' },
                    block_three: { type: 'Tags', value: data.tags },
                    recommendationText: { type: 'View recommendation', value: data?.recommendation }
                };
            case 'Space reservation':
            case 'Space allocation':
                return {
                    block_one: { type: 'Impacted LUNs', value: data.totalObjectsInViolation || '0' },
                    block_two: { type: 'Severity', value: data.severity || 'Warning' },
                    block_three: { type: 'Tags', value: data.tags },
                    recommendationText: { type: 'View recommendation', value: data?.recommendation }
                };
            case 'Multipath I/O Policy':
                return {
                    block_one: { type: 'Impacted drives', value: data.totalObjectsInViolation || '0' },
                    block_two: { type: 'Severity', value: data.severity || 'Warning' },
                    block_three: { type: 'Tags', value: data.tags },
                    recommendationText: { type: 'View recommendation', value: data?.recommendation }
                };
            case 'NTFS allocation unit size':
                return {
                    block_one: { type: 'Impacted drives', value: data.totalObjectsInViolation || '0' },
                    block_two: { type: 'Severity', value: data.severity || 'Warning' },
                    block_three: { type: 'Tags', value: data.tags },
                    recommendationText: { type: 'View recommendation', value: data?.recommendation }
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
                    }
                };
            case GENERAL.SCHEDULED_LOCAL_SNAPSHOT:
                return {
                    block_one: { type: 'Impacted volumes', value: data.impactedCount || '0' },
                    block_two: { type: 'Severity', value: data.severity || 'Warning' },
                    block_three: { type: 'Tags', value: data.tags },
                    recommendationText: { type: 'View recommendation', value: data?.recommendationText }
                };

            case GENERAL.SCHEDULED_FSX_FOR_ONTAP_BACKUPS:
                return {
                    block_one: { type: 'File system Name', value: data.impactedCount || '0' },
                    block_two: { type: 'Severity', value: data.severity || 'Warning' },
                    block_three: { type: 'Tags', value: data.tags },
                    recommendationText: { type: 'View recommendation', value: data?.recommendationText }
                };
            case GENERAL.CRR:
                return {
                    block_one: { type: 'Impacted volumes', value: data.impactedCount || '0' },
                    block_two: { type: 'Severity', value: data.severity || 'Warning' },
                    block_three: { type: 'Tags', value: data.tags },
                    recommendationText: { type: 'View recommendation', value: data?.recommendationText }
                };
            case GENERAL.CLONE_MANAGEMENT:
                return {
                    block_one: { type: 'Impacted databases', value: data.impactedCount || '0' },
                    block_two: { type: 'Severity', value: data.severity || 'Warning' },
                    block_three: { type: 'Tags', value: data.tags },
                    recommendationText: {
                        type: 'View recommendation',
                        value: data?.recommendation?.description
                    }
                };
            default:
                return null;
        }
    };

    const displayRecommendations = () => {
        if (selectedOptimizeConfig?.type === 'Log drive size') {
            return (
                <TooltipInfo>
                    <div className={styles.tooltipContainer}>
                        <DsTypography variant="Regular_14">{setCardData?.recommendationText?.value}</DsTypography>
                        <DsTypography variant="Regular_14">
                            {setCardData?.recommendationText?.valueHeading}
                        </DsTypography>

                        {setCardData?.recommendationText?.values.map((value: string, index: number) => (
                            <div key={index}>
                                <DsTypography variant="Regular_14">{value}</DsTypography>
                            </div>
                        ))}
                    </div>
                </TooltipInfo>
            );
        } else if (selectedOptimizeConfig?.type === 'Network adapter settings') {
            return (
                <TooltipInfo>
                    <div
                        className={styles.rssConfig}
                        style={{
                            //@ts-ignore
                            whiteSpace: 'pre-wrap',
                            width: 'unset'
                        }}
                    >
                        <DsTypography variant="Regular_14">
                            {setCardData?.recommendationText?.value?.first}
                        </DsTypography>
                        {setCardData?.recommendationText?.second && (
                            <DsTypography variant="Regular_14">
                                {setCardData?.recommendationText?.value?.second}
                            </DsTypography>
                        )}
                        <div className={styles.bulletContainer}>
                            {setCardData?.recommendationText?.value?.points?.map((perPoint: any, index: number) => {
                                return (
                                    <div
                                        className={styles.points}
                                        style={{ marginTop: index === 3 ? '-16px' : '' }}
                                        key={index}
                                    >
                                        <div className={styles.bullet}>
                                            <Bullet />
                                        </div>
                                        <DsTypography variant="Regular_14" style={{ position: 'relative', top: '5px' }}>
                                            {perPoint}
                                        </DsTypography>
                                    </div>
                                );
                            })}
                        </div>
                        <DsTypography variant="Regular_14">{setCardData?.recommendationText?.value?.last}</DsTypography>
                    </div>
                </TooltipInfo>
            );
        } else {
            return <TooltipInfo>{setCardData?.recommendationText?.value}</TooltipInfo>;
        }
    };

    return (
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

                    <div className={styles.tagRow}>
                        <DsTypography variant="Semibold_14">{setCardData?.block_three?.type}</DsTypography>
                        <div className={styles.tagContainer}>
                            {setCardData?.block_three?.value.map((tag: string, index: number) => {
                                return (
                                    <div key={index}>
                                        <Tag text={tag} />
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
                <div className={styles.rightSide}>
                    {displayRecommendations()}
                    <DsTypography variant="Regular_14">{setCardData?.recommendationText?.type}</DsTypography>
                </div>
            </div>
        </div>
    );
};

export default OptimizeCard;
