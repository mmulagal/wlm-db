import { DsTypography } from '@netapp/design-system';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../../../../store/storeHooks';
import styles from './OptimizeCard.module.scss';
import { GENERAL } from '../../../../utils/appConstants';
import { WLF_TABS } from '../../../../utils/consts';
import RecommendationText from '../../RecommendationText/RecommendationText';
import { getCardMetadata } from '../../../../utils/getWellConfigRegistry';

/**
 * Helper to extract nested value from object using dot notation path.
 * Example: getNestedValue(data, 'recommendation.description') returns data?.recommendation?.description
 */
const getNestedValue = (obj: any, path: string): any => {
    if (!path) return undefined;
    return path.split('.').reduce((current, key) => current?.[key], obj);
};

const OptimizeCard = ({ fromPage = '', recommendationHeight }: any) => {
    const { t } = useTranslation();
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
        // Get card metadata from registry
        const metadata = getCardMetadata(config);

        // Determine the count value based on metadata
        const countValue =
            metadata.countSource === 'impactedCount'
                ? data.impactedCount
                : data.totalObjectsInViolation || data?.violationDetails?.length;

        // Get recommendation text from configured source or fallback to recommendation field
        let recommendationTextValue;
        if (metadata.recommendationSource) {
            recommendationTextValue = getNestedValue(data, metadata.recommendationSource);
        } else {
            // Fallback: try recommendationText first, then recommendation
            recommendationTextValue = data?.recommendationText || data?.recommendation;
        }

        // Handle recommendation data structure
        const recommendation = data?.recommendation;
        const isRecommendationObject = typeof recommendation === 'object' && recommendation !== null;

        // Special handling for log-drive-size and tempdb-drive-size which have additional fields
        const hasValueHeading = data?.recommendation?.valuesHeading || data?.recommendation?.values;

        return {
            block_one: {
                type: metadata.impactedLabel,
                value: countValue || '0'
            },
            block_two: {
                type: 'Severity',
                value: data.severity
            },
            block_three: {
                type: 'Tags',
                value: data.tags
            },
            recommendationText: {
                type: 'View recommendation',
                value: typeof recommendationTextValue === 'string' ? recommendationTextValue : undefined,
                ...(hasValueHeading && {
                    valueHeading: data?.recommendation?.valuesHeading,
                    values: data?.recommendation?.values
                })
            },
            data: isRecommendationObject
                ? recommendation
                : {
                      title: `${data?.name || config} recommendation`,
                      description: typeof recommendation === 'string' ? recommendation : recommendationTextValue
                  }
        };
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

            <div className={styles.recommendation} style={recommendationHeight ? { height: recommendationHeight } : {}}>
                <RecommendationText data={setCardData?.data} from="dashboard" cardName={setCardData?.cardName} />
            </div>
        </div>
    );
};

export default OptimizeCard;
