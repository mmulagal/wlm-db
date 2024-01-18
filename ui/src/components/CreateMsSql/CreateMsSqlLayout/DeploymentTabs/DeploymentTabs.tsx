import { ReactComponent as WizardIcon } from '../../../../assets/wizard-icon.svg';
import { ReactComponent as ChatbotIcon } from '../../../../assets/chatbot-tab-icon.svg';
import { Typography } from '@netapp/design-system';

import styles from './DeploymentTabs.module.scss';

type DeploymentTabsProps = {
    selectedTab: 'wizard' | 'chatbot';
    onTabChange: (tab: 'wizard' | 'chatbot') => void;
};

const DeploymentTabs = ({ selectedTab, onTabChange }: DeploymentTabsProps) => {
    return (
        <div className={styles['deployment-tabs']}>
            <div
                className={`${styles['single-tab']} ${
                    selectedTab === 'wizard' ? styles['selected-tab'] : styles['non-selected-tab']
                }`}
                onClick={() => onTabChange('wizard')}
            >
                <WizardIcon />
                <Typography variant="Semibold_16" color={selectedTab === 'wizard' ? '#0067c5' : '#404040'}>
                    Database wizard
                </Typography>
            </div>
            <div
                className={`${styles['single-tab']} ${
                    selectedTab === 'chatbot' ? styles['selected-tab'] : styles['non-selected-tab']
                }`}
                onClick={() => onTabChange('chatbot')}
                id="chatbot-tab"
            >
                <ChatbotIcon />
                <Typography variant="Semibold_16" color={selectedTab === 'chatbot' ? '#0067c5' : '#404040'}>
                    Database Chatbot
                </Typography>
            </div>
        </div>
    );
};

export default DeploymentTabs;
