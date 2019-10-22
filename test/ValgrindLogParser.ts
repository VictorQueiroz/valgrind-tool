import {Suite} from 'sarg';
import {expect} from 'chai';
import * as path from 'path';
import {promises as fs, constants} from 'fs';
import ValgrindLogParser from '../src/ValgrindLogParser';

let tmpDir: string;
const suite = new Suite();

suite.beforeEach(async () => {
    tmpDir = await fs.mkdtemp('/tmp/valgrind-tool-test');
});

suite.test('it should comment whatever it\'s not a suppression', async () => {
    const inputBuffer = Buffer.from(`
==18056== Memcheck, a memory error detector
==18056== Copyright (C) 2002-2017, and GNU GPL'd, by Julian Seward et al.
==18056== Using Valgrind-3.14.0 and LibVEX; rerun with -h for copyright info
==18056== Command: ./Schach
==18056== 
==18056== Conditional jump or move depends on uninitialised value(s)
==18056==    at 0xC2836C4: ??? (in /usr/lib/x86_64-linux-gnu/libVkLayer_stateless_validation.so)
==18056==    by 0xC1E2A3B: ??? (in /usr/lib/x86_64-linux-gnu/libVkLayer_stateless_validation.so)
==18056==    by 0xC2F9549: ??? (in /usr/lib/x86_64-linux-gnu/libVkLayer_stateless_validation.so)
==18056==    by 0xC6565D1: ??? (in /usr/lib/x86_64-linux-gnu/libVkLayer_thread_safety.so)
==18056==    by 0x4AAA270: ??? (in /usr/lib/x86_64-linux-gnu/libvulkan.so.1.1.97)
==18056==    by 0x4AADB78: vkCreateInstance (in /usr/lib/x86_64-linux-gnu/libvulkan.so.1.1.97)
==18056==    by 0x403E89: VkRenderer::createVulkanInstance() (main.cpp:188)
==18056==    by 0x403128: VkRenderer::configure() (main.cpp:133)
==18056==    by 0x402AB6: main (main.cpp:349)
==18056==  Uninitialised value was created by a heap allocation
==18056==    at 0x4835DEF: operator new(unsigned long) (vg_replace_malloc.c:334)
==18056==    by 0xC2F90E6: ??? (in /usr/lib/x86_64-linux-gnu/libVkLayer_stateless_validation.so)
==18056==    by 0xC6565D1: ??? (in /usr/lib/x86_64-linux-gnu/libVkLayer_thread_safety.so)
==18056==    by 0x4AAA270: ??? (in /usr/lib/x86_64-linux-gnu/libvulkan.so.1.1.97)
==18056==    by 0x4AADB78: vkCreateInstance (in /usr/lib/x86_64-linux-gnu/libvulkan.so.1.1.97)
==18056==    by 0x403E89: VkRenderer::createVulkanInstance() (main.cpp:188)
==18056==    by 0x403128: VkRenderer::configure() (main.cpp:133)
==18056==    by 0x402AB6: main (main.cpp:349)
==18056== 
{
    <insert_a_suppression_name_here>
    Memcheck:Cond
    obj:/usr/lib/x86_64-linux-gnu/libVkLayer_stateless_validation.so
    obj:/usr/lib/x86_64-linux-gnu/libVkLayer_stateless_validation.so
    obj:/usr/lib/x86_64-linux-gnu/libVkLayer_stateless_validation.so
    obj:/usr/lib/x86_64-linux-gnu/libVkLayer_thread_safety.so
    obj:/usr/lib/x86_64-linux-gnu/libvulkan.so.1.1.97
    fun:vkCreateInstance
    fun:_ZN10VkRenderer20createVulkanInstanceEv
    fun:_ZN10VkRenderer9configureEv
    fun:main
}
    `.trim(), 'utf8');

    const outputFile = path.resolve(tmpDir, 'should-create-comments-from-specific-content-output');
    const inputFile = path.resolve(tmpDir, 'should-create-comments-from-specific-content-input');
    const [inputW, output, inputR] = await Promise.all([
        fs.open(inputFile, constants.O_CREAT | constants.W_OK),
        fs.open(outputFile, constants.O_CREAT | constants.W_OK),
        fs.open(inputFile, constants.O_CREAT | constants.R_OK)
    ]);
    await inputW.write(inputBuffer);
    await inputW.close();
    const parser = new ValgrindLogParser({
        input: inputR.fd,
        output: output.fd,
        commentOnly: true
    });
    await parser.parse();
    expect((await fs.readFile(outputFile)).toString('utf8')).to.be.deep.equal(
        '#==18056== Memcheck, a memory error detector\n' +
        '#==18056== Copyright (C) 2002-2017, and GNU GPL\'d, by Julian Seward et al.\n' +
        '#==18056== Using Valgrind-3.14.0 and LibVEX; rerun with -h for copyright info\n' +
        '#==18056== Command: ./Schach\n' +
        '#==18056== \n' +
        '#==18056== Conditional jump or move depends on uninitialised value(s)\n' +
        '#==18056==    at 0xC2836C4: ??? (in /usr/lib/x86_64-linux-gnu/libVkLayer_stateless_validation.so)\n' +
        '#==18056==    by 0xC1E2A3B: ??? (in /usr/lib/x86_64-linux-gnu/libVkLayer_stateless_validation.so)\n' +
        '#==18056==    by 0xC2F9549: ??? (in /usr/lib/x86_64-linux-gnu/libVkLayer_stateless_validation.so)\n' +
        '#==18056==    by 0xC6565D1: ??? (in /usr/lib/x86_64-linux-gnu/libVkLayer_thread_safety.so)\n' +
        '#==18056==    by 0x4AAA270: ??? (in /usr/lib/x86_64-linux-gnu/libvulkan.so.1.1.97)\n' +
        '#==18056==    by 0x4AADB78: vkCreateInstance (in /usr/lib/x86_64-linux-gnu/libvulkan.so.1.1.97)\n' +
        '#==18056==    by 0x403E89: VkRenderer::createVulkanInstance() (main.cpp:188)\n' +
        '#==18056==    by 0x403128: VkRenderer::configure() (main.cpp:133)\n' +
        '#==18056==    by 0x402AB6: main (main.cpp:349)\n' +
        '#==18056==  Uninitialised value was created by a heap allocation\n' +
        '#==18056==    at 0x4835DEF: operator new(unsigned long) (vg_replace_malloc.c:334)\n' +
        '#==18056==    by 0xC2F90E6: ??? (in /usr/lib/x86_64-linux-gnu/libVkLayer_stateless_validation.so)\n' +
        '#==18056==    by 0xC6565D1: ??? (in /usr/lib/x86_64-linux-gnu/libVkLayer_thread_safety.so)\n' +
        '#==18056==    by 0x4AAA270: ??? (in /usr/lib/x86_64-linux-gnu/libvulkan.so.1.1.97)\n' +
        '#==18056==    by 0x4AADB78: vkCreateInstance (in /usr/lib/x86_64-linux-gnu/libvulkan.so.1.1.97)\n' +
        '#==18056==    by 0x403E89: VkRenderer::createVulkanInstance() (main.cpp:188)\n' +
        '#==18056==    by 0x403128: VkRenderer::configure() (main.cpp:133)\n' +
        '#==18056==    by 0x402AB6: main (main.cpp:349)\n' +
        '#==18056== \n' +
        '{\n' +
        '    <insert_a_suppression_name_here>\n' +
        '    Memcheck:Cond\n' +
        '    obj:/usr/lib/x86_64-linux-gnu/libVkLayer_stateless_validation.so\n' +
        '    obj:/usr/lib/x86_64-linux-gnu/libVkLayer_stateless_validation.so\n' +
        '    obj:/usr/lib/x86_64-linux-gnu/libVkLayer_stateless_validation.so\n' +
        '    obj:/usr/lib/x86_64-linux-gnu/libVkLayer_thread_safety.so\n' +
        '    obj:/usr/lib/x86_64-linux-gnu/libvulkan.so.1.1.97\n' +
        '    fun:vkCreateInstance\n' +
        '    fun:_ZN10VkRenderer20createVulkanInstanceEv\n' +
        '    fun:_ZN10VkRenderer9configureEv\n' +
        '    fun:main\n' +
        '}\n'
    );
});

suite.test('it should keep commented lines', async () => {
    const outputFile = path.resolve(tmpDir, 'should-ignore-comment-lines-output');
    const inputFile = path.resolve(tmpDir, 'should-ignore-comment-lines-input');
    const [inputW, output, inputR] = await Promise.all([
        fs.open(inputFile, constants.O_CREAT | constants.W_OK),
        fs.open(outputFile, constants.O_CREAT | constants.W_OK),
        fs.open(inputFile, constants.O_CREAT | constants.R_OK)
    ]);
    await inputW.write(Buffer.from(`
        # Test comment 1
        # Test comment 2
        {
            <insert_a_suppression_name_here>
            Memcheck:Addr16
            obj:/usr/lib/x86_64-linux-gnu/libvulkan_intel.so
            obj:/usr/lib/x86_64-linux-gnu/libvulkan_intel.so
            obj:/usr/lib/x86_64-linux-gnu/libVkLayer_unique_objects.so
            obj:/usr/lib/x86_64-linux-gnu/libVkLayer_core_validation.so
            obj:/usr/lib/x86_64-linux-gnu/libVkLayer_object_lifetimes.so
            obj:/usr/lib/x86_64-linux-gnu/libVkLayer_stateless_validation.so
            obj:/usr/lib/x86_64-linux-gnu/libVkLayer_thread_safety.so
            fun:vkDestroyDevice
            fun:_ZN10VkRendererD2Ev
            fun:main
        }
    `, 'utf8'));
    const parser = new ValgrindLogParser({
        input: inputR.fd,
        output: output.fd,
        commentOnly: true
    });
    await parser.parse();
    await Promise.all([
        inputR.close(),
        inputW.close(),
        output.close()
    ]);
    expect((await fs.readFile(outputFile)).toString('utf8')).to.be.deep.equal(
        '# Test comment 1\n' +
        '# Test comment 2\n' +
        '{\n' +
        '    <insert_a_suppression_name_here>\n' +
        '    Memcheck:Addr16\n' +
        '    obj:/usr/lib/x86_64-linux-gnu/libvulkan_intel.so\n' +
        '    obj:/usr/lib/x86_64-linux-gnu/libvulkan_intel.so\n' +
        '    obj:/usr/lib/x86_64-linux-gnu/libVkLayer_unique_objects.so\n' +
        '    obj:/usr/lib/x86_64-linux-gnu/libVkLayer_core_validation.so\n' +
        '    obj:/usr/lib/x86_64-linux-gnu/libVkLayer_object_lifetimes.so\n' +
        '    obj:/usr/lib/x86_64-linux-gnu/libVkLayer_stateless_validation.so\n' +
        '    obj:/usr/lib/x86_64-linux-gnu/libVkLayer_thread_safety.so\n' +
        '    fun:vkDestroyDevice\n' +
        '    fun:_ZN10VkRendererD2Ev\n' +
        '    fun:main\n' +
        '}\n'
    );
});

export default suite;
