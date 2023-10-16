import { useState } from 'react';
import styles from './CreateMsSqlLayout.module.scss';
import DeploymentTabs from './DeploymentTabs/DeploymentTabs';
import MSSqlServer from '../MSSqlServer/MSSqlServer';
import Chatbot from '../Chatbot/Chatbot';

const CreateMsSqlLayout = () => {
    const [selectedTab, setSelectedTab] = useState<'wizard' | 'chatbot'>('wizard');
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
