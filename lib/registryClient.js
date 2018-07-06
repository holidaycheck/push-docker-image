'use strict';

const noop = require('noop3');
const url = require('url');
const R = require('ramda');
const pipeStreamsToPromise = require('pipe-streams-to-promise');

const createBlobWriteStream = require('./createBlobWriteStream');
const buildDistributionManifest = require('./buildDistributionManifest');

module.exports = function createRegistryClient(imageDetails, fetch) {
    const registryUrl = `http://${imageDetails.registry}`;
    const { repository, tag } = imageDetails;

    async function initiateBlobUpload() {
        const startUploadEndpoint = `${registryUrl}/v2/${repository}/blobs/uploads/`;

        const response = await fetch(startUploadEndpoint, { method: 'POST' });

        if (response.status !== 202) {
            throw new Error(`Failed to initiate blob upload to ${registryUrl}.`);
        }

        return response.headers.get('Location');
    }

    async function finalizeChunkedUpload(endpoint, digest) {
        const headers = { 'Content-Length': 0 };
        const parsedEndpointUrl = R.dissoc('search', url.parse(endpoint, true));
        const endpointWithDigest = url.format(R.assocPath([ 'query', 'digest' ], digest, parsedEndpointUrl));

        const response = await fetch(endpointWithDigest, { method: 'PUT', headers });

        if (response.status !== 201) {
            throw new Error(`Failed to complete blob upload to ${registryUrl}.`);
        }
    }

    async function fetchExistingBlobDetails(digest) {
        const endpoint = `${registryUrl}/v2/${repository}/blobs/${digest}`;

        const response = await fetch(endpoint, { method: 'HEAD' });

        if (response.status === 200) {
            return {
                size: parseInt(response.headers.get('content-length'), 10)
            };
        }

        return null;
    }

    return {
        // eslint-disable-next-line max-statements
        async uploadBlob(readStream, digest, { onProgress = noop } = {}) {
            const existingBlob = await fetchExistingBlobDetails(digest);

            if (existingBlob) {
                onProgress({ size: existingBlob.size, done: true, alreadyExists: true });
                return { digest, size: existingBlob.size };
            }

            const uploadBlobEndpoint = await initiateBlobUpload();
            const writeStream = createBlobWriteStream(uploadBlobEndpoint, fetch);
            let size = 0;

            writeStream.on('progress', (currentSize) => {
                size = currentSize;
                onProgress({ size, done: false, alreadyExists: false });
            });

            await pipeStreamsToPromise([ readStream, writeStream ]);

            await finalizeChunkedUpload(writeStream.uploadUrl, digest);

            onProgress({ size, done: true, alreadyExists: false });

            return { digest, size };
        },

        async createImageDistributionManifest(layerResults, imageConfigResult) {
            const imageDistibutionManifest = buildDistributionManifest(layerResults, imageConfigResult);
            const headers = { 'Content-Type': imageDistibutionManifest.mediaType };
            const options = { method: 'PUT', headers, body: JSON.stringify(imageDistibutionManifest) };
            const endpoint = `${registryUrl}/v2/${repository}/manifests/${tag}`;

            const response = await fetch(endpoint, options);

            if (response.status !== 201) {
                throw new Error('Failed to push image distribution manifest.');
            }
        }
    };
};
