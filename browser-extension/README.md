# Vesta Recipe Importer - Browser Extension

A Chrome/Edge extension to import recipes from any website into your Vesta household app.

## Installation

### Chrome / Edge (Developer Mode)

1. Open `chrome://extensions` (Chrome) or `edge://extensions` (Edge)
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select this `browser-extension` folder
5. The Vesta icon will appear in your toolbar

### Icons Setup

Before loading, you'll need to add icon files to the `icons/` folder:
- `icon16.png` (16x16)
- `icon32.png` (32x32)
- `icon48.png` (48x48)
- `icon128.png` (128x128)

You can use any icon or generate them from the Vesta logo.

## Usage

1. Navigate to any recipe page (AllRecipes, Food Network, etc.)
2. Click the Vesta extension icon
3. Click "Import Recipe"
4. The recipe will open in Vesta for review and saving

## Configuration

On first use, set your Vesta URL in the popup settings:
- For local development: `http://localhost:5173`
- For production: Your Vercel deployment URL

The URL is saved and remembered for future imports.

## How It Works

The extension looks for JSON-LD structured data on recipe pages. Most major recipe sites include this standardized format for SEO. The extension:

1. Extracts the Recipe schema from the page
2. Parses ingredients, instructions, times, servings
3. Encodes the data as base64
4. Opens Vesta with the recipe in the URL hash
5. Vesta detects the import and opens the recipe editor

## Supported Sites

Any site that includes `application/ld+json` schema.org Recipe markup:
- AllRecipes
- Food Network
- Serious Eats
- Bon Appetit
- NYT Cooking
- Epicurious
- Tasty
- And thousands more...

## Troubleshooting

**"No recipe found on this page"**
- The page may not have JSON-LD recipe data
- Try using the "Paste Recipe" feature in Vesta instead

**Recipe data is incomplete**
- Some sites have minimal structured data
- You can edit the recipe in Vesta after import

## Privacy

This extension:
- Only activates when you click the icon
- Only reads data from the current tab
- Does not send data to any external servers
- Stores only your Vesta URL locally
