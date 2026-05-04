import { DsTypography, DsFlashingDotsLoader, TooltipInfo } from '@netapp/design-system';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './CostBreakdown.module.scss';
import { Card, CardContent, CardTableContent } from '../../../../ui-components/Cards/Card';
import { Text } from '../../../../ui-components/Typography';
import { comparisonData, comparisonDataFsxw } from '../savingsUtil';
import { Grid, GridItem } from '../../../../ui-components/Layout/Grid';
import { useAppSelector } from '../../../../store/storeHooks';
import { SAVINGS_CALC_MODE } from '../../../../utils/consts';

type CB = {
    disableState: boolean;
};

const CostBreakdown = ({ disableState = false }: CB) => {
    const { t } = useTranslation();
    const { storageSavingsResponse, storageSavingsLoading, savingsCalculatorFrom, oracleLicenseCostUpdating } =
        useAppSelector(state => state.exploreSavings);

    const isOracle =
        savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_ONPREM ||
        savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_AUTO_EBS;
    const [calculatedResponse, setCalculatedResponse] = useState({});
    const [loading, setLoading] = useState(false);

    const checkForTooltip = (() => {
        if (
            (savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS ||
                savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_AUTO_EBS ||
                savingsCalculatorFrom === SAVINGS_CALC_MODE.ONPREM ||
                savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_ONPREM) &&
            storageSavingsResponse
        ) {
            // Handle AUTO_EBS/ONPREM/ORACLE_ONPREM array format - check if ANY host has Enterprise→Standard downgrade
            const licenseArray = Array.isArray(storageSavingsResponse?.license)
                ? storageSavingsResponse.license
                : [storageSavingsResponse?.license].filter(Boolean);
            return licenseArray.some(
                license =>
                    // Check for MSSQL (sqlServerEdition) or Oracle (oracleEdition) Enterprise→Standard downgrade
                    (license?.existing?.sqlServerEdition?.includes('Enterprise') &&
                        license?.recommended?.sqlServerEdition?.includes('Standard')) ||
                    (license?.existing?.oracleEdition?.includes('Enterprise') &&
                        license?.recommended?.oracleEdition?.includes('Standard'))
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
        setLoading(storageSavingsLoading || oracleLicenseCostUpdating);
    }, [storageSavingsResponse, storageSavingsLoading, oracleLicenseCostUpdating]);

    // Helper to get the second category label based on mode
    const getSecondCategoryLabel = (): string => {
        if (
            savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_ONPREM ||
            savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_AUTO_EBS
        ) {
            return t('databases.explore-savings.oracle-server-on-ebs');
        }
        if (
            savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_EBS ||
            savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS ||
            savingsCalculatorFrom === SAVINGS_CALC_MODE.ONPREM
        ) {
            return t('databases.explore-savings.mssql-on-ebs');
        }
        return t('databases.explore-savings.mssql-on-fsxw');
    };

    // Helper to get the comparison data and existing type based on mode
    const getComparisonConfig = (): { data: any[]; existingType: string } => {
        if (
            savingsCalculatorFrom === SAVINGS_CALC_MODE.MANUAL_FSXW ||
            savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_FSXW
        ) {
            return { data: comparisonDataFsxw(calculatedResponse), existingType: 'fsxw' };
        }
        return { data: comparisonData(calculatedResponse), existingType: 'ebs' };
    };

    const comparisonConfig = getComparisonConfig();

    // eslint-disable-next-line react/no-unstable-nested-components, no-unused-vars
    const ComparisonTableLayout = ({ data, calculatedResponse: _calcResp, existingType }: any) => {
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
                    {t('databases.explore-savings.cost-breakdown')}
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
                                {t('databases.explore-savings.type')}
                            </div>
                            <div className={styles['table-container']}>
                                <div className={styles['header-label']}>
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
                                            fontWeight: '500',
                                            color: disableState ? 'var(--text-disabled)' : 'var(--text-primary)'
                                        }}
                                    >
                                        {savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_ONPREM ||
                                        savingsCalculatorFrom === SAVINGS_CALC_MODE.ORACLE_AUTO_EBS
                                            ? t('databases.explore-savings.oracle-server-on-fsx-ontap')
                                            : t('databases.explore-savings.mssql-server-on-fsx-ontap')}
                                    </Text>
                                </div>
                            </div>
                            <div className={styles['table-container-right']}>
                                <div className={styles['header-label']}>
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
                                            fontWeight: '500',
                                            color: disableState ? 'var(--text-disabled)' : 'var(--text-primary)'
                                        }}
                                    >
                                        {getSecondCategoryLabel()}
                                    </Text>
                                </div>
                            </div>
                        </CardTableContent>

                        {comparisonConfig?.data?.map((data: any, idx: number) => (
                            <ComparisonTableLayout
                                key={data.type + String(idx)}
                                data={data}
                                calculatedResponse={calculatedResponse}
                                existingType={comparisonConfig.existingType}
                            />
                        ))}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default CostBreakdown;
