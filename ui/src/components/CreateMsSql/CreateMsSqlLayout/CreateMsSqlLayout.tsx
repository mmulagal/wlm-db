import { useEffect, useState } from 'react';
import styles from './CreateMsSqlLayout.module.scss';
import DeploymentTabs from './DeploymentTabs/DeploymentTabs';
import MSSqlServer from '../MSSqlServer/MSSqlServer';
import Chatbot from '../Chatbot/Chatbot';
import { setIsShow, setMovingFromChatbot } from '../../../store/chatbot/chatbotSlice';
import { useDispatch } from 'react-redux';
import { setSelectConfig } from '../../../store/mssql/mssqlFormSlice';
import { SELECT_CONFIG } from '../../../utils/appConstants';

type CreateMsSqlLayoutProps = {
    selectedTab: 'chatbot' | 'wizard';
    setSelectedTab: (tab: 'chatbot' | 'wizard') => void;
};

const CreateMsSqlLayout = ({ selectedTab, setSelectedTab }: CreateMsSqlLayoutProps) => {
    const dispatch = useDispatch();

    useEffect(() => {
        dispatch(setIsShow(selectedTab === 'chatbot'));
    }, [selectedTab, dispatch]);

    return (
        <div className={styles['create-mssql-layout']}>
            <DeploymentTabs
                selectedTab={selectedTab}
                onTabChange={(tab: 'wizard' | 'chatbot') => {
                    if (tab === 'wizard' && selectedTab === 'chatbot') {
                        dispatch(setMovingFromChatbot(true));
                        dispatch(setSelectConfig(SELECT_CONFIG.EASY_CREATE));
                        setTimeout(() => {
                            dispatch(setMovingFromChatbot(false));
                        }, 2000);
                    }
                    setSelectedTab(tab);
                }}
            />
            {selectedTab === 'wizard' ? <MSSqlServer /> : <Chatbot />}
        </div>
    );
};

export default CreateMsSqlLayout;
