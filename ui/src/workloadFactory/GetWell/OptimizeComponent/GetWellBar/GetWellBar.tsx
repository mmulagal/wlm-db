import styles from './GetWellBar.module.scss';

const GetWellBar = () => {
    return (
        <div className={styles.getWellBar}>
            <div className={styles.progressBar}>
                <>
                    <div
                        className={`${styles.progress} ${styles.leftCurveBar}`}
                        style={{
                            width: `${100 - 50}%`,
                            backgroundColor: 'var(--chart-4)'
                        }}
                    ></div>
                    <div className={styles.separator}></div>
                    <div
                        className={`${styles.progress} ${styles.rightCurveBar}`}
                        style={{
                            width: `50%`,
                            backgroundColor: 'var(--chart-disabled)'
                        }}
                    ></div>
                </>
            </div>
        </div>
    );
};

export default GetWellBar;
