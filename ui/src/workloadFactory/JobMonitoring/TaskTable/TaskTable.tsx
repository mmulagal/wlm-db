import styles from './TaskTable.module.scss';
import { ReactComponent as InProgress } from '../../../assets/In Progress.svg';
import { ReactComponent as Success } from '../../../assets/success.svg';
import { ReactComponent as ErrorIcon } from '../../../assets/error-icon.svg';
import { ReactComponent as Warning } from '../../../assets/warning.svg';
import { Button, Popover, Typography } from '@netapp/design-system';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { JOB_MONITORING_STATUS, JOB_MONITORING_TYPE, WLF_TABS } from '../../../utils/consts';
import { formatDateWithTime, jobMonitoringStatusMapping } from '../../../utils/utilityFunctions';
import { ReactComponent as NoDataIcon } from '../../../assets/ic_file.svg';
import { GENERAL } from '../../../utils/appConstants';
import { useDispatch } from 'react-redux';
import { setSelectedHeaderTab } from '../../../store/workloadFactory/inventoryV2Slice';
import { selectedTabSelection } from '../../../store/workloadFactory/databaseHomeSlice';
import {
    setCredIdFromJM,
    setGwDatabaseInstance,
    setGwDatabaseInstanceName,
    setGwDatabaseStorageType,
    setGwHostname,
    setGwResourceId,
    setLandingFrom,
    setRegionFromJM
} from '../../../store/workloadFactory/getWellOptimizeSlice';

const TaskTable = ({ taskList = [] }: any) => {
    const dispatch = useDispatch();
    const navigateToContinuosOptimization = (message: string, rowData: any) => {
        const splitMessage = message.split(';');

        // Extract the JSON part of the split message
        const jsonString = splitMessage[1];

        // Parse the JSON string into an object
        const jsonObject = JSON.parse(jsonString);

        // Extract the required properties
        const resourceId = jsonObject?.resourceId;
        const databaseInstanceId = jsonObject?.databaseInstanceId; // Assuming you want the first ID in the array
        const databaseInstanceName = jsonObject?.databaseInstanceName;
        const sqlServerDeploymentType = jsonObject?.sqlServerDeploymentType;
        const hostName = jsonObject?.hostName;

        dispatch(setSelectedHeaderTab(WLF_TABS.OPTIMIZE));
        dispatch(selectedTabSelection(WLF_TABS.OPTIMIZE));
        if (rowData?.type === JOB_MONITORING_TYPE.ASSESSMENT) {
            dispatch(setCredIdFromJM(rowData?.credentialsId));
            dispatch(setRegionFromJM(rowData?.region?.code));
        } else {
            dispatch(setCredIdFromJM(rowData?.credentialsId));
            dispatch(setRegionFromJM(rowData?.region?.code));
        }

        dispatch(setLandingFrom(WLF_TABS.JOB_MONITORING));

        dispatch(setGwHostname(hostName));

        dispatch(setGwResourceId(resourceId));
        dispatch(setGwDatabaseInstance(databaseInstanceId));
        dispatch(setGwDatabaseInstanceName(databaseInstanceName));
        dispatch(setGwDatabaseStorageType(sqlServerDeploymentType));
    };
    const taskDesc = (desc: string, rowData: any) => {
        if (desc.includes('databaseInstanceId') && desc.includes('resourceId')) {
            const splitMessage = desc.split(';');

            // Extract the first part of the split message
            let extractedMessage = splitMessage[0];

            // Remove the trailing period if it exists
            if (extractedMessage.endsWith('.')) {
                extractedMessage = extractedMessage.slice(0, -1);
            }
            return (
                <div className={styles.linkMessage} title={extractedMessage}>
                    <span className={styles.textSection}>{extractedMessage}</span>
                    &nbsp;
                    <span className={styles.linkSection}>
                        <Button
                            variant="link"
                            onClick={() => {
                                navigateToContinuosOptimization(desc, rowData);
                            }}
                        >
                            instance optimization dashboard
                        </Button>
                    </span>
                </div>
            );
        } else {
            return (
                <div className={CommonStyles.wrapTextIn2Line} title={desc}>
                    {desc}
                </div>
            );
        }
    };
    return (
        <div className={styles.taskTable}>
            {!taskList ||
                (taskList.length === 0 && (
                    <Typography variant="Regular_14" className={styles.emptyTable}>
                        <NoDataIcon />
                        <div>{GENERAL.NO_DATA}</div>
                    </Typography>
                ))}
            {taskList.map((task: any) => {
                return (
                    <div className={styles.taskRow}>
                        <Typography variant="Regular_14" className={styles.firstItem}>
                            <div
                                className={CommonStyles.wrapTextIn2Line}
                                style={{ display: 'block' }}
                                title={task.description}
                            >
                                {taskDesc(task.description, task)}
                            </div>
                        </Typography>
                        {/* <Typography variant="Regular_14" className={styles.secondItem}>
                            <div className={CommonStyles.wrapTextIn2Line} title={task.description}>{task.description}</div>
                        </Typography> */}
                        <div className={styles.thirdItem}>
                            <div className={styles.popOverClass}>
                                {task.status === JOB_MONITORING_STATUS.COMPLETED && <Success />}
                                {task.status === JOB_MONITORING_STATUS.FAILED && (
                                    <Popover
                                        popoverClass={CommonStyles['popover']}
                                        children={
                                            <Typography variant="Regular_14" style={{ wordBreak: 'break-word' }}>
                                                {task?.error}
                                            </Typography>
                                        }
                                        trigger="hover"
                                        delayHide={200}
                                        interactive={true}
                                        container={<ErrorIcon className={styles.statusIcon} />}
                                    />
                                )}
                                {task.status === JOB_MONITORING_STATUS.IN_PROGRESS && <InProgress />}
                                {task.status === JOB_MONITORING_STATUS.WARNING &&
                                    (task?.error ? (
                                        <Popover
                                            popoverClass={CommonStyles['popover']}
                                            children={
                                                <Typography variant="Regular_14" style={{ wordBreak: 'break-word' }}>
                                                    {task?.error}
                                                </Typography>
                                            }
                                            trigger="hover"
                                            delayHide={200}
                                            interactive={true}
                                            container={<Warning className={styles.statusIcon} />}
                                        />
                                    ) : (
                                        <Warning />
                                    ))}
                            </div>
                            <Typography variant="Regular_14" className={styles.statusColor}>
                                {jobMonitoringStatusMapping(task?.status)}
                            </Typography>
                        </div>
                        <Typography variant="Regular_14" className={styles.fourthItem}>
                            {task?.startTime ? formatDateWithTime(task?.startTime) : GENERAL.NOT_AVAILABLE}
                        </Typography>
                        <Typography variant="Regular_14" className={styles.fifthItem}>
                            {task?.endTime ? formatDateWithTime(task?.endTime) : GENERAL.NOT_AVAILABLE}
                        </Typography>
                    </div>
                );
            })}
        </div>
    );
};

export default TaskTable;
