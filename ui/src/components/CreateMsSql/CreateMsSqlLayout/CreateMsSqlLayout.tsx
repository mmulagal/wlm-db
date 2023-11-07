import { useEffect, useState } from 'react';
import styles from './CreateMsSqlLayout.module.scss';
import DeploymentTabs from './DeploymentTabs/DeploymentTabs';
import MSSqlServer from '../MSSqlServer/MSSqlServer';
import Chatbot from '../Chatbot/Chatbot';
import { setIsShow } from '../../../store/chatbot/chatbotSlice';
import { useDispatch } from 'react-redux';

const CreateMsSqlLayout = () => {
    const [selectedTab, setSelectedTab] = useState<'wizard' | 'chatbot'>('wizard');
    const dispatch = useDispatch();

    useEffect(() => {
        dispatch(setIsShow(selectedTab === 'chatbot'));
    }, [selectedTab, dispatch]);

    return (
        <div className={styles['create-mssql-layout']}>
            <DeploymentTabs
                selectedTab={selectedTab}
                onTabChange={(tab: 'wizard' | 'chatbot') => setSelectedTab(tab)}
            />
            {selectedTab === 'wizard' ? <MSSqlServer /> : <Chatbot />}
        </div>
    );
};

export default CreateMsSqlLayout;
