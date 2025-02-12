import { DsButton, DsTable } from '@netapp/design-system';
import { ReactComponent as ContextMenuIcon } from '@netapp/icons/ic_table_action.svg';
import styles from './HostsTable.module.scss';
import { GENERAL } from '../../../../utils/appConstants';

const HostsTable = () => {
    const data = [
        {
            cells: {
                snapshotUsedSize: {
                    value: 'Snapshot Used Size 145'
                },
                svmName: {
                    value: 'SVM 37'
                },
                volumeName: {
                    value: 'volume 122'
                },
                volumeSize: {
                    value: 'Volume size 51'
                }
            },
            id: '0'
        },
        {
            cells: {
                snapshotUsedSize: {
                    value: 'Snapshot Used Size 67'
                },
                svmName: {
                    value: 'SVM 81'
                },
                volumeName: {
                    value: 'volume 26'
                },
                volumeSize: {
                    value: 'Volume size 23'
                }
            },
            id: '1',
            isDisabled: true
        },
        {
            cells: {
                snapshotUsedSize: {
                    value: 'Snapshot Used Size 106'
                },
                svmName: {
                    value: 'SVM 81'
                },
                volumeName: {
                    value: 'volume 97'
                },
                volumeSize: {
                    value: 'Volume size 130'
                }
            },
            id: '2'
        },
        {
            cells: {
                snapshotUsedSize: {
                    value: 'Snapshot Used Size 15'
                },
                svmName: {
                    value: 'SVM 117'
                },
                volumeName: {
                    value: 'volume 3'
                },
                volumeSize: {
                    value: 'Volume size 119'
                }
            },
            id: '3'
        },
        {
            cells: {
                snapshotUsedSize: {
                    value: 'Snapshot Used Size 6'
                },
                svmName: {
                    value: 'SVM 78'
                },
                volumeName: {
                    value: 'volume 81'
                },
                volumeSize: {
                    value: 'Volume size 112'
                }
            },
            id: '4'
        },
        {
            cells: {
                snapshotUsedSize: {
                    value: 'Snapshot Used Size 74'
                },
                svmName: {
                    value: 'SVM 50'
                },
                volumeName: {
                    value: 'volume 74'
                },
                volumeSize: {
                    value: 'Volume size 150'
                }
            },
            id: '5'
        },
        {
            cells: {
                snapshotUsedSize: {
                    value: 'Snapshot Used Size 33'
                },
                svmName: {
                    value: 'SVM 91'
                },
                volumeName: {
                    value: 'volume 68'
                },
                volumeSize: {
                    value: 'Volume size 64'
                }
            },
            id: '6'
        },
        {
            cells: {
                snapshotUsedSize: {
                    value: 'Snapshot Used Size 27'
                },
                svmName: {
                    value: 'SVM 76'
                },
                volumeName: {
                    value: 'volume 90'
                },
                volumeSize: {
                    value: 'Volume size 135'
                }
            },
            id: '7'
        },
        {
            cells: {
                snapshotUsedSize: {
                    value: 'Snapshot Used Size 6'
                },
                svmName: {
                    value: 'SVM 136'
                },
                volumeName: {
                    value: 'volume 38'
                },
                volumeSize: {
                    value: 'Volume size 37'
                }
            },
            id: '8'
        },
        {
            cells: {
                snapshotUsedSize: {
                    value: 'Snapshot Used Size 33'
                },
                svmName: {
                    value: 'SVM 70'
                },
                volumeName: {
                    value: 'volume 43'
                },
                volumeSize: {
                    value: 'Volume size 79'
                }
            },
            id: '9'
        }
    ];
    const tableColumns: any = [
        {
            id: 'nameForSorting',
            value: 'Host name'
        },
        {
            id: 'hostType',
            isFilterable: true,
            value: 'Host type'
        },
        {
            id: 'totalInstance',
            value: 'Managed instances'
        },
        {
            id: 'serverInstallationMode',
            isFilterable: true,
            value: 'Deployment model'
        },
        {
            id: 'instanceListText',
            value: 'Attached EC2 nodes'
        },
        {
            id: 'vpcName',
            value: 'VPC'
        },
        {
            id: 'ssmState',
            value: 'SSM connectivity'
        },
        {
            id: 'totalCost',
            value: GENERAL.DB_HOST_ESTIMATED_COST
        },
        {
            id: 'credentialName',
            value: 'AWS credentials'
        },
        {
            id: 'accountId',
            value: 'AWS account'
        },
        {
            id: 'regionName',
            value: 'Region'
        },
        {
            formatCells(_, row: any) {
                return (
                    <div style={{ display: 'flex', width: '100%', justifyContent: 'center' }}>
                        <DsButton
                            type="icon"
                            icon={<ContextMenuIcon />}
                            isDisabled={row.isDisabled && row.isSelectable !== true}
                            dropDown={{
                                trigger: 'click',
                                placement: 'alignRight',
                                items: [
                                    {
                                        id: 1,
                                        label: 'menu item1'
                                    },
                                    {
                                        id: 2,
                                        label: 'menu item2'
                                    }
                                ]
                            }}
                            style={{ paddingRight: '10px' }}
                        />
                    </div>
                );
            },
            id: 'actions',
            variant: 'Action',
            width: {
                unit: 'px',
                value: 56
            }
        }
    ];
    return (
        <div className={styles.hostsTable}>
            <DsTable
                isManagedColumns={true}
                actions={[]}
                columns={tableColumns}
                data={data}
                title="Hosts"
            />
        </div>
    );
};

export default HostsTable;
