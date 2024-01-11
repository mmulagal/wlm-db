import styles from './TaskTable.module.scss';
import { ReactComponent as InProgress } from '../../../assets/In Progress.svg';
import { ReactComponent as Success } from '../../../assets/success.svg';
import { ReactComponent as ErrorIcon } from '../../../assets/error-icon.svg';
import { Popover, Typography } from '@netapp/design-system';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import { JOB_MONITORING_STATUS } from '../../../utils/consts';
import { formatDateWithTime, jobMonitoringStatusMapping } from '../../../utils/utilityFunctions';

const TaskTable = ({ taskList }: any) => {
    
    return (
        <div className={styles.taskTable}>
            {taskList.map((task: any) => {
                return (
                    <div className={styles.taskRow}>
                        <Typography variant="Regular_14" className={styles.firstItem}>
                            {task.name}
                        </Typography>
                        <Typography variant="Regular_14" className={styles.secondItem}>
                            {task.description}
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
