# Weather Jacket

A Glasgow-first weather dashboard with practical jacket advice and a five-model forecast comparison. It uses Open-Meteo's forecast and geocoding APIs; no API key is required.

## Use

Search for a city or use the location button. The site requests location only after you select that button. Switch between Fahrenheit and Celsius with the unit control.

## Publish

The GitHub Actions workflow deploys the static site to GitHub Pages whenever changes are pushed to `main`. Enable Pages with **GitHub Actions** as the build and deployment source in repository settings.