import { DsFlashingDotsLoader, TooltipInfo, DsTypography } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { TFunction } from 'i18next';
import { FINDINGS, SAVINGS_CALC_MODE, WLF_TABS } from '../../../../utils/consts';

interface OracleColDefsParams {
    loading: boolean;
    noOfInstances: number;
    styles: Record<string, string>;
    t: TFunction;
}

interface InstanceColDefsParams {
    loading: boolean;
    noOfInstances: number;
    storageSavingsLoading: boolean;
    snapshotLoading: boolean;
    savingsCalculatorFrom: string | null;
    isOnPremMode: boolean;
    styles: Record<string, string>;
    t: TFunction;
}

interface InstanceClassNameParams {
    savingsCalculatorFrom: string | null;
    selectedExploreSavingsTab: string;
    isOracleOnPrem: boolean;
    styles: Record<string, string>;
}

export const getOracleColDefs = ({ loading, noOfInstances, styles, t }: OracleColDefsParams): ColumnProps[] => [
    {
        Header: t('databases.explore-savings.instance-information-table.headers.database-information'),
        accessor: 'details',
        id: '1',
        width: '282px',
        renderCell: (_cellData: any, rowData: any) => (
            <div className={styles.tooltips}>
                {rowData.details === 'Database edition' && noOfInstances > 1 && (
                    <TooltipInfo>{t('databases.explore-savings.oracle-edition-multi-tooltip')}</TooltipInfo>
                )}
                <DsTypography variant="Regular_14" style={{ minWidth: '125px' }}>
                    {rowData.details}
                </DsTypography>
            </div>
        )
    },
    {
        Header: t('databases.explore-savings.instance-information-table.headers.value'),
        accessor: 'value',
        id: '2',
        width: '282px',
        renderCell: (_cellData: any, rowData: any) =>
            !loading ? (
                <DsTypography variant="Regular_14" style={{ minWidth: '200px' }}>
                    {rowData.value}
                </DsTypography>
            ) : (
                <DsFlashingDotsLoader />
            )
    }
];

export const getInstanceColDefs = ({
    loading,
    noOfInstances,
    storageSavingsLoading,
    snapshotLoading,
    savingsCalculatorFrom,
    isOnPremMode,
    styles,
    t
}: InstanceColDefsParams): ColumnProps[] => [
    {
        Header: t('databases.explore-savings.instance-information-table.headers.details'),
        accessor: 'details',
        id: '1',
        width: isOnPremMode ? '282px' : '178px',
        renderCell: (_cellData: any, rowData: any) => (
            <div className={styles.tooltips}>
                {rowData.details === 'SQL Edition' && noOfInstances > 1 && (
                    <TooltipInfo>{t('databases.explore-savings.sql-edition-multi-tooltip')}</TooltipInfo>
                )}
                <DsTypography variant="Regular_14" style={{ minWidth: '125px' }}>
                    {rowData.details}
                </DsTypography>
            </div>
        )
    },
    {
        Header: t('databases.explore-savings.instance-information-table.headers.value'),
        accessor: 'value',
        id: '2',
        width: isOnPremMode ? '282px' : '220px',
        renderCell: (_cellData: any, rowData: any) =>
            !loading ? (
                <DsTypography variant="Regular_14" style={{ minWidth: '200px' }}>
                    {rowData.value}
                </DsTypography>
            ) : (
                <DsFlashingDotsLoader />
            )
    },
    {
        Header: t('databases.explore-savings.instance-information-table.headers.findings'),
        accessor: 'findings',
        id: '3',
        width: isOnPremMode ? '282px' : '192px',
        renderCell: (_cellData: any, rowData: any) =>
            !storageSavingsLoading && !snapshotLoading ? (
                <>
                    {rowData.details === 'Instance type' && savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS && (
                        <div className={styles.instanceTypeTooltip}>
                            <TooltipInfo>{t('databases.explore-savings.instance-type-findings-tooltip')}</TooltipInfo>
                        </div>
                    )}
                    {rowData?.findings === FINDINGS.NOT_OPTIMIZED && (
                        <div className={styles.tooltips}>
                            {rowData.details === 'SQL Edition' && (
                                <TooltipInfo>{t('databases.explore-savings.not-optimized-tooltip')}</TooltipInfo>
                            )}
                            <DsTypography variant="Regular_14">
                                {rowData?.details === 'Instance type'
                                    ? t('databases.explore-savings.findings-over-provisioned')
                                    : t('databases.general.findings.not_optimized')}
                            </DsTypography>
                        </div>
                    )}

                    {rowData?.findings === FINDINGS.OPTIMIZED && (
                        <DsTypography variant="Regular_14">{t('databases.general.findings.optimized')}</DsTypography>
                    )}

                    {rowData?.findings === FINDINGS.UNDER_PROVISIONED && (
                        <DsTypography variant="Regular_14">
                            {t('databases.explore-savings.findings-under-provisioned')}
                        </DsTypography>
                    )}

                    {(rowData?.findings === FINDINGS.INSUFFICIENT_DATA ||
                        rowData?.findings === FINDINGS.INSUFFICIENT_PERMISSIONS) && (
                        <DsTypography variant="Regular_14">{t('databases.general.not-available')}</DsTypography>
                    )}

                    {rowData.details === 'Instance type' && savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_FSXW && (
                        <DsTypography variant="Regular_14">-</DsTypography>
                    )}
                </>
            ) : (
                <DsFlashingDotsLoader />
            )
    }
];

export const getInstanceClassName = ({
    savingsCalculatorFrom,
    selectedExploreSavingsTab,
    isOracleOnPrem,
    styles
}: InstanceClassNameParams): string => {
    if (
        savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_FSXW ||
        selectedExploreSavingsTab === WLF_TABS.MSSQL_ON_PREMISES ||
        isOracleOnPrem
    ) {
        return styles.instanceInformationAlternate;
    }
    return styles.instanceInformation;
};
