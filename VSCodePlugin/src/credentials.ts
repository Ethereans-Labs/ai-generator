import * as vscode from "vscode";
import * as Octokit from "@octokit/rest";

const GITHUB_AUTH_PROVIDER_ID = "github";
// The GitHub Authentication Provider accepts the scopes described here:
// https://developer.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps/
const SCOPES = ["user:email"];

export class Credentials {
  private session: vscode.AuthenticationSession | undefined;
  private octokit: Octokit.Octokit | undefined;

  async initialize(context: vscode.ExtensionContext): Promise<void> {
    this.registerListeners(context);
    await this.setOctokit();
  }

  private async setOctokit() {
    /**
     * By passing the `createIfNone` flag, a numbered badge will show up on the accounts activity bar icon.
     * An entry for the sample extension will be added under the menu to sign in. This allows quietly
     * prompting the user to sign in.
     * */
    this.session = await vscode.authentication.getSession(
      GITHUB_AUTH_PROVIDER_ID,
      SCOPES,
      { createIfNone: false }
    );

    if (this.session) {
      this.octokit = new Octokit.Octokit({
        auth: this.session.accessToken,
      });

      return;
    }

    this.octokit = undefined;
  }

  registerListeners(context: vscode.ExtensionContext): void {
    /**
     * Sessions are changed when a user logs in or logs out.
     */
    context.subscriptions.push(
      vscode.authentication.onDidChangeSessions(async (e) => {
        if (e.provider.id === GITHUB_AUTH_PROVIDER_ID) {
          await this.setOctokit();
        }
      })
    );
  }

  async getOctokit(): Promise<Octokit.Octokit> {
    if (this.octokit) {
      return this.octokit;
    }

    /**
     * When the `createIfNone` flag is passed, a modal dialog will be shown asking the user to sign in.
     * Note that this can throw if the user clicks cancel.
     */
    this.session = await vscode.authentication.getSession(
      GITHUB_AUTH_PROVIDER_ID,
      SCOPES,
      { createIfNone: true }
    );
    this.octokit = new Octokit.Octokit({
      auth: this.session.accessToken,
    });

    return this.octokit;
  }

  async signIn(secretStorage: vscode.SecretStorage) {
    /**
     * Octokit (https://github.com/octokit/rest.js#readme) is a library for making REST API
     * calls to GitHub. It provides convenient typings that can be helpful for using the API.
     *
     * Documentation on GitHub's REST API can be found here: https://docs.github.com/en/rest
     */
    const octokit = await this.getOctokit();
    const userInfo = await octokit.users.getAuthenticated();
   
    console.log("Github access token: ", this.session?.accessToken);

    if (this.session?.accessToken) {
    secretStorage.store("github-token", this.session.accessToken);
    }

    return userInfo;
  }

  async getAccessToken() {
    if (this.session) {
      return this.session.accessToken;
    }
  }
}
