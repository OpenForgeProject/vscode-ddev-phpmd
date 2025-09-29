/*
 * This file is part of the @openforgeproject/vscode-ddev-utils package.
 * Will be extracted to a shared NPM package in the future.
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
import { DdevUtils } from '../utils/ddev-utils';

/**
 * Configuration interface for PHP tools
 */
export interface PhpToolConfig {
    enable: boolean;
    validateOn: 'save' | 'type';
    minSeverity: 'error' | 'warning' | 'info';
}

/**
 * Base class for PHP quality tool services that work with DDEV
 *
 * This class will be part of the @openforgeproject/vscode-ddev-utils package
 * and provides common functionality for all DDEV-based PHP quality tools.
 */
export abstract class BasePhpToolService {
    protected diagnosticCollection: vscode.DiagnosticCollection;
    protected documentValidation: NodeJS.Timeout | undefined;

    constructor(
        protected readonly context: vscode.ExtensionContext,
        protected readonly toolName: string,
        protected readonly displayName: string
    ) {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection(toolName);
        context.subscriptions.push(this.diagnosticCollection);

        this.registerEventHandlers();
    }

    /**
     * Get the tool configuration from VS Code settings
     */
    protected abstract getConfig(): PhpToolConfig;

    /**
     * Build the command to execute the tool
     */
    protected abstract buildToolCommand(relativePath: string): string;

    /**
     * Process the tool output and convert to diagnostics
     */
    protected abstract processToolOutput(output: string, document: vscode.TextDocument): void;

    /**
     * Register event handlers for document changes
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
     * Handle configuration changes
     */
    private onConfigurationChanged(event: vscode.ConfigurationChangeEvent): void {
        if (event.affectsConfiguration(`ddev-${this.toolName}`)) {
            const config = this.getConfig();

            // Clear diagnostics if the tool is disabled
            if (!config.enable) {
                this.diagnosticCollection.clear();
            }

            // Allow subclasses to react to config changes
            this.onConfigurationChangedInternal(event);
        }
    }

    /**
     * Hook for subclasses to handle configuration changes
     * Override this method in subclasses if needed
     */
    protected onConfigurationChangedInternal(event: vscode.ConfigurationChangeEvent): void {
        // Default implementation does nothing
        // Subclasses can override this method
    }

    /**
     * Handle document save events
     */
    private onDocumentSave(document: vscode.TextDocument): void {
        const config = this.getConfig();
        if (document.languageId === 'php' && config.enable && config.validateOn === 'save') {
            this.analyzeFile(document);
        }
    }

    /**
     * Handle document change events
     */
    private onDocumentChange(event: vscode.TextDocumentChangeEvent): void {
        const config = this.getConfig();
        if (event.document.languageId !== 'php' || !config.enable || config.validateOn !== 'type') {
            return;
        }

        // Debounce validation to avoid running the tool too frequently
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
    public analyzeCurrentFile(): void {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            this.analyzeFile(editor.document);
        }
    }

    /**
     * Analyze a PHP file using the tool
     */
    public async analyzeFile(document: vscode.TextDocument): Promise<void> {
        const config = this.getConfig();
        if (!config.enable || document.languageId !== 'php') {
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
                    detail: `This extension requires a running DDEV environment. Please make sure:\n\n` +
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

            // Build tool command
            const toolCommand = this.buildToolCommand(relativePath);

            // Execute tool command
            const output = DdevUtils.execDdev(toolCommand, workspaceFolder.uri.fsPath);

            // Process output
            this.processToolOutput(output, document);
        } catch (error: any) {
            console.error(`Error running ${this.displayName}:`, error);

            // Show a more detailed error message to the user
            let errorMessage = error.message || String(error);

            // Cut the message at first occurrence of \n\n
            const doubleCrlfPosition = errorMessage.indexOf('\n\n');
            if (doubleCrlfPosition !== -1) {
                errorMessage = errorMessage.substring(0, doubleCrlfPosition);
            }

            const detailedMessage = error.stderr
                ? `${this.displayName} Error: ${error.stderr.split('\n\n')[0]}`
                : `Error running ${this.displayName}: ${errorMessage}`;

            vscode.window.showErrorMessage(
                detailedMessage,
                { modal: false, detail: `Make sure ${this.displayName} is installed in your DDEV container.` }
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
