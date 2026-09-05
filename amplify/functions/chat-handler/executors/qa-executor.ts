import { Builder, WebDriver, By, until, WebElement } from 'selenium-webdriver';
import { Options as ChromeOptions } from 'selenium-webdriver/chrome';
import { Options as FirefoxOptions } from 'selenium-webdriver/firefox';
import axios from 'axios';



export type TargetPlatform = 'WEB_CHROME' | 'WEB_FIREFOX' | 'MOBILE_ANDROID' | 'MOBILE_IOS';

export interface TestExecutionIntent {
  taskId: string;
  jiraTicketKey?: string;
  platform: TargetPlatform;
  targetUrlOrApp: string;
  actions: AgenticAction[];
  gridUrl: string;
  appiumOptions?: Record<string, any>;
  timeoutMs?: number;
}

export interface AgenticAction {
  id: string;
  type: 'CLICK' | 'TYPE' | 'NAVIGATE' | 'ASSERT_TEXT' | 'CAPTURE_SCREENSHOT' | 'SWIPE';
  selectorPrimary?: string;       
  selectorFallbacks?: string[];   
  semanticLabel?: string;         
  value?: string;                 
}

export interface StepResult {
  actionId: string;
  success: boolean;
  healed: boolean;
  usedSelector?: string;
  durationMs: number;
  error?: string;
  screenshotBase64?: string;
}

export interface ExecutionReport {
  taskId: string;
  jiraTicketKey?: string;
  platform: TargetPlatform;
  status: 'PASSED' | 'FAILED' | 'HEALED_PASSED';
  totalDurationMs: number;
  steps: StepResult[];
  summaryMarkdown: string;
}



export class QAExecutor {
  private driver: WebDriver | null = null;
  private jiraBaseUrl: string;
  private jiraAuthHeader: string;

  constructor(jiraBaseUrl?: string, jiraApiToken?: string, jiraEmail?: string) {
    this.jiraBaseUrl = jiraBaseUrl || process.env.JIRA_BASE_URL || '';
    const email = jiraEmail || process.env.JIRA_USER_EMAIL || '';
    const token = jiraApiToken || process.env.JIRA_API_TOKEN || '';
    this.jiraAuthHeader = `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`;
  }

  
  public async executeTask(intent: TestExecutionIntent): Promise<ExecutionReport> {
    const startTime = Date.now();
    const steps: StepResult[] = [];
    let overallStatus: ExecutionReport['status'] = 'PASSED';
    let hasHealedStep = false;

    try {
      this.driver = await this.initializeDriver(intent);

      if (intent.platform.startsWith('WEB') && intent.targetUrlOrApp.startsWith('http')) {
        await this.driver.get(intent.targetUrlOrApp);
      }

      for (const action of intent.actions) {
        const stepResult = await this.executeActionWithSelfHealing(action, intent.timeoutMs || 10000);
        steps.push(stepResult);

        if (stepResult.healed) hasHealedStep = true;

        if (!stepResult.success) {
          overallStatus = 'FAILED';
          break; 
        }
      }
    } catch (err: any) {
      overallStatus = 'FAILED';
      steps.push({
        actionId: 'INIT_OR_SYSTEM_FATAL',
        success: false,
        healed: false,
        durationMs: Date.now() - startTime,
        error: `Fatal Grid/Appium Driver Exception: ${err.message}`,
      });
    } finally {
      if (this.driver) {
        try {
          await this.driver.quit();
        } catch {
          
        }
        this.driver = null;
      }
    }

    if (overallStatus === 'PASSED' && hasHealedStep) {
      overallStatus = 'HEALED_PASSED';
    }

    const report: ExecutionReport = {
      taskId: intent.taskId,
      jiraTicketKey: intent.jiraTicketKey,
      platform: intent.platform,
      status: overallStatus,
      totalDurationMs: Date.now() - startTime,
      steps,
      summaryMarkdown: this.buildMarkdownSummary(intent, overallStatus, steps, Date.now() - startTime),
    };

    if (intent.jiraTicketKey && this.jiraBaseUrl) {
      await this.relayToJiraTicket(intent.jiraTicketKey, report);
    }

    return report;
  }

  

  private async initializeDriver(intent: TestExecutionIntent): Promise<WebDriver> {
    const builder = new Builder().usingServer(intent.gridUrl);

    switch (intent.platform) {
      case 'WEB_CHROME': {
        const chromeOptions = new ChromeOptions();
        chromeOptions.addArguments('--headless=new', '--disable-gpu', '--no-sandbox', '--window-size=1920,1080');
        return builder.forBrowser('chrome').setChromeOptions(chromeOptions).build();
      }

      case 'WEB_FIREFOX': {
        const firefoxOptions = new FirefoxOptions();
        firefoxOptions.addArguments('-headless');
        return builder.forBrowser('firefox').setFirefoxOptions(firefoxOptions).build();
      }

      case 'MOBILE_ANDROID':
      case 'MOBILE_IOS': {
        const capabilities: Record<string, any> = {
          platformName: intent.platform === 'MOBILE_ANDROID' ? 'Android' : 'iOS',
          'appium:options': {
            automationName: intent.platform === 'MOBILE_ANDROID' ? 'UiAutomator2' : 'XCUITest',
            app: intent.targetUrlOrApp,
            newCommandTimeout: 120,
            ...intent.appiumOptions,
          },
        };
        return builder.withCapabilities(capabilities).build();
      }

      default:
        throw new Error(`Unsupported Vanguard Platform Target: ${intent.platform}`);
    }
  }


  private async executeActionWithSelfHealing(action: AgenticAction, defaultTimeoutMs: number): Promise<StepResult> {
    const stepStart = Date.now();
    if (!this.driver) throw new Error('WebDriver uninitialized.');

    if (action.type === 'NAVIGATE' && action.value) {
      await this.driver.get(action.value);
      return { actionId: action.id, success: true, healed: false, durationMs: Date.now() - stepStart };
    }

    if (action.type === 'CAPTURE_SCREENSHOT') {
      const screenshot = await this.driver.takeScreenshot();
      return {
        actionId: action.id,
        success: true,
        healed: false,
        durationMs: Date.now() - stepStart,
        screenshotBase64: screenshot,
      };
    }

    // Resolve Selector Candidate List (Primary -> Fallbacks -> Semantic Strategy)
    const selectorsToTry: string[] = [];
    if (action.selectorPrimary) selectorsToTry.push(action.selectorPrimary);
    if (action.selectorFallbacks) selectorsToTry.push(...action.selectorFallbacks);

    if (action.semanticLabel) {
      selectorsToTry.push(
        `//*[@aria-label='${action.semanticLabel}']`,
        `//button[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), '${action.semanticLabel.toLowerCase()}')]`,
        `//*[@data-testid='${action.semanticLabel}']`
      );
    }

    let element: WebElement | null = null;
    let successfulSelector: string | undefined;
    let isHealed = false;

    for (let i = 0; i < selectorsToTry.length; i++) {
      const candidate = selectorsToTry[i];
      try {
        const by = this.locateByStrategy(candidate);
        element = await this.driver.wait(until.elementLocated(by), i === 0 ? defaultTimeoutMs : 2500);
        await this.driver.wait(until.elementIsVisible(element), 2000);

        successfulSelector = candidate;
        if (i > 0) isHealed = true; // Succeeded on fallback/heuristic candidate
        break;
      } catch {
        // Continue trying next candidate in self-healing strategy
      }
    }

    if (!element || !successfulSelector) {
      const failedScreenshot = await this.driver.takeScreenshot().catch(() => undefined);
      return {
        actionId: action.id,
        success: false,
        healed: false,
        durationMs: Date.now() - stepStart,
        error: `Self-Healing exhausted all ${selectorsToTry.length} candidates for '${action.semanticLabel || action.id}' without DOM resolution.`,
        screenshotBase64: failedScreenshot,
      };
    }

    // Execute Target Action on Resolved Element
    try {
      switch (action.type) {
        case 'CLICK':
          await element.click();
          break;

        case 'TYPE':
          await element.clear();
          await element.sendKeys(action.value || '');
          break;

        case 'ASSERT_TEXT': {
          const actualText = await element.getText();
          if (!actualText.includes(action.value || '')) {
            throw new Error(`Assertion mismatch. Expected containing '${action.value}', received '${actualText}'`);
          }
          break;
        }
      }

      return {
        actionId: action.id,
        success: true,
        healed: isHealed,
        usedSelector: successfulSelector,
        durationMs: Date.now() - stepStart,
      };
    } catch (err: any) {
      const failedScreenshot = await this.driver.takeScreenshot().catch(() => undefined);
      return {
        actionId: action.id,
        success: false,
        healed: isHealed,
        usedSelector: successfulSelector,
        durationMs: Date.now() - stepStart,
        error: `Action execution error on selector [${successfulSelector}]: ${err.message}`,
        screenshotBase64: failedScreenshot,
      };
    }
  }

  private locateByStrategy(selector: string): By {
    if (selector.startsWith('//') || selector.startsWith('(')) {
      return By.xpath(selector);
    }
    if (selector.startsWith('id=')) {
      return By.id(selector.replace('id=', ''));
    }
    if (selector.startsWith('accessibility=')) {
      // Appium accessibility ID mapping
      return By.css(`[accessibility-id="${selector.replace('accessibility=', '')}"]`);
    }
    return By.css(selector);
  }


  private buildMarkdownSummary(
    intent: TestExecutionIntent,
    status: ExecutionReport['status'],
    steps: StepResult[],
    durationMs: number
  ): string {
    const icon = status === 'PASSED' ? '✅' : status === 'HEALED_PASSED' ? '🩹' : '❌';
    let md = `h2. Vanguard QA Agent Execution Summary ${icon}\n`;
    md += `*Task ID:* ${intent.taskId}\n`;
    md += `*Platform Target:* ${intent.platform}\n`;
    md += `*Status:* *${status}*\n`;
    md += `*Total Duration:* ${(durationMs / 1000).toFixed(2)}s\n\n`;

    md += `|| Step ID || Status || Healed || Duration || Details ||\n`;
    for (const step of steps) {
      const stepIcon = step.success ? '✔' : '✖';
      const healedLabel = step.healed ? 'YES' : 'NO';
      const details = step.error ? `{color:red}${step.error}{color}` : `Selector: \`${step.usedSelector || 'N/A'}\``;
      md += `| ${step.actionId} | ${stepIcon} | ${healedLabel} | ${step.durationMs}ms | ${details} |\n`;
    }

    return md;
  }

  private async relayToJiraTicket(jiraKey: string, report: ExecutionReport): Promise<void> {
    try {
      const url = `${this.jiraBaseUrl}/rest/api/3/issue/${jiraKey}/comment`;
      
      const bodyData = {
        body: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'codeBlock',
              attrs: { language: 'markdown' },
              content: [{ type: 'text', text: report.summaryMarkdown }],
            },
          ],
        },
      };

      await axios.post(url, bodyData, {
        headers: {
          Authorization: this.jiraAuthHeader,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });
    } catch (err: any) {
      console.error(`[VanguardQAExecutor] Failed to relay report to Jira issue ${jiraKey}:`, err.message);
    }
  }
}