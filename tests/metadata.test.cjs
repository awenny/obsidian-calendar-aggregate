const test = require('node:test');
const assert = require('node:assert/strict');
const manifest = require('../manifest.json');
const pkg = require('../package.json');
const versions = require('../versions.json');
test('metadata versions match', () => {
  assert.equal(manifest.version, pkg.version);
  assert.equal(versions[manifest.version], manifest.minAppVersion);
  assert.match(manifest.id, /^[a-z0-9-]+$/);
});
