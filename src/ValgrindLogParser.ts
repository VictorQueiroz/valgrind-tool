import * as defaultFs from 'fs';

export interface IValgrindOptions {
    files: string[];
    output?: string;
    commentOnly: boolean;
}

export interface IValgrindLogParserOptions extends Pick<IValgrindOptions, 'commentOnly'> {
    input: number;
    output: number;
    includeHeader?: boolean;
    eventEmitter?: (event: (
        {
            type: 'readline';
            bytesWritten: number;
            suppressionCount: number;
            lineNumber: number;
        }
    )) => void | Promise<void>;
}

export class Character {
    public static isEndOfSuppressionLine(ch: number) {
        if(Character.isLineBreak(ch) || ch === 125) {
            return true;
        }
        return false;
    }
    public static isLineBreak(ch: number) {
        if(ch === 10) {
            return true;
        }
        return false;
    }
}

export default class ValgrindLogParser {
    public suppressionsCount = 0;
    public bytesWritten = 0;
    public lineCount = 0;
    private static readonly BufferReadingOffsetMax = 64**4;
    /**
     * 4 spaces
     */
    private readonly indentationBuffer = Buffer.from([32,32,32,32]);
    private readonly buffer = Buffer.allocUnsafe(ValgrindLogParser.BufferReadingOffsetMax);
    private eof = false;
    /**
     * How much did we read from current buffer?
     */
    private bufferReadingOffset = ValgrindLogParser.BufferReadingOffsetMax;
    private bufferReadingOffsetMax = ValgrindLogParser.BufferReadingOffsetMax;
    public constructor(private readonly options: IValgrindLogParserOptions) {

    }
    public async parse() {
        if(this.options.includeHeader) {
            await this.writeOutput(`# ${new Date().toString()}\n`);
            await this.writeOutput('# Generated automatically with valgrind-tool: https://github.com/VictorQueiroz/valgrind-tool\n\n');
        }
        
        let ch: number | undefined;
        do {
            ch = await this.peekCharacter();
            if(typeof ch === 'undefined' || ch === 0) {
                return;
            }
            /**
             * Ignore whitespace and line break that does not belong
             * to any kind of suppression or log.
             */
            if(ch === 32 || ch === 10) {
                await this.readCharacter();
            } else if(ch === 123) {
                await this.readSuppression();
            } else {
                await this.readValgrindLog();
            }
        } while(typeof ch !== 'undefined');
    }
    private characterCache = new Map<number, string>();
    private writeOutput(value: Buffer | string | number) {
        if(typeof value === 'number') {
            const cached = this.characterCache.get(value);
            if(cached) {
                value = cached;
            } else {
                const n = String.fromCharCode(value);
                this.characterCache.set(value, n);
                value = n;
            }
        }
        if(typeof value === 'string') {
            value = Buffer.from(value, 'utf8');
        } 
        return new Promise<{
            bytesWritten: number;
        }>((resolve, reject) => {
            defaultFs.write(this.options.output, value, (err, bytesWritten) => {
                if(err) {
                    reject(err);
                } else {
                    this.bytesWritten += bytesWritten;
                    resolve({
                        bytesWritten
                    });
                }
            });
        });
    }
    private async readSuppression() {
        let ch: number | undefined;
        await this.expect(123);
        await this.writeOutput('{\n');
        do {
            await this.readSuppressionLine();
            ch = await this.peekCharacter();
        } while(typeof ch !== 'undefined' && ch !== 125);
        await this.expect(125);
        await this.writeOutput('}\n');
        this.suppressionsCount++;
    }
    private async readSuppressionLine() {
        let ch: number | undefined;
        let startReadingLine = false;
        do {
            ch = await this.peekCharacter();
            if(typeof ch === 'undefined') {
                return;
            }
            /**
             * Ignore everything before we actually start reading the line
             */
            if(!startReadingLine && (ch === 10 || ch === 32)) {
                await this.readCharacter();
                continue;
            }
            if(ch !== 125) {
                if(!startReadingLine) {
                    startReadingLine = true;
                    await this.writeOutput(this.indentationBuffer);
                }
                await this.writeOutput(ch);
                await this.readCharacter();
            }
        } while(!Character.isEndOfSuppressionLine(ch));
    }
    private async readValgrindLog() {
        let ch: number | undefined;
        let writtingLog = false;
        do {
            ch = await this.readCharacter();
            if(typeof ch === 'undefined') {
                break;
            }
            if(this.options.commentOnly) {
                if(!writtingLog) {
                    if(ch !== 35) {
                        await this.writeOutput('#');
                    }
                    writtingLog = true;
                }
                await this.writeOutput(ch);
            }
        } while(ch !== 10);
    }
    private async preload(): Promise<boolean> {
        if(!this.eof) {
            await this.read();
        } else if(this.bufferReadingOffset === this.bufferReadingOffsetMax) {
            return false;
        }
        return true;
    }
    private async expect(n: number) {
        const ch = await this.readCharacter();
        if(ch !== n || typeof ch === 'undefined') {
            throw new Error(`Expected "${String.fromCharCode(n)}" but got "${typeof ch === 'undefined' ? 'undefined' : String.fromCharCode(ch)}" instead`);
        }
    }
    private async peekCharacter(): Promise<number | undefined> {
        const loaded = await this.preload();
        if(!loaded) {
            return undefined;
        }
        return this.buffer[this.bufferReadingOffset];
    }
    private async readCharacter(): Promise<number | undefined> {
        const loaded = await this.preload();
        if(!loaded) {
            return undefined;
        }
        const ch = this.buffer[this.bufferReadingOffset++];
        if(ch === 10) {
            this.onAdvanceLineNumber();
        }
        return ch;
    }
    private onAdvanceLineNumber() {
        this.lineCount++;
        if(this.options.eventEmitter) {
            this.options.eventEmitter({
                type: 'readline',
                suppressionCount: this.suppressionsCount,
                bytesWritten: this.bytesWritten,
                lineNumber: this.lineCount
            });
        }
    }
    /**
     * Read more from file handle as we need
     */
    private async read() {
        if(this.eof || this.bufferReadingOffset < this.bufferReadingOffsetMax) {
            return;
        }
        const {bytesRead} = await this.readInput();
        if(bytesRead < this.buffer.byteLength) {
            this.eof = true;
        }
        this.bufferReadingOffsetMax = bytesRead;
        this.bufferReadingOffset = 0;
    }
    private readInput() {
        return new Promise<{
            bytesRead: number;
        }>((resolve, reject) => {
            defaultFs.read(this.options.input, this.buffer, 0, this.buffer.byteLength, null, (err, bytesRead) => {
                if(err) {
                    reject(err);
                } else {
                    resolve({
                        bytesRead
                    });
                }
            });
        });
    }
}
