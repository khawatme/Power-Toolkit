/**
 * @file Service for managing solution layers.
 * @module services/SolutionLayersService
 * @description Provides methods to retrieve solutions, get component layers, and delete layers.
 */

import { WebApiService } from './WebApiService.js';
import { MetadataService } from './MetadataService.js';

/**
 * Service for solution layers operations.
 * @namespace SolutionLayersService
 */
export const SolutionLayersService = {
    /**
     * Retrieve all solutions from the environment.
     * @returns {Promise<Array<object>>} Array of solution objects
     */
    async getSolutions() {
        try {
            const query = '$select=solutionid,friendlyname,uniquename,ismanaged&$filter=isvisible eq true&$orderby=friendlyname asc';
            const result = await WebApiService.webApiFetch(
                'GET',
                'solution',
                query,
                null,
                {},
                MetadataService.getEntitySetName.bind(MetadataService),
                null
            );

            return result.value || [];
        } catch (error) {
            throw new Error(`Failed to retrieve solutions: ${error.message}`);
        }
    },

    /**
     * Get solution components using msdyn_solutioncomponentsummaries
     * @param {string} solutionId - The GUID of the solution
     * @param {string} solutionUniqueName - The unique name of the solution
     * @param {boolean} isManaged - Whether the solution is managed
     * @returns {Promise<Array<object>>} Array of component objects that are part of the solution
     */
    // eslint-disable-next-line max-lines-per-function
    async getSolutionLayers(solutionId, solutionUniqueName, isManaged = false) {
        try {
            let publisherName = 'Unknown Publisher';
            try {
                const solutionQuery = `$select=publisherid&$filter=solutionid eq ${solutionId}&$expand=publisherid($select=friendlyname)`;
                const solutionResult = await WebApiService.webApiFetch(
                    'GET',
                    'solution',
                    solutionQuery,
                    null,
                    {},
                    MetadataService.getEntitySetName.bind(MetadataService),
                    null
                );
                if (solutionResult.value && solutionResult.value.length > 0 && solutionResult.value[0].publisherid) {
                    publisherName = solutionResult.value[0].publisherid.friendlyname || 'Unknown Publisher';
                }
            } catch (_pubError) {
                // Publisher info is optional
            }
            const query = `$filter=(msdyn_solutionid eq ${solutionId})&$orderby=msdyn_name asc`;

            const result = await WebApiService.webApiFetch(
                'GET',
                'msdyn_solutioncomponentsummaries',
                query,
                null,
                {
                    'Prefer': 'odata.include-annotations=*'
                },
                MetadataService.getEntitySetName.bind(MetadataService),
                null
            );

            if (!result.value || result.value.length === 0) {
                return [];
            }

            const components = result.value.map((component) => {
                const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                let displayName = 'Unnamed Component';
                const nameFields = [
                    component.msdyn_displayname,
                    component.msdyn_schemaname,
                    component.msdyn_name,
                    component.msdyn_uniquename,
                    component.msdyn_componentlogicalname
                ];

                for (const field of nameFields) {
                    if (field && !guidPattern.test(field)) {
                        displayName = field;
                        break;
                    }
                }

                if (displayName === 'Unnamed Component' && component.msdyn_componentlogicalname) {
                    displayName = component.msdyn_componentlogicalname;
                }

                return {
                    id: component.msdyn_solutioncomponentsummaryid || component.msdyn_objectid,
                    name: displayName,
                    uniqueName: component.msdyn_uniquename || component.msdyn_schemaname,
                    componentType: component.msdyn_componenttype,
                    componentLogicalName: component.msdyn_componentlogicalname,
                    objectId: component.msdyn_objectid,
                    isManaged: component.msdyn_ismanaged,
                    isCustomizable: component.msdyn_iscustomizable,
                    publisherName: publisherName,
                    // Additional fields from the API
                    displayName: component.msdyn_displayname,
                    schemaName: component.msdyn_schemaname,
                    status: component.msdyn_statusname || 'Active',
                    modifiedOn: component.msdyn_modifiedon,
                    createdOn: component.msdyn_createdon,
                    description: component.msdyn_description,
                    solutionId: component.msdyn_solutionid,
                    solutionIsManaged: isManaged,
                    hasActiveCustomization: component.msdyn_hasactivecustomization,
                    totalLayers: component.msdyn_total,
                    apiComponentTypeName: component.msdyn_componenttypename,
                    msdyn_typename: component.msdyn_typename,
                    msdyn_componentlayerid: component.msdyn_solutioncomponentsummaryid || component.msdyn_objectid,
                    msdyn_name: displayName,
                    msdyn_solutioncomponentname: displayName,
                    msdyn_order: 1,
                    msdyn_solutionname: solutionUniqueName,
                    msdyn_componenttype: component.msdyn_componenttype,
                    msdyn_publishername: publisherName
                };
            });

            // eslint-disable-next-line require-await
            const enhanced = await Promise.all(components.map(async (comp) => {
                const componentForExtraction = {
                    msdyn_componenttype: comp.componentType,
                    msdyn_componenttypename: comp.apiComponentTypeName,
                    msdyn_typename: comp.msdyn_typename
                };
                let typeName = this._extractComponentTypeName(componentForExtraction);
                const displayName = comp.msdyn_name;
                let parentEntityName = null;
                let actualLogicalName = null;

                // Format: entityname.componentname (e.g., "account.accountid")
                if (comp.componentLogicalName && comp.componentLogicalName.includes('.')) {
                    const parts = comp.componentLogicalName.split('.');
                    parentEntityName = parts[0]; // First part is the entity logical name
                    actualLogicalName = parts[1]; // Second part is the actual component logical name
                } else {
                    // If no dot, use the whole thing as logical name
                    actualLogicalName = comp.componentLogicalName;
                }

                const baseTypeName = typeName;

                if (comp.componentType === 1) {
                    actualLogicalName = comp.schemaName || comp.uniqueName || actualLogicalName;
                    if (actualLogicalName && actualLogicalName !== 'entity') {
                        typeName = `Entity (${actualLogicalName})`;
                    }
                } else if (parentEntityName) {
                    typeName = `${typeName} (${parentEntityName})`;
                }

                // Can delete if managed and component type supports RemoveActiveCustomizations
                const canBeDeleted = comp.isManaged && this.canDeleteComponentType(comp.componentType);

                return {
                    ...comp,
                    componentTypeName: typeName,
                    baseComponentTypeName: baseTypeName,
                    msdyn_name: displayName,
                    name: displayName,
                    logicalName: actualLogicalName || comp.componentLogicalName || 'N/A',
                    canBeDeleted: canBeDeleted
                };
            }));
            const entities = enhanced.filter(comp => comp.componentType === 1);
            const childComponents = [];

            for (const entity of entities) {
                try {
                    const entityLogicalName = entity.logicalName;

                    if (!entityLogicalName || entityLogicalName === 'N/A') {
                        continue;
                    }

                    const childQuery = '$filter=(msdyn_solutionid eq ' + solutionId + ') and ' +
                        '((msdyn_componenttype eq 2) or ' +
                        '(msdyn_componenttype eq 24) or ' +
                        '(msdyn_componenttype eq 26 and msdyn_subtype ne \'1024\') or ' +
                        '(msdyn_componenttype eq 60) or ' +
                        '(msdyn_componenttype eq 59)) and ' +
                        '(msdyn_primaryentityname eq \'' + entityLogicalName + '\')';

                    const childResult = await WebApiService.webApiFetch(
                        'GET',
                        'msdyn_solutioncomponentsummaries',
                        childQuery,
                        null,
                        {
                            'Prefer': 'odata.include-annotations=*'
                        },
                        MetadataService.getEntitySetName.bind(MetadataService),
                        null
                    );

                    if (childResult.value && childResult.value.length > 0) {
                        const transformedChildren = childResult.value.map((component) => {
                            const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                            let displayName = 'Unnamed Component';

                            const nameFields = [
                                component.msdyn_displayname,
                                component.msdyn_schemaname,
                                component.msdyn_name,
                                component.msdyn_uniquename,
                                component.msdyn_componentlogicalname
                            ];

                            for (const field of nameFields) {
                                if (field && !guidPattern.test(field)) {
                                    displayName = field;
                                    break;
                                }
                            }

                            if (displayName === 'Unnamed Component' && component.msdyn_componentlogicalname) {
                                displayName = component.msdyn_componentlogicalname;
                            }

                            const baseChildTypeName = this._extractComponentTypeName(component);
                            const typeName = `${baseChildTypeName} (${entityLogicalName})`;

                            return {
                                id: component.msdyn_solutioncomponentsummaryid || component.msdyn_objectid,
                                name: displayName,
                                uniqueName: component.msdyn_uniquename || component.msdyn_schemaname,
                                componentType: component.msdyn_componenttype,
                                componentLogicalName: component.msdyn_componentlogicalname,
                                objectId: component.msdyn_objectid,
                                isManaged: component.msdyn_ismanaged,
                                isCustomizable: component.msdyn_iscustomizable,
                                publisherName: publisherName,
                                displayName: component.msdyn_displayname,
                                schemaName: component.msdyn_schemaname,
                                status: component.msdyn_statusname || 'Active',
                                modifiedOn: component.msdyn_modifiedon,
                                createdOn: component.msdyn_createdon,
                                description: component.msdyn_description,
                                solutionId: component.msdyn_solutionid,
                                solutionIsManaged: isManaged,
                                hasActiveCustomization: component.msdyn_hasactivecustomization,
                                totalLayers: component.msdyn_total,
                                msdyn_componentlayerid: component.msdyn_solutioncomponentsummaryid || component.msdyn_objectid,
                                msdyn_name: displayName,
                                msdyn_solutioncomponentname: displayName,
                                msdyn_order: 1,
                                msdyn_solutionname: solutionUniqueName,
                                msdyn_componenttype: component.msdyn_componenttype,
                                msdyn_publishername: publisherName,
                                componentTypeName: typeName,
                                baseComponentTypeName: baseChildTypeName,
                                logicalName: component.msdyn_schemaname || component.msdyn_componentlogicalname || 'N/A',
                                canBeDeleted: component.msdyn_ismanaged && this.canDeleteComponentType(component.msdyn_componenttype)
                            };
                        });

                        childComponents.push(...transformedChildren);
                    }
                } catch (_childError) {
                    // Continue with other entities
                }
            }
            const allComponents = [...enhanced, ...childComponents];

            return allComponents;

        } catch (error) {
            throw new Error(`Failed to retrieve solution components: ${error.message}`);
        }
    },

    /**
     * Get the proper component type name from API response.
     * @param {object} component - The component record from API
     * @returns {string} The component type name
     * @private
     */
    _extractComponentTypeName(component) {
        const componentType = component.msdyn_componenttype;
        let typeName = component.msdyn_componenttypename;

        if (componentType === 60 || componentType === 24) {
            typeName = 'Form';
        } else if (componentType === 26) {
            typeName = 'View';
        } else if (componentType === 2) {
            typeName = 'Attribute';
        } else if (componentType === 59) {
            typeName = 'Chart';
        } else if (!typeName || typeName.startsWith('Customization.Type_')) {
            if (typeName && typeName.startsWith('Customization.Type_')) {
                typeName = typeName.replace('Customization.Type_', '');
            } else {
                typeName = `Type ${componentType}`;
            }
        }

        return typeName;
    },

    /**
     * Delete a component layer by removing active customizations.
     * @param {string} componentId - The GUID of the component (objectId)
     * @param {number} componentType - The component type code
     * @returns {Promise<void>}
     */
    async deleteLayer(componentId, componentType) {
        try {
            const solutionComponentName = this._getSolutionComponentName(componentType);

            if (!solutionComponentName) {
                throw new Error(`Component type ${componentType} does not support RemoveActiveCustomizations. Only metadata components like Entity, Attribute, SystemForm, SavedQuery, and WebResource can be removed.`);
            }
            const actionUrl = `RemoveActiveCustomizations(SolutionComponentName='${solutionComponentName}',ComponentId=${componentId})`;

            await WebApiService.webApiFetch(
                'GET',
                actionUrl,
                '',
                null,
                {},
                MetadataService.getEntitySetName.bind(MetadataService),
                null
            );
        } catch (error) {
            throw new Error(`Failed to delete layer: ${error.message}`);
        }
    },

    /**
     * Get the SolutionComponentName (API entity name) for a component type.
     * Note: RemoveActiveCustomizations only supports certain metadata component types.
     * @param {number} componentType - The component type code
     * @returns {string|null} The solution component name or null if not supported
     * @private
     */
    _getSolutionComponentName(componentType) {
        const componentNameMap = {
            1: 'Entity',
            2: 'Attribute',
            3: 'Relationship',
            4: 'AttributePicklistValue',
            7: 'LocalizedLabel',
            9: 'OptionSet',
            10: 'EntityRelationship',
            20: 'Role',
            21: 'RolePrivilege',
            24: 'SystemForm',
            26: 'SavedQuery',
            29: 'Workflow',
            60: 'SystemForm',
            61: 'WebResource',
            62: 'SiteMap',
            66: 'CustomControl',
            70: 'FieldSecurityProfile',
            71: 'FieldPermission',
            90: 'PluginType',
            91: 'PluginAssembly',
            92: 'SdkMessageProcessingStep',
            371: 'Connector',
            372: 'Connector',
            380: 'EnvironmentVariableDefinition',
            381: 'EnvironmentVariableValue',
            402: 'AIConfiguration',
            10021: 'AppModule'
        };

        return componentNameMap[componentType] || null;
    },

    /**
     * Check if a component type supports RemoveActiveCustomizations.
     * @param {number} componentType - The component type code
     * @returns {boolean} True if the component type can be deleted
     */
    canDeleteComponentType(componentType) {
        return this._getSolutionComponentName(componentType) !== null;
    }
};
