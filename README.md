# DDEV PHPMD Extension for VS Code

This extension integrates PHP Mess Detector (PHPMD) with Visual Studio Code using DDEV as the runtime environment. It provides real-time code quality and static analysis feedback for PHP projects running in DDEV containers.

## Features

- Automatic PHP code analysis using PHPMD through DDEV
- Real-time feedback on code quality issues
- Configurable validation triggers (on save or on type)
- Customizable PHPMD rulesets
- Adjustable severity levels for reported issues
- Support for all standard PHPMD rulesets:
  - Clean Code
  - Code Size
  - Controversial
  - Design
  - Naming
  - Unused Code

## Requirements

- VS Code 1.100.0 or higher
- DDEV installed and configured in your project
- PHPMD installed in your DDEV container

## Extension Settings

This extension contributes the following settings:

- `ddev-phpmd.enable`: Enable/disable the extension (default: `true`)
- `ddev-phpmd.validateOn`: Set validation trigger to 'save' or 'type' (default: `"save"`)
- `ddev-phpmd.rulesets`: Array of PHPMD rulesets to use (default: `["cleancode", "codesize", "controversial", "design", "naming", "unusedcode"]`). Only used when no custom config file is specified.
- `ddev-phpmd.minSeverity`: Minimum severity level for reported issues: "error", "warning", or "info" (default: `"warning"`)
- `ddev-phpmd.configPath`: Path to a custom PHPMD ruleset XML file (relative to workspace root). When specified, this takes precedence over the rulesets setting.

## Usage

1. Make sure your project is initialized with DDEV
2. The extension will automatically start analyzing PHP files when you save them or as you type (based on your settings)
3. Issues will be displayed in the Problems panel and highlighted in the editor
4. You can also manually trigger analysis using the command "DDEV PHPMD: Analyze Current File"

## Contributing

If you find a bug or want to contribute to the development of this extension, please visit our [GitHub repository](https://github.com/OpenForgeProject/vscode-ddev-phpmd).

### Development

This project uses GitHub Actions for continuous integration:

- **Extension Tests**: Automatically runs linting and tests on both Ubuntu and macOS environments
- **Build and Publish**: Creates the VSIX package and publishes to the VS Code Marketplace on tag release

To run the tests locally:

```bash
# Install dependencies
npm install

# Lint and check types
npm run lint
npm run check-types

# Compile and run tests
npm run compile-tests
npm run test
```

## License

This extension is licensed under the GNU General Public License v3.0 (GPL-3.0). See the [LICENSE](https://github.com/OpenForgeProject/vscode-ddev-phpmd/LICENSE) file for details.
