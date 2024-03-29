import { ReactComponent as WizardIcon } from '../../../../assets/wizard-icon.svg';
import { ReactComponent as WizardSelectedInLightIcon } from '../../../../assets/Wizard_Selected_light.svg';
import { ReactComponent as ChatbotIcon } from '../../../../assets/chatbot-tab-icon.svg';
import { ReactComponent as ChatbotLightModeIcon } from '../../../../assets/ChatInLightModeNotSelected.svg';
import { ReactComponent as ChatbotDarkModeSelectedIcon } from '../../../../assets/ChatInDarkSelected.svg';
import { ReactComponent as ChatbotDarkModeNotSelectedIcon } from '../../../../assets/ChatInDarkNotSelected.svg';
import { Typography } from '@netapp/design-system';

import styles from './DeploymentTabs.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';

type DeploymentTabsProps = {
    selectedTab: 'wizard' | 'chatbot';
    onTabChange: (tab: 'wizard' | 'chatbot') => void;
};

const DeploymentTabs = ({ selectedTab, onTabChange }: DeploymentTabsProps) => {
    const isDarkTheme = useAppSelector(state => state?.auth?.features?.active['Platform.BlueXP/DarkTheme']);
    const darkModeClassSet = () => {
        if (isDarkTheme) {
            if (selectedTab === 'wizard') {
                return styles.darkModeWizardSelected;
            } else if (selectedTab === 'chatbot') {
                return styles.darkModeChatbotSelected;
            } else {
                return '';
            }
        }
        return '';
    };

    const wizardIcon = () => {
        if (selectedTab === 'wizard') {
            return (
                <div>
                    <WizardSelectedInLightIcon />
                </div>
            );
        } else {
            return (
                <div>
                    <WizardIcon />
                </div>
            );
        }
    };

    const setChatbotIcon = () => {
        if (isDarkTheme) {
            if (selectedTab === 'wizard') {
                return <ChatbotDarkModeNotSelectedIcon />;
            } else {
                return <ChatbotDarkModeSelectedIcon />;
            }
        } else {
            if (selectedTab === 'chatbot') {
                return <ChatbotIcon />;
            } else {
                return <ChatbotLightModeIcon />;
            }
        }
    };

    return (
        <div className={styles['deployment-tabs']}>
            <div
                className={`${styles['single-tab']} ${
                    selectedTab === 'wizard' ? styles['selected-tab'] : styles['non-selected-tab']
                } 
                ${selectedTab === 'wizard' && isDarkTheme && styles['selected-tab-dark-theme']}
                `}
                onClick={() => onTabChange('wizard')}
            >
                {isDarkTheme && (
                    <div className={darkModeClassSet()}>
                        <WizardIcon />
                    </div>
                )}

                {!isDarkTheme && wizardIcon()}

                <Typography variant="Semibold_16">Database wizard</Typography>
            </div>
            <div
                className={`${styles['single-tab']} ${
                    selectedTab === 'chatbot' ? styles['selected-tab'] : styles['non-selected-tab']
                }
                ${selectedTab === 'chatbot' && isDarkTheme && styles['selected-tab-dark-theme']}
                `}
                onClick={() => onTabChange('chatbot')}
                id="chatbot-tab"
            >
                <div>{setChatbotIcon()}</div>
                <Typography variant="Semibold_16">Database chatbot</Typography>
            </div>
        </div>
    );
};

export default DeploymentTabs;
