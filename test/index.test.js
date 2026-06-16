import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const cliPath = path.join(rootDir, 'index.js');

const mkdirTemp = function() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'jamovi-i18n-test-'));
}

const runCli = function(args) {
    return spawnSync(process.execPath, [cliPath, ...args], {
        cwd: rootDir,
        encoding: 'utf8'
    });
}

const writePO = function(filePath, { code, status = 'production', messages = [] }) {
    const lines = [
        'msgid ""',
        'msgstr ""',
        '"MIME-Version: 1.0\\n"',
        '"Content-Type: text/plain; charset=utf-8\\n"',
        '"Content-Transfer-Encoding: 8bit\\n"',
        `"Language: ${code}\\n"`,
        `"X-Status: ${status}\\n"`,
        '"Plural-Forms: nplurals=2; plural=(n != 1);\\n"',
        ''
    ];

    for (const [msgid, msgstr] of messages) {
        lines.push(`msgid "${msgid}"`);
        lines.push(`msgstr "${msgstr}"`);
        lines.push('');
    }

    fs.writeFileSync(filePath, lines.join('\n'));
}

const writeCatalog = function(filePath) {
    fs.writeFileSync(filePath, [
        'msgid ""',
        'msgstr ""',
        '"MIME-Version: 1.0\\n"',
        '"Content-Type: text/plain; charset=utf-8\\n"',
        '"Content-Transfer-Encoding: 8bit\\n"',
        '"Language: C\\n"',
        '"Plural-Forms: nplurals=2; plural=(n != 1);\\n"',
        '',
        'msgid "Existing"',
        'msgstr ""',
        ''
    ].join('\n'));
}

test('build validates, preserves, and emits original language codes', () => {
    const dir = mkdirTemp();
    const sourceDir = path.join(dir, 'translations');
    const destDir = path.join(dir, 'build');
    fs.mkdirSync(sourceDir);

    writePO(path.join(sourceDir, 'nb_NO.po'), {
        code: 'nb_NO',
        messages: [['Hello', 'Hallo']]
    });

    const result = runCli(['--build', sourceDir, '--dest', destDir]);

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(fs.existsSync(path.join(destDir, 'nb_NO.json')), true);

    const manifest = JSON.parse(fs.readFileSync(path.join(destDir, 'manifest.json'), 'utf8'));
    assert.deepEqual(manifest.available, ['en', 'nb_NO']);

    const json = JSON.parse(fs.readFileSync(path.join(destDir, 'nb_NO.json'), 'utf8'));
    assert.equal(json.locale_data.messages[''].lang, 'nb_NO');
});

test('build rejects invalid language headers', () => {
    const dir = mkdirTemp();
    const sourceDir = path.join(dir, 'translations');
    const destDir = path.join(dir, 'build');
    fs.mkdirSync(sourceDir);

    writePO(path.join(sourceDir, 'bad.po'), {
        code: 'not a locale',
        messages: [['Hello', 'Hallo']]
    });

    const result = runCli(['--build', sourceDir, '--dest', destDir]);

    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /Invalid language code 'not a locale'/);
});

test('build rejects mismatched filename and header codes', () => {
    const dir = mkdirTemp();
    const sourceDir = path.join(dir, 'translations');
    const destDir = path.join(dir, 'build');
    fs.mkdirSync(sourceDir);

    writePO(path.join(sourceDir, 'fr.po'), {
        code: 'nb_NO',
        messages: [['Hello', 'Hallo']]
    });

    const result = runCli(['--build', sourceDir, '--dest', destDir]);

    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /Language code mismatch in fr\.po/);
});

test('create validates and preserves the requested language code', () => {
    const sourceDir = mkdirTemp();
    writeCatalog(path.join(sourceDir, 'catalog.pot'));

    const result = runCli(['--create', sourceDir, '--code', 'nb_NO']);

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const poPath = path.join(sourceDir, 'nb_NO.po');
    assert.equal(fs.existsSync(poPath), true);
    assert.match(fs.readFileSync(poPath, 'utf8'), /Language: nb_NO\\n/);
});

test('create rejects non-Weblate language codes', () => {
    const sourceDir = mkdirTemp();
    writeCatalog(path.join(sourceDir, 'catalog.pot'));

    let result = runCli(['--create', sourceDir, '--code', 'pt_BR.UTF-8']);

    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /Invalid language code 'pt_BR\.UTF-8'/);

    result = runCli(['--create', sourceDir, '--code', 'nb-NO']);

    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /Invalid language code 'nb-NO'/);

    result = runCli(['--create', sourceDir, '--code', 'catalog']);

    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /Invalid language code 'catalog'/);
});

test('create rejects duplicate language files', () => {
    const sourceDir = mkdirTemp();
    writeCatalog(path.join(sourceDir, 'catalog.pot'));
    writePO(path.join(sourceDir, 'nb_NO.po'), {
        code: 'nb_NO',
        messages: [['Hello', 'Hallo']]
    });

    const result = runCli(['--create', sourceDir, '--code', 'nb_NO']);

    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /Translation file nb_NO\.po already exists/);
});

test('update extracts strings and preserves existing language code', () => {
    const dir = mkdirTemp();
    const sourceDir = path.join(dir, 'translations');
    const jsDir = path.join(dir, 'js');
    const pyDir = path.join(dir, 'py');
    fs.mkdirSync(sourceDir);
    fs.mkdirSync(jsDir);
    fs.mkdirSync(pyDir);

    writePO(path.join(sourceDir, 'nb_NO.po'), {
        code: 'nb_NO',
        messages: [['Old', 'Gammel']]
    });

    fs.writeFileSync(path.join(jsDir, 'main.js'), 'const label = _("Hello from JS");\n');
    fs.writeFileSync(path.join(pyDir, 'main.py'), 'label = _("Hello from Python")\n');

    const jsGlob = path.join(jsDir, '**', '*.js').replaceAll('\\', '/');
    const pyGlob = path.join(pyDir, '**', '*.py').replaceAll('\\', '/');
    const result = runCli(['--update', sourceDir, '--source', jsGlob, '--pysource', pyGlob]);

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(fs.existsSync(path.join(sourceDir, 'catalog.pot')), true);

    const po = fs.readFileSync(path.join(sourceDir, 'nb_NO.po'), 'utf8');
    assert.match(po, /Language: nb_NO\\n/);
    assert.match(po, /msgid "Hello from JS"/);
    assert.match(po, /msgid "Hello from Python"/);
    assert.doesNotMatch(po, /msgid "Old"/);
});

test('update rejects non-Weblate header codes', () => {
    const dir = mkdirTemp();
    const sourceDir = path.join(dir, 'translations');
    const jsDir = path.join(dir, 'js');
    const pyDir = path.join(dir, 'py');
    fs.mkdirSync(sourceDir);
    fs.mkdirSync(jsDir);
    fs.mkdirSync(pyDir);

    writePO(path.join(sourceDir, 'nb_NO.po'), {
        code: 'nb_no',
        messages: [['Existing', 'Eksisterende']]
    });

    fs.writeFileSync(path.join(jsDir, 'main.js'), 'const label = _("Existing");\n');
    fs.writeFileSync(path.join(pyDir, 'main.py'), '');

    const jsGlob = path.join(jsDir, '**', '*.js').replaceAll('\\', '/');
    const pyGlob = path.join(pyDir, '**', '*.py').replaceAll('\\', '/');
    const result = runCli(['--update', sourceDir, '--source', jsGlob, '--pysource', pyGlob]);

    assert.notEqual(result.status, 0);
    assert.match(result.stdout, /Invalid language code 'nb_no' in nb_NO\.po/);
});
