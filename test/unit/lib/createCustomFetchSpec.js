'use strict';

const test = require('ava');
const http = require('http');
const createCustomFetch = require('../../../lib/createCustomFetch');

test('verify auth header', async (t) => {
    const port = 3000;

    const server = http.createServer((req, res) => {
        res.end(req.headers.authorization);
    });

    server.listen(port);

    const hasAuth = await new Promise(async (resolve) => {
        const fetch = createCustomFetch({ username: 'test', password: 'test' });
        const res = await fetch(`http://localhost:${port}`);
        resolve(Boolean(await res.text()));
    });

    const hasNoAuth = await new Promise(async (resolve) => {
        const fetch = createCustomFetch();
        const res = await fetch(`http://localhost:${port}`);
        resolve(Boolean(await res.text()));
    });

    const hasAuthWithHeader = await new Promise(async (resolve) => {
        const fetch = createCustomFetch({ username: 'test', password: 'test' });
        const res = await fetch(`http://localhost:${port}`, { headers: { 'x-test': 1 } });
        resolve(Boolean(await res.text()));
    });

    const hasNoAuthWithHeader = await new Promise(async (resolve) => {
        const fetch = createCustomFetch();
        const res = await fetch(`http://localhost:${port}`, { headers: { 'x-test': 1 } });
        resolve(Boolean(await res.text()));
    });

    server.close();

    t.is(hasAuth, true);
    t.is(hasNoAuth, false);
    t.is(hasAuthWithHeader, true);
    t.is(hasNoAuthWithHeader, false);
});
