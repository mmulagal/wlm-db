import styles from './ExploreSavings.module.scss';
import TotalMonthlyCost from './TotalMonthlyCost/TotalMonthlyCost';

const ExploreSavings = () => {
    return (
        <div className={styles.exploreSavings}>
            <TotalMonthlyCost />
        </div>
    );
};

export default ExploreSavings;
