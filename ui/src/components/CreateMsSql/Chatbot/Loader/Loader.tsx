import styles from './Loader.module.scss';

const Loader = () => {
    return (
        <div className={styles['loader-container']}>
            <div className={`${styles['first-dot']} ${styles['dot']}`}></div>
            <div className={`${styles['second-dot']} ${styles['dot']}`}></div>
            <div className={`${styles['third-dot']} ${styles['dot']}`}></div>
        </div>
    );
};

export default Loader;
