import { ReactComponent as ChatBotIcon } from '../../../../assets/chatbot-icon.svg';
import styles from './Header.module.scss';

const Header = () => {
    return (
        <div className={styles['page-header']}>
            <ChatBotIcon />
            Chatbot
        </div>
    );
};

export default Header;
