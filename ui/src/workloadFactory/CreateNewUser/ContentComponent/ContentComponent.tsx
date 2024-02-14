import { AccordionController, Button, DsTypography, useDialog } from '@netapp/design-system';

import CreateStyle from '../CreateStyle/CreateStyle';
import styles from './ContentComponent.module.scss';
import DatabaseName from './DatabaseName/DatabaseName';
import FileSettings from './FileSettings/FileSettings';
const ContentComponent = () => {
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
                        Database quick create
                    </DsTypography>
                    <DatabaseName />
                    <FileSettings />
                </AccordionController>
            </div>
        </div>
    );
};

export default ContentComponent;
