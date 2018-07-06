'use strict';

const parseDockerImageName = require('docker-parse-image');

module.exports = function extractImageDetails(imageManifest) {
    const [ { RepoTags: repositories, Layers: layers, Config: configFile } ] = imageManifest;

    if (repositories.length !== 1) {
        throw new Error(`Unexpected amount of repositories. Got ${repositories.length} but expected 1.`);
    }

    const [ imageName ] = repositories;
    const { registry, tag, repository, namespace } = parseDockerImageName(imageName);

    if (!registry) {
        throw new Error(`No registry defined in image name "${imageName}".`);
    }

    return {
        layers,
        configFile,
        repository: namespace ? `${namespace}/${repository}` : repository,
        tag,
        registry
    };
};
