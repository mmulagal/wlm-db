import { Button, Typography } from '@netapp/design-system';

import styles from './InventoryHeaderSection.module.scss';
import { useNavigate } from 'react-router-dom';
import { WLF_TO_FORM_NAVIGATE } from '../../../utils/consts';
import { GENERAL } from '../../../utils/appConstants';
import InventoryChart from '../InventoryChart/InventoryChart';
import SquareComponent from '../../DatabaseHomePage/SquareComponent/SquareComponent';

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

            {/* chart area */}
            <div className={styles.chartSection}>
                <div className={styles.firstPart}>
                    <InventoryChart />
                </div>

                <div className={styles.secondPart}>
                    <Typography variant="Semibold_16" className={styles.heading}>
                        {GENERAL.DB_HOSTS_DISTRIBUTION}
                    </Typography>

                    <div className={styles.valueArea}>
                        <div className={styles.firstBlock}>
                            <SquareComponent value={'15'} color="var(--chart-4)" text={GENERAL.DETECTED_HOSTS} />
                        </div>

                        <div className={styles.separator} />

                        <div className={styles.secondBlock}>
                            <SquareComponent value={'5'} color="var(--chart-2)" text={GENERAL.UNDETECTED_HOSTS} />
                        </div>
                    </div>
                </div>

                <div className={styles.secondPart}>
                    <Typography variant="Semibold_16" className={styles.heading}>
                        {GENERAL.DETECTED_DB_HOSTS_DISTRIBUTION}
                    </Typography>

                    <div className={styles.valueArea}>
                        <div className={styles.thirdBlock}>
                            <SquareComponent value={'10'} color="var(--chart-9)" text={GENERAL.MANAGED_BY_WLF} />
                        </div>

                        <div className={styles.separator} />

                        <div className={styles.secondBlock}>
                            <SquareComponent value={'5'} color="#DE9EFF" text={GENERAL.UNMANAGED_HOSTS} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InventoryHeaderSection;
