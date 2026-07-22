import { describe, it, expect, vi } from 'vitest';
import {
    checkHasDismissedConfigurations,
    calculateTotalConfigCount,
    calculatePostponeInfo,
    isTableRowConfigurationInState,
    isTableRowConfigurationActivating,
    checkAllConfigurationsDismissed
} from '../GetWellHelper';

const CONFIG_STATES = {
    ACTIVE: 'ACTIVE',
    DISMISSED: 'DISMISSED',
    POSTPONED: 'POSTPONED',
    ACTIVATING: 'ACTIVATING'
};

// const WA_FLAG_SKIP = ['deploymentType', 'baseDeploymentType', 'isWad'];

vi.mock('../../../utils/consts', () => ({
    CONFIG_STATES: {
        ACTIVE: 'ACTIVE',
        DISMISSED: 'DISMISSED',
        POSTPONED: 'POSTPONED',
        ACTIVATING: 'ACTIVATING'
    },
    WA_FLAG_SKIP: ['deploymentType', 'baseDeploymentType', 'isWad']
}));

describe('GetWellHelper', () => {
    describe('checkHasDismissedConfigurations', () => {
        it('returns false when cardData is null', () => {
            expect(checkHasDismissedConfigurations(null)).toBe(false);
        });

        it('returns false when cardData is undefined', () => {
            expect(checkHasDismissedConfigurations(undefined)).toBe(false);
        });

        it('returns false when no configurations are dismissed', () => {
            const cardData = {
                'thin-provisioning': {
                    dismissedObj: { configState: CONFIG_STATES.ACTIVE }
                },
                autosize: {
                    dismissedObj: { configState: CONFIG_STATES.ACTIVE }
                }
            };

            expect(checkHasDismissedConfigurations(cardData)).toBe(false);
        });

        it('returns true when at least one configuration is dismissed', () => {
            const cardData = {
                'thin-provisioning': {
                    dismissedObj: { configState: CONFIG_STATES.DISMISSED }
                },
                autosize: {
                    dismissedObj: { configState: CONFIG_STATES.ACTIVE }
                }
            };

            expect(checkHasDismissedConfigurations(cardData)).toBe(true);
        });

        it('returns true when at least one configuration is postponed', () => {
            const cardData = {
                'thin-provisioning': {
                    dismissedObj: { configState: CONFIG_STATES.POSTPONED }
                },
                autosize: {
                    dismissedObj: { configState: CONFIG_STATES.ACTIVE }
                }
            };

            expect(checkHasDismissedConfigurations(cardData)).toBe(true);
        });

        it('returns false when configurations have no dismissedObj', () => {
            const cardData = {
                'thin-provisioning': { name: 'Thin Provisioning' },
                autosize: { name: 'Autosize' }
            };

            expect(checkHasDismissedConfigurations(cardData)).toBe(false);
        });
    });

    describe('calculateTotalConfigCount', () => {
        it('returns 0 when cardData is null', () => {
            expect(calculateTotalConfigCount(null, false)).toBe(0);
        });

        it('returns 0 when cardData is undefined', () => {
            expect(calculateTotalConfigCount(undefined, false)).toBe(0);
        });

        it('counts active configurations when showDismissedConfigurations is false', () => {
            const cardData = {
                'thin-provisioning': {
                    dismissedObj: { configState: CONFIG_STATES.ACTIVE }
                },
                autosize: {
                    dismissedObj: { configState: CONFIG_STATES.DISMISSED }
                },
                'snapshot-reserve': {}
            };

            expect(calculateTotalConfigCount(cardData, false)).toBe(2); // active + no dismissedObj
        });

        it('counts dismissed and postponed configurations when showDismissedConfigurations is true', () => {
            const cardData = {
                'thin-provisioning': {
                    dismissedObj: { configState: CONFIG_STATES.DISMISSED }
                },
                autosize: {
                    dismissedObj: { configState: CONFIG_STATES.POSTPONED }
                },
                'snapshot-reserve': {
                    dismissedObj: { configState: CONFIG_STATES.ACTIVE }
                }
            };

            expect(calculateTotalConfigCount(cardData, true)).toBe(2);
        });

        it('includes activating configurations in active count', () => {
            const cardData = {
                'thin-provisioning': {
                    dismissedObj: { configState: CONFIG_STATES.ACTIVATING }
                },
                autosize: {
                    dismissedObj: { configState: CONFIG_STATES.ACTIVE }
                }
            };

            expect(calculateTotalConfigCount(cardData, false)).toBe(2);
        });

        describe('calculatePostponeInfo', () => {
            it('returns null when configState is not POSTPONED or DISMISSED', () => {
                const cardData = {
                    'thin-provisioning': {
                        dismissedObj: { configState: CONFIG_STATES.ACTIVE }
                    }
                };

                const result = calculatePostponeInfo(cardData, 'thin-provisioning');
                expect(result).toBeNull();
            });

            it('returns info with postpone date and days left for POSTPONED state', () => {
                const now = new Date();
                const futureDate = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000); // 15 days from now
                const pastDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days ago

                const cardData = {
                    'thin-provisioning': {
                        dismissedObj: {
                            configState: CONFIG_STATES.POSTPONED,
                            startTime: pastDate.getTime(),
                            endTime: futureDate.getTime()
                        },
                        block_one: { value: 'Thin Provisioning' }
                    }
                };

                const result = calculatePostponeInfo(cardData, 'thin-provisioning');

                expect(result).not.toBeNull();
                expect(result?.postponeDate).toBeDefined();
                expect(result?.daysLeft).toBeGreaterThan(0);
                expect(result?.configName).toBe('Thin Provisioning');
            });

            it('returns info for DISMISSED state without date calculations', () => {
                const cardData = {
                    'thin-provisioning': {
                        dismissedObj: {
                            configState: CONFIG_STATES.DISMISSED
                        },
                        block_one: { value: 'Thin Provisioning' }
                    }
                };

                const result = calculatePostponeInfo(cardData, 'thin-provisioning');

                expect(result).not.toBeNull();
                expect(result?.postponeDate).toBe('');
                expect(result?.daysLeft).toBe(0);
            });

            it('returns 0 days left when postpone period has expired', () => {
                const now = new Date();
                const pastStartDate = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000); // 35 days ago
                const pastEndDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days ago

                const cardData = {
                    'thin-provisioning': {
                        dismissedObj: {
                            configState: CONFIG_STATES.POSTPONED,
                            startTime: pastStartDate.getTime(),
                            endTime: pastEndDate.getTime()
                        },
                        block_one: { value: 'Thin Provisioning' }
                    }
                };

                const result = calculatePostponeInfo(cardData, 'thin-provisioning');

                expect(result?.daysLeft).toBe(0);
            });

            it('handles missing block_one gracefully', () => {
                const now = new Date();
                const futureDate = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);

                const cardData = {
                    'thin-provisioning': {
                        dismissedObj: {
                            configState: CONFIG_STATES.POSTPONED,
                            startTime: now.getTime(),
                            endTime: futureDate.getTime()
                        }
                    }
                };

                const result = calculatePostponeInfo(cardData, 'thin-provisioning');

                expect(result?.configName).toBe('');
            });
        });

        describe('isTableRowConfigurationInState', () => {
            it('returns false when rowData has no name', () => {
                const rowData = {};
                const cardData = {};

                expect(isTableRowConfigurationInState(rowData, cardData, [CONFIG_STATES.DISMISSED])).toBe(false);
            });

            it('returns true when configuration matches target state via config key', () => {
                const rowData = {
                    name: 'Thin Provisioning',
                    id: 'thin-provisioning'
                };
                const cardData = {
                    'thin-provisioning': {
                        dismissedObj: { configState: CONFIG_STATES.DISMISSED }
                    }
                };

                expect(isTableRowConfigurationInState(rowData, cardData, [CONFIG_STATES.DISMISSED])).toBe(true);
            });

            it('returns true when row dismissed state matches target', () => {
                const rowData = {
                    name: 'Thin Provisioning',
                    dismissedObj: { configState: CONFIG_STATES.POSTPONED }
                };
                const cardData = {};

                expect(isTableRowConfigurationInState(rowData, cardData, [CONFIG_STATES.POSTPONED])).toBe(true);
            });

            it('returns false when configuration does not match any target state', () => {
                const rowData = {
                    name: 'Thin Provisioning',
                    id: 'thin-provisioning'
                };
                const cardData = {
                    'thin-provisioning': {
                        dismissedObj: { configState: CONFIG_STATES.ACTIVE }
                    }
                };

                expect(isTableRowConfigurationInState(rowData, cardData, [CONFIG_STATES.DISMISSED])).toBe(false);
            });

            it('supports multiple target states', () => {
                const rowData = {
                    name: 'Thin Provisioning',
                    id: 'thin-provisioning'
                };
                const cardData = {
                    'thin-provisioning': {
                        dismissedObj: { configState: CONFIG_STATES.POSTPONED }
                    }
                };

                expect(
                    isTableRowConfigurationInState(rowData, cardData, [
                        CONFIG_STATES.DISMISSED,
                        CONFIG_STATES.POSTPONED
                    ])
                ).toBe(true);
            });

            it('uses configKey when id is not present', () => {
                const rowData = {
                    name: 'Thin Provisioning',
                    configKey: 'thin-provisioning'
                };
                const cardData = {
                    'thin-provisioning': {
                        dismissedObj: { configState: CONFIG_STATES.DISMISSED }
                    }
                };

                expect(isTableRowConfigurationInState(rowData, cardData, [CONFIG_STATES.DISMISSED])).toBe(true);
            });
        });

        describe('isTableRowConfigurationActivating', () => {
            it('returns true when configuration is in ACTIVATING state', () => {
                const rowData = {
                    name: 'Thin Provisioning',
                    id: 'thin-provisioning'
                };
                const cardData = {
                    'thin-provisioning': {
                        dismissedObj: { configState: CONFIG_STATES.ACTIVATING }
                    }
                };

                expect(isTableRowConfigurationActivating(rowData, cardData)).toBe(true);
            });

            it('returns false when configuration is not in ACTIVATING state', () => {
                const rowData = {
                    name: 'Thin Provisioning',
                    id: 'thin-provisioning'
                };
                const cardData = {
                    'thin-provisioning': {
                        dismissedObj: { configState: CONFIG_STATES.DISMISSED }
                    }
                };

                expect(isTableRowConfigurationActivating(rowData, cardData)).toBe(false);
            });
        });

        describe('checkAllConfigurationsDismissed', () => {
            it('returns false when cardData is null', () => {
                expect(checkAllConfigurationsDismissed(null)).toBe(false);
            });

            it('returns false when cardData is undefined', () => {
                expect(checkAllConfigurationsDismissed(undefined)).toBe(false);
            });

            it('returns false when no configurations exist', () => {
                const cardData = {
                    deploymentType: 'standalone',
                    isWad: false
                };

                expect(checkAllConfigurationsDismissed(cardData)).toBe(false);
            });

            it('returns false when some configurations are not dismissed', () => {
                const cardData = {
                    'thin-provisioning': {
                        dismissedObj: { configState: CONFIG_STATES.DISMISSED }
                    },
                    autosize: {
                        dismissedObj: { configState: CONFIG_STATES.ACTIVE }
                    }
                };

                expect(checkAllConfigurationsDismissed(cardData)).toBe(false);
            });

            it('returns true when all configurations are dismissed', () => {
                const cardData = {
                    'thin-provisioning': {
                        dismissedObj: { configState: CONFIG_STATES.DISMISSED }
                    },
                    autosize: {
                        dismissedObj: { configState: CONFIG_STATES.DISMISSED }
                    }
                };

                expect(checkAllConfigurationsDismissed(cardData)).toBe(true);
            });

            it('returns true when all configurations are postponed', () => {
                const cardData = {
                    'thin-provisioning': {
                        dismissedObj: { configState: CONFIG_STATES.POSTPONED }
                    },
                    autosize: {
                        dismissedObj: { configState: CONFIG_STATES.POSTPONED }
                    }
                };

                expect(checkAllConfigurationsDismissed(cardData)).toBe(true);
            });

            it('returns true when all configurations are dismissed or postponed', () => {
                const cardData = {
                    'thin-provisioning': {
                        dismissedObj: { configState: CONFIG_STATES.DISMISSED }
                    },
                    autosize: {
                        dismissedObj: { configState: CONFIG_STATES.POSTPONED }
                    }
                };

                expect(checkAllConfigurationsDismissed(cardData)).toBe(true);
            });

            it('skips metadata fields in WA_FLAG_SKIP', () => {
                const cardData = {
                    deploymentType: 'standalone',
                    isWad: false,
                    'thin-provisioning': {
                        dismissedObj: { configState: CONFIG_STATES.DISMISSED }
                    }
                };

                expect(checkAllConfigurationsDismissed(cardData)).toBe(true);
            });
        });
    });
});
