import styles from './Loader.module.scss';

const Loader = () => (
    <div className={styles['loader-container']}>
        <div className={`${styles['first-dot']} ${styles.dot}`} />
        <div className={`${styles['second-dot']} ${styles.dot}`} />
        <div className={`${styles['third-dot']} ${styles.dot}`} />
    </div>
);

export default Loader;
