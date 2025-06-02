import * as vscode from 'vscode';
import { execSync } from 'child_process';

// Configuration interface
interface PhpmdConfig {
    enable: boolean;
    validateOn: string;
    rulesets: string[];
    minSeverity: string;
    configPath: string;
}

class PhpmdService {
    private diagnosticCollection: vscode.DiagnosticCollection;
    private config: PhpmdConfig;
    private documentValidation: any;

    constructor(context: vscode.ExtensionContext) {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection('phpmd');
        context.subscriptions.push(this.diagnosticCollection);
        this.config = this.getConfig();

        // Register configuration change listener
        context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration(this.onConfigurationChanged, this)
        );

        // Register save and typing events
        context.subscriptions.push(
            vscode.workspace.onDidSaveTextDocument(this.onDocumentSave, this),
            vscode.workspace.onDidChangeTextDocument(this.onDocumentChange, this)
        );

        // Register command for manual analysis
        context.subscriptions.push(
            vscode.commands.registerCommand('ddev-phpmd.analyzeCurrentFile', () => {
                const editor = vscode.window.activeTextEditor;
                if (editor) {
                    this.analyzeFile(editor.document);
                }
            })
        );
    }

    private getConfig(): PhpmdConfig {
        const config = vscode.workspace.getConfiguration('ddev-phpmd');
        return {
            enable: config.get('enable', true),
            validateOn: config.get('validateOn', 'save'),
            rulesets: config.get('rulesets', ['cleancode', 'codesize', 'controversial', 'design', 'naming', 'unusedcode']),
            minSeverity: config.get('minSeverity', 'warning'),
            configPath: config.get('configPath', '')
        };
    }

    private onConfigurationChanged(event: vscode.ConfigurationChangeEvent): void {
        if (event.affectsConfiguration('ddev-phpmd')) {
            this.config = this.getConfig();
        }
    }

    private onDocumentSave(document: vscode.TextDocument): void {
        if (document.languageId === 'php' && this.config.enable) {
            this.analyzeFile(document);
        }
    }

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

    private isDdevProject(document: vscode.TextDocument): boolean {
        try {
            // Get workspace folder containing the current file
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
            if (!workspaceFolder) {
                return false;
            }

            // Check if .ddev/config.yaml exists
            const ddevConfig = execSync('test -f .ddev/config.yaml && echo "exists"', {
                cwd: workspaceFolder.uri.fsPath,
                encoding: 'utf-8'
            });

            if (!ddevConfig.includes('exists')) {
                return false;
            }

            // Check if DDEV is running
            execSync('ddev status', {
                cwd: workspaceFolder.uri.fsPath,
                stdio: 'ignore'
            });
            return true;
        } catch (error) {
            return false;
        }
    }

    public async analyzeFile(document: vscode.TextDocument): Promise<void> {
        if (!this.config.enable || document.languageId !== 'php') {
            return;
        }

        if (!this.isDdevProject(document)) {
            vscode.window.showErrorMessage('This workspace is not a DDEV project. Please make sure: 1. You are in a DDEV project directory, 2. The .ddev/config.yaml file exists, 3. DDEV is running (use "ddev start")');
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

            // Determine PHPMD command based on configuration
            let cmd: string;
            if (this.config.configPath) {
                // Use custom ruleset XML file if configured
                const configPath = vscode.workspace.asRelativePath(this.config.configPath);
                cmd = `ddev exec phpmd "${relativePath}" json "${configPath}"`;
            } else {
                // Use default rulesets if no config file is specified
                const rulesets = this.config.rulesets.join(',');
                cmd = `ddev exec phpmd "${relativePath}" json ${rulesets}`;
            }
            try {
                const output = execSync(cmd, {
                    encoding: 'utf-8',
                    cwd: workspaceFolder.uri.fsPath
                });
                this.processPhpmdResults(output, document);
            } catch (execError: any) {
                // If PHPMD produced any output, process it regardless of exit code
                if (execError.stdout) {
                    this.processPhpmdResults(execError.stdout, document);
                } else {
                    // Only treat it as an error if we got no output at all
                    console.error('Error executing PHPMD:', execError);
                    vscode.window.showErrorMessage('Error running PHPMD. Make sure PHPMD is installed in your DDEV container.');
                }
            }
        } catch (error) {
            console.error('Error running PHPMD:', error);
            vscode.window.showErrorMessage('Error running PHPMD. Make sure PHPMD is installed in your DDEV container.');
        }
    }

    private processPhpmdResults(output: string, document: vscode.TextDocument): void {
        try {
            const results = JSON.parse(output);
            const diagnostics: vscode.Diagnostic[] = [];

            if (results && results.files && results.files.length > 0) {
                for (const file of results.files) {
                    for (const violation of file.violations) {
                        const lineNum = violation.beginLine - 1;
                        const range = new vscode.Range(
                            new vscode.Position(lineNum, 0),
                            new vscode.Position(lineNum, Number.MAX_VALUE)
                        );

                        const severity = this.getSeverity(violation.priority);
                        if (this.shouldReportSeverity(severity)) {
                            const diagnostic = new vscode.Diagnostic(
                                range,
                                `${violation.description} (${violation.rule})`,
                                severity
                            );
                            diagnostic.source = 'phpmd';
                            diagnostics.push(diagnostic);
                        }
                    }
                }
            }

            // Update diagnostics (clear if empty, set if there are issues)
            this.diagnosticCollection.delete(document.uri);
            if (diagnostics.length > 0) {
                this.diagnosticCollection.set(document.uri, diagnostics);
            }
        } catch (error) {
            console.error('Error processing PHPMD output:', error);
            throw error;
        }
    }

    private getSeverity(priority: number): vscode.DiagnosticSeverity {
        // PHPMD priorities: 1 = high, 2 = medium-high, 3 = medium-low, 4 = low, 5 = information
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
    }

    private shouldReportSeverity(severity: vscode.DiagnosticSeverity): boolean {
        const minSeverity = this.config.minSeverity;

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
    }

    public dispose(): void {
        this.diagnosticCollection.dispose();
    }
}

let phpmdService: PhpmdService;

export function activate(context: vscode.ExtensionContext) {
    console.log('DDEV PHPMD extension is now active!');
    phpmdService = new PhpmdService(context);
}

export function deactivate() {
    if (phpmdService) {
        phpmdService.dispose();
    }
}
