# @zenithbuild/plugins ⚡

The official plugin ecosystem for the Zenith framework.

## Overview

Zenith is designed to be extensible. The `@zenithbuild/plugins` package provides the core plugin system and is the home for shared official plugins that enhance the framework's capabilities.

## Features

- **Extensible Hooks**: Tap into different phases of the Zenith lifecycle (build, dev, runtime).
- **Official Plugins**: A collection of vetted plugins for common tasks (SEO, Analytics, State persistence, etc.).
- **Simple API**: Focused on ease of use for plugin authors.

## Plugin Example (Preview)

```typescript
export default function myZenithPlugin() {
  return {
    name: 'my-plugin',
    setup(api) {
      // Tap into the build process
      api.onBuild(() => {
        console.log('Zenith is building!');
      });
    }
  }
}
```

## Getting Started

Refer to the Zenith documentation for instructions on how to consume and create plugins.

## License

MIT
