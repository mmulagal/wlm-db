import styles from './SeparatorComponent.module.scss';

type SeparatorComponentProps = {
    variant?: string;
    height?: string;
};

const SeparatorComponent = ({ variant, height }: SeparatorComponentProps) => (
    <div className={styles.separatorComponent}>
        {variant === 'vertical' ? (
            <div style={{ height, borderRight: '1px solid var(--border)' }} />
        ) : (
            <div style={{ height, borderTop: '1px solid var(--border)' }} />
        )}
    </div>
);

export default SeparatorComponent;
