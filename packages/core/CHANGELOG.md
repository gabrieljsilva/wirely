# @wirely/core

## 0.1.1

### Patch Changes

- 078be90: First release published through the automated CI pipeline, adding npm provenance attestation (the initial 0.1.0 was published manually without it).

## 0.1.0

### Minor Changes

- Initial public release: function-based Dependency Injection core (no decorators, no reflection). Providers (class/value/factory), modules with encapsulation and global modules, abstract-class and symbol tokens, singleton/transient lifetimes, circular dependency resolution via forwardRef, onInit/onDestroy lifecycle hooks, and typed errors. Ships dual ESM (.mjs) + CJS (.cjs) builds with type declarations.
