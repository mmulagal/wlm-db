import { ReactComponent as ChatBotIcon } from '../../../../assets/chatbot-icon.svg';
import Loader from '../Loader/Loader';
import styles from './ChatBotResponseLoader.module.scss';

type chatBotResponseLoaderProps = {
    isBotReplying: boolean;
};

const ChatBotResponseLoader = ({ isBotReplying }: chatBotResponseLoaderProps) => {
    return (
        isBotReplying && (
            <div className={styles['message-item']}>
                <div className={styles[`message-icon`]}>
                    <ChatBotIcon />
                </div>
                <div className={styles[`message-text`]}>
                    <Loader />
                </div>
            </div>
        )
    );
};

export default ChatBotResponseLoader;
