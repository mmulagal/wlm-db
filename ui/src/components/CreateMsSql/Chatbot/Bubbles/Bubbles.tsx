import { Typography } from '@netapp/design-system';
import styles from './Bubbles.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';

type BubblesPropsType = {
    bubbleList: Array<bubbleItemType>;
    onBubbleClick: (label?: string, value?: string) => void;
};

type bubbleItemType = {
    label?: string;
    value?: string;
};

const Bubbles = ({ bubbleList, onBubbleClick }: BubblesPropsType) => {
    const isDarkTheme = useAppSelector(state => state?.auth?.features?.active['Platform.BlueXP/DarkTheme']);

    return (
        <div className={styles['bubbles-container']}>
            {bubbleList.map((bubble: bubbleItemType) => {
                return (
                    <div
                        className={`${'chatbot-select-msg'} ${
                            isDarkTheme
                                ? `${styles['bubble-item']} ${styles['bubble-item-dark-mode']}`
                                : styles['bubble-item']
                        }`}
                        onClick={() => onBubbleClick(bubble?.label, bubble?.value)}
                        id={bubble.value === 'deploy' ? 'chatbot-deploy-btn' : ''}
                    >
                        <Typography
                            variant="Semibold_13"
                            className={
                                isDarkTheme
                                    ? `${styles['bubble-label']} ${styles['bubble-item-dark-mode-label']}`
                                    : styles['bubble-label']
                            }
                        >
                            {bubble.label}
                        </Typography>
                    </div>
                );
            })}
        </div>
    );
};

export default Bubbles;
