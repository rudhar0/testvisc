// backend/src/services/code-preprocessor.service.js

class CodePreprocessorService {
  preprocess(code) {
    // A simple preprocessor to fix common typos.
    // This can be extended to handle more cases.
    const fixedCode = code.replace(/\bpritf\b/g, 'printf');
    return fixedCode;
  }
}

export const codePreprocessorService = new CodePreprocessorService();
