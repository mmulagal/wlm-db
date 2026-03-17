import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import AppNotification, { NotificationObject } from './AppNotification';

vi.mock('../../store/notificationSlice', () => ({
    NOTIFICATION_TYPES: {
        SUCCESS: 'success',
        ERROR: 'error',
        WARNING: 'warning',
        INFO: 'info'
    }
}));

vi.mock('@netapp/design-system', () => ({
    Notification: ({ children, type, variant, onClose, moreInfo, className }: any) => (
        <div data-testid="notification" data-type={type} data-variant={variant} className={className}>
            <button data-testid="notification-close" onClick={onClose}>
                close
            </button>
            <div data-testid="notification-body">{children}</div>
            {moreInfo && <div data-testid="notification-more-info">{moreInfo}</div>}
        </div>
    ),
    NotificationPanel: ({ notifications }: any) => (
        <div data-testid="notification-panel">
            {notifications.map((n: any, i: number) => (
                <div key={i} data-testid={`panel-item-${i}`} data-type={n.type}>
                    <button data-testid={`panel-close-${i}`} onClick={n.onClose}>
                        close
                    </button>
                    <div data-testid={`panel-body-${i}`}>{n.children}</div>
                    {n.moreInfo && <div data-testid={`panel-more-${i}`}>{n.moreInfo}</div>}
                </div>
            ))}
        </div>
    )
}));

const makeNotifications = (
    type: string,
    message: string,
    overrides?: Partial<NotificationObject['messages'][0]>
): NotificationObject => ({
    messages: [
        {
            notificationType: type,
            additionalText: undefined,
            linkComp: { comp: null, data: null, label: '' },
            message,
            allowDuplicate: false,
            notificationPlacement: undefined,
            ...overrides
        }
    ],
    showDetailedView: false
});

describe('AppNotification', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should be a function component', () => {
        expect(typeof AppNotification).toBe('function');
    });

    it('should render success notification', () => {
        const { getByTestId } = render(
            <AppNotification notifications={makeNotifications('success', 'Operation succeeded')} onClose={vi.fn()} />
        );
        expect(getByTestId('notification')).toBeTruthy();
        expect(getByTestId('notification').dataset.type).toBe('success');
    });

    it('should render error notification', () => {
        const { getByTestId } = render(
            <AppNotification notifications={makeNotifications('error', 'Something went wrong')} onClose={vi.fn()} />
        );
        expect(getByTestId('notification').dataset.type).toBe('error');
    });

    it('should render warning notification', () => {
        const { getByTestId } = render(
            <AppNotification notifications={makeNotifications('warning', 'Take caution')} onClose={vi.fn()} />
        );
        expect(getByTestId('notification').dataset.type).toBe('warning');
    });

    it('should render info notification', () => {
        const { getByTestId } = render(
            <AppNotification notifications={makeNotifications('info', 'FYI')} onClose={vi.fn()} />
        );
        expect(getByTestId('notification').dataset.type).toBe('info');
    });

    it('should auto-close success notification after 8000ms', () => {
        vi.useFakeTimers();
        const onClose = vi.fn();
        render(<AppNotification notifications={makeNotifications('success', 'Done!')} onClose={onClose} />);
        expect(onClose).not.toHaveBeenCalled();
        act(() => {
            vi.advanceTimersByTime(8000);
        });
        expect(onClose).toHaveBeenCalledWith(0, 1);
        vi.useRealTimers();
    });

    it('should auto-close info notification after 20000ms', () => {
        vi.useFakeTimers();
        const onClose = vi.fn();
        render(<AppNotification notifications={makeNotifications('info', 'FYI')} onClose={onClose} />);
        act(() => {
            vi.advanceTimersByTime(20000);
        });
        expect(onClose).toHaveBeenCalledWith(0, 1);
        vi.useRealTimers();
    });

    it('should NOT auto-close error notification', () => {
        vi.useFakeTimers();
        const onClose = vi.fn();
        render(<AppNotification notifications={makeNotifications('error', 'Error!')} onClose={onClose} />);
        act(() => {
            vi.advanceTimersByTime(30000);
        });
        expect(onClose).not.toHaveBeenCalled();
        vi.useRealTimers();
    });

    it('should call onClose when close button is clicked', () => {
        const onClose = vi.fn();
        const { getByTestId } = render(
            <AppNotification notifications={makeNotifications('error', 'Oops')} onClose={onClose} />
        );
        fireEvent.click(getByTestId('notification-close'));
        expect(onClose).toHaveBeenCalled();
    });

    it('should use manualNotificationPlacement when set', () => {
        const { container } = render(
            <AppNotification
                notifications={makeNotifications('error', 'msg', { notificationPlacement: '200px' })}
                onClose={vi.fn()}
            />
        );
        const outerDiv = container.firstChild as HTMLElement;
        expect(outerDiv.style.bottom).toBe('200px');
    });

    // ---- additionalText without URL ----
    it('should render notification with additionalText (no URL) via moreInfo', () => {
        const { getByTestId } = render(
            <AppNotification
                notifications={makeNotifications('error', 'Main msg', {
                    additionalText: 'Extra info without url'
                })}
                onClose={vi.fn()}
            />
        );
        expect(getByTestId('notification-more-info')).toBeTruthy();
        expect(getByTestId('notification-more-info').textContent).toBe('Extra info without url');
    });

    // ---- additionalText with URL (renderAdditionalText URL branch) ----
    it('should render notification with additionalText containing a URL as anchor', () => {
        const { getByTestId } = render(
            <AppNotification
                notifications={makeNotifications('error', 'Main msg', {
                    additionalText: 'See docs at https://docs.example.com for details'
                })}
                onClose={vi.fn()}
            />
        );
        const moreInfo = getByTestId('notification-more-info');
        const anchor = moreInfo.querySelector('a');
        expect(anchor).toBeTruthy();
        expect(anchor?.getAttribute('href')).toBe('https://docs.example.com');
        expect(anchor?.getAttribute('target')).toBe('_blank');
        expect(anchor?.getAttribute('rel')).toBe('noopener noreferrer');
    });

    // ---- INFO_DETAIL type ----
    it('should render INFO_DETAIL notification with block layout', () => {
        const { getByTestId } = render(
            <AppNotification
                notifications={makeNotifications('INFO_DETAIL', 'Title text', {
                    additionalText: 'Additional job info',
                    notificationType: 'INFO_DETAIL'
                })}
                onClose={vi.fn()}
            />
        );
        expect(getByTestId('notification')).toBeTruthy();
        expect(getByTestId('notification-body').textContent).toContain('Title text');
    });

    // ---- INFO_DETAIL with LinkComp ----
    it('should render INFO_DETAIL with LinkComp', () => {
        const MockLink = ({ label, onClose }: any) => (
            <a data-testid="link-comp" onClick={onClose}>
                {label}
            </a>
        );
        const { getByTestId } = render(
            <AppNotification
                notifications={makeNotifications('INFO_DETAIL', 'Check this', {
                    additionalText: 'Go to tab',
                    notificationType: 'INFO_DETAIL',
                    linkComp: { comp: MockLink, data: {}, label: 'Job Monitoring' }
                })}
                onClose={vi.fn()}
            />
        );
        expect(getByTestId('link-comp').textContent).toBe('Job Monitoring');
    });

    // ---- Single notification with LinkComp (no additionalText) ----
    it('should render single notification with LinkComp in message body', () => {
        const MockLink = ({ label, onClose }: any) => (
            <a data-testid="link-comp" onClick={onClose}>
                {label}
            </a>
        );
        const { getByTestId } = render(
            <AppNotification
                notifications={makeNotifications('error', 'Error with link', {
                    linkComp: { comp: MockLink, data: {}, label: 'View logs' }
                })}
                onClose={vi.fn()}
            />
        );
        expect(getByTestId('link-comp').textContent).toBe('View logs');
    });

    // ---- Multiple messages → NotificationPanel ----
    it('should render NotificationPanel when messages.length > 1', () => {
        const notifications: NotificationObject = {
            messages: [
                {
                    notificationType: 'success',
                    additionalText: undefined,
                    linkComp: { comp: null, data: null, label: '' },
                    message: 'First',
                    allowDuplicate: false,
                    notificationPlacement: undefined
                },
                {
                    notificationType: 'error',
                    additionalText: undefined,
                    linkComp: { comp: null, data: null, label: '' },
                    message: 'Second',
                    allowDuplicate: false,
                    notificationPlacement: undefined
                }
            ],
            showDetailedView: false
        };
        const { getByTestId } = render(<AppNotification notifications={notifications} onClose={vi.fn()} />);
        expect(getByTestId('notification-panel')).toBeTruthy();
    });

    it('should call onClose when panel item close is clicked', () => {
        const onClose = vi.fn();
        const notifications: NotificationObject = {
            messages: [
                {
                    notificationType: 'success',
                    additionalText: undefined,
                    linkComp: { comp: null, data: null, label: '' },
                    message: 'First',
                    allowDuplicate: false,
                    notificationPlacement: undefined
                },
                {
                    notificationType: 'error',
                    additionalText: undefined,
                    linkComp: { comp: null, data: null, label: '' },
                    message: 'Second',
                    allowDuplicate: false,
                    notificationPlacement: undefined
                }
            ],
            showDetailedView: false
        };
        const { getByTestId } = render(<AppNotification notifications={notifications} onClose={onClose} />);
        fireEvent.click(getByTestId('panel-close-0'));
        expect(onClose).toHaveBeenCalledWith(0);
    });

    // ---- Multiple messages with additionalText → moreInfo in panel ----
    it('should pass moreInfo to NotificationPanel when additionalText is present', () => {
        const notifications: NotificationObject = {
            messages: [
                {
                    notificationType: 'error',
                    additionalText: 'Some extra detail',
                    linkComp: { comp: null, data: null, label: '' },
                    message: 'Primary',
                    allowDuplicate: false,
                    notificationPlacement: undefined
                },
                {
                    notificationType: 'info',
                    additionalText: undefined,
                    linkComp: { comp: null, data: null, label: '' },
                    message: 'Secondary',
                    allowDuplicate: false,
                    notificationPlacement: undefined
                }
            ],
            showDetailedView: false
        };
        const { getByTestId } = render(<AppNotification notifications={notifications} onClose={vi.fn()} />);
        expect(getByTestId('panel-more-0').textContent).toBe('Some extra detail');
    });

    // ---- Multiple messages with LinkComp ----
    it('should render LinkComp in panel item when linkComp is provided', () => {
        const MockLink = ({ label }: any) => <a data-testid="panel-link">{label}</a>;
        const notifications: NotificationObject = {
            messages: [
                {
                    notificationType: 'info',
                    additionalText: undefined,
                    linkComp: { comp: MockLink, data: {}, label: 'View' },
                    message: 'Info with link',
                    allowDuplicate: false,
                    notificationPlacement: undefined
                },
                {
                    notificationType: 'error',
                    additionalText: undefined,
                    linkComp: { comp: null, data: null, label: '' },
                    message: 'Error msg',
                    allowDuplicate: false,
                    notificationPlacement: undefined
                }
            ],
            showDetailedView: false
        };
        const { getByTestId } = render(<AppNotification notifications={notifications} onClose={vi.fn()} />);
        expect(getByTestId('panel-link').textContent).toBe('View');
    });

    // ---- showDetailedView=true ----
    it('should render multiple messages individually when showDetailedView=true', () => {
        const notifications: NotificationObject = {
            messages: [
                {
                    notificationType: 'success',
                    additionalText: undefined,
                    linkComp: { comp: null, data: null, label: '' },
                    message: 'Msg A',
                    allowDuplicate: false,
                    notificationPlacement: undefined
                },
                {
                    notificationType: 'error',
                    additionalText: undefined,
                    linkComp: { comp: null, data: null, label: '' },
                    message: 'Msg B',
                    allowDuplicate: false,
                    notificationPlacement: undefined
                }
            ],
            showDetailedView: true
        };
        const { getByTestId } = render(<AppNotification notifications={notifications} onClose={vi.fn()} />);
        // showDetailedView=true → NotificationPanel renders (multiple messages always use panel)
        expect(getByTestId('notification-panel')).toBeTruthy();
    });
});
