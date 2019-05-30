'use strict';

const fs = require('fs');
const { extract } = require('tar-fs');
const gunzip = require('gunzip-maybe');
const path = require('path');
const pipeStreamsToPromise = require('pipe-streams-to-promise');
const tmp = require('tmp');
const { promisify } = require('util');
const rimraf = require('rimraf');
const fetch = require('node-fetch');
const hasha = require('hasha');
const extractImageDetails = require('./extractImageDetails');
const createRegistryClient = require('./registryClient');
const formatBytes = require('pretty-bytes');
const zlib = require('zlib');

const deleteDir = promisify(rimraf);
const createTempDir = promisify(tmp.dir);

/* eslint-disable no-console */

async function extractArchive(dockerImageTarFile, dest) {
    const readArchiveStream = fs.createReadStream(dockerImageTarFile);
    const extractStream = extract(dest, { dmode: 0o666 });

    return pipeStreamsToPromise([ readArchiveStream, gunzip(), extractStream ]);
}

const chunkSize = 16 * 1024 * 1024;
const readStreamOptions = { highWaterMark: chunkSize };

async function compressLayer(layerPath) {
    if (layerPath.endsWith('.gz')) {
        return layerPath;
    }

    const readStream = fs.createReadStream(layerPath, readStreamOptions);
    const writeSteam = fs.createWriteStream(`${layerPath}.gz`, { encoding: 'binary' });
    const transformStream = zlib.createGzip({ chunkSize });

    await pipeStreamsToPromise([ readStream, transformStream, writeSteam ]);

    return `${layerPath}.gz`;
}

function createReporter(layerId) {
    return function ({ size, done, alreadyExists }) {
        if (!done) {
            console.log(`Layer ${layerId}: uploaded ${formatBytes(size)}.`);
        } else if (alreadyExists) {
            console.log(`Layer ${layerId}: already exists on registry.`);
        } else {
            console.log(`Layer ${layerId}: upload complete.`);
        }
    };
}

async function upload(tempDir, { auth, ssl }) {
    const imageManifest = require(path.join(tempDir, './manifest.json'));
    const imageDetails = extractImageDetails(imageManifest);

    const customFetch = (...args) => {
        if (auth && auth.username && auth.password) {
            if (!args[1]) {
                args[1] = {};
            }

            if (!args[1].headers) {
                args[1].headers = {};
            }

            const header = `Basic ${Buffer.from(`${auth.username}:${auth.password}`).toString('base64')}`;
            args[1].headers.Authorization = header;
        }

        return fetch(...args);
    };

    const registryClient = createRegistryClient(imageDetails, customFetch, { ssl });

    const uploadAllLayerPromises = imageDetails.layers.map(async (relativeLayerPath) => {
        const [ layerId ] = relativeLayerPath.split('/');
        const layerPath = path.join(tempDir, relativeLayerPath);
        const compressedLayerPath = await compressLayer(layerPath);

        console.log('Layer Path:', layerPath);
        console.log('Upload Layer:', compressedLayerPath);
        console.log('Joined Paths', relativeLayerPath);
        console.log('\n');

        const hash = await hasha.fromFile(compressedLayerPath, { algorithm: 'sha256' });
        const digest = `sha256:${hash}`;
        const readStream = fs.createReadStream(compressedLayerPath, readStreamOptions);
        const options = { onProgress: createReporter(layerId) };

        return registryClient.uploadBlob(readStream, digest, options);
    });

    const imageConfigFile = path.join(tempDir, imageDetails.configFile);

    const imageConfigFileHash = await hasha.fromFile(imageConfigFile, { algorithm: 'sha256' });
    const [ imageConfigResult, ...layerResults ] = await Promise.all([
        registryClient.uploadBlob(fs.createReadStream(imageConfigFile), `sha256:${imageConfigFileHash}`),
        ...uploadAllLayerPromises
    ]);

    await registryClient.createImageDistributionManifest(layerResults, imageConfigResult);
}

module.exports = async function main(dockerImageTarFile, { auth, ssl } = {}) {
    const tempDir = await createTempDir();

    try {
        await extractArchive(dockerImageTarFile, tempDir);

        await upload(tempDir, { auth, ssl });

        // eslint-disable-next-line no-console
        console.log('Image successfully uploaded.');
    } finally {
        await deleteDir(tempDir);
    }
};
