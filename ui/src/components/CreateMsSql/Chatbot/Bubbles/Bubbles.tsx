import { Typography } from '@netapp/design-system';
import styles from './Bubbles.module.scss';

type BubblesPropsType = {
    bubbleList: Array<bubbleItemType>;
    onBubbleClick: (label?: string, value?: string) => void;
};

type bubbleItemType = {
    label?: string;
    value?: string;
};

const Bubbles = ({ bubbleList, onBubbleClick }: BubblesPropsType) => {
    return (
        <div className={styles['bubbles-container']}>
            {bubbleList.map((bubble: bubbleItemType) => {
                return (
                    <div
                        className={`${"chatbot-select-msg"} ${styles['bubble-item']}`}
                        onClick={() => onBubbleClick(bubble?.label, bubble?.value)}
                        id={bubble.value === 'deploy' ? 'chatbot-deploy-btn' : ''}
                    >
                        <Typography variant="Semibold_13" className={styles['bubble-label']}>
                            {bubble.label}
                        </Typography>
                    </div>
                );
            })}
        </div>
    );
};

export default Bubbles;
