[![NPM Version](https://img.shields.io/npm/v/push-docker-image.svg?style=flat)](https://www.npmjs.org/package/push-docker-image)
[![Build Status](https://img.shields.io/travis/holidaycheck/push-docker-image/master.svg?style=flat)](https://travis-ci.org/holidaycheck/push-docker-image)
[![Coverage Status](https://img.shields.io/coveralls/holidaycheck/push-docker-image/master.svg?style=flat)](https://coveralls.io/r/holidaycheck/push-docker-image)
[![NPM Downloads](https://img.shields.io/npm/dm/push-docker-image.svg?style=flat)](https://www.npmjs.org/package/push-docker-image)
# push-docker-image

Push docker image `.tar.gz` files to a docker registry.

This tool is only compatible with:

* images following the [docker image spec v1.2](https://github.com/moby/moby/blob/5072b22c5fea93f00917c8c5d6a29d782db2bb73/image/spec/v1.2.md#combined-image-json--filesystem-changeset-format)
* registries that support the [registry API v2](https://docs.docker.com/registry/spec/api/)

This tool accepts a path to a docker image stored as a `.tar.gz` file following the [`Combined Image JSON + Filesystem Changeset Format` of the docker image specification v1.2](https://github.com/moby/moby/blob/5072b22c5fea93f00917c8c5d6a29d782db2bb73/image/spec/v1.2.md#combined-image-json--filesystem-changeset-format).

## Usage

### CLI

```
push-docker-image myImage.tar.gz
```

### Node API

```js
const pushDockerImage = require('push-docker-image');

const options = {
  auth: { username: 'user', password: 'password '},
  ssl: false
};

// The `options` argument is optional
pushDockerImage('/path/to/myImage.tar.gz', options)
    .then(() => console.log('Successfully uploaded.')
    .catch(() => console.log('Upload failed');
```
