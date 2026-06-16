#!/usr/bin/env node

'use strict';

import CLA from 'command-line-args';
import path from 'path';
import { createRequire } from 'module';
import fs from 'fs-extra';
import po2json from 'po2json';
import gettextParser from "gettext-parser";
import { GettextExtractor, JsExtractors } from 'gettext-extractor';
import utils from './utils.js';

const require = createRequire(import.meta.url);
const globPkg = require('glob');
const globSync = globPkg.globSync || globPkg.sync || globPkg;

const ARGS = [
    { name: 'build', type: String },
    { name: 'update', type: String },
    { name: 'create', type: String },
    { name: 'dest', type: String },
    { name: 'source', type: String },
    { name: 'pysource', type: String },
    { name: 'code', type: String }
];

const args = CLA(ARGS);

const isValidWeblateLanguageCode = function(code) {
    const weblateRegex = /^[a-z]{2,3}(?:_[A-Z][a-z]{3})?(?:_[A-Z]{2}|\d{3})?(?:_(?:[A-Za-z0-9]{5,8}|\d{4}))*$/;

    return typeof code === 'string' && weblateRegex.test(code);
}

const resolveLanguageCode = function(code, allowCatalog = false) {
    if (typeof code !== 'string')
        return null;

    if (allowCatalog && (code.toLowerCase() === 'catalog' || code.toLowerCase() === 'c'))
        return 'c';

    if (isValidWeblateLanguageCode(code) === false)
        return null;

    return code;
}

const languageCodeFromTranslationFile = function(file) {
    if (file === 'catalog.pot')
        return 'c';
    if (file.endsWith('.po'))
        return path.basename(file, '.po');
    if (file.endsWith('.pot'))
        return path.basename(file, '.pot');
    return null;
}

const validatePOCode = function(po, file) {
    const fileCode = languageCodeFromTranslationFile(file);
    const headerCode = po.headers.Language || po.headers.language || po.headers.lang;
    const code = headerCode || fileCode;

    if (resolveLanguageCode(code, fileCode === 'c') === null)
        throw `Invalid language code '${code}' in ${file}. Expected a Weblate language code.`;

    if (fileCode) {
        if (resolveLanguageCode(fileCode, fileCode === 'c') === null)
            throw `Invalid language code '${fileCode}' in filename ${file}. Expected a Weblate language code.`;

        if (headerCode && fileCode !== 'c' && fileCode !== headerCode)
            throw `Language code mismatch in ${file}: filename is '${fileCode}' but header is '${headerCode}'.`;
    }

    return { code: fileCode || code };
}

let usage = 'Usage:\n';
    usage += '    j18n  --build  path/to/translations  [--dest path]\n';
    usage += '\n    j18n  --update path/to/translations  --source glob  --pysource pyglob\n';
    usage += '\n    j18n  --create path/to/translations  --code lang';

let sourceDir = '.';
if (args.build)
    sourceDir = args.build;
else if (args.update)
    sourceDir = args.update;
else if (args.create)
    sourceDir = args.create;

if (args.build) {
    let buildDir = '.';
    if (args.dest)
        buildDir = args.dest;

    console.log('\nBuilding translation files.');

    if (utils.exists(sourceDir) === false) {
        console.log('\nNo translations can be found.');
        process.exit(1);
    }

    let sourcefiles = fs.readdirSync(sourceDir);

    if (utils.exists(buildDir) === false)
        fs.mkdirSync(buildDir);

    console.log(`Searching ${sourceDir}...`);

    let codes = [ 'en' ];
    let codesInDev = [ ];

    for (let file of sourcefiles) {

        if (file.endsWith('.po') === false)
            continue;

        let poPath = path.join(sourceDir, file);
        console.log(`found ${file}`);

        let content = fs.readFileSync(poPath, { encoding: 'utf-8' });

        if (content.includes('X-Status: hidden'))
            continue;

        let inDev = true;
        if (content.includes('X-Status: production'))
            inDev = false;

        let po = null;
        try {
            po = gettextParser.po.parse(content);
        }
        catch (e) {
            console.log(`Error parsing ${file}: ${e.message || e}`);
            process.exit(1);
        }
        let code = null;
        try {
            ({ code } = validatePOCode(po, file));
        }
        catch (e) {
            console.log(e);
            process.exit(1);
        }

        let translation = po2json.parse(content, { format: 'jed1.x' });
        translation.locale_data.messages[""].lang = code;

        if (code === 'en')
            continue;
        else if (inDev)
            codesInDev.push(code);
        else
            codes.push(code);

        let buildFile = code + '.json';
        fs.writeFileSync(path.join(buildDir, buildFile), JSON.stringify(translation, null, 4));
        console.log(`wrote: ${buildFile}`);
    }

    if (codes.length > 0) {
        if (codesInDev.length > 0)
            codes = codes.concat(['---']).concat(codesInDev);
        let manifest = { current: '', available: codes };
        fs.writeFileSync(path.join(buildDir, 'manifest.json'), JSON.stringify(manifest, null, 4));
        console.log('wrote: manifest.json');
    }
    else {
        console.log('\nNo translation files found.');
    }
}
else if (args.update) {

    if ( ! args.source) {
        console.log(usage);
        process.exit(1);
    }

    if ( ! args.pysource) {
        console.log(usage);
        process.exit(1);
    }

    if (utils.exists(sourceDir) === false)
        fs.mkdirSync(sourceDir);

    let sourcefiles = fs.readdirSync(sourceDir);

    let globPattern = args.source;

    console.log('\nExtracting strings from js files...');
    let extractor = new GettextExtractor();

    extractor.createJsParser([
            JsExtractors.callExpression('_', {
                arguments: {
                    text: 0
                }
            }),
            JsExtractors.callExpression('s_', {
                arguments: {
                    text: 0
                }
            }),
            JsExtractors.callExpression('n_', {
                arguments: {
                    text: 0,
                    textPlural: 1
                }
            }),
            JsExtractors.callExpression('_p', {
                arguments: {
                    context: 0,
                    text: 1
                }
            })
        ])
        .parseFilesGlob(globPattern);

    console.log('Extracting strings from py files...');
    let re = /[^a-zA-Z._]\_\('([^'\\]*(\\.[^'\\]*)*)'|[^a-zA-Z._]\_\("([^"\\]*(\\.[^"\\]*)*)"/g;
    let pyGlobPattern = args.pysource; //"jamovi/server/jamovi/+(common|server)/**/*.py"
    console.log(pyGlobPattern)
    for (let pyFileName of globSync(pyGlobPattern)) {
        let content = fs.readFileSync(pyFileName, 'UTF-8');
        for (let match of content.matchAll(re)) {
            let pieces = match.slice(1);

            // when matching strings containing \\n, this regex has a
            // duplicate final piece (not sure why)
            // if the final piece begins with '\\n' it should be discarded
            let last = pieces.slice(-1)[0];
            if (last && last.startsWith('\\n'))
                pieces.splice(-1);

            // unescape newlines
            let key = pieces.join('').replace(/\\n/g, '\n');

            extractor.addMessage({
                text: key,
                references: [pyFileName],
                comments: []
            });
        }
    }

    extractor.printStats();

    let headers = {
        "Language": "C",
        "MIME-Version": "1.0",
        "Content-Type": "text/plain; charset=UTF-8",
        "Content-Transfer-Encoding": "8bit",
        "Plural-Forms": "nplurals=2; plural=(n != 1);"
    };

    extractor.savePotFile(path.join(sourceDir, `catalog.pot`), headers);
    console.log(`wrote catalog.pot`);

    let pot = null;
    try {
        pot = gettextParser.po.parse(fs.readFileSync(path.join(sourceDir, `catalog.pot`)));
    }
    catch (e) {
        console.log(`Error parsing catalog.pot: ${e.message || e}`);
        process.exit(1);
    }

    let updatedMsgs = 0;
    let addedMsgs = 0;
    let removedMsgs = 0;
    for (let file of sourcefiles) {

        if (file.endsWith('.po') === false)
            continue;

        let poPath = path.join(sourceDir, file);
        console.log(`found ${file}`);

        let input = fs.readFileSync(poPath);
        let po = null;
        try {
            po = gettextParser.po.parse(input);
        }
        catch (e) {
            console.log(`Error parsing ${file}: ${e.message || e}`);
            process.exit(1);
        }
        let code = null;
        try {
            ({ code } = validatePOCode(po, file));
        }
        catch (e) {
            console.log(e);
            process.exit(1);
        }

        if (code !== 'c')
            po.headers.Language = code;

        //merge
        for (let cName in pot.translations) {
            let context = pot.translations[cName];
            if (po.translations[cName] === undefined)
                po.translations[cName] = context;
            else {
                let poContext = po.translations[cName];
                for (let key in context) {
                    if (poContext[key] === undefined) {
                        addedMsgs += 1;
                        poContext[key] = context[key];
                    }
                    else {
                        let msg = poContext[key];
                        if (msg.msgid !== undefined && msg.msgid !== context[key].msgid) {
                            updatedMsgs += 1;
                            if (msg.msgstr)
                                msg.comments.previous = msg.msgid;
                            msg.msgid = context[key].msgid;
                        }
                        if (msg.msgid_plural !== undefined && msg.msgid_plural !== context[key].msgid_plural)
                            msg.msgid_plural = context[key].msgid_plural;
                    }
                    poContext[key]._inUse = true;
                }
            }
            po.translations[cName]._inUse = true;
        }

        for (let cName in po.translations) {
            let context =  po.translations[cName];
            if (context._inUse === undefined) {
                console.log(`remove context ${cName}`);
                delete po.translations[cName];
            }
            else {
                delete context._inUse;
                for (let key in context) {
                    let msg = context[key];
                    if (msg._inUse === undefined) {
                        removedMsgs += 1;
                        delete context[key];
                    }
                    else
                        delete msg._inUse;
                }
            }
        }

        if (removedMsgs > 0)
            console.log(`Messages removed: ${removedMsgs}`);
        if (updatedMsgs > 0)
            console.log(`Messages updated: ${updatedMsgs}`);
        if (addedMsgs > 0)
            console.log(`Messages added: ${addedMsgs}`);
        // merged

        let output = gettextParser.po.compile(po, { foldLength: 77, sort: (a, b) => a.msgid.localeCompare(b.msgid) });
        fs.writeFileSync(path.join(sourceDir, file), output);
    }
}
else if (args.create) {
    if ( ! args.code) {
        console.log(usage);
        process.exit(1);
    }

    if (utils.exists(path.join(sourceDir, `catalog.pot`)) === false) {
        console.log(`\nThe catalog.pot file needed to create a new translation file does not exist.\n\n To create a new catalog.pot use:\n\n   j18n --update --source glob --pysoure pyglob [--home path]\n`);
        process.exit(1);
    }

    let code = resolveLanguageCode(args.code);
    if (code === null) {
        console.log(`\nInvalid language code '${args.code}'. Expected a Weblate language code.`);
        process.exit(1);
    }

    for (let file of fs.readdirSync(sourceDir)) {
        if (file.endsWith('.po') === false)
            continue;

        const fileCode = languageCodeFromTranslationFile(file);
        if (fileCode === code) {
            console.log(`\nTranslation file ${file} already exists.`);
            process.exit(1);
        }
    }

    if (utils.exists(path.join(sourceDir, `${code}.po`))) {
        console.log(`\nTranslation file ${code}.po already exists.`);
        process.exit(1);
    }
    let input = fs.readFileSync(path.join(sourceDir, `catalog.pot`));
    let pot = null;
    try {
        pot = gettextParser.po.parse(input);
    }
    catch (e) {
        console.log(`Error parsing catalog.pot: ${e.message || e}`);
        process.exit(1);
    }

    delete pot.headers.language;
    pot.headers.Language = code;

    let output = gettextParser.po.compile(pot, { foldLength: 77, sort: (a, b) => a.msgid.localeCompare(b.msgid) });
    fs.writeFileSync(path.join(sourceDir, `${code}.po`), output);

    console.log(`wrote ${code}.po`);
}
else {
    console.log(usage);
}
