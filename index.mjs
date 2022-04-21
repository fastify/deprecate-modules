// This script reads the input `./lib/modules.json` data file, iterates
// the items within it, and builds the deprecation modules in the `./out/`
// directory.

import dotenv from 'dotenv'
dotenv.config()

import { boolean } from 'boolean'
let DRY_RUN = true
if (process.env.DRY_RUN) {
  DRY_RUN = boolean(process.env.DRY_RUN)
}

import { spawn } from "child_process"
import fs from 'fs/promises'
import path from 'path'
import PackageJson from '@npmcli/package-json'

import { Client } from 'undici'
const client = new Client('https://api.github.com')
const headers = {
  'user-agent': 'fastify/deprecator',
  accept: 'application/vnd.github.v3+json',
  authorization: `token ${process.env.GITHUB_TOKEN}`,
  'content-type': 'application/json'
}

import umeta from 'umeta'
const { dirName } = umeta(import.meta)

const modulesSource = await fs.readFile('./lib/modules.json')
const modules = JSON.parse(modulesSource.toString('utf8'))

import {
  indexTmpl,
  pkgTmpl,
  readmeTmpl,
  pullRequestMessageTmpl
} from './templates/index.mjs'

/**
 * This name to be used for branches when updating modules's names and versions.
 */
const REPO_BRANCH_NAME = 'rename-module'

const statuses = {}
for (const mod of modules) {
  const status = {
    deprecationModule: {
      published: false
    },
    replacementModule: {
      prCreated: false
    }
  }
  statuses[mod.name] = status

  try {
    await buildDeprecationModule(mod)
    status.deprecationModule.published = true
    status.deprecationModule.versionPublished = mod.versionToPublish
  } catch (cause) {
    status.deprecationModule.error = cause.message
    status.deprecationModule.stack = cause.stack
    continue
  }

  try {
    const prUrl = await buildReplacementModule(mod)
    status.replacementModule.prCreated = true
    status.replacementModule.prUrl = prUrl
  } catch (cause) {
    status.replacementModule.error = cause.message
    status.replacementModule.stack = cause.stack
    continue
  }
}
console.log(JSON.stringify(statuses, null, 2))

/**
 * Write a skeleton wrapper module that will act as the deprecation
 * module when published to npmjs.com.
 *
 * @param {object} mod A module description from the input `modules.json`.
 */
async function buildDeprecationModule(mod) {
  const outDir = path.join('out', mod.name)
  const indexOut = path.join(outDir, 'index.js')
  const pkgOut = path.join(outDir, 'package.json')
  const readmeOut = path.join(outDir, 'README.md')

  await fs.mkdir(outDir, { recursive: true })

  const index = replaceAll(indexTmpl, mod)
  await fs.writeFile(indexOut, index)

  const pkg = replaceAll(pkgTmpl, mod)
  await fs.writeFile(pkgOut, pkg)

  const readme = replaceAll(readmeTmpl, mod)
  await fs.writeFile(readmeOut, readme)
}

/**
 * Utility function to replace all placeholder values in a template
 * with the corresponding values for a module being deprecated.
 *
 * @param {string} str The template string with placeholder values.
 * @param {object} mod A module description from the input `modules.json`.
 *
 * @returns {string} The updated string.
 */
function replaceAll (str, mod) {
  return str
    .slice(0)
    .replaceAll('<<module_name>>', mod.name)
    .replaceAll('<<module_current_version>>', mod.currentVersion)
    .replaceAll('<<module_version>>', mod.versionToPublish)
    .replaceAll('<<module_license>>', mod.license)
    .replaceAll('<<new_module_name>>', mod.newModule.name)
    .replaceAll('<<new_module_version>>', mod.newModule.version)
}

/**
 * This function clones the remote repository, creates a new branch,
 * updates the module's `package.json`, and creates a new pull request.
 *
 * @param {object} mod A module description from the input `modules.json`.
 */
async function buildReplacementModule(mod) {
  const reposDir = path.join(dirName, 'repos')
  await fs.mkdir(reposDir, { recursive: true })

  const repoDir = path.join(reposDir, mod.name)
  try {
    // Clean up previous runs and start over. It's easier than managing
    // all of the ceremony around making sure branches exist and are in the
    // right state.
    const dirStats = await fs.stat(repoDir)
    if (dirStats.isDirectory()) {
      await fs.rm(repoDir, { recursive: true })
    }
  } catch {}

  await cloneRepo({ repoName: mod.name, reposDir })
  await createBranch({ repoDir })
  await updatePackageJson({ repoDir, mod })
  await stageChanges({ repoDir })
  await commitChanges({ repoDir })

  let prUrl = 'dry run: did not create pr'
  if (DRY_RUN !== true) {
    await pushChanges({ repoDir })
    prUrl = await createPullRequest({ repoDir, mod })
  }

  return prUrl
}

/**
 * Clone a repository from the GitHub organzation into our local working
 * tree.
 */
function cloneRepo({ repoName, reposDir }) {
  const gitUrl = `git@github.com:fastify/${repoName}.git`

  const proc = spawn(
    'git',
    ['clone', '--depth=1', gitUrl, repoName ],
    { cwd: reposDir }
  )

  return new Promise((resolve, reject) => {
    proc.on('error', reject)
    proc.on('exit', (code) => {
      if (code !== 0) {
        return reject(Error(`process exited with code: ${code}`))
      }
      resolve()
    })
  })
}

/**
 * Create the branch to be used for automating the change of a module's version
 * and name.
 */
function createBranch({ repoDir }) {
  const proc = spawn(
    'git',
    ['checkout', '-b', REPO_BRANCH_NAME],
    { cwd: repoDir }
  )

  return new Promise((resolve, reject) => {
    proc.on('error', reject)
    proc.on('exit', (code) => {
      if (code !== 0) {
        return reject(Error(`process exited with code: ${code}`))
      }
      resolve()
    })
  })
}

/**
 * Update a module's version and name with the new module version and name.
 */
async function updatePackageJson({ repoDir, mod }) {
  const pkg = await PackageJson.load(repoDir)
  pkg.update({
    version: mod.newModule.version,
    name: mod.newModule.name
  })
  await pkg.save()
}

/**
 * Stage the changes to the module in preparation for commit.
 */
function stageChanges({ repoDir }) {
  const proc = spawn(
    'git',
    ['add', '.'],
    { cwd: repoDir }
  )

  return new Promise((resolve, reject) => {
    proc.on('error', reject)
    proc.on('exit', (code) => {
      if (code !== 0) {
        return reject(Error(`process exited with code: ${code}`))
      }
      resolve()
    })
  })
}

/**
 * Commit the staged changes and use a templated commit message.
 */
function commitChanges({ repoDir }) {
  const proc = spawn(
    'git',
    ['commit', '-F', path.join(dirName, 'templates', 'module-rename-commit.msg')],
    { cwd: repoDir }
  )

  return new Promise((resolve, reject) => {
    proc.on('error', reject)
    proc.on('exit', (code) => {
      if (code !== 0) {
        return reject(Error(`process exited with code: ${code}`))
      }
      resolve()
    })
  })
}

/**
 * Push the staged changes to the remote GitHub repository.
 */
function pushChanges({ repoDir }) {
  const proc = spawn(
    'git',
    ['push', '-u', 'origin', REPO_BRANCH_NAME],
    { cwd: repoDir }
  )

  return new Promise((resolve, reject) => {
    proc.on('error', reject)
    proc.on('exit', (code) => {
      if (code !== 0) {
        return reject(Error(`process exited with code: ${code}`))
      }
      resolve()
    })
  })
}

/**
 * Determine the name of the main branch for the repository on GitHub.
 * This is needed for creating the pull request. We cannot assume a specific
 * name, e.g. "master", as it may be different per repository.
 */
function getRemoteMainBranch({ repoDir }) {
  const proc = spawn(
    'git',
    ['remote', 'show', 'origin'],
    { cwd: repoDir }
  )

  let output = ''
  proc.stdout.on('data', d => {
    output += d.toString()
  })

  return new Promise((resolve, reject) => {
    proc.on('error', reject)
    proc.on('exit', (code) => {
      if (code !== 0) {
        return reject(Error(`process exited with code: ${code}`))
      }
      const branch = output.split(/\r?\n/)
        .filter(line => line.trim().startsWith('HEAD branch:'))
        ?.pop()
        ?.split(': ')
        ?.pop();

      resolve(branch)
    })
  })
}

/**
 * Generate a new templated pull request that will rename the module and
 * set the new version.
 */
async function createPullRequest({ repoDir, mod }) {
  const remoteBase = await getRemoteMainBranch({ repoDir })
  const response = await client.request({
    method: 'POST',
    path: `/repos/fastify/${mod.name}/pulls`,
    headers,
    body: JSON.stringify({
      title: 'Rename module',
      body: pullRequestMessageTmpl,
      head: REPO_BRANCH_NAME,
      base: remoteBase
    })
  })

  if (response.statusCode !== 201) {
    console.log(await response.body.text())
    throw Error(`pr create failed with code ${response.statusCode}`)
  }

  const data = await response.body.json()
  return data.html_url
}
