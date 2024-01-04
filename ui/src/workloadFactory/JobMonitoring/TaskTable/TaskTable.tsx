import styles from './TaskTable.module.scss';

const TaskTable = () => {
    return (
        <div className={styles.taskTable}>
            <div className={styles.firstItem}>Task full Name</div>
            <div className={styles.secondItem}>Description</div>
            <div className={styles.thirdItem}>Completed</div>
            <div className={styles.fourthItem}>December 10</div>
            <div className={styles.fifthItem}>December 10</div>
        </div>
    );
};

export default TaskTable;
