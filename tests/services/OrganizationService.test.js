/**
 * @file Tests for OrganizationService
 * @module tests/services/OrganizationService.test.js
 */

import { describe, it, expect, vi } from 'vitest';
import { OrganizationService, PLUGIN_TRACE_LOG_SETTING } from '../../src/services/OrganizationService.js';

describe('OrganizationService', () => {
    describe('getDiagnosticSettings', () => {
        it('should query the organizations set with the diagnostic columns and $top=1', async () => {
            const retrieve = vi.fn().mockResolvedValue({ entities: [] });
            await OrganizationService.getDiagnosticSettings(retrieve);

            expect(retrieve).toHaveBeenCalledWith('organizations', expect.stringContaining('plugintracelogsetting'));
            const query = retrieve.mock.calls[0][1];
            expect(query).toContain('blocktranscriptrecordingforcopilotstudio');
            expect(query).toContain('flowruntimetoliveinseconds');
            expect(query).toContain('$top=1');
        });

        it('should parse a healthy environment (logging Off, recording allowed, 28-day retention)', async () => {
            const retrieve = vi.fn().mockResolvedValue({
                entities: [{
                    organizationid: 'org-1',
                    plugintracelogsetting: 0,
                    blocktranscriptrecordingforcopilotstudio: false,
                    blockaccesstosessiontranscriptsforcopilotstudio: false,
                    flowruntimetoliveinseconds: 2419200
                }]
            });
            const result = await OrganizationService.getDiagnosticSettings(retrieve);

            expect(result.organizationId).toBe('org-1');
            expect(result.pluginTraceLogSetting).toBe(PLUGIN_TRACE_LOG_SETTING.OFF);
            expect(result.transcriptRecordingBlocked).toBe(false);
            expect(result.transcriptAccessBlocked).toBe(false);
            expect(result.flowRunRetentionSeconds).toBe(2419200);
        });

        it('should reflect All-logging, blocked recording, and disabled run retention', async () => {
            const retrieve = vi.fn().mockResolvedValue({
                entities: [{
                    plugintracelogsetting: 2,
                    blocktranscriptrecordingforcopilotstudio: true,
                    blockaccesstosessiontranscriptsforcopilotstudio: true,
                    flowruntimetoliveinseconds: 0
                }]
            });
            const result = await OrganizationService.getDiagnosticSettings(retrieve);

            expect(result.pluginTraceLogSetting).toBe(PLUGIN_TRACE_LOG_SETTING.ALL);
            expect(result.transcriptRecordingBlocked).toBe(true);
            expect(result.transcriptAccessBlocked).toBe(true);
            expect(result.flowRunRetentionSeconds).toBe(0);
        });

        it('should return null/false defaults when the row or columns are missing', async () => {
            const retrieve = vi.fn().mockResolvedValue({ entities: [] });
            const result = await OrganizationService.getDiagnosticSettings(retrieve);

            expect(result.organizationId).toBeNull();
            expect(result.pluginTraceLogSetting).toBeNull();
            expect(result.transcriptRecordingBlocked).toBe(false);
            expect(result.transcriptAccessBlocked).toBe(false);
            expect(result.flowRunRetentionSeconds).toBeNull();
        });
    });

    describe('setPluginTraceLogSetting', () => {
        it('should patch the organization row with the requested level', async () => {
            const update = vi.fn().mockResolvedValue({});
            await OrganizationService.setPluginTraceLogSetting(update, 'org-1', PLUGIN_TRACE_LOG_SETTING.ALL);

            expect(update).toHaveBeenCalledWith('organizations', 'org-1', { plugintracelogsetting: 2 });
        });

        it('should allow turning logging off (value 0 is a real level, not a missing one)', async () => {
            const update = vi.fn().mockResolvedValue({});
            await OrganizationService.setPluginTraceLogSetting(update, 'org-1', PLUGIN_TRACE_LOG_SETTING.OFF);

            expect(update).toHaveBeenCalledWith('organizations', 'org-1', { plugintracelogsetting: 0 });
        });

        it('should throw without writing when the organization id is missing', () => {
            const update = vi.fn();
            expect(() => OrganizationService.setPluginTraceLogSetting(update, null, 1)).toThrow(/Organization ID/);
            expect(update).not.toHaveBeenCalled();
        });

        it('should throw without writing when the level is not a valid option value', () => {
            const update = vi.fn();
            expect(() => OrganizationService.setPluginTraceLogSetting(update, 'org-1', 3)).toThrow(/Invalid plugin trace log setting/);
            expect(() => OrganizationService.setPluginTraceLogSetting(update, 'org-1', '2')).toThrow(/Invalid plugin trace log setting/);
            expect(update).not.toHaveBeenCalled();
        });

        it('should surface a rejected update (e.g. no privilege) to the caller', async () => {
            const update = vi.fn().mockRejectedValue(new Error('Principal lacks prvWriteOrganization'));

            await expect(OrganizationService.setPluginTraceLogSetting(update, 'org-1', 2))
                .rejects.toThrow(/prvWriteOrganization/);
        });
    });
});
