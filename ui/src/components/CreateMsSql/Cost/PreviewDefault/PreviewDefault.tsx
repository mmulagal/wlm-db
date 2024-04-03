import {
    AccordionCard,
    AccordionCardContent,
    Button,
    DsTypography,
    TooltipInfo,
    Typography
} from '@netapp/design-system';
import { Table, useTable } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import styles from './PreviewDefault.module.scss';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import { GENERAL, SELECT_CONFIG } from '../../../../utils/appConstants';
import { ReactComponent as ActionRequiredIcon } from '../../../../assets/action-required.svg';
import { useDispatch } from 'react-redux';
import {
    setCloudWatch,
    setDBName,
    setDBVersion,
    setSelectConfig,
    setSelectedDBDeploymentModel,
    setSelectedDBEdition,
    setSelectedOperatingSystem,
    setSNSARN,
    setSNSState,
    setSqlServerCollation,
    setTags
} from '../../../../store/mssql/mssqlFormSlice';
import { useEffect } from 'react';
import { useAppSelector } from '../../../../store/storeHooks';
import { DEFAULT_MASTER_KEY, SQL_DEPLOYMENT_MODE } from '../../../../utils/consts';
import {
    selectDefaultCollation,
    selectDefaultEncryption,
    selectDefaultInstanceType,
    selectDefaultLicense,
    selectDefaultSecurityGroup,
    selectFsxIops,
    selectFsxKmsKey,
    selectFsxThroughput
} from '../../MSSqlServer/MSSqlUtils';
import { generateRandomDBName } from '../../../../utils/utilityFunctions';

const PreviewDefault = () => {
    const dispatch = useDispatch();

    const selectedConfig = useAppSelector(state => state.mssqlForm.selectConfig);
    const instanceValue = useAppSelector(state => state.mssqlForm.instanceType);
    const dbName = useAppSelector(state => state.mssqlForm.dbName);
    const sqlServerCollation = useAppSelector(state => state.mssqlForm.sqlServerCollation);
    const throughputValue = useAppSelector(state => state.mssqlForm.throughput);
    const iopsValue = useAppSelector(state => state.mssqlForm.provisionedIOPS.IOPSValue);
    const amiLicense = useAppSelector(state => state.mssqlForm.license.selectedLicenseId);
    const instanceTypeData = useAppSelector(state => state.mssql.getInstanceTypeList?.instanceTypeData);
    const kmsData = useAppSelector(state => state.mssql.getKmsList.kmsData);
    const amiData = useAppSelector(state => state.mssql.getAmiList.amiData);
    const collationList = useAppSelector(state => state.mssql.getCollationList.collationList);
    const selectedFsxnType = useAppSelector(state => state.mssqlForm.fsxN.fsxNType);
    const selectedExistingFsxnName = useAppSelector(state => state.mssqlForm.fsxN.fsxNExistingName);
    const encryptionType = useAppSelector(state => state.mssqlForm.encryption?.encryptionType);
    const encryptionArn = useAppSelector(state => state.mssqlForm.encryption?.encryptionArn);

    useEffect(() => {
        if (selectedConfig === SELECT_CONFIG.EASY_CREATE) {
            selectDefaultSecurityGroup(dispatch);
            dispatch(
                setSelectedOperatingSystem({
                    label: GENERAL.WIN_SERVER_2016,
                    value: GENERAL.WIN_SERVER_2016_VERSION
                })
            );
            dispatch(
                setSelectedDBDeploymentModel({
                    label: GENERAL.FAILOVER_CLUSTER,
                    value: SQL_DEPLOYMENT_MODE.FAILOVER_CLUSTER_VALUE
                })
            );
            dispatch(
                setSelectedDBEdition({
                    label: GENERAL.SQL_SERVER_STANDARD_EDITION,
                    value: GENERAL.SQL_SERVER_STANDARD
                })
            );
            dispatch(
                setDBVersion({
                    value: GENERAL.SQL_SERVER_2019_VERSION,
                    label: GENERAL.SQL_SERVER_2019
                })
            );
            selectDefaultLicense(amiData, dispatch);
            selectDefaultCollation(collationList, dispatch);
            dispatch(setDBName(generateRandomDBName()));
            selectDefaultInstanceType(instanceTypeData, dispatch);
            selectDefaultEncryption(kmsData, dispatch);
            dispatch(setTags([{ key: '', value: '' }]));
            dispatch(setSNSState(false));
            dispatch(setSNSARN(''));
            dispatch(setCloudWatch(true));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedConfig]);

    useEffect(() => {
        selectFsxThroughput(selectedFsxnType, selectedExistingFsxnName, '128 MBps', dispatch);
        selectFsxIops(selectedFsxnType, selectedExistingFsxnName, dispatch);
        selectFsxKmsKey(selectedFsxnType, selectedExistingFsxnName, dispatch);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedFsxnType, selectedExistingFsxnName]);

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
        { accordionName: GENERAL.LICENSE, defaultValue: amiLicense?.value, editable: GENERAL.NO, id: '6' },
        {
            accordionName: GENERAL.SQL_SERVER_COLLATION,
            defaultValue: sqlServerCollation?.label,
            editable: GENERAL.YES,
            id: '17'
        },
        { accordionName: GENERAL.DATABASE_NAME, defaultValue: dbName, editable: GENERAL.YES, id: '7' },
        {
            accordionName: GENERAL.INSTANCE_TYPE,
            defaultValue: instanceValue?.value,
            editable: GENERAL.NO,
            id: '9'
        },
        {
            accordionName: GENERAL.PROVISIONED_IOPS,
            defaultValue: iopsValue || GENERAL.AUTOMATIC,
            editable: GENERAL.YES,
            id: '10'
        },
        {
            accordionName: GENERAL.THROUGHPUT_CAPACITY,
            defaultValue: throughputValue?.value,
            editable: GENERAL.YES,
            id: '11'
        },
        {
            accordionName: GENERAL.ENCRYPTION,
            defaultValue:
                encryptionType === GENERAL.ENCRYPTION_SELECT_FROM_OTHER_ACCOUNT ? encryptionArn : DEFAULT_MASTER_KEY,
            editable: GENERAL.YES,
            id: '12'
        },
        { accordionName: GENERAL.TAGS, defaultValue: '0 tags', editable: GENERAL.YES, id: '13' },
        {
            accordionName: GENERAL.SIMPLE_NOTIFICATION_SERVICE,
            defaultValue: GENERAL.PD_DISABLED,
            editable: 'N/A',
            id: '14'
        },
        { accordionName: GENERAL.CLOUD_WATCH_MONITORING, defaultValue: GENERAL.ENABLED, editable: 'N/A', id: '15' },
        { accordionName: 'Resource rollback', defaultValue: GENERAL.PD_DISABLED, editable: 'No', id: '16' }
    ];

    const PreviewDefaultColDefs: ColumnProps[] = [
        {
            Header: GENERAL.CONFIGURATION,
            accessor: 'accordionName',
            id: '1',
            isSortable: false,

            width: '231px',
            renderCell: (cellData: any, rowData: any) => {
                return cellData === 'Resource rollback' ? (
                    <div className={styles.resourceContainer}>
                        <DsTypography variant="Regular_14">{cellData}</DsTypography>
                        <TooltipInfo>{GENERAL.RESOURCE_ROLLBACK_TOOLTIP}</TooltipInfo>
                    </div>
                ) : (
                    <DsTypography variant="Regular_14">{cellData}</DsTypography>
                );
            }
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
        setTimeout(() => {
            document.querySelector('#easy-create')?.scrollIntoView({
                behavior: 'smooth',
                block: 'end',
                inline: 'nearest'
            });
        }, 500);
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
                                    {SELECT_CONFIG.ADVANCED_CREATE}
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
