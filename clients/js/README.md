# JavaScript client for mallow Gumball Machine

A Umi-compatible JavaScript library for Gumball machines.

## Getting started

1. First, if you're not already using Umi, [follow these instructions to install the Umi framework](https://github.com/metaplex-foundation/umi/blob/main/docs/installation.md).
2. Next, install this library using the package manager of your choice.
   ```sh
   npm install @mallow-labs/mallow-gumball
   ```
2. Finally, register the library with your Umi instance like so.
   ```ts
   import { mallowGumball } from '@mallow-labs/mallow-gumball';
   umi.use(mallowGumball());
   ```

You can learn more about this library's API by reading its generated [TypeDoc documentation](https://mallow-gumball-js-docs.vercel.app).

## Contributing

Check out the [Contributing Guide](./CONTRIBUTING.md) the learn more about how to contribute to this library.
