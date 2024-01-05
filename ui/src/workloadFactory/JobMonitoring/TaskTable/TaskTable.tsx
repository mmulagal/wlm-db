import styles from './TaskTable.module.scss';
import { ReactComponent as InProgress } from '../../../assets/In Progress.svg';
import { ReactComponent as Success } from '../../../assets/success.svg';
import { ReactComponent as ErrorIcon } from '../../../assets/error-icon.svg';
import { Popover, Typography } from '@netapp/design-system';
import CommonStyles from '../../../utils/CommonStyles.module.scss';

const TaskTable = () => {
    const taskList: any[] = [
        {
            name: 'Task 1',
            description:
                'Microsoft SQL server deployed with stack <stack-name>. Microsoft SQL server deployed with stack <stack-name>',
            status: 'Completed',
            startTime: 'December 20, 2023, 10:25:45',
            endTime: 'December 20, 2023, 12:25:45'
        },
        {
            name: 'Task 2',
            description:
                'Microsoft SQL server deployed with stack <stack-name>. Microsoft SQL server deployed with stack <stack-name>',
            status: 'Completed',
            startTime: 'December 20, 2023, 10:25:45',
            endTime: 'December 20, 2023, 12:25:45'
        },
        {
            name: 'Task 3',
            description:
                'Microsoft SQL server deployed with stack <stack-name>. Microsoft SQL server deployed with stack <stack-name>',
            status: 'Failed',
            startTime: 'December 20, 2023, 10:25:45',
            endTime: 'December 20, 2023, 12:25:45',
            errorMsg: 'Embedded stack arn:aws:cloudformation:ap-southeast-1:464262061435:stack/WLMDB-SqlFciStack-1704443882020-ValidationStack1-1DM7D6502JCM8/d389a1b0-aba5-11ee-9f10-067d5fa9eb92 was not successfully created: The following resource(s) failed to create: [ValidationNode1].'
        },
        {
            name: 'Task 4',
            description:
                'Microsoft SQL server deployed with stack <stack-name>. Microsoft SQL server deployed with stack <stack-name>',
            status: 'Running',
            startTime: 'December 20, 2023, 10:25:45',
            endTime: 'December 20, 2023, 12:25:45'
        },
        {
            name: 'Task 5',
            description:
                'Microsoft SQL server deployed with stack <stack-name>. Microsoft SQL server deployed with stack <stack-name>',
            status: 'Running',
            startTime: 'December 20, 2023, 10:25:45',
            endTime: 'December 20, 2023, 12:25:45'
        },
        {
            name: 'Task 6',
            description:
                'Microsoft SQL server deployed with stack <stack-name>. Microsoft SQL server deployed with stack <stack-name>',
            status: 'Completed',
            startTime: 'December 20, 2023, 10:25:45',
            endTime: 'December 20, 2023, 12:25:45'
        }
    ];

    return (
        <div className={styles.taskTable}>
            {taskList.map(task => {
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
                                {task.status === 'Completed' && <Success />}
                                {task.status === 'Failed' && 
                                    <Popover
                                        popoverClass={CommonStyles['popover']}
                                        children={<Typography variant="Regular_14">{task?.errorMsg}</Typography>}
                                        trigger="hover"
                                        container={
                                            <ErrorIcon className={styles.statusIcon}/>
                                        }
                                    />
                                }
                                {task.status === 'Running' && <InProgress />}
                            </div>
                            <Typography variant="Regular_14">{task.status}</Typography>
                        </div>
                        <Typography variant="Regular_14" className={styles.fourthItem}>
                            {task.startTime}
                        </Typography>
                        <Typography variant="Regular_14" className={styles.fifthItem}>
                            {task.endTime}
                        </Typography>
                    </div>
                );
            })}
        </div>
    );
};

export default TaskTable;
