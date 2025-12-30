export class GdbMiParser {
    parse(output) {
        const result = {
            status: 'unknown',
            line: 0,
            file: '',
            locals: [],
            console: ''
        };

        const lines = output.toString().split('\n');
        
        for (const line of lines) {
            if (line.startsWith('~')) {
                // Console output (remove quotes and newlines)
                let text = line.substring(2, line.length - 1);
                text = text.replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\t/g, '\t');
                result.console += text;
            }
            
            if (line.startsWith('*stopped')) {
                result.status = 'stopped';
                // Extract line and file using regex
                const lineMatch = line.match(/line="(\d+)"/);
                const fileMatch = line.match(/file="([^"]+)"/);
                
                if (lineMatch) result.line = parseInt(lineMatch[1], 10);
                if (fileMatch) result.file = fileMatch[1];
            }
        }
        return result;
    }
}

export default new GdbMiParser();