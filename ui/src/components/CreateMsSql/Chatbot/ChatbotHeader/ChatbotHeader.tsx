import { Typography } from '@netapp/design-system';
import styles from './ChatbotHeader.module.scss';
import { CHATBOT } from '../../../../utils/appConstants';
import { ReactComponent as AddIcon } from '../../../../assets/ic_add.svg';
import { useAppDispatch, useAppSelector } from '../../../../store/storeHooks';
import {
    setCurrentIntent,
    setIsWizardTouched,
    setMessages,
    setSuggestionBubbles
} from '../../../../store/chatbot/chatbotSlice';
import { getChatbotParamsFromPayload } from '../../../../utils/utilityFunctions';

type ChatbotHeaderPropTypes = {
    mapParamsToPayload: (paramObj: any) => void;
};

const ChatbotHeader = ({ mapParamsToPayload }: ChatbotHeaderPropTypes) => {
    const dispatch = useAppDispatch();
    const mssqlFormData = useAppSelector(state => state.mssqlForm);

    const startNewChat = () => {
        let defaultParams = getChatbotParamsFromPayload(mssqlFormData);
        let defaultObj: any = {};
        Object.keys(defaultParams).map((key: string) => {
            defaultObj[key] = null;
        });
        mapParamsToPayload(defaultObj);
        dispatch(setCurrentIntent(''));
        dispatch(setIsWizardTouched(false));
        dispatch(setMessages([]));
        dispatch(setSuggestionBubbles({ list: [], onBubbleClick: () => {} }));
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
