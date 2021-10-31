import umeta from 'umeta'
const {dirName} = umeta(import.meta)

import fs from 'fs/promises'
import path from 'path'
const localNpmRc = path.resolve(path.join(dirName, '..', 'npmrc_local'))
const fixturePath = path.resolve(path.join(dirName, 'fixtures', 'fastify-cookie'))

import assert from 'assert'
import {promisify} from 'util'
import child_process from 'child_process'

const execp = promisify(child_process.exec)

const opts = {
  cwd: fixturePath,
  env: Object.assign({}, process.env, {
    npm_config_userconfig: localNpmRc,
    NPM_CONFIG_USERCONFIG: localNpmRc
  })
}
try {
  await execp('npm install', opts)
  const {stdout} = await execp('node index.js', opts)
  assert.equal(stdout.trim(), 'wrap succeeded')
} finally {
  await fs.rm(path.join(fixturePath, 'node_modules'), { recursive: true, force: true })
}
