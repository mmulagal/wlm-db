import {
    Table,
    useTable,
    Typography,
    TableTopBar,
    DsTypography,
    Popover,
    DsSpinner,
    TooltipInfo
} from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import styles from './ExploreSavingsOnPremiseTable.module.scss';
import { GENERAL } from '../../../utils/appConstants';
import { useDispatch } from 'react-redux';
import { useAppSelector } from '../../../store/storeHooks';
import { onClickESHostOnPrem } from '../ExploreSavingsUtils';
import { useEffect, useRef, useState } from 'react';
import { getFilterOptions, getTruncatedItems } from '../../../utils/utilityFunctions';
import { ReactComponent as Download } from '../../../assets/download.svg';
import tcoScript from '../../../script/OnPremTCOCollector1.ps1?raw';

import FileUpload from './FileUpload';
import {
    useGetUploadScriptMutation,
    useGetOnPremSavingsMutation,
    useLazyGetSubTaskListQuery
} from '../../../utils/apiService';
//@ts-ignore
import pako from 'pako';
import { addNotification, NOTIFICATION_TYPES } from '../../../store/notificationSlice';
import { isSet } from 'lodash';
import { JOB_MONITORING_STATUS } from '../../../utils/consts';
import { setOnPremiseData } from '../../../store/workloadFactory/exploreSavingsSlice';

const ExploreSavingsOnPremiseTable = () => {
    const dispatch = useDispatch();

    const [tableData, setTableData] = useState<any>([]);
    const [isUploadLoading, setIsUploadLoading] = useState(false);
    const { onPremiseData } = useAppSelector(state => state.exploreSavings);
    const [getUploadScript] = useGetUploadScriptMutation();
    const [getOnPremSavings] = useGetOnPremSavingsMutation();
    const [setLoading, isSetLoading] = useState(false);
    const [getJobDetailApi] = useLazyGetSubTaskListQuery();
    const isUploadRef = useRef(false);

    const { isWorkloadFactory } = useAppSelector(state => state.auth);

    const getData = async () => {
        if (onPremiseData && isUploadRef.current === false) return;
        try {
            isSetLoading(true);
            const apiResult = await getOnPremSavings({});
            let result: any = [];
            apiResult?.data?.items?.map((perRow: any) => {
                const rowData = {
                    ...perRow,
                    onPremNode: perRow?.onPremisesNode[0],
                    totalInstance: perRow?.sqlServerInstances?.length,
                    nameForSorting: perRow?.databaseHostName?.toLowerCase()
                };
                result.push(rowData);
            });

            setTableData(result);
            dispatch(setOnPremiseData(result));
            isSetLoading(false);
            setIsUploadLoading(false);
            isUploadRef.current = false;
        } catch {
            console.error('Error fetching data');
            isSetLoading(false);
        }
    };

    useEffect(() => {
        if (!onPremiseData) {
            getData();
        } else {
            setTableData(onPremiseData);
        }
    }, []);

    const handleFileChange = (event: any) => {
        const selectedFile = event.target.files[0];
        if (!selectedFile) return;
        // Validate the file type (ensure it's JSON)
        if (selectedFile.type !== 'application/json' && !selectedFile.name.endsWith('.json')) {
            dispatch(
                addNotification({
                    notificationType: NOTIFICATION_TYPES.ERROR,
                    message: 'Invalid file type. Please upload a JSON file.'
                })
            );
            return;
        }
        setTableData([]); //This code needs to be removed
        setIsUploadLoading(true);

        if (selectedFile) {
            const reader = new FileReader();

            reader.onload = async e => {
                try {
                    // Parse the JSON data
                    const jsonString = e.target?.result as string;
                    const base64Encoded = btoa(jsonString);
                    const compressedData = pako.deflate(base64Encoded);
                    const compressedBase64 = btoa(String.fromCharCode(...compressedData));

                    // Access the data inside the JSON
                    if (compressedBase64) {
                        const result = await getUploadScript({ payload: compressedBase64 });
                        const jobInterval = setInterval(() => {
                            getJobDetailApi(result.data.jobId).then((jobRes: any) => {
                                const status = jobRes?.data?.status;

                                if (status === JOB_MONITORING_STATUS.COMPLETED) {
                                    isUploadRef.current = true;

                                    getData();

                                    clearInterval(jobInterval);
                                } else if (status === JOB_MONITORING_STATUS.FAILED) {
                                    setIsUploadLoading(false);
                                    clearInterval(jobInterval);
                                }
                            });
                        }, 5000);
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
                const name = rowData?.databaseHostName;
                return (
                    <div>
                        <Typography variant="Semibold_14">{name || GENERAL.NOT_AVAILABLE}</Typography>
                    </div>
                );
            }
        },
        {
            Header: GENERAL.DB_HOST_DEPLOYMENT_MODEL,
            accessor: 'deploymentModel',
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
                const instanceNames = rowData?.sqlServerInstances;
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
            accessor: 'onPremNode',
            id: '5',
            width: '347px',
            isSortable: true,
            accessorForTextFilter: 'onPremNode',
            renderCell: (cellData: any, rowData: any) => {
                return 'xxx';
            }
        },

        lastColDetails()
    ];

    const lazyLoadComponent = () => {
        return (
            <>
                {isUploadLoading && (
                    <div className={styles.lazyLoadContainer}>
                        <DsSpinner />
                        <div className={styles.textArea}>
                            <DsTypography variant="Semibold_16">Uploading script</DsTypography>
                            <DsTypography variant="Regular_14">This process can take several minutes</DsTypography>
                        </div>
                    </div>
                )}
                {!isUploadLoading && (
                    <div className={styles.lazyLoadContainer}>
                        <DsSpinner />
                        <div className={styles.textArea}>
                            <DsTypography variant="Regular_14">Loading</DsTypography>
                        </div>
                    </div>
                )}
            </>
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
        isLazyLoading: setLoading || isUploadLoading
    });

    const tableComponentProps = {
        lazyLoadingText: lazyLoadComponent()
    };

    const handleDownload = async () => {
        // getDownloadFn([{ input: tcoScript, name: 'list-vms.ps1' }]);

        const fileProps = [{ input: tcoScript, name: 'tco-script.ps1' }];

        const files = fileProps.map(
            ({ name, input }) =>
                new File([input], name, {
                    type: 'text/plain'
                })
        );
        const { name } = files[0];
        const obj = files[0];

        const link = document.createElement('a');
        const url = URL.createObjectURL(obj);

        link.href = url;
        link.download = name;
        link.click();
        link.remove();

        window.URL.revokeObjectURL(url);
    };

    return (
        <div className={styles['on-premise-table']}>
            <TableTopBar
                //@ts-ignore
                tableProps={tableProps}
                pluralTitle={`Microsoft SQL Server hosts on-premises`}
                singularTitle={`Microsoft SQL Server host on-premises`}
                subTitle="The table contains the latest script results uploaded."
                actionsRight={
                    <div className={styles.actions}>
                        <FileUpload handleFileChange={handleFileChange} />
                        <div className={styles.commonAction}>
                            <Download />
                            <DsTypography onClick={handleDownload} variant="Semibold_14" className={styles.text}>
                                Download script
                            </DsTypography>
                            <TooltipInfo placement="bottom" isAppendedToBody={true}>
                                {GENERAL.ONPREM_TOOLTIP}
                            </TooltipInfo>
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
