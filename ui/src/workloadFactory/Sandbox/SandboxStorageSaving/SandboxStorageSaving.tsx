import styles from './SandboxStorageSaving.module.scss';

const SandboxStorageSaving = () => {
    return (
        <div className={styles.sandboxStorageSaving}>
            <div className={styles.progressBar}>
                <div
                    className={`${styles.progress} ${styles.leftCurveBar}`}
                    style={{
                        width: `${70}%`,
                        backgroundColor: 'var(--chart-4)'
                    }}
                ></div>
                <div className={styles.separator}></div>
                <div
                    className={`${styles.progress} ${styles.rightCurveBar}`}
                    style={{
                        width: `${30}%`,
                        backgroundColor: 'var(--chart-9)'
                    }}
                ></div>
            </div>
        </div>
    );
};

export default SandboxStorageSaving;
