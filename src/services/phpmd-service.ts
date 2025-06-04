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
import { DdevUtils } from '../utils/ddev-utils';
import { DiagnosticUtils } from '../utils/diagnostic-utils';

/**
 * Service for analyzing PHP files using PHPMD
 */
export class PhpmdService {
    private diagnosticCollection: vscode.DiagnosticCollection;
    private config: PhpmdConfig;
    private documentValidation: NodeJS.Timeout | undefined;

    /**
     * Create a new PHPMD service
     *
     * @param context VS Code extension context
     */
    constructor(private readonly context: vscode.ExtensionContext) {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('phpmd');
        context.subscriptions.push(this.diagnosticCollection);
        this.config = ConfigurationService.getConfig();

        this.registerEventHandlers();
        this.registerCommands();
    }

    /**
     * Register event handlers
     */
    private registerEventHandlers(): void {
        // Register configuration change listener
        this.context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration(this.onConfigurationChanged, this)
        );

        // Register save and typing events
        this.context.subscriptions.push(
            vscode.workspace.onDidSaveTextDocument(this.onDocumentSave, this),
            vscode.workspace.onDidChangeTextDocument(this.onDocumentChange, this)
        );
    }

    /**
     * Register commands
     */
    private registerCommands(): void {
        // Register command for manual analysis
        this.context.subscriptions.push(
            vscode.commands.registerCommand('ddev-phpmd.analyzeCurrentFile', this.analyzeCurrentFile, this)
        );
    }

    /**
     * Handle configuration changes
     *
     * @param event Configuration change event
     */
    private onConfigurationChanged(event: vscode.ConfigurationChangeEvent): void {
        if (event.affectsConfiguration('ddev-phpmd')) {
            this.config = ConfigurationService.getConfig();
        }
    }

    /**
     * Handle document save events
     *
     * @param document Saved document
     */
    private onDocumentSave(document: vscode.TextDocument): void {
        if (document.languageId === 'php' && this.config.enable) {
            this.analyzeFile(document);
        }
    }

    /**
     * Handle document change events
     *
     * @param event Document change event
     */
    private onDocumentChange(event: vscode.TextDocumentChangeEvent): void {
        if (event.document.languageId !== 'php' || !this.config.enable || this.config.validateOn !== 'type') {
            return;
        }

        // Debounce validation to avoid running PHPMD too frequently
        if (this.documentValidation) {
            clearTimeout(this.documentValidation);
        }

        this.documentValidation = setTimeout(() => {
            this.analyzeFile(event.document);
        }, 500);
    }

    /**
     * Analyze the current file
     */
    private analyzeCurrentFile(): void {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            this.analyzeFile(editor.document);
        }
    }

    /**
     * Analyze a PHP file using PHPMD
     *
     * @param document Document to analyze
     */
    public async analyzeFile(document: vscode.TextDocument): Promise<void> {
        if (!this.config.enable || document.languageId !== 'php') {
            return;
        }

        // Clear existing diagnostics
        this.diagnosticCollection.delete(document.uri);

        // Check if it's a DDEV project
        if (!DdevUtils.isDdevProject(document)) {
            vscode.window.showErrorMessage(
                'DDEV environment not detected',
                {
                    modal: false,
                    detail: 'This extension requires a running DDEV environment. Please make sure:\n\n' +
                            '1. You are in a DDEV project directory\n' +
                            '2. The .ddev/config.yaml file exists\n' +
                            '3. DDEV is running (use "ddev start" in terminal)\n\n' +
                            'If DDEV is already running, try restarting it with "ddev restart".'
                }
            );
            return;
        }

        try {
            // Get workspace folder for the current file
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
            if (!workspaceFolder) {
                throw new Error('No workspace folder found for the current file');
            }

            // Convert absolute path to relative path from workspace root
            const relativePath = vscode.workspace.asRelativePath(document.uri);

            // Build PHPMD command
            const phpmdCommand = this.buildPhpmdCommand(relativePath);

            // Execute PHPMD command
            const output = DdevUtils.execDdev(phpmdCommand, workspaceFolder.uri.fsPath);

            // Process output
            this.processPhpmdOutput(output, document);
        } catch (error: any) {
            console.error('Error running PHPMD:', error);

            // Show a more detailed error message to the user
            let errorMessage = error.message || String(error);

            // Cut the message at first occurrence of \n\n
            const doubleCrlfPosition = errorMessage.indexOf('\n\n');
            if (doubleCrlfPosition !== -1) {
                errorMessage = errorMessage.substring(0, doubleCrlfPosition);
            }

            const detailedMessage = error.stderr
                ? `PHPMD Error: ${error.stderr.split('\n\n')[0]}`
                : `Error running PHPMD: ${errorMessage}`;

            vscode.window.showErrorMessage(
                detailedMessage,
                { modal: false, detail: 'Make sure PHPMD is installed in your DDEV container.' }
            );
        }
    }

    /**
     * Build the PHPMD command
     *
     * @param relativePath Path to the file relative to the workspace root
     * @returns PHPMD command
     */
    private buildPhpmdCommand(relativePath: string): string {
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
    private processPhpmdOutput(output: string, document: vscode.TextDocument): void {
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

    /**
     * Dispose of resources
     */
    public dispose(): void {
        this.diagnosticCollection.dispose();
        if (this.documentValidation) {
            clearTimeout(this.documentValidation);
        }
    }
}
