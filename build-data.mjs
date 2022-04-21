// This script iterates through the repositories in the Fastify GitHub
// organization in order to build an input data file for the deprecation
// script.

import dotenv from 'dotenv'
dotenv.config()

import semver from 'semver'
import {Client} from 'undici'
const client = new Client('https://api.github.com')
const headers = {
  'user-agent': 'fastify/deprecator',
  accept: 'application/vnd.github.v3+json',
  authorization: `token ${process.env.GITHUB_TOKEN}`,
  'content-type': 'application/json'
}

const modules = []
const getRepos = getReposGen()
for await (const repo of getRepos) {
  if (
    repo.name.startsWith('fastify-') === false ||
    repo.name.includes('example') === true ||
    ['fastify-vite', 'fastify-dx'].includes(repo.name) === true ||
    repo.archived === true
  ) {
    continue
  }

  console.log(`processing ${repo.name} ...`)
  let pkg
  try {
    pkg = await getPackageJson(repo.name)
  } catch (cause) {
    console.error(`failed to process ${repo.name}: ${cause.message}`)
    continue
  }

  if (pkg.name.startsWith('@fastify/')) {
    console.log(`skipping ${pkg.name}`)
    continue
  }

  const modData = {
    name: pkg.name,
    currentVersion: pkg.version,
    versionToPublish: semver.inc(pkg.version, 'minor'),
    license: pkg.license,
    newModule: {
      name: '@fastify/' + pkg.name.replace('fastify-', ''),
      version: semver.inc(pkg.version, 'major')
    }
  }

  modules.push(modData)
}

import { writeFile } from 'fs/promises'
writeFile('./lib/modules.json', JSON.stringify(modules, null, 2))

/**
 * Iterates the full list of repositories in the Fastify organization.
 *
 * @yields {object} GitHub repository object.
 */
async function * getReposGen() {
  const params = new URLSearchParams()
  params.set('type', 'public')
  params.set('sort', 'full_name')
  params.set('per_page', '100')

  let response = await client.request({
    method: 'GET',
    path: '/orgs/fastify/repos?' + params.toString(),
    headers
  })

  const firstPage = await response.body.json()
  for (const repo of firstPage) {
    yield repo
  }

  let finished = false
  do {
    if (!response.headers.link) {
      break;
    }

    // On the first page there will be `rel=next` and `rel=last`.
    // On middle pages there will be `rel=prev`, `rel=next`, and `rel=first`.
    // On the last page there will be `rel=prev` and `rel=first`.
    const links = response.headers.link.split(',');
    const nextLink = links.find((l) => l.includes(`rel="next"`));
    if (!nextLink) {
      finished = true;
      break;
    }

    const parts = nextLink.split(';');
    const url = new URL(parts[0].replace(/[<>]/g, ''));
    // const rel = parts[1].slice(6, -1);

    response = await client.request({
      method: 'GET',
      path: url.pathname + url.search,
      headers
    })
    const repos = await response.body.json()
    for (const repo of repos) {
      yield repo
    }
  } while (finished === false)
}

/**
 * Retrieves the current `package.json` from the specified repo.
 *
 * @returns {object} NPM package object.
 */
async function getPackageJson(repoName) {
  const response = await client.request({
    method: 'GET',
    path: `/repos/fastify/${repoName}/contents/package.json`,
    headers
  })
  const payload = await response.body.json()
  const buf = Buffer.from(payload.content, 'base64')
  return JSON.parse(buf.toString('utf8'))
}
