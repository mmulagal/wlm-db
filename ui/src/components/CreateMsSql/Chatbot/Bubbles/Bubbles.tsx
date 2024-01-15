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
                    <div className={styles['bubble-item']} onClick={() => onBubbleClick(bubble?.label, bubble?.value)}>
                        {bubble.label}
                    </div>
                );
            })}
        </div>
    );
};

export default Bubbles;
