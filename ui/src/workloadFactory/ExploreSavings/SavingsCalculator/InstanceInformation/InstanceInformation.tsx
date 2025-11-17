import { Table, useTable, DsFlashingDotsLoader, TooltipInfo, DsTypography } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { useEffect, useState } from 'react';
import styles from './InstanceInformation.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';
import { GENERAL } from '../../../../utils/appConstants';
import { FINDINGS, SAVINGS_CALC_MODE, WLF_TABS } from '../../../../utils/consts';

const InstanceInformation = () => {
    const selectedHostDetails = useAppSelector(state => state.exploreSavings.selectedHostDetails);
    const {
        savingsCalculatorFrom,
        storageSavingsResponse,
        storageSavingsLoading,
        snapshotLoading,
        selectedExploreSavingsTab,
        selectedOnPremHostDetails
    }: any = useAppSelector(state => state.exploreSavings);

    const [tableData, setTableData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [noOfInstances, setNoOfInstances] = useState(0);

    useEffect(() => {
        if (selectedExploreSavingsTab !== WLF_TABS.MSSQL_ON_PREMISES) {
            setLoading(selectedHostDetails?.loading);
            const findingsComputeData = (() => {
                if (savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS && storageSavingsResponse) {
                    // Handle AUTO_EBS array format
                    const computeArray = Array.isArray(storageSavingsResponse?.compute)
                        ? storageSavingsResponse.compute
                        : [storageSavingsResponse?.compute].filter(Boolean);
                    return computeArray[0]?.existing?.finding || '-';
                }
                // Handle single object format for other modes
                return storageSavingsResponse && (storageSavingsResponse?.compute?.existing?.finding || '-');
            })();
            const findingsLicenseData = (() => {
                if (savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS && storageSavingsResponse) {
                    // Handle AUTO_EBS array format
                    const licenseArray = Array.isArray(storageSavingsResponse?.license)
                        ? storageSavingsResponse.license
                        : [storageSavingsResponse?.license].filter(Boolean);
                    return licenseArray[0]?.existing?.finding || '-';
                }
                // Handle single object format for other modes
                return storageSavingsResponse && (storageSavingsResponse?.license?.existing?.finding || '-');
            })();
            const findingsDbModel =
                selectedHostDetails?.serverInstallationMode?.length &&
                selectedHostDetails?.serverInstallationMode.includes(GENERAL.AOAG)
                    ? FINDINGS.NOT_OPTIMIZED
                    : FINDINGS.OPTIMIZED;

            setNoOfInstances(selectedHostDetails?.totalInstance || 0);

            let instanceTypelist = [];
            if (selectedHostDetails?.clusterNodeDetails && selectedHostDetails?.clusterNodeDetails?.length === 2) {
                instanceTypelist = selectedHostDetails?.clusterNodeDetails?.map((inst: any) => inst?.ec2InstanceType);
            } else {
                instanceTypelist = selectedHostDetails?.ec2Details?.map((inst: any) => inst?.instanceType);
            }
            const serverEdition: any = [];
            selectedHostDetails?.sqlServerInstances?.map((perRow: any) => {
                if (
                    perRow?.databaseServer?.serverEdition &&
                    !serverEdition.includes(perRow?.databaseServer?.serverEdition)
                ) {
                    serverEdition.push(perRow?.databaseServer?.serverEdition);
                }
            });
            const data: any = [
                {
                    details: 'Instance type',
                    value: instanceTypelist?.length > 0 ? instanceTypelist.join(', ') : GENERAL.NOT_AVAILABLE,
                    id: '1',
                    findings: savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS ? findingsComputeData : ''
                },
                {
                    details: 'SQL Edition',
                    value: serverEdition?.length > 0 ? serverEdition.join(', ') : GENERAL.NOT_AVAILABLE,
                    id: '2',
                    findings: findingsLicenseData
                },
                {
                    details: 'Deployment model',
                    value: selectedHostDetails?.serverAllInstallationMode
                        ? selectedHostDetails?.serverAllInstallationMode.join(', ')
                        : selectedHostDetails?.serverInstallationMode || GENERAL.NOT_AVAILABLE,
                    id: '3',
                    findings: findingsDbModel
                }
            ];
            setTableData(data);
        }
    }, [selectedHostDetails, storageSavingsResponse]);

    useEffect(() => {
        if (selectedExploreSavingsTab === WLF_TABS.MSSQL_ON_PREMISES) {
            const findingsLicenseData = storageSavingsResponse && (storageSavingsResponse?.license?.finding || '-');
            const findingsDbModel = selectedOnPremHostDetails?.deploymentModel?.includes(GENERAL.AOAG)
                ? FINDINGS.NOT_OPTIMIZED
                : FINDINGS.OPTIMIZED;

            setNoOfInstances(selectedOnPremHostDetails?.totalInstance || 0);

            const serverEdition: any = [];
            selectedOnPremHostDetails?.sqlServerInstances?.map((perRow: any) => {
                if (perRow?.sqlEdition && !serverEdition.includes(perRow?.sqlEdition)) {
                    serverEdition.push(perRow?.sqlEdition);
                }
            });
            const data: any = [
                {
                    details: 'SQL Edition',
                    value: serverEdition?.length > 0 ? serverEdition.join(', ') : GENERAL.NOT_AVAILABLE,
                    id: '2',
                    findings: findingsLicenseData
                },
                {
                    details: 'Deployment model',
                    value: selectedOnPremHostDetails?.deploymentModel || GENERAL.NOT_AVAILABLE,
                    id: '3',
                    findings: findingsDbModel
                }
            ];
            setTableData(data);
        }
    }, [selectedOnPremHostDetails, storageSavingsResponse]);

    const InstanceColDefs: ColumnProps[] = [
        {
            Header: 'Details',
            accessor: 'details',
            id: '1',
            width: selectedExploreSavingsTab === WLF_TABS.MSSQL_ON_PREMISES ? '282px' : '178px',
            renderCell: (cellData: any, rowData: any) => (
                <div className={styles.tooltips}>
                    {rowData.details === 'SQL Edition' && noOfInstances > 1 && (
                        <TooltipInfo>{GENERAL.ES_SQL_EDITION_MULTI_TOOLTIP}</TooltipInfo>
                    )}
                    <DsTypography variant="Regular_14" style={{ minWidth: '125px' }}>
                        {rowData.details}
                    </DsTypography>
                </div>
            )
        },

        {
            Header: 'Value',
            accessor: 'value',
            id: '2',
            width: selectedExploreSavingsTab === WLF_TABS.MSSQL_ON_PREMISES ? '282px' : '220px',
            renderCell: (cellData: any, rowData: any) =>
                !loading ? (
                    <DsTypography variant="Regular_14" style={{ minWidth: '200px' }}>
                        {rowData.value}
                    </DsTypography>
                ) : (
                    <DsFlashingDotsLoader />
                )
        },
        {
            Header: 'Findings',
            accessor: 'findings',
            id: '3',
            width: selectedExploreSavingsTab === WLF_TABS.MSSQL_ON_PREMISES ? '282px' : '192px',
            renderCell: (cellData: any, rowData: any) =>
                !storageSavingsLoading && !snapshotLoading ? (
                    <>
                        {rowData.details === 'Instance type' &&
                            savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS && (
                                <div className={styles.instanceTypeTooltip}>
                                    <TooltipInfo>{GENERAL.INSTANCE_TYPE_FINDINGS_TOOLTIP}</TooltipInfo>
                                </div>
                            )}
                        {rowData?.findings === FINDINGS.NOT_OPTIMIZED && (
                            <div className={styles.tooltips}>
                                {rowData.details === 'SQL Edition' && (
                                    <TooltipInfo>{GENERAL.NOT_OPTIMIZED}</TooltipInfo>
                                )}
                                <DsTypography variant="Regular_14">
                                    {rowData?.details === 'Instance type'
                                        ? GENERAL.FINDINGS.OVER_PROVISIONED
                                        : GENERAL.FINDINGS.NOT_OPTIMIZED}
                                </DsTypography>
                            </div>
                        )}

                        {rowData?.findings === FINDINGS.OPTIMIZED && (
                            <DsTypography variant="Regular_14">{GENERAL.FINDINGS.OPTIMIZED}</DsTypography>
                        )}

                        {rowData?.findings === FINDINGS.UNDER_PROVISIONED && (
                            <DsTypography variant="Regular_14">{GENERAL.FINDINGS.UNDER_PROVISIONED}</DsTypography>
                        )}

                        {(rowData?.findings === FINDINGS.INSUFFICIENT_DATA ||
                            rowData?.findings === FINDINGS.INSUFFICIENT_PERMISSIONS) && (
                            <DsTypography variant="Regular_14">{GENERAL.NOT_AVAILABLE}</DsTypography>
                        )}

                        {rowData.details === 'Instance type' &&
                            savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_FSXW && (
                                <DsTypography variant="Regular_14">-</DsTypography>
                            )}
                    </>
                ) : (
                    <DsFlashingDotsLoader />
                )
        }
    ];

    const tableProps = useTable({
        // @ts-ignore
        selectAllProps: false,
        // @ts-ignore
        manageColumnsProps: false,

        columns: InstanceColDefs,
        rows: tableData,
        pageSize: 10
    });
    return (
        <div className={styles.instanceInformation}>
            <DsTypography variant="Regular_14">{GENERAL.INSTANCE_INFORMATION}</DsTypography>
            <div className={styles.instanceTable}>
                <Table
                    // @ts-ignore
                    tableProps={tableProps}
                    variant="innerTable"
                />
            </div>
        </div>
    );
};

export default InstanceInformation;
