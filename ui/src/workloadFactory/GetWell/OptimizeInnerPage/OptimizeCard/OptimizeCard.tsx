import { DsTypography, TooltipInfo } from '@netapp/design-system';
import { useAppSelector } from '../../../../store/storeHooks';
import styles from './OptimizeCard.module.scss';
import Tag from '../../../../common/Tag/Tag';
import { useEffect, useState } from 'react';

const OptimizeCard = () => {
    const selectedOptimizeConfig = useAppSelector(state => state.inventoryV2.selectedOptimizeConfig);
    const [setCardData, setSetCardData] = useState<any>({});
    useEffect(() => {
        if (selectedOptimizeConfig) {
            let dataObj = {};
            console.log(selectedOptimizeConfig?.data);
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
    const getCardData = (config: string, data: any) => {
        switch (config) {
            case 'Storage tier':
            case 'ONTAP / Tiering policy':
                return {
                    block_one: { type: 'Impacted volumes', value: data.impactedCount || '0' },
                    block_two: { type: 'Severity', value: data.severity || 'Warning' },
                    block_three: { type: 'Tags', value: data.tags }
                };
            case 'File system headroom':
                return {
                    block_one: { type: 'Impacted databases', value: data.impactedCount || '0' },
                    block_two: { type: 'Severity', value: data.severity || 'Warning' },
                    block_three: { type: 'Tags', value: data.tags }
                };
            case 'Log drive size':
                return {
                    block_one: { type: 'Impacted drives', value: data.impactedCount || '0' },
                    block_two: { type: 'Severity', value: data.severity || 'Warning' },
                    block_three: { type: 'Tags', value: data.tags }
                };
            case 'Data files':
                return {
                    block_one: { type: 'Impacted databases', value: data.impactedCount || '0' },
                    block_two: { type: 'Severity', value: data.severity || 'Warning' },
                    block_three: { type: 'Tags', value: data.tags }
                };
            case 'Log files':
                return {
                    block_one: { type: 'Impacted databases', value: data.impactedCount || '0' },
                    block_two: { type: 'Severity', value: data.severity || 'Warning' },
                    block_three: { type: 'Tags', value: data.tags }
                };
            case 'Thin provisioning':
            case 'Autosize':
            case 'Autosize-mode':
            case 'Fractional reserve':
            case 'Snapshot copy reserve':
            case 'Snapshot autodelete ':
            case 'Space management':
                return {
                    block_one: { type: 'Impacted volumes', value: data.totalObjectsInViolation || '0' },
                    block_two: { type: 'Severity', value: data.severity || 'Warning' },
                    block_three: { type: 'Tags', value: data.tags }
                };
            case 'Tiering minimum cooling days':
                return {
                    block_one: { type: 'Impacted volumes', value: data.totalObjectsInViolation || '0' },
                    block_two: { type: 'Severity', value: data.severity || 'Warning' },
                    block_three: { type: 'Tags', value: data.tags }
                };
            case 'OS type':
                return {
                    block_one: { type: 'Impacted LUNs', value: data.totalObjectsInViolation || '0' },
                    block_two: { type: 'Severity', value: data.severity || 'Warning' },
                    block_three: { type: 'Tags', value: data.tags }
                };
            case 'Space reservation':
            case 'Space allocation':
                return {
                    block_one: { type: 'Impacted LUNs', value: data.totalObjectsInViolation || '0' },
                    block_two: { type: 'Severity', value: data.severity || 'Warning' },
                    block_three: { type: 'Tags', value: data.tags }
                };
            case 'Multipath I/O Policy':
                return {
                    block_one: { type: 'Impacted discs', value: data.totalObjectsInViolation || '0' },
                    block_two: { type: 'Severity', value: data.severity || 'Warning' },
                    block_three: { type: 'Tags', value: data.tags }
                };
            case 'NTFS allocation unit size':
                return {
                    block_one: { type: 'Impacted discs', value: data.totalObjectsInViolation || '0' },
                    block_two: { type: 'Severity', value: data.severity || 'Warning' },
                    block_three: { type: 'Tags', value: data.tags }
                };
            case 'Network adapter settings':
            case 'Network adapters':
                return {
                    block_one: { type: 'Impacted network adapters', value: data.impactedCount || '0' },
                    block_two: { type: 'Severity', value: data.severity || 'Warning' },
                    block_three: { type: 'Tags', value: data.tags }
                };
            default:
                return null;
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
                    <TooltipInfo>
                        For optimal storage performance, provision FSx for ONTAP volumes on the primary SSD tier. Using
                        the capacity tier may result in slower performance and higher latency.
                    </TooltipInfo>
                    <DsTypography variant="Regular_14">View recommendation</DsTypography>
                </div>
            </div>
        </div>
    );
};

export default OptimizeCard;
