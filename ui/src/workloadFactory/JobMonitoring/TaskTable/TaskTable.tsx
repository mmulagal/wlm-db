import styles from './TaskTable.module.scss';

const TaskTable = () => {

    const taskList: any[] = [
        {
            name: 'Task 1',
            description: 'Microsoft SQL server deployed with stack <stack-name>. Microsoft SQL server deployed with stack <stack-name>',
            status: 'Completed',
            startTime: 'December 20, 2023, 10:25:45',
            endTime: 'December 20, 2023, 12:25:45'
        },
        {
            name: 'Task 2',
            description: 'Microsoft SQL server deployed with stack <stack-name>. Microsoft SQL server deployed with stack <stack-name>',
            status: 'Completed',
            startTime: 'December 20, 2023, 10:25:45',
            endTime: 'December 20, 2023, 12:25:45'
        },
        {
            name: 'Task 3',
            description: 'Microsoft SQL server deployed with stack <stack-name>. Microsoft SQL server deployed with stack <stack-name>',
            status: 'Failed',
            startTime: 'December 20, 2023, 10:25:45',
            endTime: 'December 20, 2023, 12:25:45'
        },
        {
            name: 'Task 4',
            description: 'Microsoft SQL server deployed with stack <stack-name>. Microsoft SQL server deployed with stack <stack-name>',
            status: 'Running',
            startTime: 'December 20, 2023, 10:25:45',
            endTime: 'December 20, 2023, 12:25:45'
        },
        {
            name: 'Task 5',
            description: 'Microsoft SQL server deployed with stack <stack-name>. Microsoft SQL server deployed with stack <stack-name>',
            status: 'Running',
            startTime: 'December 20, 2023, 10:25:45',
            endTime: 'December 20, 2023, 12:25:45'
        },
        {
            name: 'Task 6',
            description: 'Microsoft SQL server deployed with stack <stack-name>. Microsoft SQL server deployed with stack <stack-name>',
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
                        <div className={styles.firstItem}>{task.name}</div>
                        <div className={styles.secondItem}>{task.description}</div>
                        <div className={styles.thirdItem}>{task.status}</div>
                        <div className={styles.fourthItem}>{task.startTime}</div>
                        <div className={styles.fifthItem}>{task.endTime}</div>
                    </div>
                )
            })}
            
        </div>
    );
};

export default TaskTable;
