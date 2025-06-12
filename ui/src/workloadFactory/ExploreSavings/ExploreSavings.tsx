import ExploreSavingHeader from './ExploreSavingHeader/ExploreSavingHeader';
import styles from './ExploreSavings.module.scss';
import ExploreSavingsTab from './ExploreSavingsTab/ExploreSavingsTab';

const ExploreSavings = () => (
    <div className={styles.exploreSavings}>
        <ExploreSavingsTab />
        <ExploreSavingHeader />
    </div>
);

export default ExploreSavings;
