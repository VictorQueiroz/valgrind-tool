import {expect} from 'chai';
import { Suite } from "sarg";
import ArgumentsProcessor from '../src/ArgumentsProcessor';
import { IValgrindOptions } from '../src/ValgrindLogParser';

const suite = new Suite();

suite.test('it should support --comment option', () => {
    const argsProcessor = new ArgumentsProcessor([
        '--comment'
    ]);
    const expectedOptions: IValgrindOptions = {
        commentOnly: true,
        files: [],
        output: undefined
    };
    expect(argsProcessor.getOptions()).to.be.deep.equal(expectedOptions);
});

export default suite;