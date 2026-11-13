const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const ts = require('typescript')

const source = fs.readFileSync(path.join(__dirname, 'chatMedia.ts'), 'utf8')
const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
})
const { validateChatMedia } = new Function('exports', `${outputText}; return exports;`)({})
const MiB = 1024 * 1024

test('attachment limits match the accepted photo and video sizes', () => {
    assert.equal(validateChatMedia({ name: 'photo.jpg', type: 'image/jpeg', size: 15 * MiB }), null)
    assert.match(validateChatMedia({ name: 'photo.jpg', type: 'image/jpeg', size: 15 * MiB + 1 }), /15 MiB/)
    assert.equal(validateChatMedia({ name: 'clip.MOV', type: 'application/octet-stream', size: 50 * MiB }), null)
    assert.match(validateChatMedia({ name: 'clip.mp4', type: 'video/mp4', size: 50 * MiB + 1 }), /50 MiB/)
})

test('the picker rejects empty and unsupported files', () => {
    assert.match(validateChatMedia({ name: 'blank.png', type: 'image/png', size: 0 }), /빈 파일/)
    assert.match(validateChatMedia({ name: 'spoofed.png', type: 'image/svg+xml', size: 1 }), /선택해주세요/)
    assert.match(validateChatMedia({ name: 'video.avi', type: '', size: 1 }), /선택해주세요/)
})
