import { Typography } from '@netapp/design-system';
import styles from './Transactions.module.scss';
import LineChart from '../../../DatabaseHomePage/LineChart/LineChart';

const Transactions = () => {
    return (
        <div className={styles.transactions}>
            <div className={styles.topSection}>
                <Typography variant="Semibold_14">Transactions</Typography>
            </div>

            <div className={styles.bottomSection}>
                <LineChart startColor="#A815F3" endColor="rgba(168, 21, 243, 0.00)" />
            </div>
        </div>
    );
};

export default Transactions;
