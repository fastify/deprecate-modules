// This script reads the input `./lib/modules.json` data file, iterates
// the items within it, and builds the deprecation modules in the `./out/`
// directory.

import fs from 'fs/promises'
import path from 'path'

const modulesSource = await fs.readFile('./lib/modules.json')
const modules = JSON.parse(modulesSource.toString('utf8'))

import { indexTmpl, pkgTmpl, readmeTmpl } from './templates/index.mjs'

for (const mod of modules) {
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

function replaceAll (str, mod) {
  return str
    .slice(0)
    .replaceAll('<<module_name>>', mod.name)
    .replaceAll('<<module_version>>', mod.versionToPublish)
    .replaceAll('<<module_license>>', mod.license)
    .replaceAll('<<new_module_name>>', mod.newModule.name)
    .replaceAll('<<new_module_version>>', mod.newModule.version)
}
