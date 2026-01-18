/**
 * @file Tests for EntityContextResolver utility
 * @module tests/utils/resolvers/EntityContextResolver
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EntityContextResolver } from '../../../src/utils/resolvers/EntityContextResolver.js';
import { DataService } from '../../../src/services/DataService.js';

vi.mock('../../../src/services/DataService.js');

describe('EntityContextResolver', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        EntityContextResolver._attrCache.clear();
    });

    describe('resolve', () => {
        it('should resolve entity set name and logical name from input', async () => {
            const mockEntityDef = {
                EntitySetName: 'accounts',
                LogicalName: 'account'
            };
            vi.mocked(DataService.getEntityByAny).mockResolvedValue(mockEntityDef);

            const result = await EntityContextResolver.resolve('account');

            expect(result).toEqual({
                entitySet: 'accounts',
                logicalName: 'account'
            });
            expect(DataService.getEntityByAny).toHaveBeenCalledWith('account');
        });

        it('should resolve from entity set name', async () => {
            const mockEntityDef = {
                EntitySetName: 'contacts',
                LogicalName: 'contact'
            };
            vi.mocked(DataService.getEntityByAny).mockResolvedValue(mockEntityDef);

            const result = await EntityContextResolver.resolve('contacts');

            expect(result).toEqual({
                entitySet: 'contacts',
                logicalName: 'contact'
            });
        });

        it('should throw error when entity cannot be resolved', async () => {
            vi.mocked(DataService.getEntityByAny).mockResolvedValue(null);

            await expect(EntityContextResolver.resolve('invalidEntity'))
                .rejects.toThrow("Could not resolve entity for 'invalidEntity'");
        });

        it('should handle different entity types', async () => {
            const mockEntityDef = {
                EntitySetName: 'systemusers',
                LogicalName: 'systemuser'
            };
            vi.mocked(DataService.getEntityByAny).mockResolvedValue(mockEntityDef);

            const result = await EntityContextResolver.resolve('systemuser');

            expect(result).toEqual({
                entitySet: 'systemusers',
                logicalName: 'systemuser'
            });
        });
    });

    describe('getAttrMap', () => {
        it('should fetch and cache attribute map', async () => {
            const mockAttrMap = new Map([
                ['name', { type: 'string' }],
                ['ownerid', { type: 'lookup', targets: ['systemuser'] }]
            ]);
            vi.mocked(DataService.getAttributeMap).mockResolvedValue(mockAttrMap);

            const result = await EntityContextResolver.getAttrMap('account');

            expect(result).toBe(mockAttrMap);
            expect(DataService.getAttributeMap).toHaveBeenCalledWith('account');
            expect(DataService.getAttributeMap).toHaveBeenCalledTimes(1);
        });

        it('should return cached attribute map on subsequent calls', async () => {
            const mockAttrMap = new Map([
                ['name', { type: 'string' }]
            ]);
            vi.mocked(DataService.getAttributeMap).mockResolvedValue(mockAttrMap);

            const result1 = await EntityContextResolver.getAttrMap('account');
            const result2 = await EntityContextResolver.getAttrMap('account');

            expect(result1).toBe(result2);
            expect(DataService.getAttributeMap).toHaveBeenCalledTimes(1);
        });

        it('should maintain separate caches for different entities', async () => {
            const accountMap = new Map([['accountname', { type: 'string' }]]);
            const contactMap = new Map([['fullname', { type: 'string' }]]);

            vi.mocked(DataService.getAttributeMap)
                .mockResolvedValueOnce(accountMap)
                .mockResolvedValueOnce(contactMap);

            const result1 = await EntityContextResolver.getAttrMap('account');
            const result2 = await EntityContextResolver.getAttrMap('contact');

            expect(result1).toBe(accountMap);
            expect(result2).toBe(contactMap);
            expect(DataService.getAttributeMap).toHaveBeenCalledTimes(2);
        });
    });

    describe('invalidate', () => {
        it('should remove cached attribute map for specified entity', async () => {
            const mockAttrMap = new Map([['name', { type: 'string' }]]);
            vi.mocked(DataService.getAttributeMap).mockResolvedValue(mockAttrMap);

            await EntityContextResolver.getAttrMap('account');
            expect(DataService.getAttributeMap).toHaveBeenCalledTimes(1);

            EntityContextResolver.invalidate('account');

            await EntityContextResolver.getAttrMap('account');
            expect(DataService.getAttributeMap).toHaveBeenCalledTimes(2);
        });

        it('should only invalidate specified entity cache', async () => {
            const accountMap = new Map([['accountname', { type: 'string' }]]);
            const contactMap = new Map([['fullname', { type: 'string' }]]);

            vi.mocked(DataService.getAttributeMap)
                .mockResolvedValueOnce(accountMap)
                .mockResolvedValueOnce(contactMap)
                .mockResolvedValueOnce(accountMap);

            await EntityContextResolver.getAttrMap('account');
            await EntityContextResolver.getAttrMap('contact');
            
            EntityContextResolver.invalidate('account');
            
            await EntityContextResolver.getAttrMap('account');
            await EntityContextResolver.getAttrMap('contact');

            expect(DataService.getAttributeMap).toHaveBeenCalledTimes(3);
        });

        it('should handle invalidating non-existent cache', () => {
            expect(() => EntityContextResolver.invalidate('nonExistentEntity')).not.toThrow();
        });
    });

    describe('cache behavior', () => {
        it('should use Map for cache storage', () => {
            expect(EntityContextResolver._attrCache).toBeInstanceOf(Map);
        });

        it('should allow manual cache inspection', async () => {
            const mockAttrMap = new Map([['name', { type: 'string' }]]);
            vi.mocked(DataService.getAttributeMap).mockResolvedValue(mockAttrMap);

            await EntityContextResolver.getAttrMap('account');

            expect(EntityContextResolver._attrCache.has('account')).toBe(true);
            expect(EntityContextResolver._attrCache.get('account')).toBe(mockAttrMap);
        });
    });
});
