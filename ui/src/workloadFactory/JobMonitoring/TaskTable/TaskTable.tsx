import styles from './TaskTable.module.scss';
import { ReactComponent as InProgress } from '../../../assets/In Progress.svg';
import { ReactComponent as Success } from '../../../assets/success.svg';
import { ReactComponent as ErrorIcon } from '../../../assets/error-icon.svg';
import { Popover, Typography } from '@netapp/design-system';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { JOB_MONITORING_STATUS } from '../../../utils/consts';
import { formatDateWithTime, jobMonitoringStatusMapping } from '../../../utils/utilityFunctions';
import { ReactComponent as NoDataIcon } from '../../../assets/ic_file.svg';
import { GENERAL } from '../../../utils/appConstants';

const TaskTable = ({ taskList = [] }: any) => {
    
    return (
        <div className={styles.taskTable}>
            {!taskList || taskList.length === 0 && 
                <Typography variant="Regular_14" className={styles.emptyTable}>
                    <NoDataIcon />
                    <div>{GENERAL.NO_DATA}</div>
                </Typography>
            }
            {taskList.map((task: any) => {
                return (
                    <div className={styles.taskRow}>
                        <Typography variant="Regular_14" className={styles.firstItem}>
                            <div className={styles.firstItemText} title={task.name}>{task.name}</div>
                        </Typography>
                        <Typography variant="Regular_14" className={styles.secondItem}>
                            <div className={CommonStyles.wrapTextIn2Line} title={task.description}>{task.description}</div>
                        </Typography>
                        <div className={styles.thirdItem}>
                            <div>
                                {task.status === JOB_MONITORING_STATUS.COMPLETED && <Success />}
                                {task.status === JOB_MONITORING_STATUS.FAILED && 
                                    <Popover
                                        popoverClass={CommonStyles['popover']}
                                        children={<Typography variant="Regular_14">{task?.error}</Typography>}
                                        trigger="hover"
                                        container={
                                            <ErrorIcon className={styles.statusIcon}/>
                                        }
                                    />
                                }
                                {task.status === JOB_MONITORING_STATUS.IN_PROGRESS && <InProgress />}
                            </div>
                            <Typography variant="Regular_14">{jobMonitoringStatusMapping(task?.status)}</Typography>
                        </div>
                        <Typography variant="Regular_14" className={styles.fourthItem}>
                            {formatDateWithTime(task.startTime)}
                        </Typography>
                        <Typography variant="Regular_14" className={styles.fifthItem}>
                            {formatDateWithTime(task.endTime)}
                        </Typography>
                    </div>
                );
            })}
        </div>
    );
};

export default TaskTable;
