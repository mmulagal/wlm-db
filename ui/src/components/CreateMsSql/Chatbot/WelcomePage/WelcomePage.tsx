import { Typography } from '@netapp/design-system';

import { ReactComponent as BedrockPoweredIcon } from '../../../../assets/bedrock-powered-icon.svg';
import styles from './WelcomePage.module.scss';
import { CHATBOT_WELCOME_CARDS } from '../../../../utils/consts';
import { CHATBOT } from '../../../../utils/appConstants';

type WelcomePagePropTypes = {
    handleSendMsg: (msg: string | undefined) => void;
};

const WelcomePage = ({ handleSendMsg }: WelcomePagePropTypes) => {
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
                    <div className={styles['card']} onClick={() => handleSendMsg(CHATBOT_WELCOME_CARDS[0])}>
                        <Typography variant="Regular_14" className={styles['chatbot-card-text']}>
                            {CHATBOT_WELCOME_CARDS[0]}
                        </Typography>
                    </div>
                    <div className={styles['card']} onClick={() => handleSendMsg(CHATBOT_WELCOME_CARDS[1])}>
                        <Typography variant="Regular_14" className={styles['chatbot-card-text']}>
                            {CHATBOT_WELCOME_CARDS[1]}
                        </Typography>
                    </div>
                </div>
                <div className={styles['card-row']}>
                    <div className={styles['card']} onClick={() => handleSendMsg(CHATBOT_WELCOME_CARDS[2])}>
                        <Typography variant="Regular_14" className={styles['chatbot-card-text']}>
                            {CHATBOT_WELCOME_CARDS[2]}
                        </Typography>
                    </div>
                    <div className={styles['card']} onClick={() => handleSendMsg(CHATBOT_WELCOME_CARDS[3])}>
                        <Typography variant="Regular_14" className={styles['chatbot-card-text']}>
                            {CHATBOT_WELCOME_CARDS[3]}
                        </Typography>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WelcomePage;
