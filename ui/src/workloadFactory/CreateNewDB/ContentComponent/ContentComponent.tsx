import { AccordionController, Button, DsTypography, useDialog } from '@netapp/design-system';

import CreateStyle from '../CreateStyle/CreateStyle';
import styles from './ContentComponent.module.scss';
import DatabaseName from './DatabaseName/DatabaseName';
import FileSettings from './FileSettings/FileSettings';
import { useAppSelector } from '../../../store/storeHooks';
const ContentComponent = () => {
    const { selectedNewUserConfig } = useAppSelector(state => state.createNewUser);
    return (
        <div className={styles.contentComponent}>
            <CreateStyle />

            <div className={styles.accordionContainer}>
                <AccordionController isGrouped>
                    <DsTypography
                        style={{
                            padding: '0 0 8px'
                        }}
                        variant="Semibold_16"
                    >
                        {selectedNewUserConfig === 'Quick create' && 'Database quick create'}
                        {selectedNewUserConfig === 'Advanced create' && 'Database advanced create'}
                    </DsTypography>
                    <DatabaseName />
                    <FileSettings />
                </AccordionController>
            </div>
        </div>
    );
};

export default ContentComponent;
