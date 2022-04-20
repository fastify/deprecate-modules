import fs from 'fs/promises'
import path from 'path'
import umeta from 'umeta'

const {dirName} = umeta(import.meta)

const indexTmpl = (await fs.readFile(path.join(dirName, 'index.tmpl.js'))).toString()
const pkgTmpl = (await fs.readFile(path.join(dirName, 'package.json'))).toString()
const readmeTmpl = (await fs.readFile(path.join(dirName, 'README.md'))).toString()
const pullRequestMessageTmpl = (await fs.readFile(path.join(dirName, 'pr-msg.tmpl'))).toString()

export {
  indexTmpl,
  pkgTmpl,
  readmeTmpl,
  pullRequestMessageTmpl
}
