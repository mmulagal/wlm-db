import { Table, useTable, DsFlashingDotsLoader } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { DsTypography } from '@netapp/design-system';
import styles from './InstanceInformation.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';
import { GENERAL } from '../../../../utils/appConstants';
import { useEffect, useState } from 'react';

const InstanceInformation = () => {
    const selectedHostDetails = useAppSelector(state => state.exploreSavings.selectedHostDetails);

    const [tableData, setTableData] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setLoading(selectedHostDetails?.loading);
        const instanceTypelist = selectedHostDetails?.topology?.ec2Details?.map((inst: any) => inst?.instanceType);
        let data: any = [
            {
                details: 'Instance type',
                value: instanceTypelist ? instanceTypelist.join(', ') : GENERAL.NOT_AVAILABLE,
                id: '1'
            },
            {
                details: 'SQL Edition',
                value: selectedHostDetails?.databaseServer?.serverEdition || GENERAL.NOT_AVAILABLE,
                id: '2'
            },
            {
                details: 'Deployment model',
                value: selectedHostDetails?.serverInstallationMode || GENERAL.NOT_AVAILABLE,
                id: '3'
            }
        ];
        setTableData(data);
    }, [selectedHostDetails]);

    const InstanceColDefs: ColumnProps[] = [
        {
            Header: 'Details',
            accessor: 'details',
            id: '1',
            width: '190px',
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
            width: '386px',
            renderCell: (cellData: any, rowData: any) => {
                return !loading ? (
                    <DsTypography variant="Regular_14" style={{ minWidth: '200px' }}>
                        {rowData.value}
                    </DsTypography>
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
