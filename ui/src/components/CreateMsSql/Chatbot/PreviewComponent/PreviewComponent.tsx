import { ReactComponent as Toplogy } from '../../../../assets/topology.svg';
import JsonRenderer from './JsonRenderer/JsonRenderer';
import styles from './PreviewComponent.module.scss';

type PreviewComponentProps = {
    heading: string;
    content: any;
    footerButton: string;
    onClickFooter: () => void;
    isButtonEnabled?: boolean;
};

const PreviewComponent = ({
    heading,
    content,
    footerButton,
    onClickFooter,
    isButtonEnabled
}: PreviewComponentProps) => {
    return (
        <div className={styles['preview-container']}>
            <div className={`${styles['preview-component']} ${heading ? styles['top-portion'] : ''}`}>
                <div className={styles['preview-header']}>{heading}</div>
                <div className={styles['preview-content']}>
                    <JsonRenderer jsonData={content} />
                </div>
                <div className={styles['preview-footer']}>
                    {footerButton && (
                        <button onClick={onClickFooter} disabled={!isButtonEnabled} className={styles['footer-button']}>
                            {footerButton}
                        </button>
                    )}
                </div>
            </div>
            {heading && (
                <div className={styles['topology-container']}>
                    <Toplogy className={styles['topology-image']} />
                </div>
            )}
        </div>
    );
};

export default PreviewComponent;
