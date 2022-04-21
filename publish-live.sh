#!/bin/bash

echo "Warning: this will publish modules to the REAL npmjs.org registry."
read -p "Press any key to continue or Ctrl+C to exit..."
echo ""

## Start publishing...

if [ -z "${NPM_PUBLISH_TOKEN}" ]; then
  echo "Please set NPM_PUBLISH_TOKEN to an _automation_ token that can publish packages."
  echo "See https://docs.npmjs.com/creating-and-viewing-access-tokens"
  exit 1
fi

if [ -z $(which jq) ]; then
  echo "Please install jq to continue."
  echo "https://stedolan.github.io/jq/"
  exit 1
fi

DRY_RUN=${DRY_RUN:-1}
if [ ${DRY_RUN} -eq 1 ]; then
  echo "Operating in dry run mode. Set DRY_RUN=0 to run for real."
  echo 'e.g.: `DRY_RUN=0 ./publish-live.sh`'
  echo ""
fi

# The .env file is in a format that the npm `dotenv` module supports.
# So we need to source it and export the values.
source .env
export GITHUB_TOKEN=${GITHUB_TOKEN}
export NPM_PUBLISH_TOKEN=${NPM_PUBLISH_TOKEN}

CURDIR=$(pwd)
export NPM_CONFIG_USERCONFIG=${CURDIR}/npmrc_live
export npm_config_userconfig=${CURDIR}/npmrc_live

function publish() {
  if [ ${DRY_RUN} -eq 1 ]; then
    echo "module: $(basename $(pwd))"
    echo "Live run would issue:"
    echo "${1}"
    echo ""
  else
    eval ${1}
  fi
}

FILES=$(ls -1A out)
for f in ${FILES}; do
  cd ${CURDIR}/out/${f}

  is_rc=$(cat package.json | jq '.version | test("-rc\\.\\d+$")')
  if [ "${is_rc}" == "true" ]; then
    publish "npm publish --tag=rc"
  else
    publish "npm publish"
  fi
done
