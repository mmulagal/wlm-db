import { Typography } from '@netapp/design-system';
import { GENERAL } from '../../../utils/appConstants';
import { ReactComponent as Deploy } from '../../../assets/Deploy.svg';
import { ReactComponent as Migrate } from '../../../assets/Migrate.svg';
import { ReactComponent as Clone } from '../../../assets/Clone.svg';
import { ReactComponent as Protect } from '../../../assets/Protect.svg';
import styles from './DatabaseActions.module.scss';
import ActionCard from './ActionCard/ActionCard';

const DatabaseActions = () => {
    return (
        <div className={styles.databaseAction}>
            <Typography variant="Semibold_14">{GENERAL.ACTIONS}</Typography>
            <div className={styles.firstRow}>
                <ActionCard image={<Deploy />} buttonName={GENERAL.DEPLOY} />
                <ActionCard image={<Migrate />} buttonName={GENERAL.MIGRATE} />
            </div>

            <div className={styles.secondRow}>
                <ActionCard image={<Clone />} buttonName={GENERAL.CLONE} />
                <ActionCard image={<Protect />} buttonName={GENERAL.PROTECT} />
            </div>
        </div>
    );
};

export default DatabaseActions;
