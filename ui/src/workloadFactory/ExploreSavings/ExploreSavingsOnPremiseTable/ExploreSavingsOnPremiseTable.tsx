import { Table, useTable, Typography, TableTopBar, DsTypography, Popover, DsSpinner } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import styles from './ExploreSavingsOnPremiseTable.module.scss';
import { GENERAL } from '../../../utils/appConstants';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../store/storeHooks';
import { onClickESHostOnPrem } from '../ExploreSavingsUtils';
import { useEffect, useState } from 'react';
import { getFilterOptions, getTruncatedItems } from '../../../utils/utilityFunctions';
import { ReactComponent as Download } from '../../../assets/download.svg';

import FileUpload from './FileUpload';
import { useGetUploadScriptMutation } from '../../../utils/apiService';
//@ts-ignore
import pako from 'pako';

const ExploreSavingsOnPremiseTable = () => {
    const dispatch = useDispatch();

    const isDiscoverInProgress = useAppSelector(state => state.inventoryV2.discoveredHosts.discoverHostLoading);
    const isManagedHostListLoading = useAppSelector(state => state.inventoryV2.isManagedHostListLoading);
    const unManagedHostFormatedList = useAppSelector(state => state.exploreSavings.unmanagedExploreSavingsHost);
    const [tableData, setTableData] = useState<any>([]);
    const [isUploadLoading, setIsUploadLoading] = useState(false);
    const [getUploadScript] = useGetUploadScriptMutation();

    const { isWorkloadFactory } = useAppSelector(state => state.auth);

    const handleFileChange = (event: any) => {
        const selectedFile = event.target.files[0];
        setTableData([]); //This code needs to be removed
        setIsUploadLoading(true);
        if (selectedFile) {
            const reader = new FileReader();

            reader.onload = async e => {
                try {
                    // Parse the JSON data
                    const jsonString = e.target?.result as string;
                    const base64Encoded = btoa(jsonString);
                    const compressedData = pako.deflate(base64Encoded, { to: 'string' });

                    // Access the data inside the JSON
                    if (compressedData) {
                        const result = await getUploadScript({ payload: compressedData });
                        setIsUploadLoading(false);
                        setTableData(unManagedHostFormatedList);
                        console.log(result);
                    } else {
                        console.log('No data found in the file.');
                    }
                } catch (error) {
                    console.error('Error parsing JSON:', error);
                }
            };

            reader.onerror = () => {
                console.error('File could not be read.');
            };

            reader.readAsText(selectedFile); // Read file as text
        }
    };

    useEffect(() => {
        if (unManagedHostFormatedList) {
            let result: any = [];
            unManagedHostFormatedList?.map((perRow: any) => {
                let instanceList: any = [];
                let instanceNameList: any = [];
                perRow?.ec2Details?.map((row: any) => {
                    if (row?.name) {
                        instanceNameList.push(row?.name);
                    }
                    if (row?.name && row?.id) {
                        instanceList.push(row?.name + ' | ID: ' + row?.id);
                    } else if (row?.id) {
                        instanceList.push(GENERAL.NOT_AVAILABLE + ' | ID: ' + row?.id);
                    }
                });
                const rowData = {
                    ...perRow,
                    instanceListText: instanceList.join(','),
                    instanceNameListText: instanceNameList.join(', '),
                    nameForSorting: perRow?.name?.toLowerCase()
                };
                result.push(rowData);
            });
            setTableData(result);
        } else {
            setTableData([]);
        }
    }, [unManagedHostFormatedList]);

    const lastColDetails = () => {
        return {
            id: '9',
            Header: '',
            accessor: '',
            isSticky: true,
            width: '225px',
            renderCell: (cellData: any, rowData: any) => {
                return (
                    <div
                        className={styles.detectManage}
                        onClick={() => {
                            onClickESHostOnPrem(dispatch, rowData, isWorkloadFactory);
                        }}
                        id="explore-savings-table-button"
                    >
                        <Typography variant="Regular_14" className={styles.textStyle}>
                            {GENERAL.ES_SAVINGS}
                        </Typography>
                    </div>
                );
            }
        };
    };

    const ExploreSavingsColDefs: ColumnProps[] = [
        {
            Header: GENERAL.DATABASE_HOST_NAME,
            accessor: 'nameForSorting',
            id: '1',
            isSortable: true,
            isSticky: true,
            width: '345px',
            renderCell: (cellData: any, rowData: any) => {
                const name = rowData?.name;
                return (
                    <div>
                        <Typography variant="Semibold_14">{name || GENERAL.NOT_AVAILABLE}</Typography>
                    </div>
                );
            }
        },
        {
            Header: GENERAL.DB_HOST_DEPLOYMENT_MODEL,
            accessor: 'serverInstallationMode',
            id: '2',
            width: '345px',
            filterOptions: getFilterOptions(tableData, 'serverInstallationMode'),
            renderCell: (cellData: string) => {
                return cellData || GENERAL.NOT_AVAILABLE;
            }
        },

        {
            Header: 'SQL server instances',
            accessor: 'totalInstance',
            id: '4',
            width: '345px',
            filterOptions: getFilterOptions(tableData, 'totalInstance'),
            renderCell: (cellData: string, rowData: any) => {
                const instanceData = rowData?.sqlServerInstances;
                const instanceNames = instanceData?.map((instance: any) => instance?.sqlServerInstance);
                const truncatedItems = getTruncatedItems(instanceNames);

                return (
                    <div>
                        {cellData && Number(cellData) !== 0 ? (
                            <div className={styles.container}>
                                <Typography
                                    title={truncatedItems?.maxItemsToShow.join(', ')}
                                    variant="Regular_14"
                                    className={styles.sqlServerInstance}
                                >
                                    {truncatedItems?.maxItemsToShow.join(', ')}
                                </Typography>
                                {truncatedItems?.remaining.length > 0 && (
                                    <>
                                        <Popover
                                            popoverClass={styles['popover']}
                                            children={truncatedItems?.remaining.map((item: any) => (
                                                <Typography variant="Regular_14">{item}</Typography>
                                            ))}
                                            trigger="hover"
                                            container={
                                                <Typography variant="Regular_14" className={styles.colorText}>
                                                    {`+ ${truncatedItems?.remaining.length}`}
                                                </Typography>
                                            }
                                        />
                                    </>
                                )}
                            </div>
                        ) : (
                            ''
                        )}
                        {!cellData ? GENERAL.NOT_AVAILABLE : ''}
                    </div>
                );
            }
        },
        {
            Header: 'OnPrem nodes',
            accessor: 'instanceListText',
            id: '5',
            width: '347px',
            isSortable: true,
            accessorForTextFilter: 'instanceListText',
            renderCell: (cellData: any, rowData: any) => {
                return 'xxx';
            }
        },

        lastColDetails()
    ];

    const lazyLoadComponent = () => {
        return (
            <div className={styles.lazyLoadContainer}>
                <DsSpinner />
                <div className={styles.textArea}>
                    <DsTypography variant="Semibold_16">Uploading script</DsTypography>
                    <DsTypography variant="Regular_14">This process can take several minutes</DsTypography>
                </div>
            </div>
        );
    };

    const tableProps = useTable({
        //@ts-ignore
        selectAllProps: false,
        //@ts-ignore
        manageColumnsProps: false,
        isHorizontalScroll: true,
        isSorting: false,
        columns: ExploreSavingsColDefs,
        rows: tableData || [],
        pageSize: 50,
        isLazyLoading: isDiscoverInProgress || isManagedHostListLoading || isUploadLoading
    });

    const tableComponentProps = {
        lazyLoadingText: lazyLoadComponent()
    };

    return (
        <div className={styles['on-premise-table']}>
            <TableTopBar
                //@ts-ignore
                tableProps={tableProps}
                pluralTitle={`MsSQL on On-Premises host`}
                singularTitle={`MsSQL on On-Premises hosts`}
                subTitle="The table contains the latest script results uploaded."
                actionsRight={
                    <div className={styles.actions}>
                        <FileUpload handleFileChange={handleFileChange} />
                        <div className={styles.commonAction}>
                            <Download />
                            <DsTypography variant="Semibold_14" className={styles.text}>
                                Download script
                            </DsTypography>
                        </div>
                    </div>
                }
            />
            <Table
                {...tableComponentProps}
                //@ts-ignore
                tableProps={tableProps}
                isDoubleRow={true}
            />
        </div>
    );
};

export default ExploreSavingsOnPremiseTable;
