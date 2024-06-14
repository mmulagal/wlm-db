import { DsTypography, DsFlashingDotsLoader } from '@netapp/design-system';
import styles from './CostBreakdown.module.scss';
import { Card, CardContent, CardTableContent } from '../../../../ui-components/Cards/Card';
import { Text } from '../../../../ui-components/Typography';
import { comparisonData } from '../savingsUtil';
import { Grid, GridItem } from '../../../../ui-components/Layout/Grid';
import { useAppSelector } from '../../../../store/storeHooks';
import { GENERAL } from '../../../../utils/appConstants';
import { useEffect, useState } from 'react';

const CostBreakdown = () => {
    const { storageSavingsResponse, storageSavingsLoading } = useAppSelector(state => state.exploreSavings);

    const [calculatedResponse, setCalculatedResponse] = useState({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setCalculatedResponse(storageSavingsResponse);
        setLoading(storageSavingsLoading);
    }, [storageSavingsResponse, storageSavingsLoading]);

    const ComparisonTableLayout = ({ data, calculatedResponse }: any) => {
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
                        >
                            {data?.type}
                        </Text>
                    </GridItem>
                    <GridItem lg="4">
                        <Text style={{ paddingLeft: 10 }}>
                            {!loading && calculatedResponse && data?.fsx}
                            {loading && (
                                <div style={{ position: 'relative', top: '5px' }}>
                                    <DsFlashingDotsLoader />
                                </div>
                            )}
                        </Text>
                    </GridItem>
                    <GridItem lg="4">
                        <Text style={{ paddingLeft: 10 }}>
                            {!loading && calculatedResponse && data?.ebs}
                            {loading && (
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
                <DsTypography variant="Semibold_16" className={styles.title}>
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
                                    !calculatedResponse
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
                                        calculatedResponse
                                            ? { backgroundColor: 'var(--chart-9)' }
                                            : { backgroundColor: 'var(--border)' }
                                    }
                                ></div>
                                <Text
                                    color={!calculatedResponse && 'text-disabled'}
                                    style={{ width: '121px', fontWeight: '500' }}
                                >
                                    {' '}
                                    {GENERAL.ES_MSSQL_SERVER}
                                </Text>
                            </div>
                            <div className={styles['table-container-right']}>
                                <div
                                    className={styles['table-header']}
                                    style={
                                        calculatedResponse
                                            ? { backgroundColor: 'var(--chart-6)' }
                                            : { backgroundColor: 'var(--border)' }
                                    }
                                ></div>
                                <Text
                                    color={!calculatedResponse && 'text-disabled'}
                                    style={{ width: '121px', fontWeight: '500' }}
                                >
                                    {' '}
                                    {GENERAL.ES_MSSQL_EBS}
                                </Text>
                            </div>
                        </CardTableContent>

                        {comparisonData(calculatedResponse).map((data: any, index: number) => (
                            <ComparisonTableLayout key={index} data={data} calculatedResponse={calculatedResponse} />
                        ))}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default CostBreakdown;
