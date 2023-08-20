import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router';
import ResourceHeader from './ResourceHeader/ResourceHeader';
import styles from './ResourcePage.module.scss';

const ResourcePage = () => {
    const navigate = useNavigate();

    useEffect(() => {
        navigate('overview');
    }, []);

    return (
        <div className={styles.resourcePageContainer}>
            <ResourceHeader name={'TestName'} />
            <Outlet />
        </div>
    );
};

export default ResourcePage;
