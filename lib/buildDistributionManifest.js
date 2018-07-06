'use strict';

function buildLayer({ size, digest }) {
    return {
        mediaType: 'application/vnd.docker.image.rootfs.diff.tar.gzip',
        size,
        digest
    };
}

module.exports = function buildDistributionManifest(layers, config) {
    return {
        schemaVersion: 2,
        mediaType: 'application/vnd.docker.distribution.manifest.v2+json',
        config: {
            mediaType: 'application/vnd.docker.container.image.v1+json',
            size: config.size,
            digest: config.digest
        },
        layers: layers.map(buildLayer)
    };
};
