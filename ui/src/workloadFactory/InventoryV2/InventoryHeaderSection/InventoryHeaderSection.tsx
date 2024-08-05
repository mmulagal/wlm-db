import { Button } from '@netapp/design-system';

import styles from './InventoryHeaderSection.module.scss';
import { useNavigate } from 'react-router-dom';
import { WLF_TO_FORM_NAVIGATE } from '../../../utils/consts';
import { GENERAL } from '../../../utils/appConstants';
import NewInventoryHeaderSection from '../NewInventoryHeaderSection/NewInventoryHeaderSection';
import { useDispatch } from 'react-redux';
import { setDatabaseHostEntryPoint } from '../../../store/mssql/msSqlActionSlice';

const InventoryHeaderSection = () => {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    return (
        <div className={styles.inventoryHeader}>
            <NewInventoryHeaderSection />
        </div>
    );
};

export default InventoryHeaderSection;
