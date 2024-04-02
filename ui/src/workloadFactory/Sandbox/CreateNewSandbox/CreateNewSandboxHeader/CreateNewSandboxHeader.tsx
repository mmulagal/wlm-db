import { Header } from '@netapp/design-system';
import { useNavigate } from 'react-router-dom';
import styles from './CreateNewSandboxHeader.module.scss';

function CreateNewSandboxHeader() {
    const navigate = useNavigate();
    return (
        <div className={styles.sandboxHeader}>
            <Header
                closeButtonProps={{
                    onClick: () => {
                        navigate('../databases');
                    }
                }}
                title={<div className={styles.leftSideStyle}>{'Create new sandbox'}</div>}
                style={{ width: '100vw' }}
            ></Header>
        </div>
    );
}

export default CreateNewSandboxHeader;
