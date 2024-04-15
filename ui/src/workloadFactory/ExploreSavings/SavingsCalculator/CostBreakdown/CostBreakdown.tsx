import { DsTypography } from '@netapp/design-system';
import styles from './CostBreakdown.module.scss';
import { Card, CardContent, CardTableContent } from '../../../../ui-components/Cards/Card';
import { Text } from '../../../../ui-components/Typography';
import { comparisonData } from '../savingsUtil';
import { Grid, GridItem } from '../../../../ui-components/Layout/Grid';

const CostBreakdown = () => {
    const ComparisonTableLayout = ({ data, calculatedResponse }: any) => {
        return (
            <div
                className={styles['comparison-table-column']}
                style={
                    data?.type === 'Total summary'
                        ? { backgroundColor: 'var(--table-header-background)', fontWeight: 590 }
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
                        <Text style={{ paddingLeft: 10 }}>{calculatedResponse && `$ ${data?.fsx}`}</Text>
                    </GridItem>
                    <GridItem lg="4">
                        <Text style={{ paddingLeft: 10 }}>{calculatedResponse && `$ ${data?.ebs}`}</Text>
                    </GridItem>
                </Grid>
            </div>
        );
    };

    const calculatedResponse = {
        fsx: {
            capacity: 1000,
            iops: 1000,
            throughput: 1000,
            snapshots: 1000,
            clone: 1000,
            compute: 1000,
            license: 1000,
            total: 8000
        },
        ebs: {
            capacity: 12,
            iops: 1000,
            throughput: 1000,
            snapshots: '1000',
            clone: '1000',
            compute: '1000',
            license: '1000',
            total: 8000
        }
    };

    return (
        <div className={styles.costBreakdown}>
            <div className={styles.headSection}>
                <DsTypography variant="Semibold_16" className={styles.title}>
                    Cost breakdown - Monthly charge
                </DsTypography>
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
                                Type
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
                                    MsSQL server on FSx for ONTAP
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
                                    MsSQL server on EBS
                                </Text>
                            </div>
                        </CardTableContent>

                        {comparisonData(calculatedResponse).map(
                            (data: { type: string; fsx: string; ebs: string }, index: number) => (
                                <ComparisonTableLayout
                                    key={index}
                                    data={data}
                                    calculatedResponse={calculatedResponse}
                                />
                            )
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default CostBreakdown;
