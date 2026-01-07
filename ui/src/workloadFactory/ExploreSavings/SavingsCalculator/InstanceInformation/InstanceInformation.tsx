import { Table, useTable, DsFlashingDotsLoader, TooltipInfo, DsTypography } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { useEffect, useState } from 'react';
import styles from './InstanceInformation.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';
import { GENERAL } from '../../../../utils/appConstants';
import { FINDINGS, SAVINGS_CALC_MODE, WLF_TABS } from '../../../../utils/consts';

const InstanceInformation = ({ host }: { host?: any }) => {
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
            let currentHost = host || selectedHostDetails;

            // If host prop exists and matches selectedHostDetails, prefer selectedHostDetails for latest data
            if (
                host &&
                selectedHostDetails &&
                host.ec2InstanceId === selectedHostDetails.ec2InstanceId &&
                host.credentialId === selectedHostDetails.credentialId &&
                host.regionId === selectedHostDetails.regionId
            ) {
                currentHost = selectedHostDetails;
            }

            setLoading(currentHost?.loading);
            const hostName = currentHost?.name;

            const findingsComputeData = (() => {
                if (savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS && storageSavingsResponse) {
                    // Handle AUTO_EBS array format
                    const computeArray = Array.isArray(storageSavingsResponse?.compute)
                        ? storageSavingsResponse.compute
                        : [storageSavingsResponse?.compute].filter(Boolean);

                    // Find compute data by matching hostname
                    const hostCompute = computeArray.find((item: any) => item.hostname === hostName);
                    return hostCompute?.existing?.finding || '-';
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

                    // Find license data by matching hostname
                    const hostLicense = licenseArray.find((item: any) => item.hostname === hostName);
                    return hostLicense?.existing?.finding || '-';
                }
                // Handle single object format for other modes
                return storageSavingsResponse && (storageSavingsResponse?.license?.existing?.finding || '-');
            })();
            const findingsDbModel =
                currentHost?.serverInstallationMode?.length &&
                currentHost?.serverInstallationMode.includes(GENERAL.AOAG)
                    ? FINDINGS.NOT_OPTIMIZED
                    : FINDINGS.OPTIMIZED;

            setNoOfInstances(currentHost?.totalInstance || 0);

            let instanceTypelist = [];
            if (currentHost?.clusterNodeDetails && currentHost?.clusterNodeDetails?.length === 2) {
                instanceTypelist = currentHost?.clusterNodeDetails?.map((inst: any) => inst?.ec2InstanceType);
            } else {
                instanceTypelist = currentHost?.ec2Details?.map((inst: any) => inst?.instanceType);
            }
            const serverEdition: any = [];

            currentHost?.sqlServerInstances?.map((perRow: any) => {
                // Check both nested and direct paths for serverEdition
                const edition = perRow?.databaseServer?.serverEdition || perRow?.serverEdition;

                if (edition && !serverEdition.includes(edition)) {
                    serverEdition.push(edition);
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
                    value: currentHost?.serverAllInstallationMode
                        ? currentHost?.serverAllInstallationMode.join(', ')
                        : currentHost?.serverInstallationMode || GENERAL.NOT_AVAILABLE,
                    id: '3',
                    findings: findingsDbModel
                }
            ];
            setTableData(data);
        }
    }, [selectedHostDetails, storageSavingsResponse, host]);

    useEffect(() => {
        if (selectedExploreSavingsTab === WLF_TABS.MSSQL_ON_PREMISES) {
            // For on-prem bulk mode, use the host prop if available
            const currentHost = host || selectedOnPremHostDetails;
            const hostName = currentHost?.resourceName;

            const findingsLicenseData = (() => {
                if (savingsCalculatorFrom === SAVINGS_CALC_MODE.ONPREM && storageSavingsResponse) {
                    // Handle ONPREM array format for bulk
                    const licenseArray = Array.isArray(storageSavingsResponse?.license)
                        ? storageSavingsResponse.license
                        : [storageSavingsResponse?.license].filter(Boolean);

                    // Find license data by matching hostname
                    const hostLicense = licenseArray.find((item: any) => item.hostname === hostName);
                    return hostLicense?.finding || '-';
                }
                // Handle single object format for non-bulk mode
                return storageSavingsResponse && (storageSavingsResponse?.license?.finding || '-');
            })();

            const findingsDbModel = currentHost?.deploymentModel?.includes(GENERAL.AOAG)
                ? FINDINGS.NOT_OPTIMIZED
                : FINDINGS.OPTIMIZED;

            setNoOfInstances(currentHost?.totalInstance || 0);

            const serverEdition: any = [];
            currentHost?.sqlServerInstances?.map((perRow: any) => {
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
                    value: currentHost?.deploymentModel || GENERAL.NOT_AVAILABLE,
                    id: '3',
                    findings: findingsDbModel
                }
            ];
            setTableData(data);
        }
    }, [selectedOnPremHostDetails, storageSavingsResponse, host]);

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

    const getInstanceClassName = () => {
        if (
            savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_FSXW ||
            selectedExploreSavingsTab === WLF_TABS.MSSQL_ON_PREMISES
        ) {
            return styles.instanceInformationAlternate;
        }
        return styles.instanceInformation;
    };

    return (
        <div className={getInstanceClassName()}>
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
