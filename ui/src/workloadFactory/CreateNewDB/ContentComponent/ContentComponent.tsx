import { AccordionController, DsTypography } from '@netapp/design-system';

import styles from './ContentComponent.module.scss';
import DatabaseName from './DatabaseInformation/DatabaseName/DatabaseName';
import FilesSize from './FileSettings/FilesSize/FilesSize';
import CommonStyles from '../../../utils/CommonStyles.module.scss';
import FileSettingsMode from './FileSettings/FileSettingsMode/FileSettingsMode';
import FileNames from './FileSettings/FileNames/FileNames';
import { useAppSelector } from '../../../store/storeHooks';
import { GENERAL } from '../../../utils/appConstants';
import { useGetDriveInfoQuery } from '../../../utils/apiService';
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { setDriveInfoList, setDriveInfoListLoading } from '../../../store/workloadFactory/createNewDBSlice';
import Collation from './DatabaseInformation/Collation/Collation';

const ContentComponent = () => {
    const dispatch = useDispatch();
    const dbHostName = useAppSelector(state => state.createNewUser.dbHostName);
    const resourceId = useAppSelector(state => state.auth.resourceId);
    const selectedCredId = useAppSelector(state => state.headers.headerSelectedCred);
    const selectedRegionCode = useAppSelector(state => state.headers.headerSelectedRegion);

    const { data: driveInfoList, isFetching: driveInfoListLoading } = useGetDriveInfoQuery({
        credentialId: selectedCredId?.data?.credentialsId,
        region: selectedRegionCode?.data?.regionCode,
        id: resourceId
    });

    useEffect(() => {
        dispatch(setDriveInfoList(driveInfoList));
        dispatch(setDriveInfoListLoading(driveInfoListLoading));
    }, [driveInfoList, driveInfoListLoading]);

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
                    <DsTypography variant="Semibold_16" className={styles.accordionContainer}>
                        {GENERAL.DATABASE_INFORMATION}
                    </DsTypography>
                    <DatabaseName />
                    {/* <Collation /> */}
                    <DsTypography variant="Semibold_16" className={styles.accordionContainer}>
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
