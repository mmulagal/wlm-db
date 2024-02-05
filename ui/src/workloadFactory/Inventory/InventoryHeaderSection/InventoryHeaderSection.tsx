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
                        Hosts distribution
                    </Typography>

                    <div className={styles.valueArea}>
                        <div className={styles.firstBlock}>
                            <SquareComponent value={'15'} color="var(--chart-4)" text={'Detected hosts'} />
                        </div>

                        <div className={styles.separator} />

                        <div className={styles.secondBlock}>
                            <SquareComponent value={'5'} color="var(--chart-2)" text={'Undetected hosts'} />
                        </div>
                    </div>
                </div>

                <div className={styles.secondPart}>
                    <Typography variant="Semibold_16" className={styles.heading}>
                        Detected host distribution
                    </Typography>

                    <div className={styles.valueArea}>
                        <div className={styles.thirdBlock}>
                            <SquareComponent value={'10'} color="var(--chart-9)" text={'Managed by Workload Factory'} />
                        </div>

                        <div className={styles.separator} />

                        <div className={styles.secondBlock}>
                            <SquareComponent value={'5'} color="#DE9EFF" text={'Unmanaged hosts'} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InventoryHeaderSection;
