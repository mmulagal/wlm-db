import { DsTypography, Table, useTable } from '@netapp/design-system';
import styles from './DetectHeader.module.scss';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { ReactComponent as Success } from '../../../../../../assets/success.svg';
import { ReactComponent as Cross } from '../../../../../../assets/black-cross.svg';
import { useAppSelector } from '../../../../../../store/storeHooks';
import { useEffect, useState } from 'react';
import { GENERAL } from '../../../../../../utils/appConstants';
import {
    checkOverallManageState,
    getPermissionState,
    hasMissingPowershell7,
    missingModules
} from '../../ManageInstanceUtils';

const DetectedInstanceTable = () => {
    const { selectedMultiDetectInstances } = useAppSelector(state => state.inventoryV2);
    const [tableData, setTableData] = useState<any>([]);

    const manageCheck = (instance: any) => {
        let manageCheckObj: any = {
            installMissingAWS: false,
            installMissingAWSList: [],
            installMissingPowershell: false,
            assessment: GENERAL.NOT_AVAILABLE,
            remediation: GENERAL.NOT_AVAILABLE,
            dbcreation: GENERAL.NOT_AVAILABLE,
            sandbox: GENERAL.NOT_AVAILABLE,
            ec2InstanceId: '',
            region: '',
            credentialsId: '',
            databaseInstanceName: '',
            overallState: GENERAL.NOT_AVAILABLE
        };

        let manageReadinessData: any = null;
        if (!instance?.data?.windowsAuthentication && !instance?.data?.sqlServerAuthentication) {
            manageReadinessData = instance?.manageReadiness;
        } else {
            manageReadinessData = instance?.data?.manageReadiness;
        }
        if (manageReadinessData) {
            let missingModulesList = missingModules(manageReadinessData);
            let assessment = getPermissionState('assessment', manageReadinessData);
            let remediation = getPermissionState('remediation', manageReadinessData);
            let dbcreation = getPermissionState('dbcreation', manageReadinessData);
            let sandbox = getPermissionState('sandbox', manageReadinessData);
            let overallState = checkOverallManageState(assessment, remediation, dbcreation, sandbox);
            manageCheckObj = {
                installMissingAWS: missingModulesList.length > 0 ? true : false,
                installMissingAWSList: missingModulesList,
                installMissingPowershell: hasMissingPowershell7(manageReadinessData),
                assessment: assessment,
                remediation: remediation,
                dbcreation: dbcreation,
                sandbox: sandbox,
                ec2InstanceId: instance?.data?.ec2InstanceId,
                region: instance?.data?.regionId,
                credentialsId: instance?.data?.credentialId,
                databaseInstanceName: instance?.data?.databaseInstanceName,
                overallState: overallState
            };
            return manageCheckObj;
        }
        return manageCheckObj;
    };

    useEffect(() => {
        let newTableData: any = [];
        selectedMultiDetectInstances?.forEach((item: any) => {
            if (item?.authorized) {
                newTableData.push({
                    id: item?.id,
                    instanceName: item?.data?.databaseInstanceName,
                    hostName: item?.data?.name,
                    readinessStatus: manageCheck(item)?.overallState
                });
            }
        });
        setTableData(newTableData);
    }, [selectedMultiDetectInstances]);

    const ColDefs: ColumnProps[] = [
        {
            id: '1',
            Header: 'Instance name',
            accessor: 'instanceName',
            width: '310px',
            isSortable: true
        },
        {
            id: '2',
            Header: 'Host name',
            accessor: 'hostName',
            width: '310px',
            filterOptions: 'auto'
        },
        {
            id: '3',
            Header: `Readiness status`,
            accessor: 'readinessStatus',
            width: '310px',
            filterOptions: 'auto',
            renderCell: (cellData: any, rowData: any) => {
                return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {cellData === 'Ready' ? <Success /> : <Cross />}
                        <DsTypography variant="Regular_14">{cellData}</DsTypography>
                    </div>
                );
            }
        }
    ];

    const tableProps = useTable({
        //@ts-ignore
        selectAllProps: false,
        //@ts-ignore
        manageColumnsProps: false,
        isSorting: false,
        selectionType: 'none',
        columns: ColDefs,
        rows: tableData,
        isHorizontalScroll: false,
        isVerticalScroll: true,
        isLazyLoading: false
    });

    return (
        <div className={styles.table}>
            <Table
                //@ts-ignore
                tableProps={tableProps}
                isDoubleRow={true}
                variant="innerTable"
            />
        </div>
    );
};

export default DetectedInstanceTable;
