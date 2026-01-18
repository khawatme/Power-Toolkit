/**
 * Service for uploading files to Dataverse file columns using the proper chunked upload API.
 * @module services/FileUploadService
 */

import { NotificationService } from './NotificationService.js';
import { Config } from '../constants/index.js';

/**
 * Maximum block size for chunked file uploads (4MB).
 * Dataverse API requires files larger than 128MB to be uploaded in chunks.
 * @constant {number}
 */
const UPLOAD_BLOCK_SIZE_BYTES = 4 * 1024 * 1024;

export class FileUploadService {
    /**
     * Upload a file to a file column using the Dataverse file upload API.
     * @param {string} entityLogicalName - Entity logical name
     * @param {string} entityId - Record ID
     * @param {string} fileAttributeName - File column logical name
     * @param {string} base64Data - Base64 encoded file data
     * @param {string} fileName - File name
     * @param {string} mimeType - MIME type
     * @returns {Promise<{FileId: string, FileSizeInBytes: number}>}
     */
    static async uploadFile(entityLogicalName, entityId, fileAttributeName, base64Data, fileName, mimeType) {
        try {
            // Initialize file blocks upload
            const initPayload = {
                Target: {
                    [`${entityLogicalName}id`]: entityId,
                    '@odata.type': `Microsoft.Dynamics.CRM.${entityLogicalName}`
                },
                FileAttributeName: fileAttributeName,
                FileName: fileName
            };

            const initResponse = await this._callAction('InitializeFileBlocksUpload', initPayload);
            const fileContinuationToken = initResponse.FileContinuationToken;

            // Upload file in blocks (4MB chunks)
            const blockIds = await this._uploadBlocks(base64Data, fileContinuationToken);

            // Commit the upload
            const commitPayload = {
                FileName: fileName,
                MimeType: mimeType || 'application/octet-stream',
                BlockList: blockIds,
                FileContinuationToken: fileContinuationToken
            };

            const commitResponse = await this._callAction('CommitFileBlocksUpload', commitPayload);

            NotificationService.show(`File "${fileName}" uploaded successfully (${this._formatFileSize(commitResponse.FileSizeInBytes)})`, 'success');

            return commitResponse;
        } catch (error) {
            console.error('[FileUploadService] Upload failed:', error);
            throw error;
        }
    }

    /**
     * Call a Dataverse unbound action using direct POST.
     * @private
     * @param {string} actionName - Action name
     * @param {object} parameters - Action parameters
     * @returns {Promise<any>}
     */
    static async _callAction(actionName, parameters) {
        const globalContext = window.Xrm?.Utility?.getGlobalContext?.() || window.parent?.Xrm?.Utility?.getGlobalContext?.();
        if (!globalContext) {
            throw new Error('Unable to get global context');
        }

        const baseUrl = `${globalContext.getClientUrl()}/api/data/v9.2`;
        const url = `${baseUrl}/${actionName}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                ...Config.WEB_API_HEADERS.STANDARD
            },
            body: JSON.stringify(parameters)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Action ${actionName} failed: ${errorText}`);
        }

        const text = await response.text();
        return text ? JSON.parse(text) : {};
    }

    /**
     * Upload file data in 4MB blocks.
     * @private
     * @param {string} base64Data - Base64 encoded file data
     * @param {string} fileContinuationToken - Upload session token
     * @returns {Promise<string[]>} Array of block IDs
     * @throws {Error} If any block upload fails
     */
    static async _uploadBlocks(base64Data, fileContinuationToken) {
        const blockIds = [];
        const blockSize = UPLOAD_BLOCK_SIZE_BYTES;

        const binaryData = this._base64ToUint8Array(base64Data);
        const totalBytes = binaryData.length;

        let offset = 0;

        try {
            while (offset < totalBytes) {
                const remainingBytes = totalBytes - offset;
                const currentBlockSize = Math.min(blockSize, remainingBytes);

                const blockBytes = binaryData.subarray(offset, offset + currentBlockSize);
                const blockData = this._uint8ArrayToBase64(blockBytes);

                const blockId = this._uint8ArrayToBase64(this._stringToUint8Array(this._generateGuid()));
                blockIds.push(blockId);

                const uploadPayload = {
                    BlockId: blockId,
                    BlockData: blockData,
                    FileContinuationToken: fileContinuationToken
                };

                await this._callAction('UploadBlock', uploadPayload);

                offset += currentBlockSize;
            }

            return blockIds;
        } catch (error) {
            const errorMsg = `File upload failed at block ${blockIds.length + 1}: ${error.message}`;
            NotificationService.show(errorMsg, 'error');
            console.error('[FileUploadService] Block upload failed:', error);
            throw new Error(errorMsg);
        }
    }

    /**
     * Convert base64 string to Uint8Array efficiently.
     * @private
     * @param {string} base64 - Base64 encoded string
     * @returns {Uint8Array} Binary data as Uint8Array
     */
    static _base64ToUint8Array(base64) {
        const binaryString = window.atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    }

    /**
     * Convert Uint8Array to base64 string efficiently.
     * @private
     * @param {Uint8Array} bytes - Binary data
     * @returns {string} Base64 encoded string
     */
    static _uint8ArrayToBase64(bytes) {
        let binaryString = '';
        const chunkSize = 8192;

        // Process in chunks to avoid call stack size exceeded errors with large files
        for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
            binaryString += String.fromCharCode(...chunk);
        }

        return window.btoa(binaryString);
    }

    /**
     * Convert string to Uint8Array.
     * @private
     * @param {string} str - String to convert
     * @returns {Uint8Array} Binary representation
     */
    static _stringToUint8Array(str) {
        const bytes = new Uint8Array(str.length);
        for (let i = 0; i < str.length; i++) {
            bytes[i] = str.charCodeAt(i) & 0xFF;
        }
        return bytes;
    }

    /**
     * Generate a GUID for block IDs.
     * @private
     */
    static _generateGuid() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    /**
     * Format file size for display.
     * @private
     */
    static _formatFileSize(bytes) {
        if (bytes === 0) {
            return '0 Bytes';
        }
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }
}
