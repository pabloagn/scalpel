# mermaid-render-tool

## Setup

1. Install Docker if you don't have it yet.
2. Start the Docker daemon.
3. Run the script with the path to your diagrams folder:

```PowerShell
python main.py /path/to/diagrams -o /path/to/output
```

## Example Usage

```PowerShell
python main.py diagrams -o exported_diagrams -r 300
```

This will:

1. Look for all `.mmd` files in the `diagrams` folder.
2. Export them as PNG files to the `exported_diagrams` folder.
3. Use a resolution of 300 PPI.
4. Maintain transparent backgrounds.
5. Preserve the theme settings from your Mermaid diagrams.

The script automatically creates a `puppeteerConfig.json` file that configures the high-resolution rendering and transparent background.