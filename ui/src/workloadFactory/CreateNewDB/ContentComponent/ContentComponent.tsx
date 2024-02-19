import { AccordionController, DsTypography } from '@netapp/design-system';

import styles from './ContentComponent.module.scss';
import DatabaseName from './DatabaseInformation/DatabaseName/DatabaseName';
import FilesSize from './FileSettings/FilesSize/FilesSize';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import FileSettingsMode from './FileSettings/FileSettingsMode/FileSettingsMode';
import FileNames from './FileSettings/FileNames/FileNames';
import { useAppSelector } from '../../../store/storeHooks';
import { GENERAL } from '../../../utils/appConstants';

const ContentComponent = () => {
    const dbHostName = useAppSelector(state => state.createNewUser.dbHostName);

    return (
        <div className={`${styles.contentComponent} ${CommonStyles['accordion-group']}`}>
            <DsTypography variant="Semibold_20" className={styles.heading}>
                {GENERAL.CREATE_USER_DB_TITLE}
            </DsTypography>
            <DsTypography variant="Semibold_16" className={styles.headingHost}>
                {GENERAL.DB_CREATE_HOST} {dbHostName}
            </DsTypography>

            <div className={styles.accordionContainer}>
                <AccordionController isGrouped>
                    <DsTypography
                        style={{
                            padding: '0 0 8px'
                        }}
                        variant="Semibold_16"
                        className={styles.accordionContainer}
                    >
                        {GENERAL.DATABASE_INFORMATION}
                    </DsTypography>
                    <DatabaseName />
                    <DsTypography
                        style={{
                            padding: '0 0 8px'
                        }}
                        variant="Semibold_16"
                        className={styles.accordionContainer}
                    >
                        {GENERAL.FILE_SETTINGS}
                    </DsTypography>
                    <FileSettingsMode />
                    <FileNames />
                    <FilesSize />
                </AccordionController>
            </div>
        </div>
    );
};

export default ContentComponent;
