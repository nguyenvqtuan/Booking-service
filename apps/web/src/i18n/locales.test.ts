import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { resources } from './resources';

/** Flattens nested translation objects into dotted keys. */
function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keys(v as object, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe('translation resources', () => {
  it.each(Object.keys(resources.vi))('namespace "%s" has the same keys in vi and en', (ns) => {
    const vi = keys(resources.vi[ns as keyof typeof resources.vi]).sort();
    const en = keys(resources.en[ns as keyof typeof resources.en]).sort();
    expect(en).toEqual(vi);
  });

  it('has no empty translations', () => {
    for (const lng of ['vi', 'en'] as const) {
      for (const [ns, values] of Object.entries(resources[lng])) {
        const empty = keys(values).filter(
          (k) => !k.split('.').reduce<unknown>((o, p) => (o as Record<string, unknown>)[p], values),
        );
        expect(empty, `${lng}/${ns}`).toEqual([]);
      }
    }
  });
});

describe('no hard-coded UI text', () => {
  const VIETNAMESE = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
  const srcDir = join(__dirname, '..');

  function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory())
        return name === 'locales' || name === 'test' ? [] : sourceFiles(path);
      return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
    });
  }

  it('keeps Vietnamese text in locale files only', () => {
    const offenders = sourceFiles(srcDir).flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .map((line, i) => ({ line, i }))
        .filter(({ line }) => VIETNAMESE.test(line))
        .map(({ line, i }) => `${relative(srcDir, file)}:${i + 1}: ${line.trim()}`),
    );
    expect(offenders).toEqual([]);
  });
});
