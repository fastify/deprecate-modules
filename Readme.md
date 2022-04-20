## Working With This Repo

The puprose of this repository is to facilitate publishing deprecation
packages as Fastiy moves from `fastify-*` packages to `@fastify/*` packages.

Each package defined in `lib/modules.json` will generate a deprecation package
in the `out/` directory. This is accomplished by running `npm run build`.
Subsequently, `npm run publish:live` will issue a publish of those modules
to the live `npmjs.org` registry.

## TODO

+ Do a live test with some release candidates

## Dry Run

1. Add a `.env` file with a `GITHUB_TOKEN=token` line
1. `node build-data.mjs` to generate source data
1. `node index.mjs` to generate deprecated module sources and repo changes
1. `docker-compose up` to start Verdaccio server
1. `npm run publish-local` to publish modules to Verdaccio server
