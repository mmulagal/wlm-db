import { DsFlashingDotsLoader, TooltipInfo, DsTypography } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { TFunction } from 'i18next';
import { FINDINGS, INSTANCE_INFORMATION_DETAIL, SAVINGS_CALC_MODE, WLF_TABS } from '../../../../utils/consts';

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
        width: 'auto',
        renderCell: (_cellData: any, rowData: any) => (
            <div className={styles.tooltips}>
                {rowData.detailKey === INSTANCE_INFORMATION_DETAIL.DATABASE_EDITION && noOfInstances > 1 && (
                    <TooltipInfo>{t('databases.explore-savings.oracle-edition-multi-tooltip')}</TooltipInfo>
                )}
                <DsTypography variant="Regular_14">{rowData.details}</DsTypography>
            </div>
        )
    },
    {
        Header: t('databases.explore-savings.instance-information-table.headers.value'),
        accessor: 'value',
        id: '2',
        width: 'auto',
        renderCell: (_cellData: any, rowData: any) =>
            !loading ? <DsTypography variant="Regular_14">{rowData.value}</DsTypography> : <DsFlashingDotsLoader />
    }
];

export const getInstanceColDefs = ({
    loading,
    noOfInstances,
    storageSavingsLoading,
    snapshotLoading,
    savingsCalculatorFrom,
    styles,
    t
}: InstanceColDefsParams): ColumnProps[] => [
    {
        Header: t('databases.explore-savings.instance-information-table.headers.details'),
        accessor: 'details',
        id: '1',
        width: 'auto',
        renderCell: (_cellData: any, rowData: any) => (
            <div className={styles.tooltips}>
                {rowData.detailKey === INSTANCE_INFORMATION_DETAIL.SQL_EDITION && noOfInstances > 1 && (
                    <TooltipInfo>{t('databases.explore-savings.sql-edition-multi-tooltip')}</TooltipInfo>
                )}
                <DsTypography variant="Regular_14">{rowData.details}</DsTypography>
            </div>
        )
    },
    {
        Header: t('databases.explore-savings.instance-information-table.headers.value'),
        accessor: 'value',
        id: '2',
        width: 'auto',
        renderCell: (_cellData: any, rowData: any) => {
            if (loading) {
                return <DsFlashingDotsLoader />;
            }
            if (
                rowData.detailKey === INSTANCE_INFORMATION_DETAIL.SQL_EDITION &&
                rowData.showSqlLicensePermissionTooltip
            ) {
                return (
                    <div className={styles.tooltips}>
                        <TooltipInfo>
                            {t('databases.explore-savings.insufficient-sql-license-permissions-tooltip')}
                        </TooltipInfo>
                        <DsTypography variant="Regular_14">{rowData.value}</DsTypography>
                    </div>
                );
            }
            return <DsTypography variant="Regular_14">{rowData.value}</DsTypography>;
        }
    },
    {
        Header: t('databases.explore-savings.instance-information-table.headers.findings'),
        accessor: 'findings',
        id: '3',
        width: 'auto',
        renderCell: (_cellData: any, rowData: any) => {
            const isSqlEditionPermissionTooltip =
                rowData.detailKey === INSTANCE_INFORMATION_DETAIL.SQL_EDITION &&
                rowData.showSqlLicensePermissionTooltip;

            return !storageSavingsLoading && !snapshotLoading ? (
                <>
                    {rowData.detailKey === INSTANCE_INFORMATION_DETAIL.INSTANCE_TYPE &&
                        savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS && (
                            <div className={styles.tooltips}>
                                <TooltipInfo>
                                    {t('databases.explore-savings.instance-type-findings-tooltip')}
                                </TooltipInfo>
                                {(rowData?.findings === FINDINGS.INSUFFICIENT_DATA ||
                                    rowData?.findings === FINDINGS.INSUFFICIENT_PERMISSIONS ||
                                    rowData?.findings === '-') && (
                                    <DsTypography variant="Regular_14">
                                        {t('databases.general.not-available')}
                                    </DsTypography>
                                )}
                            </div>
                        )}
                    {isSqlEditionPermissionTooltip && (
                        <div className={styles.tooltips}>
                            <TooltipInfo>
                                {t('databases.explore-savings.insufficient-sql-license-permissions-tooltip')}
                            </TooltipInfo>
                            <DsTypography variant="Regular_14">{t('databases.general.not-available')}</DsTypography>
                        </div>
                    )}
                    {rowData?.findings === FINDINGS.NOT_OPTIMIZED && !isSqlEditionPermissionTooltip && (
                        <div className={styles.tooltips}>
                            {rowData.detailKey === INSTANCE_INFORMATION_DETAIL.SQL_EDITION && (
                                <TooltipInfo>{t('databases.explore-savings.not-optimized-tooltip')}</TooltipInfo>
                            )}
                            <DsTypography variant="Regular_14">
                                {rowData?.detailKey === INSTANCE_INFORMATION_DETAIL.INSTANCE_TYPE
                                    ? t('databases.explore-savings.findings-over-provisioned')
                                    : t('databases.general.findings.not_optimized')}
                            </DsTypography>
                        </div>
                    )}

                    {rowData?.findings === FINDINGS.OPTIMIZED && !isSqlEditionPermissionTooltip && (
                        <DsTypography variant="Regular_14">{t('databases.general.findings.optimized')}</DsTypography>
                    )}

                    {rowData?.findings === FINDINGS.UNDER_PROVISIONED && !isSqlEditionPermissionTooltip && (
                        <DsTypography variant="Regular_14">
                            {t('databases.explore-savings.findings-under-provisioned')}
                        </DsTypography>
                    )}

                    {(rowData?.findings === FINDINGS.INSUFFICIENT_DATA ||
                        rowData?.findings === FINDINGS.INSUFFICIENT_PERMISSIONS) &&
                        rowData.detailKey !== INSTANCE_INFORMATION_DETAIL.INSTANCE_TYPE &&
                        !isSqlEditionPermissionTooltip && (
                            <DsTypography variant="Regular_14">{t('databases.general.not-available')}</DsTypography>
                        )}

                    {rowData.detailKey === INSTANCE_INFORMATION_DETAIL.INSTANCE_TYPE &&
                        savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_FSXW && (
                            <DsTypography variant="Regular_14">-</DsTypography>
                        )}
                </>
            ) : (
                <DsFlashingDotsLoader />
            );
        }
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
