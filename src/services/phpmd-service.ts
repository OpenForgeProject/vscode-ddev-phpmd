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

import * as vscode from 'vscode';
import { PhpmdConfig } from '../models/configuration';
import { PhpmdResult } from '../models/phpmd-result';
import { ConfigurationService } from './configuration-service';
import { DiagnosticUtils } from '../utils/diagnostic-utils';
import { BasePhpToolService, PhpToolConfig } from '../shared/services/base-php-tool-service';

/**
 * Service for analyzing PHP files using PHPMD
 */
export class PhpmdService extends BasePhpToolService {
    private config: PhpmdConfig;

    /**
     * Create a new PHPMD service
     *
     * @param context VS Code extension context
     */
    constructor(context: vscode.ExtensionContext) {
        super(context, 'phpmd', 'PHPMD');
        this.config = ConfigurationService.getConfig();
    }

    /**
     * Get the PHPMD configuration
     */
    protected getConfig(): PhpToolConfig {
        this.config = ConfigurationService.getConfig();
        return {
            enable: this.config.enable,
            validateOn: this.config.validateOn as 'save' | 'type',
            minSeverity: this.config.minSeverity as 'error' | 'warning' | 'info'
        };
    }

    /**
     * Build the PHPMD command
     *
     * @param relativePath Path to the file relative to the workspace root
     * @returns PHPMD command
     */
    protected buildToolCommand(relativePath: string): string {
        if (this.config.configPath) {
            // Use custom ruleset XML file if configured
            const configPath = vscode.workspace.asRelativePath(this.config.configPath);
            return `phpmd "${relativePath}" json "${configPath}"`;
        } else {
            // Use default rulesets if no config file is specified
            const rulesets = this.config.rulesets.join(',');
            return `phpmd "${relativePath}" json ${rulesets}`;
        }
    }

    /**
     * Process the PHPMD output and update diagnostics
     *
     * @param output PHPMD output
     * @param document Document that was analyzed
     */
    protected processToolOutput(output: string, document: vscode.TextDocument): void {
        // Store original output for error reporting
        const originalOutput = output;

        try {
            // Parse output
            const result = JSON.parse(output) as PhpmdResult;
            const diagnostics: vscode.Diagnostic[] = [];

            // Process violations
            if (result.files && result.files.length > 0) {
                for (const file of result.files) {
                    for (const violation of file.violations) {
                        // Convert violation to diagnostic
                        const severity = DiagnosticUtils.getSeverity(violation.priority);
                        if (DiagnosticUtils.shouldReportSeverity(severity, this.config.minSeverity)) {
                            const diagnostic = DiagnosticUtils.createDiagnostic(violation);
                            diagnostics.push(diagnostic);
                        }
                    }
                }
            }

            // Update diagnostics
            if (diagnostics.length > 0) {
                this.diagnosticCollection.set(document.uri, diagnostics);
            }
        } catch (error: any) {
            console.error('Error processing PHPMD output:', error);

            // Extract a readable error message
            let errorMessage = error.message || String(error);

            // Cut the message at first occurrence of \n\n
            const doubleCrlfPosition = errorMessage.indexOf('\n\n');
            if (doubleCrlfPosition !== -1) {
                errorMessage = errorMessage.substring(0, doubleCrlfPosition);
            }

            // Show the raw output for debugging if it's available
            let detail = 'There was a problem processing the PHPMD output.';
            if (originalOutput) {
                const shortenedOutput = originalOutput.indexOf('\n\n') !== -1
                    ? originalOutput.substring(0, originalOutput.indexOf('\n\n'))
                    : originalOutput.substring(0, 200);

                detail += `\n\nRaw output:\n${shortenedOutput}${originalOutput.length > shortenedOutput.length ? '...' : ''}`;
            }

            vscode.window.showErrorMessage(
                `Error processing PHPMD output: ${errorMessage}`,
                { modal: false, detail: detail }
            );
        }
    }
}
