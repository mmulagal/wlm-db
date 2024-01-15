import { Typography } from '@netapp/design-system';
import styles from './ChatbotHeader.module.scss';
import { CHATBOT } from '../../../../utils/appConstants';

const ChatbotHeader = () => {
    return (
        <div className={styles['chatbot-header']}>
            <div className={styles['preview-tag']}>
                <Typography variant="Semibold_13" color="#6B31AB">
                    {CHATBOT.HEADER.PREVIEW}
                </Typography>
            </div>
        </div>
    );
};

export default ChatbotHeader;
