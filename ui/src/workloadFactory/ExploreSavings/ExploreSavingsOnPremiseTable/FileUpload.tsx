import styles from './FileUpload.module.scss';
import { ReactComponent as Upload } from '../../../assets/ic_upload.svg';
import { DsTypography } from '@netapp/design-system';

const FileUpload = ({
    handleFileChange
}: {
    handleFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}) => {
    return (
        <div className={styles.upload}>
            {/* Styled label to act as the button */}
            <label htmlFor="file-input" className={styles.fileUpload}>
                <div style={{ marginRight: '8px' }}>
                    <Upload />
                </div>
                <DsTypography variant="Semibold_14" className={styles.text}>
                    Upload script results
                </DsTypography>
            </label>
            {/* Hidden file input */}
            <input type="file" id="file-input" style={{ display: 'none' }} onChange={handleFileChange} />
        </div>
    );
};

export default FileUpload;
