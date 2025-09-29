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
import { PhpmdService } from './services/phpmd-service';
import { DdevUtils } from './shared/utils/ddev-utils';
import type { DdevValidationResult } from './shared/utils/ddev-utils';
import { ConfigurationService } from './services/configuration-service';

// Global service instance
let phpmdService: PhpmdService | undefined;

// Status bar item
let statusBarItem: vscode.StatusBarItem | undefined;

// Track current file diagnostic status
let currentFileHasIssues = false;

// Track DDEV service status
let ddevServiceStatus: 'disabled' | 'ready' | 'has-issues' | 'not-available' = 'disabled';

// Extension context for reinitialization
let extensionContext: vscode.ExtensionContext | undefined;

/**
 * Get the extension context
 */
function getExtensionContext(): vscode.ExtensionContext {
    if (!extensionContext) {
        throw new Error('Extension context not available');
    }
    return extensionContext;
}

/**
 * Shows standardized error message for DDEV-related issues with appropriate action buttons
 */
function showDdevError(validationResult: DdevValidationResult): void {
    const message = validationResult.userMessage || 'DDEV configuration issue';

    // Determine appropriate buttons based on error type
    const buttons: string[] = [];

    if (message.includes('appears to be stopped') ||
        message.includes('not currently running')) {
        buttons.push("Start DDEV");
    }

    buttons.push("Disable for this project");

    vscode.window.showWarningMessage(message, ...buttons).then(selection => {
        if (selection === "Start DDEV") {
            // Get the current workspace folder
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (workspaceFolder) {
                vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: "Starting DDEV...",
                    cancellable: false
                }, async () => {
                    try {
                        await vscode.commands.executeCommand('workbench.action.terminal.new');
                        await vscode.commands.executeCommand('workbench.action.terminal.sendSequence', {
                            text: `cd "${workspaceFolder.uri.fsPath}" && ddev start\n`
                        });
                        vscode.window.showInformationMessage("DDEV start command sent to terminal");
                    } catch (error) {
                        vscode.window.showErrorMessage("Failed to start DDEV: " + error);
                    }
                });
            }
        } else if (selection === "Disable for this project") {
            vscode.commands.executeCommand('ddev-phpmd.disable');
        }
    });
}

/**
 * Analyze the current file if the service is available and enabled
 */
function analyzeCurrentFile() {
    const config = ConfigurationService.getConfig();
    if (!config.enable) {
        vscode.window.showWarningMessage('PHPMD is disabled. Enable it first to analyze files.');
        return;
    }

    // Try to initialize service if not available
    if (!phpmdService) {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            console.log('Attempting to reinitialize PHPMD service...');

            const validationResult = DdevUtils.validateDdevTool('phpmd', workspaceFolders[0].uri.fsPath);
            if (!validationResult.isValid) {
                showDdevError(validationResult);
                return;
            }

            // If validation passed, try to initialize service
            const success = initializeService(getExtensionContext(), workspaceFolders[0], true);
            if (!success) {
                return;
            }
        } else {
            vscode.window.showWarningMessage('No workspace folder found.');
            return;
        }
    }

    // Service should be available now
    if (phpmdService) {
        phpmdService.analyzeCurrentFile();
    }
}

/**
 * Update the DDEV service status
 */
function updateDdevServiceStatus() {
    const config = ConfigurationService.getConfig();

    if (!config.enable) {
        ddevServiceStatus = 'disabled';
        return;
    }

    // Check if we're in a workspace
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        ddevServiceStatus = 'not-available';
        return;
    }

    const workspaceFolder = workspaceFolders[0];
    const validationResult = DdevUtils.validateDdevTool('phpmd', workspaceFolder.uri.fsPath);

    if (!validationResult.isValid) {
        ddevServiceStatus = 'not-available';
    } else if (currentFileHasIssues) {
        ddevServiceStatus = 'has-issues';
    } else {
        ddevServiceStatus = 'ready';
    }
}
/**
 * Check if the current active file has PHPMD issues
 */
function checkCurrentFileStatus() {
    const editor = vscode.window.activeTextEditor;
    if (!editor || !phpmdService) {
        currentFileHasIssues = false;
        updateDdevServiceStatus();
        updateStatusBar();
        return;
    }

    const document = editor.document;
    if (document.languageId !== 'php') {
        currentFileHasIssues = false;
        updateDdevServiceStatus();
        updateStatusBar();
        return;
    }

    // Get diagnostics for the current file
    const diagnostics = vscode.languages.getDiagnostics(document.uri);
    const phpmdDiagnostics = diagnostics.filter(diagnostic =>
        diagnostic.source === 'phpmd'
    );

    currentFileHasIssues = phpmdDiagnostics.length > 0;
    updateDdevServiceStatus();
    updateStatusBar();
}

/**
 * Update status bar based on current configuration and file status and file status
 */
function updateStatusBar() {
    if (!statusBarItem) {
        return;
    }

    switch (ddevServiceStatus) {
        case 'disabled':
            // Extension is disabled
            statusBarItem.text = "$(circle-slash) PHPMD";
            statusBarItem.tooltip = "PHPMD is disabled. Click to enable.";
            statusBarItem.command = "ddev-phpmd.enable";
            statusBarItem.color = new vscode.ThemeColor('statusBarItem.warningForeground');
            break;

        case 'not-available':
            // DDEV not running or tool not installed
            statusBarItem.text = "$(warning) PHPMD";
            statusBarItem.tooltip = "PHPMD service is not available. Click to retry or check DDEV status.";
            statusBarItem.command = "ddev-phpmd.analyzeCurrentFile";
            statusBarItem.color = new vscode.ThemeColor('statusBarItem.errorForeground');
            break;

        case 'has-issues':
            // Extension is enabled and current file has issues
            statusBarItem.text = "$(error) PHPMD";
            statusBarItem.tooltip = "PHPMD found issues in current file. Click to analyze again.";
            statusBarItem.command = "ddev-phpmd.analyzeCurrentFile";
            statusBarItem.color = new vscode.ThemeColor('statusBarItem.errorForeground');
            break;

        case 'ready':
        default:
            // Extension is enabled and current file is clean (or not analyzed yet)
            statusBarItem.text = "$(check) PHPMD";
            statusBarItem.tooltip = "PHPMD is active. Click to analyze current file.";
            statusBarItem.command = "ddev-phpmd.analyzeCurrentFile";
            statusBarItem.color = new vscode.ThemeColor('statusBarItem.prominentForeground');
            break;
    }
}

/**
 * Initialize or reinitialize the PHPMD service based on configuration
 */
function initializeService(context: vscode.ExtensionContext, workspaceFolder: vscode.WorkspaceFolder, silent: boolean = false) {
    const config = ConfigurationService.getConfig();

    if (config.enable) {
        if (!phpmdService) {
            const validationResult = DdevUtils.validateDdevTool('phpmd', workspaceFolder.uri.fsPath);

            if (!validationResult.isValid) {
                // Only show error if not silent (e.g., during initial activation)
                if (!silent) {
                    showDdevError(validationResult);
                }
                updateDdevServiceStatus();
                updateStatusBar();
                return false;
            }

            phpmdService = new PhpmdService(context);
            console.log('PHPMD service initialized.');
        }
    } else {
        if (phpmdService) {
            phpmdService.dispose();
            phpmdService = undefined;
            console.log('PHPMD service disposed.');
        }
    }

    updateDdevServiceStatus();
    updateStatusBar();
    return true;
}

/**
 * Activate the extension
 *
 * @param context VS Code extension context
 */
export function activate(context: vscode.ExtensionContext) {
    console.log('DDEV PHPMD extension is now active!');

    // Store extension context for later use
    extensionContext = context;

    // Check if we're in a workspace
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        console.log('No workspace folder found. DDEV PHPMD extension will not activate.');
        return;
    }

    // Get the first workspace folder
    const workspaceFolder = workspaceFolders[0];

    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // Initialize service based on configuration
    initializeService(context, workspaceFolder);

    // Set up periodic check for DDEV recovery (every 30 seconds)
    const periodicCheck = setInterval(() => {
        const config = ConfigurationService.getConfig();
        if (config.enable && !phpmdService) {
            console.log('Periodic check: Attempting to recover PHPMD service...');
            initializeService(context, workspaceFolder, true); // Silent retry
        }
    }, 30000);

    // Clean up interval on extension deactivation
    context.subscriptions.push({
        dispose: () => clearInterval(periodicCheck)
    });

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('ddev-phpmd.analyzeCurrentFile', analyzeCurrentFile),

        vscode.commands.registerCommand('ddev-phpmd.enable', async () => {
            const config = vscode.workspace.getConfiguration('ddev-phpmd');
            await config.update('enable', true, vscode.ConfigurationTarget.Workspace);
            vscode.window.showInformationMessage('DDEV PHPMD enabled.');
        }),

        vscode.commands.registerCommand('ddev-phpmd.disable', async () => {
            const config = vscode.workspace.getConfiguration('ddev-phpmd');
            await config.update('enable', false, vscode.ConfigurationTarget.Workspace);
            vscode.window.showInformationMessage('DDEV PHPMD disabled.');
        }),

        vscode.commands.registerCommand('ddev-phpmd.toggle', async () => {
            const config = vscode.workspace.getConfiguration('ddev-phpmd');
            const currentValue = config.get('enable', true);
            await config.update('enable', !currentValue, vscode.ConfigurationTarget.Workspace);
            vscode.window.showInformationMessage(`DDEV PHPMD ${!currentValue ? 'enabled' : 'disabled'}.`);
        })
    );

    // Listen for configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration('ddev-phpmd.enable')) {
                initializeService(context, workspaceFolder);
            }
        })
    );

    // Listen for active editor changes to update status bar
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(() => {
            checkCurrentFileStatus();
        })
    );

    // Listen for diagnostic changes to update status bar
    context.subscriptions.push(
        vscode.languages.onDidChangeDiagnostics((event) => {
            const editor = vscode.window.activeTextEditor;
            if (editor && event.uris.some(uri => uri.toString() === editor.document.uri.toString())) {
                checkCurrentFileStatus();
            }
        })
    );

    // Initial check of current file status
    checkCurrentFileStatus();
}

/**
 * Deactivate the extension
 */
export function deactivate() {
    // Clean up resources
    if (phpmdService) {
        phpmdService.dispose();
        phpmdService = undefined;
    }

    // Dispose of status bar item
    if (statusBarItem) {
        statusBarItem.dispose();
        statusBarItem = undefined;
    }
}
