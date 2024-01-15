import { Button } from '@netapp/design-system';
import styles from './ActionCard.module.scss';

const ActionCard = ({ image, buttonName }: any) => {
    return (
        <div className={styles.cardContainer}>
            <div className={styles.imageContainer}>{image}</div>
            <div className={styles.buttonContainer}>
                <Button onClick={function noRefCheck() {}} variant="secondary" id={`${buttonName}-btn`}>
                    {buttonName}
                </Button>
            </div>
        </div>
    );
};

export default ActionCard;
