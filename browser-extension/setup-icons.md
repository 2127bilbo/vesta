# Icon Setup

To set up icons for the browser extension, copy or resize the PWA icons:

## Quick Setup (Windows)

Copy the 192px icon as a temporary solution:
```
copy ..\public\icons\pwa-192.png icons\icon128.png
copy ..\public\icons\pwa-192.png icons\icon48.png
copy ..\public\icons\pwa-192.png icons\icon32.png
copy ..\public\icons\pwa-192.png icons\icon16.png
```

## Proper Setup

For best quality, resize the icons properly using an image editor:
- Take `pwa-512.png` and resize to: 128x128, 48x48, 32x32, 16x16
- Save each as `icon128.png`, `icon48.png`, `icon32.png`, `icon16.png`
- Place in the `icons/` folder

## Online Tools

You can use online tools like:
- https://www.iloveimg.com/resize-image
- https://squoosh.app/
