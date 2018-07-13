<p align="center">
  <img alt="OS.js Logo" src="https://raw.githubusercontent.com/os-js/gfx/master/logo-big.png" />
</p>

[OS.js](https://www.os-js.org/) is an [open-source](https://raw.githubusercontent.com/os-js/OS.js/master/LICENSE) desktop implementation for your browser with a fully-fledged window manager, Application APIs, GUI toolkits and filesystem abstraction.

[![Community](https://img.shields.io/badge/join-community-green.svg)](https://community.os-js.org/)
[![Donate](https://img.shields.io/badge/liberapay-donate-yellowgreen.svg)](https://liberapay.com/os-js/)
[![Donate](https://img.shields.io/badge/paypal-donate-yellow.svg)](https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=andersevenrud%40gmail%2ecom&lc=NO&currency_code=USD&bn=PP%2dDonationsBF%3abtn_donate_SM%2egif%3aNonHosted)
[![Support](https://img.shields.io/badge/patreon-support-orange.svg)](https://www.patreon.com/user?u=2978551&ty=h&u=2978551)

# OS.js v3 Google Drive VFS Adapter

This is the Google Drive VFS (Client) Adapter for OS.js v3.

**This is not done and might damage your files!**

## Installation

Requires `@osjs/gapi-provider` set up with the following configuration:

```
client: {
  discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
  scope: ['https://www.googleapis.com/auth/drive']
}
```

In your client initialization script:

```
import gdriveAdapter from '@osjs/gdrive-adapter';

osjs.register(VFSServiceProvider, {
  depends: ['osjs/gapi'],
  args: {
    adapters: {
      gdrive: gdriveAdapter
    }
  }
});
```

Then create a mountpoint:

```
{
  vfs: {
    mountpoints: [{
      name: 'gdrive',
      label: 'Google Drive',
      adapter: 'gdrive'
     }]
   }
}
```
