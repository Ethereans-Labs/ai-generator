declare module "multiverse-main" {
    export interface CompileResult {
        success: boolean;
        data?: any;
    }

    export function compile(input: any): CompileResult;
}