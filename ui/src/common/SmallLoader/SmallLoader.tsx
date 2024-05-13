import styles from './SmallLoader.module.scss';

const SmallLoader = () => (
    <div className={styles.smallLoader} id="small-loader">
        <svg
            xmlns="http://www.w3.org/2000/svg"
            className={styles['circular-loader']}
            viewBox="0 0 50 50"
            overflow="visible"
        >
            <circle
                className={styles['primary-stroke']}
                cx="25"
                cy="25"
                r="20"
                fill="none"
                stroke="#70c542"
                strokeWidth="5"
            />
        </svg>
    </div>
);

export default SmallLoader;
