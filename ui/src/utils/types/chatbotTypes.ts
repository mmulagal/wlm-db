export interface ChatbotEntities {
    messages: any;
    currentIntent: any;
    isShow: boolean;
    isReceivingMsg: boolean;
    loadConfigClicked: boolean;
    showRetry: boolean;
    isWizardTouched: boolean;
    suggestionBubbles: {
        list: Array<{ label: string; value: string }>;
        onBubbleClick: (label?: string, value?: string) => void;
    };
    expectingResponse: {
        type: 'none' | 'text' | 'password' | 'number';
        fieldName: string;
    };
    latestIntentMsg: string;
    resumeCount: number;
}
