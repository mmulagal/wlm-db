import { Typography } from '@netapp/design-system';
import styles from './ChatbotHeader.module.scss';
import { CHATBOT } from '../../../../utils/appConstants';
import { ReactComponent as AddIcon } from '../../../../assets/ic_add.svg';
import { useAppDispatch } from '../../../../store/storeHooks';
import { setIsWizardTouched, setMessages } from '../../../../store/chatbot/chatbotSlice';

const ChatbotHeader = () => {
    const dispatch = useAppDispatch();

    const startNewChat = () => {
        dispatch(setIsWizardTouched(false));
        dispatch(setMessages([]));
    };

    return (
        <div className={styles['chatbot-header']}>
            <div className={styles['start-new-chat']} onClick={startNewChat}>
                <AddIcon />
                <Typography variant="Semibold_14" className={styles['start-new-chat-txt']}>
                    {CHATBOT.WELCOME_PAGE.START_NEW_CHAT}
                </Typography>
            </div>
            <div className={styles['preview-tag']}>
                <Typography variant="Semibold_13" color="#6B31AB">
                    {CHATBOT.HEADER.PREVIEW}
                </Typography>
            </div>
        </div>
    );
};

export default ChatbotHeader;
