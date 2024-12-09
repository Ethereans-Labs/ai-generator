"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Credentials = void 0;
const vscode = __importStar(require("vscode"));
const Octokit = __importStar(require("@octokit/rest"));
const GITHUB_AUTH_PROVIDER_ID = "github";
// The GitHub Authentication Provider accepts the scopes described here:
// https://developer.github.com/apps/building-oauth-apps/understanding-scopes-for-oauth-apps/
const SCOPES = ["user:email"];
class Credentials {
    initialize(context) {
        return __awaiter(this, void 0, void 0, function* () {
            this.registerListeners(context);
            yield this.setOctokit();
        });
    }
    setOctokit() {
        return __awaiter(this, void 0, void 0, function* () {
            /**
             * By passing the `createIfNone` flag, a numbered badge will show up on the accounts activity bar icon.
             * An entry for the sample extension will be added under the menu to sign in. This allows quietly
             * prompting the user to sign in.
             * */
            const session = yield vscode.authentication.getSession(GITHUB_AUTH_PROVIDER_ID, SCOPES, { createIfNone: false });
            if (session) {
                this.octokit = new Octokit.Octokit({
                    auth: session.accessToken,
                });
                return;
            }
            this.octokit = undefined;
        });
    }
    registerListeners(context) {
        /**
         * Sessions are changed when a user logs in or logs out.
         */
        context.subscriptions.push(vscode.authentication.onDidChangeSessions((e) => __awaiter(this, void 0, void 0, function* () {
            if (e.provider.id === GITHUB_AUTH_PROVIDER_ID) {
                yield this.setOctokit();
            }
        })));
    }
    getOctokit() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.octokit) {
                return this.octokit;
            }
            /**
             * When the `createIfNone` flag is passed, a modal dialog will be shown asking the user to sign in.
             * Note that this can throw if the user clicks cancel.
             */
            const session = yield vscode.authentication.getSession(GITHUB_AUTH_PROVIDER_ID, SCOPES, { createIfNone: true });
            this.octokit = new Octokit.Octokit({
                auth: session.accessToken,
            });
            return this.octokit;
        });
    }
    signIn() {
        return __awaiter(this, void 0, void 0, function* () {
            /**
             * Octokit (https://github.com/octokit/rest.js#readme) is a library for making REST API
             * calls to GitHub. It provides convenient typings that can be helpful for using the API.
             *
             * Documentation on GitHub's REST API can be found here: https://docs.github.com/en/rest
             */
            const octokit = yield this.getOctokit();
            const userInfo = yield octokit.users.getAuthenticated();
            return userInfo;
        });
    }
}
exports.Credentials = Credentials;
