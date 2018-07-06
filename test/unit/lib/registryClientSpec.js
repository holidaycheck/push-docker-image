'use strict';

const test = require('ava');
const sinon = require('sinon');
const noop = require('noop3');

const { Readable } = require('stream');
const { Headers } = require('node-fetch');
const createRegistryClient = require('../../../lib/registryClient');

const imageDetails = {
    registry: 'example.com',
    repository: 'any-repo'
};

test('checks for existing blob', async (t) => {
    const fetch = sinon.stub().resolves({ status: 200 });

    const client = createRegistryClient(imageDetails, fetch);
    const readStream = new Readable();

    await client.uploadBlob(readStream, 'anyDigest').catch(noop);

    t.true(fetch.calledOnce);

    const [ url, options ] = fetch.firstCall.args;

    t.is(url, 'http://example.com/v2/any-repo/blobs/anyDigest');
    t.deepEqual(options, { method: 'HEAD' });
});

test('doesn’t upload anything and returns size from the content-length header when blob exists', async (t) => {
    const headers = new Headers({ 'Content-Length': 42 });
    const fetch = sinon.stub().resolves({ status: 200, headers });

    const client = createRegistryClient(imageDetails, fetch);
    const readStream = new Readable();

    const result = await client.uploadBlob(readStream, 'anyDigest').catch(noop);

    t.is(fetch.callCount, 1);
    t.deepEqual(result, { size: 42, digest: 'anyDigest' });
});

test('initiates a chunked blob upload correctly', async (t) => {
    const fetch = sinon.stub().resolves({ status: 418 });

    const client = createRegistryClient(imageDetails, fetch);
    const readStream = new Readable();

    await client.uploadBlob(readStream, 'anyDigest').catch(noop);

    t.is(fetch.callCount, 2);

    const [ url, options ] = fetch.secondCall.args;

    t.is(url, 'http://example.com/v2/any-repo/blobs/uploads/');
    t.deepEqual(options, { method: 'POST' });
});

test('rejects when the response status for initiating the upload is not 202', async (t) => {
    const fetch = sinon.stub().resolves({ status: 418 });

    const client = createRegistryClient(imageDetails, fetch);
    const readStream = new Readable();

    const error = await t.throws(client.uploadBlob(readStream, 'anyDigest'), Error);
    t.is(error.message, 'Failed to initiate blob upload to http://example.com.');
});

test('uses the URL from the Location header of the initiate response for subsequent requests', async (t) => {
    const fetch = sinon.stub();

    fetch.onFirstCall().resolves({ status: 404 });

    const responseHeaders = new Headers({ Location: 'http://example.com/foo/bar' });
    fetch.onSecondCall().resolves({ status: 202, headers: responseHeaders });

    fetch.onThirdCall().resolves({ status: 418 });

    const client = createRegistryClient(imageDetails, fetch);
    const readStream = new Readable();

    readStream.push('foo');
    readStream.push(null);

    await client.uploadBlob(readStream, 'anyDigest').catch(noop);

    t.is(fetch.callCount, 3);

    const [ url ] = fetch.thirdCall.args;
    t.is(url, 'http://example.com/foo/bar');
});

test('finalizes an upload after all chunks haven been uploaded', async (t) => {
    const fetch = sinon.stub();

    fetch.onFirstCall().resolves({ status: 404 });

    const responseHeaders = new Headers({ Location: '/foo/bar' });
    fetch.onSecondCall().resolves({ status: 202, headers: responseHeaders });

    const uploadResponseHeaders = new Headers({ Location: 'http://example.com/foo/bar?a=b' });
    fetch.onThirdCall().resolves({ status: 202, headers: uploadResponseHeaders });
    fetch.onCall(3).resolves({ status: 418 });

    const client = createRegistryClient(imageDetails, fetch);
    const readStream = new Readable();

    readStream.push('foo');
    readStream.push(null);

    await client.uploadBlob(readStream, 'anyDigest').catch(noop);

    t.is(fetch.callCount, 4);

    const [ fourthCallUrl, fourthCallOptions ] = fetch.lastCall.args;

    const expectedDigiest = 'anyDigest';
    t.is(fourthCallUrl, `http://example.com/foo/bar?a=b&digest=${encodeURIComponent(expectedDigiest)}`);

    t.deepEqual(fourthCallOptions, { method: 'PUT', headers: { 'Content-Length': 0 } });
});

test('rejects an error when the finialize response status is not 201', async (t) => {
    const fetch = sinon.stub();

    const responseHeaders = new Headers({ Location: '/foo/bar' });
    fetch.onFirstCall().resolves({ status: 404 });
    fetch.onSecondCall().resolves({ status: 202, headers: responseHeaders });

    fetch.onThirdCall().resolves({ status: 202, headers: responseHeaders });
    fetch.onCall(3).resolves({ status: 418 });

    const client = createRegistryClient(imageDetails, fetch);
    const readStream = new Readable();

    readStream.push('foo');
    readStream.push(null);

    const error = await t.throws(client.uploadBlob(readStream, 'anyDigest'), Error);

    t.is(error.message, 'Failed to complete blob upload to http://example.com.');
});

test('does a complete upload and resolves with the digest and size', async (t) => {
    const fetch = sinon.stub();

    const responseHeaders = new Headers({ Location: 'http://example.com/foo/bar' });
    fetch.onFirstCall().resolves({ status: 404 });
    fetch.onSecondCall().resolves({ status: 202, headers: responseHeaders });

    fetch.onThirdCall().resolves({ status: 202, headers: responseHeaders });
    fetch.onCall(3).resolves({ status: 201, headers: responseHeaders });

    const client = createRegistryClient(imageDetails, fetch);
    const readStream = new Readable();

    readStream.push('foo');
    readStream.push(null);

    const result = await client.uploadBlob(readStream, 'anyDigest');

    t.deepEqual(result, {
        digest: 'anyDigest',
        size: 3
    });
});

test('calls the onProgress callback for each uploaded chunk and on completion', async (t) => {
    const fetch = sinon.stub();
    const onProgress = sinon.stub();

    fetch.onFirstCall().resolves({ status: 404 });

    const responseHeaders = new Headers({ Location: 'http://example.com/foo/bar' });
    fetch.onSecondCall().resolves({ status: 202, headers: responseHeaders });

    fetch.onThirdCall().resolves({ status: 202, headers: responseHeaders });
    fetch.onCall(3).resolves({ status: 202, headers: responseHeaders });
    fetch.onCall(4).resolves({ status: 201, headers: responseHeaders });

    const client = createRegistryClient(imageDetails, fetch);
    const readStream = new Readable();

    readStream.push('foo');
    readStream.push('bar');
    readStream.push(null);

    await client.uploadBlob(readStream, 'anyDigest', { onProgress });

    t.is(onProgress.callCount, 3);
    t.deepEqual(onProgress.firstCall.args, [ { size: 3, done: false, alreadyExists: false } ]);
    t.deepEqual(onProgress.secondCall.args, [ { size: 6, done: false, alreadyExists: false } ]);
    t.deepEqual(onProgress.thirdCall.args, [ { size: 6, done: true, alreadyExists: false } ]);
});

test('calls the onProgress callback immediately when blob already exists', async (t) => {
    const headers = new Headers({ 'Content-Length': 42 });
    const fetch = sinon.stub().resolves({ status: 200, headers });

    const client = createRegistryClient(imageDetails, fetch);
    const readStream = new Readable();

    const onProgress = sinon.stub();
    await client.uploadBlob(readStream, 'anyDigest', { onProgress }).catch(noop);

    t.is(onProgress.callCount, 1);
    t.deepEqual(onProgress.firstCall.args, [ { size: 42, done: true, alreadyExists: true } ]);
});
