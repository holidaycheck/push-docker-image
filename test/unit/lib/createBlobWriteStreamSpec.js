'use strict';

const test = require('ava');
const sinon = require('sinon');

const { Readable } = require('stream');
const { Headers } = require('node-fetch');
const pipeStreamsToPromise = require('pipe-streams-to-promise');
const createBlobWriteStream = require('../../../lib/createBlobWriteStream');

test('rejects an error when the response status is not 202', async (t) => {
    const fetch = sinon.stub().resolves({ status: 418 });

    const readStream = new Readable();
    const writeStream = createBlobWriteStream('', fetch);
    const promise = pipeStreamsToPromise([ readStream, writeStream ]);

    readStream.push('foo');
    readStream.push(null);

    await t.throws(promise);
});

test('makes an upload request for a single chunk', async (t) => {
    const headers = new Headers({ Location: '' });
    const fetch = sinon.stub().resolves({ status: 202, headers });

    const readStream = new Readable();
    const writeStream = createBlobWriteStream('http://example.com/upload-endpoint', fetch);
    const promise = pipeStreamsToPromise([ readStream, writeStream ]);

    readStream.push('foo');
    readStream.push(null);

    await promise;

    t.true(fetch.calledOnce);

    const [ calledEndpoint, options ] = fetch.firstCall.args;

    t.is(calledEndpoint, 'http://example.com/upload-endpoint');
    t.deepEqual(options, {
        method: 'PATCH',
        headers: {
            'Content-Length': 3,
            'Content-Range': '0-2',
            'Content-Type': 'application/octet-stream'
        },
        body: Buffer.from('foo')
    });
});

test('makes sequential upload requests for multiple chunks in the correct order', async (t) => {
    const headers = new Headers({ Location: 'http://example.com/other-upload-endpoint' });
    const fetch = sinon.stub().resolves({ status: 202, headers });

    const readStream = new Readable();
    const writeStream = createBlobWriteStream('http://example.com/upload-endpoint', fetch);
    const promise = pipeStreamsToPromise([ readStream, writeStream ]);

    readStream.push('foo');
    readStream.push('bar');
    readStream.push('baz');
    readStream.push(null);

    await promise;

    t.true(fetch.calledThrice);

    const [ firstCallEndpoint, firstCallOptions ] = fetch.firstCall.args;
    const [ secondCallEndpoint, secondCallOptions ] = fetch.secondCall.args;
    const [ , thirdCallOptions ] = fetch.thirdCall.args;

    t.is(firstCallEndpoint, 'http://example.com/upload-endpoint');
    t.deepEqual(firstCallOptions, {
        method: 'PATCH',
        headers: {
            'Content-Length': 3,
            'Content-Range': '0-2',
            'Content-Type': 'application/octet-stream'
        },
        body: Buffer.from('foo')
    });

    t.is(secondCallEndpoint, 'http://example.com/other-upload-endpoint');
    t.deepEqual(secondCallOptions, {
        method: 'PATCH',
        headers: {
            'Content-Length': 3,
            'Content-Range': '3-5',
            'Content-Type': 'application/octet-stream'
        },
        body: Buffer.from('bar')
    });

    t.deepEqual(thirdCallOptions, {
        method: 'PATCH',
        headers: {
            'Content-Length': 3,
            'Content-Range': '6-8',
            'Content-Type': 'application/octet-stream'
        },
        body: Buffer.from('baz')
    });
});
