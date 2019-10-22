import { promises as fs, constants as fsConstants } from 'fs';
import * as path from 'path';
import ValgrindLogParser from './ValgrindLogParser';
import ArgumentsProcessor from './ArgumentsProcessor';

const STDOUT_FILE_DESCRIPTOR = 1;
const STDIN_FILE_DESCRIPTOR = 0;

async function run(argv: string[]) {
    const options = new ArgumentsProcessor(argv).getOptions();
    if(!options) {
        return;
    }
    let output: number;
    if(!options.output) {
        output = STDOUT_FILE_DESCRIPTOR;
    } else {
        const {fd} = await fs.open(path.resolve(process.cwd(), options.output), fsConstants.W_OK | fsConstants.O_CREAT);
        output = fd;
    }
    const fds = new Array<number>();
    const files = new Array<string>();
    if(!options.files.length) {
        fds.push(STDIN_FILE_DESCRIPTOR);
    } else {
        for(const file of options.files) {
            const fullPath = path.resolve(process.cwd(), file);
            const {fd} = await fs.open(fullPath, fsConstants.R_OK);
            fds.push(fd);
            files[fd] = fullPath;
        }
    }
    function printHeader(fd: number) {
        if(output !== STDOUT_FILE_DESCRIPTOR) {
            process.stdout.write(`Processing ${files[fd]}:\n`);
        }
    }
    const startTime = Date.now();
    for(const fd of fds) {
        printHeader(fd);
        const parser = new ValgrindLogParser({
            input: fd,
            includeHeader: true,
            output,
            commentOnly: options.commentOnly,
            eventEmitter: output !== STDOUT_FILE_DESCRIPTOR ? (event) => {
                switch(event.type) {
                    case 'readline':
                        process.stdout.cursorTo(0, 0);
                        process.stdout.clearLine(0);
                        process.stdout.clearScreenDown();
                        printHeader(fd);
                        process.stdout.cursorTo(0, 1);
                        process.stdout.clearLine(0);
                        process.stdout.write(`Line number ${event.lineNumber}... (${event.bytesWritten} bytes written, ${event.suppressionCount} suppressions)\n`)
                }
            } : undefined
        });
        await parser.parse();
    }
    if(output !== STDOUT_FILE_DESCRIPTOR) {
        process.stdout.write(`Done in ${Date.now() - startTime}ms!\n\n`);
    }
}

run(process.argv.slice(2)).catch((reason) => {
    console.error(reason);
});
