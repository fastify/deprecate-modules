## Working With This Repo

The puprose of this repository is to facilitate publishing deprecation
packages as Fastiy moves from `fastify-*` packages to `@fastify/*` packages.

Each package defined in `lib/modules.json` will generate a deprecation package
in the `out/` directory. This is accomplished by running `npm run build`.
Subsequently, `npm run publish:live` will issue a publish of those modules
to the live `npmjs.org` registry.

## Dry Run

1. Copy `sample.env` to `.env` and adjust with real values
1. `node build-data.mjs` to generate source data
1. `node index.mjs` to generate deprecated module sources and repo changes
1. `docker-compose up` to start Verdaccio server
1. `npm run publish-local` to publish modules to Verdaccio server

## Publishing Live Modules

1. Copy `sample.env` to `.env` and adjust with real values.
1. `node build-data.mjs` to generate `./lib/modules.json`.
1. `DRY_RUN=0 node index.mjs | tee build.log.json` to generate deprecated modules
    sources and create PRs to rename modules with new major versions. This step
    will generate log data that looks like:
    ```json
    {
      "fastify-bearer-auth": {
        "deprecationModule": {
          "published": true,
          "versionPublished": "6.3.0-rc.1"
        },
        "replacementModule": {
          "prCreated": true,
          "prUrl": "https://github.com/fastify/fastify-bearer-auth/pull/127"
        }
      }
    }
    ```
1. `DRY_RUN=0 ./publish-live.sh` to publish the deprecated modules.


