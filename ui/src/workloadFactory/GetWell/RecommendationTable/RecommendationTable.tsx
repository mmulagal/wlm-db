import { DsButton, DsTypography, Popover, Table, useTable } from '@netapp/design-system';
import { useDialog } from '@netapp/design-system';
import styles from './RecommendationTable.module.scss';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { ReactComponent as NotActive } from '../../../assets/ic_not_active.svg';
import { ReactComponent as Active } from '../../../assets/success.svg';
import { ReactComponent as TooltipIcon } from '../../../assets/tooltipGrey.svg';
import { ReactComponent as DisabledTooltipIcon } from '../../../assets/tooltipDisabled.svg';
import Tag from '../../../common/Tag/Tag';
import RecommendationTooltip from '../RecommendationTooltip/RecommendationTooltip';
import DialogComponent from '../../../common/Dialog/DialogComponent';
import DialogContent from '../StorageCardComponent/DialogContent/DialogContent';
import { GENERAL } from '../../../utils/appConstants';

const RecommendationTable = ({ tableData, isLoading, optimizePrintState }: any) => {
    const { setDialog, closeDialog } = useDialog();
    const handleOntapDialog = (rowData: any) => {
        setDialog(
            <DialogComponent
                header={`${rowData?.name} optimization`}
                content={<DialogContent type={rowData?.name} />}
                primaryButton={GENERAL.CONTINUE}
                secondaryButton={GENERAL.CANCEL}
                callback={() => {}}
                closeCallback={() => {
                    closeDialog();
                }}
                customClass={styles.colorSet}
                hidePrimaryButton={
                    rowData?.name === 'Multipath I/O Status' ||
                    rowData?.name === 'Multipath I/O Policy' ||
                    rowData?.name === 'NTFS allocation unit size'
                }
            />
        );
    };
    const ColDefs: ColumnProps[] = [
        {
            id: '1',
            Header: 'Configuration',
            accessor: 'name',
            width: '18%',
            isSortable: true
        },
        {
            id: '3',
            Header: 'Status',
            accessor: 'status',
            width: '14%',
            isSortable: true,
            renderCell: (cellData: any, rowData: any) => {
                return (
                    <div className={styles.statusCol}>
                        <div>
                            {cellData === 'Optimized' && <Active className={styles.statusIcon} />}
                            {cellData === 'Not optimized' && <NotActive className={styles.statusIcon} />}
                        </div>
                        <div>{cellData}</div>
                    </div>
                );
            }
        },
        {
            id: '4',
            Header: 'Severity',
            accessor: 'severity',
            width: '14%',
            isSortable: true
        },
        {
            id: '5',
            Header: 'Tags',
            accessor: 'tags',
            width: '14%',
            isSortable: true,
            renderCell: (cellData: any, rowData: any) => {
                return (
                    <>
                        <div className={styles.tooltipContainer}>
                            {cellData?.length > 0 && (
                                <div className={styles.tooltip}>
                                    <Popover
                                        popoverClass={''}
                                        children={
                                            <div className={styles.tags}>
                                                {cellData?.map((perTag: string) => {
                                                    return <Tag text={perTag} />;
                                                })}
                                            </div>
                                        }
                                        trigger="hover"
                                        delayHide={200}
                                        interactive={true}
                                        isAppendedToBody={false}
                                        container={<TooltipIcon />}
                                    />
                                </div>
                            )}
                            {cellData?.length === 0 && (
                                <div>
                                    <DisabledTooltipIcon />
                                </div>
                            )}

                            <DsTypography variant="Regular_13" className={`${styles.colText}`}>
                                {'Tags (' + cellData.length + ')'}
                            </DsTypography>
                        </div>
                    </>
                );
            }
        },
        {
            id: '6',
            Header: '',
            accessor: 'recommendation',
            width: '40%',
            renderCell: (cellData: any, rowData: any) => {
                return (
                    <>
                        <div className={styles.recommendation}>
                            <div className={styles.tooltipContainer}>
                                <div className={styles.tooltip}>
                                    <Popover
                                        popoverClass={''}
                                        children={cellData && <RecommendationTooltip data={cellData} />}
                                        trigger="hover"
                                        delayHide={200}
                                        interactive={true}
                                        isAppendedToBody={false}
                                        container={<TooltipIcon />}
                                        placement="bottom"
                                    />
                                </div>
                                <DsTypography variant="Regular_13" className={`${styles.colText}`}>
                                    {'View recommendations'}
                                </DsTypography>
                            </div>
                            {!optimizePrintState && (
                                <div>
                                    <DsButton
                                        variant="secondary"
                                        onClick={() => handleOntapDialog(rowData)}
                                        isDisabled={rowData?.status === 'Not optimized' ? false : true}
                                    >
                                        Optimize
                                    </DsButton>
                                </div>
                            )}
                        </div>
                    </>
                );
            }
        }
    ];

    const tableProps = useTable({
        isSorting: false,
        columns: ColDefs,
        rows: tableData,
        selectionType: 'none',
        isHorizontalScroll: true,
        isLazyLoading: isLoading
    });

    return (
        <div className={styles.recommendationTable}>
            {/* <div className={styles.table}> */}
            <Table
                //@ts-ignore
                tableProps={tableProps}
                isDoubleRow={true}
                // variant="innerTable"
            />
            {/* </div> */}
        </div>
    );
};

export default RecommendationTable;
