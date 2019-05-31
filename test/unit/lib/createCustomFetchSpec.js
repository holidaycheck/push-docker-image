'use strict';

const test = require('ava');
const http = require('http');
const listen = require('test-listen');
const createCustomFetch = require('../../../lib/createCustomFetch');

async function customFetchMacro(t, { customFetchOptions, headers, expectedResult }) {
    const server = http.createServer((req, res) => {
        res.end(req.headers.authorization);
    });

    const url = await listen(server);

    const fetch = createCustomFetch(customFetchOptions);
    const response = await fetch(url, headers ? { headers } : undefined);
    const result = Boolean(await response.text());

    server.close();

    t.is(result, expectedResult);
}

test('has auth', customFetchMacro, {
    customFetchOptions: { username: 'test', password: 'test' },
    expectedResult: true
});

test('has no auth', customFetchMacro, {
    expectedResult: false
});

test('has auth with header', customFetchMacro, {
    customFetchOptions: { username: 'test', password: 'test' },
    headers: { 'x-test': 1 },
    expectedResult: true
});

test('has no auth with header', customFetchMacro, {
    headers: { 'x-test': 1 },
    expectedResult: false
});
