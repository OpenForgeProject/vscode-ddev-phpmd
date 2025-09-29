# DDEV PHPMD Extension for VS Code

This extension integrates [PHP Mess Detector (PHPMD)](https://phpmd.org/) with Visual Studio Code using [DDEV](https://ddev.com/) as the runtime environment. It provides real-time code quality analysis for PHP projects running in DDEV containers.

## Features

- Real-time PHP code analysis using PHPMD through DDEV
- **Easy enable/disable functionality per project**
- Configurable validation triggers (on save or on type)
- Customizable PHPMD rulesets and severity levels
- Automatic DDEV project detection
- Problems panel integration with clickable issue links
- Status bar indicator showing extension state

## Requirements

- [VS Code](https://code.visualstudio.com/) 1.100.0 or higher
- [DDEV](https://github.com/ddev/ddev) project with running container
- PHPMD installed in your DDEV container

## Installation

Install the extension from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=OpenForgeProject.vscode-ddev-phpmd) or search for "DDEV PHPMD" in VS Code's extension panel.

Install [PHPMD](https://github.com/phpmd/phpmd) in your DDEV container:
```bash
ddev composer require --dev phpmd/phpmd
```

## Usage

1. Open a DDEV project in VS Code
2. The extension automatically analyzes PHP files when you save them
3. Issues appear in the Problems panel and are highlighted in the editor
4. Click on issues to view detailed information and external documentation

### Enable/Disable Extension

You can easily enable or disable the extension per project:

- **Status Bar Indicators**:
  - 🚫 `PHPMD` (disabled) - Extension is disabled, click to enable
  - ⚠️ `PHPMD` (not available) - DDEV/PHPMD not available, check `ddev status`
  - ✅ `PHPMD` (active/clean) - Extension is active, no issues in current file
  - ❌ `PHPMD` (active/issues) - Extension is active, current file has PHPMD issues
- **Command Palette** (`Cmd+Shift+P` / `Ctrl+Shift+P`):
  - `DDEV PHPMD: Enable` - Enable the extension
  - `DDEV PHPMD: Disable` - Disable the extension
  - `DDEV PHPMD: Toggle Enable/Disable` - Toggle the current state
- **Settings**: Change `ddev-phpmd.enable` in your workspace settings

## Configuration

Key settings in VS Code preferences:

- `ddev-phpmd.enable`: Enable/disable the extension (default: `true`)
- `ddev-phpmd.validateOn`: When to validate (`"save"` or `"type"`)
- `ddev-phpmd.rulesets`: PHPMD rulesets to use
- `ddev-phpmd.configPath`: Path to custom PHPMD configuration file

## License

GPL-3.0 License. See [LICENSE](LICENSE) for details.
