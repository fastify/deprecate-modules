#!/bin/bash
set -e

# This script is used to adjust the access restrictions for publishing
# modules to npmjs.com. See the Twitter thread
# https://twitter.com/jsumners79/status/1517131550403485697 for details.

# Set to "2fa_only" to configure packages to not accept an automation token.
ACCESS_MODE=${ACCESS_MODE:-"2fa_or_token"}

# Set to a `modules.json` as built by `build-data.mjs`.
MODULES_JSON=${MODULES_JSON:-"./lib/modules.json"}

# The name of the item in 1Password for the NPM credentials. Must have a
# TOTP field.
OP_ITEM=${OP_ITEM:-"npmjs.com"}

echo "Must sign-in to 1Password to continue:"
eval $(op signin)
username=$(op item get ${OP_ITEM} --field name --format json | jq -r .value)
password=$(op item get ${OP_ITEM} --field password --format json | jq -r .value)
credentials=$(echo -n "${username}:${password}" | base64)

post_data='{"publish_requires_tfa": true, "automation_token_overrides_tfa": true}'
if [ "${ACCESS_MODE}" == "2fa_only" ]; then
  post_data='{"publish_requires_tfa": true, , "automation_token_overrides_tfa": false}'
fi

modules=$(cat ${MODULES_JSON} | jq -r '.[] | .name')
for module in ${modules}; do
  echo "Setting access for module: ${module}"

  # module=$(node -e "console.log(encodeURIComponent(process.argv[1]))" -- "${module}")
  otp=$(op item get ${OP_ITEM} --field type=otp --format json | jq -r .totp)
  curl --http1.1 --no-keepalive \
    -H 'user-agent: npm/8.6.0 node/v18.0.0 darwin x64 workspaces/false' \
    -H "authorization: Basic ${credentials}" \
    -H "npm-otp: ${otp}" \
    -H "npm-scope: fastify" \
    -H "npm-command: access" \
    -H "content-type: application/json" \
    -d "${post_data}" \
    "https://registry.npmjs.org/-/package/${module}/access"

  # We must let the already used OTP expire before requesting another one.
  sleep 30
  echo ""
done
