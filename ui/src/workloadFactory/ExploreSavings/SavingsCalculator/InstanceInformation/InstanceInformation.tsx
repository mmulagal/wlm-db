import { Table, useTable, DsFlashingDotsLoader, TooltipInfo } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { DsTypography } from '@netapp/design-system';
import styles from './InstanceInformation.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';
import { GENERAL } from '../../../../utils/appConstants';
import { useEffect, useState } from 'react';

const InstanceInformation = () => {
    const selectedHostDetails = useAppSelector(state => state.exploreSavings.selectedHostDetails);
    const { storageSavingsResponse, storageSavingsLoading }: any = useAppSelector(state => state.exploreSavings);
    const isInventoryV2 = useAppSelector(state => state.auth.isInventoryV2);

    const [tableData, setTableData] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setLoading(selectedHostDetails?.loading);
        const findingsComputeData =
            storageSavingsResponse && (storageSavingsResponse?.compute?.existing?.findings || '-');
        const findingsLicenseData =
            storageSavingsResponse && (storageSavingsResponse?.license?.existing?.findings || '-');
        if (isInventoryV2) {
            let instanceTypelist = [];
            if (selectedHostDetails?.clusterNodeDetails && selectedHostDetails?.clusterNodeDetails?.length === 2) {
                instanceTypelist = selectedHostDetails?.clusterNodeDetails?.map((inst: any) => inst?.ec2InstanceType);
            } else {
                instanceTypelist = selectedHostDetails?.ec2Details?.map((inst: any) => inst?.instanceType);
            }
            let serverEdition: any = [];
            selectedHostDetails?.sqlServerInstances?.map((perRow: any) => {
                if (
                    perRow?.databaseServer?.serverEdition &&
                    !serverEdition.includes(perRow?.databaseServer?.serverEdition)
                ) {
                    serverEdition.push(perRow?.databaseServer?.serverEdition);
                }
            });
            let data: any = [
                {
                    details: 'Instance type',
                    value: instanceTypelist?.length > 0 ? instanceTypelist.join(', ') : GENERAL.NOT_AVAILABLE,
                    id: '1',
                    findings: findingsComputeData
                },
                {
                    details: 'SQL Edition',
                    value: serverEdition?.length > 0 ? serverEdition.join(', ') : GENERAL.NOT_AVAILABLE,
                    id: '2',
                    findings: findingsLicenseData
                },
                {
                    details: 'Deployment model',
                    value: selectedHostDetails?.serverInstallationMode || GENERAL.NOT_AVAILABLE,
                    id: '3',
                    findings: ''
                }
            ];
            setTableData(data);
        } else {
            let instanceTypelist = [];
            if (selectedHostDetails?.clusterNodeDetails && selectedHostDetails?.clusterNodeDetails?.length === 2) {
                instanceTypelist = selectedHostDetails?.clusterNodeDetails?.map((inst: any) => inst?.ec2InstanceType);
            } else {
                instanceTypelist = selectedHostDetails?.topology?.ec2Details?.map((inst: any) => inst?.instanceType);
            }
            let data: any = [
                {
                    details: 'Instance type',
                    value: instanceTypelist?.length > 0 ? instanceTypelist.join(', ') : GENERAL.NOT_AVAILABLE,
                    id: '1',
                    findings: findingsComputeData
                },
                {
                    details: 'SQL Edition',
                    value: selectedHostDetails?.databaseServer?.serverEdition || GENERAL.NOT_AVAILABLE,
                    id: '2',
                    findings: findingsLicenseData
                },
                {
                    details: 'Deployment model',
                    value: selectedHostDetails?.serverInstallationMode || GENERAL.NOT_AVAILABLE,
                    id: '3',
                    findings: ''
                }
            ];
            setTableData(data);
        }
    }, [selectedHostDetails, storageSavingsResponse]);

    const InstanceColDefs: ColumnProps[] = [
        {
            Header: 'Details',
            accessor: 'details',
            id: '1',
            width: '178px',
            renderCell: (cellData: any, rowData: any) => {
                return (
                    <DsTypography variant="Regular_14" style={{ minWidth: '125px' }}>
                        {rowData.details}
                    </DsTypography>
                );
            }
        },

        {
            Header: 'Value',
            accessor: 'value',
            id: '2',
            width: '220px',
            renderCell: (cellData: any, rowData: any) => {
                return !loading ? (
                    <DsTypography variant="Regular_14" style={{ minWidth: '200px' }}>
                        {rowData.value}
                    </DsTypography>
                ) : (
                    <DsFlashingDotsLoader />
                );
            }
        },
        {
            Header: 'Findings',
            accessor: 'findings',
            id: '3',
            width: '192px',
            renderCell: (cellData: any, rowData: any) => {
                return !storageSavingsLoading ? (
                    <>
                        {rowData?.findings === 'NOT-OPTIMIZED' && (
                            <div className={styles.findings}>
                                <TooltipInfo>
                                    Your SQL license is Enterprise and could be replaced with Standard while using FSxN,
                                    since replication and other Enterprise features are not in use anymore.
                                </TooltipInfo>
                                <DsTypography variant="Regular_14">Not optimized</DsTypography>
                            </div>
                        )}

                        {rowData?.findings === 'OPTIMIZED' && (
                            <DsTypography variant="Regular_14">Optimized</DsTypography>
                        )}
                    </>
                ) : (
                    <DsFlashingDotsLoader />
                );
            }
        }
    ];

    const tableProps = useTable({
        //@ts-ignore
        selectAllProps: false,
        //@ts-ignore
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
                    //@ts-ignore
                    tableProps={tableProps}
                    variant="innerTable"
                />
            </div>
        </div>
    );
};

export default InstanceInformation;
