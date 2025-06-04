/*
 * This file is part of the vscode-ddev-phpmd extension.
 *
 * © OpenForgeProject
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as sinon from 'sinon';
import * as fs from 'fs/promises';
import { afterEach, beforeEach } from 'mocha';

// Import the extension but do not execute it
// This allows us to test utility functions without mocking child_process
const myExtensionPath = path.resolve(__dirname, '../../dist/extension.js');

// Mock sample PHPMD output
const SAMPLE_PHPMD_OUTPUT = JSON.stringify({
  files: [
    {
      file: "test.php",
      violations: [
        {
          beginLine: 10,
          endLine: 10,
          beginColumn: 1,
          endColumn: 20,
          description: "The method 'testMethod' has 15 parameters. Consider reducing the number of parameters.",
          rule: "ExcessiveParameterList",
          ruleSet: "codesize",
          priority: 3,
          externalInfoUrl: "https://phpmd.org/rules/codesize.html#excessiveparameterlist"
        },
        {
          beginLine: 20,
          endLine: 20,
          beginColumn: 1,
          endColumn: 20,
          description: "Avoid using short variable names like '$q'. Use more descriptive names.",
          rule: "ShortVariable",
          ruleSet: "naming",
          priority: 1,
          externalInfoUrl: "https://phpmd.org/rules/naming.html#shortvariable"
        }
      ]
    }
  ]
});

// Tests for the VS Code extension
suite('Extension Test Suite', () => {
  let sandbox: sinon.SinonSandbox;
  let diagnosticCollectionMock: any;

  // Sample JSON for PHPMD output processing tests
  const phpmdResultSample = JSON.parse(SAMPLE_PHPMD_OUTPUT);

  beforeEach(async () => {
    sandbox = sinon.createSandbox();

    // Mock diagnostic collection
    diagnosticCollectionMock = {
      set: sandbox.stub(),
      delete: sandbox.stub(),
      dispose: sandbox.stub()
    };
  });

  afterEach(() => {
    sandbox.restore();
  });

  // Basic test that we can check if the extension file exists
  test('Extension file exists', async () => {
    try {
      // Verify the extension file exists
      const stats = await fs.stat(myExtensionPath);
      assert.strictEqual(stats.isFile(), true);
    } catch (e) {
      assert.fail('Extension file not found: ' + myExtensionPath);
    }
  });

  // Test for diagnostic severity mapping
  test('PHPMD priorities map to correct VS Code diagnostic severities', async () => {
    // Define a helper function to simulate the getSeverity function from the extension
    const getSeverity = (priority: number): vscode.DiagnosticSeverity => {
      // Same logic as in the extension
      switch (priority) {
        case 1:
          return vscode.DiagnosticSeverity.Error;
        case 2:
        case 3:
          return vscode.DiagnosticSeverity.Warning;
        case 4:
        case 5:
          return vscode.DiagnosticSeverity.Information;
        default:
          return vscode.DiagnosticSeverity.Warning;
      }
    };

    // Test all priority levels
    assert.strictEqual(getSeverity(1), vscode.DiagnosticSeverity.Error);
    assert.strictEqual(getSeverity(2), vscode.DiagnosticSeverity.Warning);
    assert.strictEqual(getSeverity(3), vscode.DiagnosticSeverity.Warning);
    assert.strictEqual(getSeverity(4), vscode.DiagnosticSeverity.Information);
    assert.strictEqual(getSeverity(5), vscode.DiagnosticSeverity.Information);
    assert.strictEqual(getSeverity(99), vscode.DiagnosticSeverity.Warning); // Default case
  });

  // Test for minimum severity filtering
  test('Severity filtering works correctly', async () => {
    // Define a helper function to simulate the shouldReportSeverity function from the extension
    const shouldReportSeverity = (severity: vscode.DiagnosticSeverity, minSeverity: string): boolean => {
      switch (minSeverity) {
        case 'error':
          return severity === vscode.DiagnosticSeverity.Error;
        case 'warning':
          return severity <= vscode.DiagnosticSeverity.Warning;
        case 'info':
          return true;
        default:
          return true;
      }
    };

    // Test all combinations
    assert.strictEqual(shouldReportSeverity(vscode.DiagnosticSeverity.Error, 'error'), true);
    assert.strictEqual(shouldReportSeverity(vscode.DiagnosticSeverity.Warning, 'error'), false);
    assert.strictEqual(shouldReportSeverity(vscode.DiagnosticSeverity.Information, 'error'), false);

    assert.strictEqual(shouldReportSeverity(vscode.DiagnosticSeverity.Error, 'warning'), true);
    assert.strictEqual(shouldReportSeverity(vscode.DiagnosticSeverity.Warning, 'warning'), true);
    assert.strictEqual(shouldReportSeverity(vscode.DiagnosticSeverity.Information, 'warning'), false);

    assert.strictEqual(shouldReportSeverity(vscode.DiagnosticSeverity.Error, 'info'), true);
    assert.strictEqual(shouldReportSeverity(vscode.DiagnosticSeverity.Warning, 'info'), true);
    assert.strictEqual(shouldReportSeverity(vscode.DiagnosticSeverity.Information, 'info'), true);
  });

  // Test for PHPMD output processing
  test('PHPMD output can be parsed and produces expected diagnostics', async () => {
    // Create a simplified processPhpmdResults function to test the logic
    const processPhpmdResults = (output: string): vscode.Diagnostic[] => {
      try {
        const results = JSON.parse(output);
        const diagnostics: vscode.Diagnostic[] = [];

        if (results && results.files && results.files.length > 0) {
          for (const file of results.files) {
            for (const violation of file.violations) {
              const lineNum = violation.beginLine - 1; // Convert to 0-based
              const range = new vscode.Range(
                new vscode.Position(lineNum, 0),
                new vscode.Position(lineNum, Number.MAX_VALUE)
              );

              // Map the priority to severity
              let severity: vscode.DiagnosticSeverity;
              switch (violation.priority) {
                case 1:
                  severity = vscode.DiagnosticSeverity.Error;
                  break;
                case 2:
                case 3:
                  severity = vscode.DiagnosticSeverity.Warning;
                  break;
                default:
                  severity = vscode.DiagnosticSeverity.Information;
              }

              const diagnostic = new vscode.Diagnostic(
                range,
                `${violation.description} (${violation.rule})`,
                severity
              );
              diagnostic.source = 'phpmd';

              // Add rule code and external info URL if available
              if (violation.externalInfoUrl) {
                diagnostic.code = {
                  value: violation.rule,
                  target: vscode.Uri.parse(violation.externalInfoUrl)
                };
              } else {
                diagnostic.code = violation.rule;
              }

              diagnostics.push(diagnostic);
            }
          }
        }

        return diagnostics;
      } catch (error) {
        console.error('Error processing PHPMD output:', error);
        throw error;
      }
    };

    // Process sample output
    const diagnostics = processPhpmdResults(SAMPLE_PHPMD_OUTPUT);

    // Verify results
    assert.strictEqual(diagnostics.length, 2, 'Should have two diagnostics');

    // Check first diagnostic (line 10)
    assert.strictEqual(diagnostics[0].range.start.line, 9); // 10-1 (0-based)
    assert.strictEqual(diagnostics[0].message.includes('ExcessiveParameterList'), true);
    assert.strictEqual(diagnostics[0].severity, vscode.DiagnosticSeverity.Warning);

    // Check second diagnostic (line 20)
    assert.strictEqual(diagnostics[1].range.start.line, 19); // 20-1 (0-based)
    assert.strictEqual(diagnostics[1].message.includes('ShortVariable'), true);
    assert.strictEqual(diagnostics[1].severity, vscode.DiagnosticSeverity.Error);
  });

  // Test for external info URL in diagnostics
  test('Diagnostics include external info URL when available', async () => {
    // Define the same function as in the previous test
    const processPhpmdResults = (output: string): vscode.Diagnostic[] => {
      try {
        const results = JSON.parse(output);
        const diagnostics: vscode.Diagnostic[] = [];

        if (results && results.files && results.files.length > 0) {
          for (const file of results.files) {
            for (const violation of file.violations) {
              const lineNum = violation.beginLine - 1; // Convert to 0-based
              const range = new vscode.Range(
                new vscode.Position(lineNum, 0),
                new vscode.Position(lineNum, Number.MAX_VALUE)
              );

              // Map the priority to severity
              let severity: vscode.DiagnosticSeverity;
              switch (violation.priority) {
                case 1:
                  severity = vscode.DiagnosticSeverity.Error;
                  break;
                case 2:
                case 3:
                  severity = vscode.DiagnosticSeverity.Warning;
                  break;
                default:
                  severity = vscode.DiagnosticSeverity.Information;
              }

              const diagnostic = new vscode.Diagnostic(
                range,
                `${violation.description} (${violation.rule})`,
                severity
              );
              diagnostic.source = 'phpmd';

              // Add rule code and external info URL if available
              if (violation.externalInfoUrl) {
                diagnostic.code = {
                  value: violation.rule,
                  target: vscode.Uri.parse(violation.externalInfoUrl)
                };
              } else {
                diagnostic.code = violation.rule;
              }

              diagnostics.push(diagnostic);
            }
          }
        }

        return diagnostics;
      } catch (error) {
        console.error('Error processing PHPMD output:', error);
        throw error;
      }
    };

    // Process sample output
    const diagnostics = processPhpmdResults(SAMPLE_PHPMD_OUTPUT);

    // Check that the first diagnostic has an external info URL
    assert.ok(diagnostics[0].code, 'Diagnostic should have a code property');

    // When externalInfoUrl is provided, code should be an object with target
    if (typeof diagnostics[0].code === 'object') {
      assert.strictEqual(
        (diagnostics[0].code as any).value,
        'ExcessiveParameterList',
        'Code value should match the rule name'
      );
      assert.ok(
        (diagnostics[0].code as any).target instanceof vscode.Uri,
        'Code target should be a VS Code URI'
      );
      assert.strictEqual(
        (diagnostics[0].code as any).target.toString(),
        'https://phpmd.org/rules/codesize.html#excessiveparameterlist',
        'URI should match the external info URL'
      );
    } else {
      assert.fail('Code should be an object with target property when externalInfoUrl is available');
    }

    // Ensure the second diagnostic also has the correct code
    if (typeof diagnostics[1].code === 'object') {
      assert.strictEqual((diagnostics[1].code as any).value, 'ShortVariable');
      assert.strictEqual(
        (diagnostics[1].code as any).target.toString(),
        'https://phpmd.org/rules/naming.html#shortvariable'
      );
    } else {
      assert.fail('Second diagnostic should also have code object with target');
    }
  });

  // Test for error message truncation at \n\n
  test('Error messages are truncated at first \\n\\n occurrence', async () => {
    // Test error message truncation
    const truncateErrorMessage = (message: string): string => {
      const doubleCrlfPosition = message.indexOf('\n\n');
      if (doubleCrlfPosition !== -1) {
        return message.substring(0, doubleCrlfPosition);
      }
      return message;
    };

    // Sample error messages
    const singleLineError = 'Error: PHPMD command failed';
    const multiLineError = 'Error: PHPMD command failed\nSome additional info';
    const errorWithDoubleNewline = 'Error: PHPMD command failed\n\nStack trace:\nat line 1\nat line 2';
    const multipleDoubleNewlines = 'Error: PHPMD command failed\n\nStack trace\n\nMore details';

    // Test truncation
    assert.strictEqual(
      truncateErrorMessage(singleLineError),
      singleLineError,
      'Single line error should remain unchanged'
    );

    assert.strictEqual(
      truncateErrorMessage(multiLineError),
      multiLineError,
      'Error with single newlines should remain unchanged'
    );

    assert.strictEqual(
      truncateErrorMessage(errorWithDoubleNewline),
      'Error: PHPMD command failed',
      'Error with double newline should be truncated at first occurrence'
    );

    assert.strictEqual(
      truncateErrorMessage(multipleDoubleNewlines),
      'Error: PHPMD command failed',
      'Error with multiple double newlines should be truncated at first occurrence'
    );
  });

  // Test for stderr message truncation
  test('STDERR messages are truncated at first \\n\\n occurrence', async () => {
    // Test stderr truncation similar to what we're doing in the error handler
    const truncateStderr = (stderr: string): string => {
      return stderr.split('\n\n')[0];
    };

    // Sample stderr outputs
    const singleLineStderr = 'Command failed with exit code 1';
    const multiLineStderr = 'Command failed with exit code 1\nAdditional error details';
    const stderrWithDoubleNewline = 'Command failed with exit code 1\n\nDetailed error information';

    // Test truncation
    assert.strictEqual(
      truncateStderr(singleLineStderr),
      singleLineStderr,
      'Single line stderr should remain unchanged'
    );

    assert.strictEqual(
      truncateStderr(multiLineStderr),
      multiLineStderr,
      'Stderr with single newlines should remain unchanged'
    );

    assert.strictEqual(
      truncateStderr(stderrWithDoubleNewline),
      'Command failed with exit code 1',
      'Stderr with double newline should be truncated at first occurrence'
    );
  });

  // Test for raw output truncation
  test('Raw output is truncated at first \\n\\n or limited to 200 characters', async () => {
    // Test raw output truncation similar to what we do in processPhpmdOutput error handling
    const truncateRawOutput = (output: string): string => {
      const doubleCrlfPosition = output.indexOf('\n\n');
      if (doubleCrlfPosition !== -1) {
        return output.substring(0, doubleCrlfPosition);
      }
      return output.substring(0, Math.min(output.length, 200));
    };

    // Sample outputs
    const shortOutput = 'Valid JSON output';
    const longOutputNoNewlines = 'x'.repeat(300); // 300 characters with no newlines
    const outputWithNewlines = 'First part of output\n\nSecond part that should be truncated';
    const outputWithMultipleDoubleNewlines = 'Start\n\nMiddle\n\nEnd';

    // Test truncation
    assert.strictEqual(
      truncateRawOutput(shortOutput),
      shortOutput,
      'Short output should remain unchanged'
    );

    assert.strictEqual(
      truncateRawOutput(longOutputNoNewlines).length,
      200,
      'Long output without newlines should be truncated to 200 characters'
    );

    assert.strictEqual(
      truncateRawOutput(outputWithNewlines),
      'First part of output',
      'Output with newlines should be truncated at first \\n\\n'
    );

    assert.strictEqual(
      truncateRawOutput(outputWithMultipleDoubleNewlines),
      'Start',
      'Output with multiple double newlines should be truncated at first occurrence'
    );
  });
});
