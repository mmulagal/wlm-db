import { Typography } from '@netapp/design-system';
import styles from './ChatbotHeader.module.scss';

const ChatbotHeader = () => {
    return (
        <div className={styles['chatbot-header']}>
            <div className={styles['preview-tag']}>
                <Typography variant="Semibold_13" color="#6B31AB">
                    Preview
                </Typography>
            </div>
        </div>
    );
};

export default ChatbotHeader;
