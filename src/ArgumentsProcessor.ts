import * as path from 'path';
import { IValgrindOptions } from "./ValgrindLogParser";
import { createReadStream } from "fs";

export default class ArgumentsProcessor {
    constructor(private argv: string[]) {
    }
    public getOptions(): IValgrindOptions | undefined {
        const {
            argv
        } = this;

        let output: string | undefined;
        let commentOnly = false;
        const files = new Array<string>();

        for(let i = 0; i < argv.length; i++) {
            // support --arg="x", --arg=x and --arg='x'
            if(argv[i][0] === '-' && argv[i].indexOf('=') > -1) {
                const slices = argv[i].split('=');

                if(slices[1][0] === '"' || slices[1][0] === "'")
                    slices[1] = slices[1].substring(1, slices[1].length - 1);

                argv.splice(i, 1, ...slices);
                i--;
                continue;
            }
            switch(argv[i]) {
                case '-h':
                case '--help':
                    this.printHelp();
                    return undefined;
                case '--license':
                    createReadStream(path.resolve(__dirname, '../LICENSE')).pipe(process.stdout);
                    return undefined;
                case '-o':
                case '--output':
                    output = argv[++i];
                    break;
                case '--comment':
                    commentOnly = true;
                    break;
                default:
                    if(argv[i][0] == '-' || argv[i].substring(0, 2) == '--') {
                        process.stderr.write('valgrind-tool FAILED:\n');
                        process.stderr.write(`Invalid option ${argv[i]}. Try valgrind-tool -h\n`);
                        return undefined;
                    }
                    files.push(argv[i]);
            }
        }
        return {
            files,
            commentOnly,
            output
        };
    }
    private printHelp() {
        createReadStream(path.resolve(__dirname, '../HELP')).pipe(process.stdout);
    }
}