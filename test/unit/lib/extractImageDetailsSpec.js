'use strict';

const test = require('ava');
const extractImageDetails = require('../../../lib/extractImageDetails');

test('throws an error when the manifest contains more than one repository', (t) => {
    const manifest = [ { RepoTags: [ 1, 2 ] } ];
    const expectedErrorMessage = 'Unexpected amount of repositories. Got 2 but expected 1.';

    const error = t.throws(() => extractImageDetails(manifest), Error);
    t.is(error.message, expectedErrorMessage);
});

test('throws an error when the manifest contains less than one repository', (t) => {
    const manifest = [ { RepoTags: [] } ];
    const expectedErrorMessage = 'Unexpected amount of repositories. Got 0 but expected 1.';

    const error = t.throws(() => extractImageDetails(manifest), Error);
    t.is(error.message, expectedErrorMessage);
});

test('throws an error when the image name doesn’t contain a docker registry host', (t) => {
    const manifest = [ { RepoTags: [ 'foo:bar' ] } ];
    const expectedErrorMessage = 'No registry defined in image name "foo:bar".';

    const error = t.throws(() => extractImageDetails(manifest), Error);
    t.is(error.message, expectedErrorMessage);
});

test('returns all relevant image details', (t) => {
    const manifest = [ {
        RepoTags: [ 'example.com/foo:bar' ],
        Layers: [
            'layer-1/layer.tar',
            'layer-2/layer.tar'
        ],
        Config: 'config.json',
        something: 'not relevant'
    } ];
    const expectedDetails = {
        layers: [
            'layer-1/layer.tar',
            'layer-2/layer.tar'
        ],
        configFile: 'config.json',
        registry: 'example.com',
        repository: 'foo',
        tag: 'bar'
    };

    t.deepEqual(extractImageDetails(manifest), expectedDetails);
});

test('includes the image namespace in the repository name', (t) => {
    const manifest = [ {
        RepoTags: [ 'example.com/myNamespace/foo:bar' ],
        Layers: [ 'layer-1/layer.tar' ],
        Config: 'config.json'
    } ];
    const expectedDetails = {
        layers: [ 'layer-1/layer.tar' ],
        configFile: 'config.json',
        registry: 'example.com',
        repository: 'myNamespace/foo',
        tag: 'bar'
    };

    t.deepEqual(extractImageDetails(manifest), expectedDetails);
});
