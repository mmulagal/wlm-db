import { DsTypography, DsFlashingDotsLoader, TooltipInfo } from '@netapp/design-system';
import { useEffect, useState } from 'react';
import styles from './CostBreakdown.module.scss';
import { Card, CardContent, CardTableContent } from '../../../../ui-components/Cards/Card';
import { Text } from '../../../../ui-components/Typography';
import { comparisonData, comparisonDataFsxw } from '../savingsUtil';
import { Grid, GridItem } from '../../../../ui-components/Layout/Grid';
import { useAppSelector } from '../../../../store/storeHooks';
import { GENERAL } from '../../../../utils/appConstants';
import { SAVINGS_CALC_MODE } from '../../../../utils/consts';

type CB = {
    disableState: boolean;
};

const CostBreakdown = ({ disableState = false }: CB) => {
    const { storageSavingsResponse, storageSavingsLoading, savingsCalculatorFrom } = useAppSelector(
        state => state.exploreSavings
    );

    const [calculatedResponse, setCalculatedResponse] = useState({});
    const [loading, setLoading] = useState(false);

    const checkForTooltip = (() => {
        if (savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS && storageSavingsResponse) {
            // Handle AUTO_EBS array format - check if ANY host has Enterprise→Standard downgrade
            const licenseArray = Array.isArray(storageSavingsResponse?.license)
                ? storageSavingsResponse.license
                : [storageSavingsResponse?.license].filter(Boolean);
            return licenseArray.some(
                license =>
                    license?.existing?.sqlServerEdition?.includes('Enterprise') &&
                    license?.recommended?.sqlServerEdition?.includes('Standard')
            );
        }
        // Handle single object format for other modes
        return (
            storageSavingsResponse?.license?.existing?.sqlServerEdition?.includes('Enterprise') &&
            storageSavingsResponse?.license?.recommended?.sqlServerEdition?.includes('Standard')
        );
    })();

    useEffect(() => {
        setCalculatedResponse(storageSavingsResponse);
        setLoading(storageSavingsLoading);
    }, [storageSavingsResponse, storageSavingsLoading]);

    const ComparisonTableLayout = ({ data, calculatedResponse, existingType }: any) => {
        const checkForComputeTooltip = data.isTooltip && data.type === 'Compute';
        return (
            <div
                className={
                    data?.type === 'Total summary'
                        ? `${styles['comparison-table-column']} ${styles.totalSummary}`
                        : styles['comparison-table-column']
                }
                style={
                    data?.type === 'Total summary'
                        ? { backgroundColor: 'var(--table-header-background)', fontWeight: 500 }
                        : { backgroundColor: 'var(--main-background)' }
                }
            >
                <Grid>
                    <GridItem lg="4">
                        <Text
                            color={!calculatedResponse && 'text-disabled'}
                            level={data?.type === 'Total summary' ? '14' : '13'}
                            style={{ color: disableState ? 'var(--text-disabled)' : 'var(--text-primary)' }}
                        >
                            {data?.isTooltip ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {(checkForTooltip || checkForComputeTooltip) && (
                                        <TooltipInfo>{data?.isTooltip}</TooltipInfo>
                                    )}
                                    <div>{data?.type}</div>
                                </div>
                            ) : (
                                <div style={{ whiteSpace: 'nowrap' }}>{data?.type}</div>
                            )}
                        </Text>
                    </GridItem>
                    <GridItem lg="4">
                        <Text style={{ paddingLeft: 10 }}>
                            {!disableState && !loading && calculatedResponse && data?.fsx}
                            {!disableState && loading && (
                                <div style={{ position: 'relative', top: '5px' }}>
                                    <DsFlashingDotsLoader />
                                </div>
                            )}
                        </Text>
                    </GridItem>
                    <GridItem lg="4">
                        <Text style={{ paddingLeft: 10 }}>
                            {!disableState && !loading && calculatedResponse && data?.[existingType]}
                            {!disableState && loading && (
                                <div style={{ position: 'relative', top: '5px' }}>
                                    <DsFlashingDotsLoader />
                                </div>
                            )}
                        </Text>
                    </GridItem>
                </Grid>
            </div>
        );
    };

    return (
        <div className={styles.costBreakdown}>
            <div className={styles.headSection}>
                <DsTypography
                    variant="Semibold_16"
                    className={styles.title}
                    style={{ color: disableState ? 'var(--text-disabled)' : 'var(--text-primary)' }}
                >
                    {GENERAL.ES_COST_BREAKDOWN}
                </DsTypography>
                {loading && <DsFlashingDotsLoader />}
            </div>

            <div>
                <Card>
                    <CardContent style={{ padding: '24px 40px 32px 40px' }}>
                        <CardTableContent columns="lg-3" style={{ padding: 0, height: '56px' }}>
                            <div
                                style={
                                    !calculatedResponse || disableState
                                        ? {
                                              color: 'var(--text-disabled)',
                                              marginLeft: 16
                                          }
                                        : { marginLeft: 16, fontWeight: 500 }
                                }
                            >
                                {' '}
                                {GENERAL.ES_TYPE}
                            </div>
                            <div className={styles['table-container']}>
                                <div
                                    className={styles['table-header']}
                                    style={
                                        !calculatedResponse || disableState
                                            ? { backgroundColor: 'var(--border)' }
                                            : { backgroundColor: 'var(--chart-9)' }
                                    }
                                />
                                <Text
                                    color={!calculatedResponse && 'text-disabled'}
                                    style={{
                                        width: '150px',
                                        fontWeight: '500',
                                        color: disableState ? 'var(--text-disabled)' : 'var(--text-primary)'
                                    }}
                                >
                                    {' '}
                                    {GENERAL.ES_MSSQL_SERVER}
                                </Text>
                            </div>
                            <div className={styles['table-container-right']}>
                                <div
                                    className={styles['table-header']}
                                    style={
                                        !calculatedResponse || disableState
                                            ? { backgroundColor: 'var(--border)' }
                                            : { backgroundColor: 'var(--chart-6)' }
                                    }
                                />
                                <Text
                                    color={!calculatedResponse && 'text-disabled'}
                                    style={{
                                        width: '150px',
                                        fontWeight: '500',
                                        color: disableState ? 'var(--text-disabled)' : 'var(--text-primary)'
                                    }}
                                >
                                    {' '}
                                    {savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_EBS ||
                                    savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS ||
                                    savingsCalculatorFrom === SAVINGS_CALC_MODE.ONPREM
                                        ? GENERAL.ES_MSSQL_EBS
                                        : GENERAL.ES_MSSQL_FSXW}
                                </Text>
                            </div>
                        </CardTableContent>

                        {savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_FSXW ||
                        savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_FSXW
                            ? comparisonDataFsxw(calculatedResponse).map((data: any, index: number) => (
                                  <ComparisonTableLayout
                                      key={index}
                                      data={data}
                                      calculatedResponse={calculatedResponse}
                                      existingType="fsxw"
                                  />
                              ))
                            : comparisonData(calculatedResponse).map((data: any, index: number) => (
                                  <ComparisonTableLayout
                                      key={index}
                                      data={data}
                                      calculatedResponse={calculatedResponse}
                                      existingType="ebs"
                                  />
                              ))}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default CostBreakdown;
