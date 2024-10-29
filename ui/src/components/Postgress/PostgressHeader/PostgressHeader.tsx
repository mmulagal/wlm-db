import { Header } from '@netapp/design-system';
import { useAppSelector } from '../../../store/storeHooks';
import { useNavigate } from 'react-router-dom';
import { navigateToCanvas } from '../../../utils/appConfig';

const PostgressHeader = () => {
    const { databaseHostEntryPoint } = useAppSelector(state => state.msSqlAction);
    const navigate = useNavigate();
    const handleNavigateWithoutDialog = () => {
        if (databaseHostEntryPoint === 'database') {
            navigate('/databases');
        } else {
            navigateToCanvas('/');
        }
    };
    return (
        <Header
            title={'Create new PostgreSQL Server'}
            closeButtonProps={{
                onClick: () => {
                    handleNavigateWithoutDialog();
                }
            }}
            style={{ width: '100vw' }}
        ></Header>
    );
};

export default PostgressHeader;
