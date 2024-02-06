import { Typography } from '@netapp/design-system';

import { ReactComponent as BedrockPoweredIcon } from '../../../../assets/bedrock-powered-icon.svg';
import styles from './WelcomePage.module.scss';
import { CHATBOT_WELCOME_CARDS } from '../../../../utils/consts';
import { CHATBOT } from '../../../../utils/appConstants';
import { useDispatch } from 'react-redux';
import { setLatestIntentMsg, setMessages } from '../../../../store/chatbot/chatbotSlice';
import { useAppSelector } from '../../../../store/storeHooks';

type WelcomePagePropTypes = {
    handleSendMsg: (msg: string | undefined, add?: boolean, updatedMessages?: any) => void;
};

const WelcomePage = ({ handleSendMsg }: WelcomePagePropTypes) => {
    const dispatch = useDispatch();
    const messages = useAppSelector(state => state.chatbot.messages);

    const askSuggested = (suggestionObj: any) => {
        const updatedMessages = [...messages, { sender: 'user', msg: suggestionObj.label }];
        handleSendMsg(suggestionObj.value || suggestionObj.label, false, updatedMessages);
        dispatch(setMessages(updatedMessages));
    };

    return (
        <div className={styles['welcome-image-container']}>
            <BedrockPoweredIcon />
            <div className={styles['welcome-text']}>
                <Typography variant="Semibold_16">{CHATBOT.WELCOME_PAGE.DB_WORKLOAD_EXPERT}</Typography>
                <Typography variant="Regular_14" className={styles['welcome-description']}>
                    {CHATBOT.WELCOME_PAGE.WELCOME_MSG}
                </Typography>
            </div>
            <div className={styles['welcome-cards-container']}>
                <div className={styles['card-row']}>
                    <div
                        className={`${'chatbot-select-msg'} ${styles['card']}`}
                        onClick={() => {
                            askSuggested(CHATBOT_WELCOME_CARDS[0]);
                            dispatch(setLatestIntentMsg(CHATBOT_WELCOME_CARDS[0].label));
                        }}
                    >
                        <Typography variant="Regular_14" className={styles['chatbot-card-text']}>
                            {CHATBOT_WELCOME_CARDS[0].label}
                        </Typography>
                    </div>
                    <div
                        className={`${'chatbot-select-msg'} ${styles['card']}`}
                        onClick={() => askSuggested(CHATBOT_WELCOME_CARDS[1])}
                    >
                        <Typography variant="Regular_14" className={styles['chatbot-card-text']}>
                            {CHATBOT_WELCOME_CARDS[1].label}
                        </Typography>
                    </div>
                </div>
                <div className={styles['card-row']}>
                    <div
                        className={`${'chatbot-select-msg'} ${styles['card']}`}
                        onClick={() => askSuggested(CHATBOT_WELCOME_CARDS[2])}
                    >
                        <Typography variant="Regular_14" className={styles['chatbot-card-text']}>
                            {CHATBOT_WELCOME_CARDS[2].label}
                        </Typography>
                    </div>
                    <div
                        className={`${'chatbot-select-msg'} ${styles['card']}`}
                        onClick={() => askSuggested(CHATBOT_WELCOME_CARDS[3])}
                    >
                        <Typography variant="Regular_14" className={styles['chatbot-card-text']}>
                            {CHATBOT_WELCOME_CARDS[3].label}
                        </Typography>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WelcomePage;
