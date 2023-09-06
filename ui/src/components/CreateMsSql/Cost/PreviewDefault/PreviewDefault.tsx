import { AccordionCard, AccordionCardContent, Typography } from '@netapp/design-system';
import { Table, useTable } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import styles from './PreviewDefault.module.scss';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import { GENERAL, SELECT_CONFIG } from '../../../../utils/appConstants';
import { ReactComponent as ActionRequiredIcon } from '../../../../assets/action-required.svg';

const PreviewDefault = () => {
    const data = [
        {
            accordionName: SELECT_CONFIG.SECURITY_GROUP,
            defaultValue: 'Create a security group for the user',
            editable: 'Yes',
            id: '1'
        },
        { accordionName: GENERAL.OPERATING_SYSTEM, defaultValue: 'Windows Server 2016', editable: 'No', id: '2' },
        {
            accordionName: GENERAL.DATABASE_DEPLOYMENT_MODEL,
            defaultValue: 'Failover Cluster Instances (FCI)',
            editable: 'No',
            id: '3'
        },
        {
            accordionName: GENERAL.DATABASE_EDITION,
            defaultValue: 'SQL Server Standard Edition',
            editable: 'No',
            id: '4'
        },
        {
            accordionName: GENERAL.DATABASE_VERSION,
            defaultValue: 'SQL Server 2019',
            editable: 'Yes (can be upgraded manually)',
            id: '5'
        },
        { accordionName: GENERAL.LICENSE, defaultValue: 'License included AMI', editable: 'No', id: '6' },
        { accordionName: GENERAL.DATABASE_NAME, defaultValue: 'sqldatabase1', editable: 'Yes', id: '7' },
        { accordionName: GENERAL.KEY_PAIR, defaultValue: 'First in the list', editable: 'Yes', id: '8' },
        {
            accordionName: GENERAL.INSTANCE_TYPE,
            defaultValue: 'Automaticlly create based on user selection',
            editable: 'No',
            id: '9'
        },
        { accordionName: GENERAL.PROVISIONED_IOPS, defaultValue: 'Automatic', editable: 'Yes', id: '10' },
        { accordionName: GENERAL.THROUGHPUT_CAPACITY, defaultValue: '128 MB/s', editable: 'Yes', id: '11' },
        { accordionName: GENERAL.ENCRYPTION, defaultValue: 'AWS/FSx', editable: 'Yes', id: '12' },
        { accordionName: GENERAL.TAGS, defaultValue: '0 tags', editable: 'Yes', id: '13' },
        { accordionName: GENERAL.SIMPLE_NOTIFICATION_SERVICE, defaultValue: 'Disabled', editable: '-', id: '14' },
        { accordionName: GENERAL.CLOUD_WATCH_MONITORING, defaultValue: 'Disabled', editable: '-', id: '15' }
    ];

    const PreviewDefaultColDefs: ColumnProps[] = [
        {
            Header: 'Configuration',
            accessor: 'accordionName',
            id: '1',
            isSortable: false,

            width: '231px'
        },
        {
            Header: 'Default',
            accessor: 'defaultValue',
            id: '2',
            width: '495px'
        },
        {
            Header: 'Editable after creation',
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
        return <Typography variant="Regular_14">View the default configuration created by the system</Typography>;
    };
    return (
        <div className={styles['preview-default']}>
            <AccordionCard
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="23"
                title={<div className={CommonStyles.title}>Preview default</div>}
            >
                <AccordionCardContent>
                    <Typography>
                        <div className={styles.note}>
                            <ActionRequiredIcon />
                            <Typography variant="Regular_14">
                                Easy create sets the following configurations to their default values, some of which can
                                be changed later. If you want to change any of these settings now, use Standard create.
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
