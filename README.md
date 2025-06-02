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

To install PHPMD in your DDEV container, you can add the following to your `.ddev/config.yaml`:

```yaml
hooks:
  post-start:
    - exec: composer global require phpmd/phpmd
```

Or run this command manually:

```bash
ddev exec composer global require phpmd/phpmd
```

## Extension Settings

This extension contributes the following settings:

* `ddev-phpmd.enable`: Enable/disable the extension (default: `true`)
* `ddev-phpmd.validateOn`: Set validation trigger to 'save' or 'type' (default: `"save"`)
* `ddev-phpmd.rulesets`: Array of PHPMD rulesets to use (default: `["cleancode", "codesize", "controversial", "design", "naming", "unusedcode"]`)
* `ddev-phpmd.minSeverity`: Minimum severity level for reported issues: "error", "warning", or "info" (default: `"warning"`)

## Usage

1. Make sure your project is initialized with DDEV
2. The extension will automatically start analyzing PHP files when you save them or as you type (based on your settings)
3. Issues will be displayed in the Problems panel and highlighted in the editor
4. You can also manually trigger analysis using the command "DDEV PHPMD: Analyze Current File"

## Known Issues

- The extension requires PHPMD to be installed in your DDEV container
- File paths must be accessible from within the DDEV container

## Release Notes

### 0.0.1

- Initial release
- Basic PHPMD integration with DDEV
- Configurable validation triggers and rulesets
- Support for all standard PHPMD rulesets

## Contributing

If you find a bug or want to contribute to the development of this extension, please visit our [GitHub repository](https://github.com/openforgeproject/vscode-ddev-phpmd).

## License

This extension is licensed under the GNU General Public License v3.0 (GPL-3.0). See the [LICENSE](LICENSE) file for details.
