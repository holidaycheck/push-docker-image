'use strict';

const fetch = require('node-fetch');

module.exports = function createCustomFetch({ username, password } = {}) {
    // eslint-disable-next-line complexity
    return function (url, options = {}) {
        if (username && password) {
            const basic = Buffer.from(`${username}:${password}`).toString('base64');
            const authHeader = { Authorization: `Basic ${basic}` };

            if (!options.headers) {
                Object.assign(options, { headers: {} });
            }

            Object.assign(options.headers, authHeader);
        }

        return fetch(url, options);
    };
};
