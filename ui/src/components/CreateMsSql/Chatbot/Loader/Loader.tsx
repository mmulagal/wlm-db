import styles from './Loader.module.scss';

const Loader = () => {
    return (
        <div className={styles['loader-container']}>
            <div className={styles['first-dot dot']}></div>
            <div className={styles['second-dot dot']}></div>
            <div className={styles['third-dot dot']}></div>
        </div>
    );
};

export default Loader;
