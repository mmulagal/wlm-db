import PreviewComponent from '../CreateMsSql/Chatbot/PreviewComponent/PreviewComponent';
import styles from './PreviewPanel.module.scss';
import { useSelector } from 'react-redux';

const PreviewPanel = () => {
    const { type, data } = useSelector((state: any) => state.previewPanel);
    return (
        <div className={styles['preview-panel']}>
            {type === 'chatbot' && (
                <PreviewComponent
                    heading={data.heading}
                    content={data.payloadContent}
                    footerButton={data.footerButton}
                    onClickFooter={() => console.log('deploy clicked')}
                    isButtonEnabled={data.isPayloadReady}
                />
            )}
        </div>
    );
};

export default PreviewPanel;
