import { autoCheckAndDownloadPackage } from '../utils/auto_download_check_packages.mjs';
import torch from 'torch';
import transformers from 'transformers';

class StringStoppingCriteria extends transformers.StoppingCriteria {
    constructor(tokenizer, promptLength) {
        super();
        this.tokenizer = tokenizer;
        this.promptLength = promptLength;
    }

    call(inputIds, _) {
        if (inputIds[0].length <= this.promptLength) {
            return false;
        }

        const lastTokenId = inputIds[0][inputIds[0].length - 1];
        const lastToken = this.tokenizer.decode(lastTokenId, { skipSpecialTokens: true });

        return lastToken.includes('"');
    }
}

class NumberStoppingCriteria extends transformers.StoppingCriteria {
    constructor(tokenizer, promptLength, precision = 3) {
        super();
        this.tokenizer = tokenizer;
        this.precision = precision;
        this.promptLength = promptLength;
    }

    call(inputIds, scores) {
        const decoded = this.tokenizer.decode(
            inputIds[0].slice(this.promptLength),
            { skipSpecialTokens: true }
        );

        if (decoded.split('.').length > 2) {
            return true;
        }

        if (decoded.split('.').length === 2 && decoded.split('.')[1].length > this.precision) {
            return true;
        }

        if (decoded.length > 1 && /\d/.test(decoded) && [' ', '\n'].includes(decoded[decoded.length - 1])) {
            return true;
        }

        return false;
    }
}

class OutputNumbersTokens extends transformers.LogitsWarper {
    constructor(tokenizer, prompt) {
        super();
        this.tokenizer = tokenizer;
        this.tokenizedPrompt = tokenizer(prompt, { returnTensors: "pt" });
        const vocabSize = tokenizer.vocab_size;
        this.allowedMask = torch.zeros(vocabSize, { dtype: torch.bool });

        for (const [_, tokenId] of Object.entries(tokenizer.get_vocab())) {
            const tokenStr = tokenizer.decode(tokenId).trim();

            if (tokenStr === "" || (/[0-9.]/.test(tokenStr) && (tokenStr.match(/\./g) || []).length <= 1)) {
                this.allowedMask[tokenId] = true;
            }
        }
    }

    call(_, scores) {
        const mask = this.allowedMask.expand_as(scores);
        scores[~mask] = -Infinity;

        return scores;
    }
}