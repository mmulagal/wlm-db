import { AccordionCard, AccordionCardContent, Button, Typography } from '@netapp/design-system';
import { Table, useTable } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import styles from './PreviewDefault.module.scss';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import { GENERAL, SELECT_CONFIG } from '../../../../utils/appConstants';
import { ReactComponent as ActionRequiredIcon } from '../../../../assets/action-required.svg';
import { useDispatch } from 'react-redux';
import { setSelectConfig, setThroughputValue } from '../../../../store/mssql/mssqlFormSlice';
import { useEffect } from 'react';
import { useAppSelector } from '../../../../store/storeHooks';
import { generateOptionType } from '../../../../utils/utilityFunctions';
import { DEFAULT_MASTER_KEY, SQL_DATABASE } from '../../../../utils/consts';

const PreviewDefault = () => {
    const dispatch = useDispatch();

    const selectedConfig = useAppSelector(state => state.mssqlForm.selectConfig);

    useEffect(() => {
        if(selectedConfig === SELECT_CONFIG.EASY_CREATE){
            const throughputVal = '128 MBps';
            const option = generateOptionType(throughputVal, throughputVal, '', false, '');
            dispatch(setThroughputValue(option));
        }
    }, [selectedConfig]);

    const data = [
        {
            accordionName: SELECT_CONFIG.SECURITY_GROUP,
            defaultValue: GENERAL.PD_CREATE_SECURITY,
            editable: GENERAL.YES,
            id: '1'
        },
        {
            accordionName: GENERAL.OPERATING_SYSTEM,
            defaultValue: GENERAL.WIN_SERVER_2016,
            editable: GENERAL.NO,
            id: '2'
        },
        {
            accordionName: GENERAL.DATABASE_DEPLOYMENT_MODEL,
            defaultValue: GENERAL.FAILOVER_CLUSTER,
            editable: GENERAL.NO,
            id: '3'
        },
        {
            accordionName: GENERAL.DATABASE_EDITION,
            defaultValue: GENERAL.SQL_SERVER_STANDARD_EDITION,
            editable: GENERAL.NO,
            id: '4'
        },
        {
            accordionName: GENERAL.DATABASE_VERSION,
            defaultValue: GENERAL.SQL_SERVER_2019,
            editable: GENERAL.PD_UPGRADED_MANUALLY,
            id: '5'
        },
        { accordionName: GENERAL.LICENSE, defaultValue: GENERAL.LICENSE_INCLUDED_AMI, editable: GENERAL.NO, id: '6' },
        { accordionName: GENERAL.DATABASE_NAME, defaultValue: SQL_DATABASE, editable: GENERAL.YES, id: '7' },
        { accordionName: GENERAL.KEY_PAIR, defaultValue: GENERAL.FIRST_IN_THE_LIST, editable: GENERAL.YES, id: '8' },
        {
            accordionName: GENERAL.INSTANCE_TYPE,
            defaultValue: GENERAL.PD_AUTO_CREATE,
            editable: GENERAL.NO,
            id: '9'
        },
        { accordionName: GENERAL.PROVISIONED_IOPS, defaultValue: GENERAL.AUTOMATIC, editable: GENERAL.YES, id: '10' },
        { accordionName: GENERAL.THROUGHPUT_CAPACITY, defaultValue: '128 MBps', editable: GENERAL.YES, id: '11' },
        { accordionName: GENERAL.ENCRYPTION, defaultValue: DEFAULT_MASTER_KEY, editable: GENERAL.YES, id: '12' },
        { accordionName: GENERAL.TAGS, defaultValue: '0 tags', editable: GENERAL.YES, id: '13' },
        {
            accordionName: GENERAL.SIMPLE_NOTIFICATION_SERVICE,
            defaultValue: GENERAL.PD_DISABLED,
            editable: '-',
            id: '14'
        },
        { accordionName: GENERAL.CLOUD_WATCH_MONITORING, defaultValue: GENERAL.PD_DISABLED, editable: '-', id: '15' }
    ];

    const PreviewDefaultColDefs: ColumnProps[] = [
        {
            Header: GENERAL.CONFIGURATION,
            accessor: 'accordionName',
            id: '1',
            isSortable: false,

            width: '231px'
        },
        {
            Header: GENERAL.DEFAULT,
            accessor: 'defaultValue',
            id: '2',
            width: '495px'
        },
        {
            Header: GENERAL.EDITABLE_AFTER,
            accessor: 'editable',
            id: '3',
            width: '257px'
        }
    ];

    const tableProps = useTable({
        //@ts-ignore
        selectAllProps: false,
        //@ts-ignore
        manageColumnsProps: false,
        isSorting: false,
        columns: PreviewDefaultColDefs,
        rows: data,
        pageSize: 50
    });
    const setHeader = () => {
        return <Typography variant="Regular_14">{GENERAL.PD_HEADER_TEXT}</Typography>;
    };

    const handleConfig = () => {
        dispatch(setSelectConfig(SELECT_CONFIG.STANDARD_CREATE));
    };
    return (
        <div className={styles['preview-default']}>
            <AccordionCard
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="23"
                title={<div className={CommonStyles.title}>{GENERAL.PREVIEW_DEFAULT}</div>}
            >
                <AccordionCardContent>
                    <Typography>
                        <div className={styles.note}>
                            <ActionRequiredIcon />
                            <Typography variant="Regular_14">
                                {GENERAL.PREVIEW_DEFAULT_TEXT}{' '}
                                <Button Component="button" onClick={handleConfig} variant="text">
                                    {SELECT_CONFIG.STANDARD_CREATE}
                                </Button>
                                .
                            </Typography>
                        </div>
                        <div className={styles.table}>
                            <Table
                                //@ts-ignore
                                tableProps={tableProps}
                                variant="innerTable"
                            />
                        </div>
                    </Typography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default PreviewDefault;
