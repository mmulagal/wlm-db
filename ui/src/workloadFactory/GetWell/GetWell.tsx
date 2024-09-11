import styles from './GetWell.module.scss';
import OptimizeComponent from './OptimizeComponent/OptimizeComponent';
import StorageCardComponent from './StorageCardComponent/StorageCardComponent';

const GetWell = () => {
    return (
        <div className={styles.getWell}>
            <OptimizeComponent />
            <StorageCardComponent />
        </div>
    );
};

export default GetWell;
