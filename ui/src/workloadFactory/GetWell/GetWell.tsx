import { DsAccordion } from '@netapp/design-system';
import styles from './GetWell.module.scss';
import OptimizeComponent from './OptimizeComponent/OptimizeComponent';
import StorageCardComponent from './StorageCardComponent/StorageCardComponent';

const GetWell = () => {
    return (
        <div className={styles.getWell}>
            <OptimizeComponent />
            <div className={styles.combineComponent}>
                <StorageCardComponent />
                <DsAccordion
                    id="1"
                    variant="Default"
                    title={<div className={styles.genericTag}>Performance efficiency</div>}
                    headerActions={[<div style={{ color: 'var(--text-button-primary)' }}>View recommendation</div>]}
                    children={<div>Content here</div>}
                />
            </div>
        </div>
    );
};

export default GetWell;
