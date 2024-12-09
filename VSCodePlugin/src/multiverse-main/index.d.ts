// src/multiverse-main/index.d.ts

export interface CompileResult {
    abi: any;
    ast: any;
    bin: string;
    'bin-runtime': string;
    name: string;
    parsed?: any;
    warning?: string;
    // Add other properties as needed
  }
  
  export function compile(
    file: string,
    contractName?: string,
    solcVersion?: string,
    noOptimize?: boolean
  ): Promise<CompileResult>;
  
  // Export other types and functions if necessary
  