import { STAGING } from '../../utils/consts';
import ExploreSavingHeader from './ExploreSavingHeader/ExploreSavingHeader';
import styles from './ExploreSavings.module.scss';
import ExploreSavingsTab from './ExploreSavingsTab/ExploreSavingsTab';

const ExploreSavings = () => (
    <div
        className={
            import.meta.env.VITE_APP_ENVIRONMENT !== STAGING
                ? `${styles.exploreSavings} ${styles.tempClass}`
                : styles.exploreSavings
        }
    >
        <ExploreSavingsTab />
        <ExploreSavingHeader />
    </div>
);

export default ExploreSavings;
