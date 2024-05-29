import { Button } from '@netapp/design-system';

import styles from './InventoryHeaderSection.module.scss';
import { useNavigate } from 'react-router-dom';
import { WLF_TO_FORM_NAVIGATE } from '../../../utils/consts';
import { GENERAL } from '../../../utils/appConstants';
import NewInventoryHeaderSection from '../NewInventoryHeaderSection/NewInventoryHeaderSection';

const InventoryHeaderSection = () => {
    const navigate = useNavigate();
    return (
        <div className={styles.inventoryHeader}>
            {/* Top button area */}
            <div className={styles.buttonSection}>
                <div />
                <div>
                    <Button
                        variant="primary"
                        onClick={() => {
                            navigate(WLF_TO_FORM_NAVIGATE);
                        }}
                        id={'deploy-button'}
                    >
                        {GENERAL.DEPLOY_NEW_DATABASE}
                    </Button>
                </div>
            </div>

            <NewInventoryHeaderSection />
        </div>
    );
};

export default InventoryHeaderSection;
