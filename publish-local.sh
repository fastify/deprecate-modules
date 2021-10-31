#!/bin/bash

export NPM_CONFIG_USERCONFIG=$(pwd)/npmrc_local
export npm_config_userconfig=$(pwd)/npmrc_local

CURDIR=$(pwd)

FILES=$(ls -1A out)
for f in ${FILES}; do
  cd ${CURDIR}/out/${f}
  npm publish
done

cd ${CURDIR}

FILES=$(ls -1A ref-modules)
for f in ${FILES}; do
  cd ${CURDIR}/ref-modules/${f}
  npm publish
done
