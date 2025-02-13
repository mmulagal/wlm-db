import { DsTypography, TooltipInfo } from '@netapp/design-system';
import { useAppSelector } from '../../../../store/storeHooks';
import styles from './OptimizeCard.module.scss';
import Tag from '../../../../common/Tag/Tag';
import { useEffect, useState } from 'react';

const OptimizeCard = () => {
    const selectedOptimizeConfig = useAppSelector(state => state.inventoryV2.selectedOptimizeConfig);
    const optimizeInnerPageValues = useAppSelector(state => state.inventoryV2.optimizeInnerPageValues);
    const [setCardData, setSetCardData] = useState<any>({});
    useEffect(() => {
        if (optimizeInnerPageValues) {
            const data = getCardData(selectedOptimizeConfig, optimizeInnerPageValues);
            setSetCardData(data);
        }
    }, [selectedOptimizeConfig, optimizeInnerPageValues]);
    const getCardData = (config: string, data: any) => {
        if (config === 'Storage tier') {
            return {
                block_one: { type: 'Impacted volumes', value: data.impactedVolumes || '2' },
                block_two: { type: 'Severity', value: data.severity || 'Critical' },
                block_three: { type: 'Tags', value: ['Performance efficiency'] }
            };
        } else if (config === 'File system') {
            return {
                block_one: { type: 'Impacted databases', value: data.impactedDatabases || '0' },
                block_two: { type: 'Severity', value: data.severity || 'Unknown' },
                block_three: { type: 'Tags', value: data.tags || [] }
            };
        }
        return null;
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
                        {setCardData?.block_three?.value.map((tag: string, index: number) => {
                            return (
                                <div key={index}>
                                    <Tag text={tag} />
                                </div>
                            );
                        })}
                    </div>
                </div>
                <div className={styles.rightSide}>
                    <TooltipInfo>text</TooltipInfo>
                    <DsTypography variant="Regular_14">View recommendation</DsTypography>
                </div>
            </div>
        </div>
    );
};

export default OptimizeCard;
