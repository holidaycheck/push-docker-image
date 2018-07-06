'use strict';

const { Writable } = require('stream');

async function uploadBlobChunk(endpoint, lastRangeEnd, chunk, fetch) {
    const rangeStart = lastRangeEnd + 1;
    const rangeEnd = rangeStart + chunk.length - 1;
    const headers = {
        'Content-Length': chunk.length,
        'Content-Range': `${rangeStart}-${rangeEnd}`,
        'Content-Type': 'application/octet-stream'
    };

    const response = await fetch(endpoint, { method: 'PATCH', headers, body: chunk });

    if (response.status !== 202) {
        throw new Error('Failed to upload blob chunk.');
    }

    return response.headers.get('Location');
}

module.exports = function createBlobWriteStream(initialUploadUrl, fetch) {
    class BlobWriteStream extends Writable {
        constructor() {
            super({ highWaterMark: 16 * 1024 * 1024 });

            this.lastWrittenIndex = -1;
            this.uploadUrl = initialUploadUrl;
        }

        async _write(chunk, encoding, callback) {
            try {
                this.uploadUrl = await uploadBlobChunk(this.uploadUrl, this.lastWrittenIndex, chunk, fetch);
                this.lastWrittenIndex += chunk.length;
                this.emit('progress', this.lastWrittenIndex + 1);
                callback(null);
            } catch (error) {
                callback(error);
            }
        }
    }

    return new BlobWriteStream();
};
