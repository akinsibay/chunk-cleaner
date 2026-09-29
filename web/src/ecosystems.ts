export type EcosystemTone = 'node' | 'rust' | 'maven' | 'python' | 'unity' | 'cocoapods' | 'next' | 'gradle' | 'other';

interface EcosystemMeta {
  abbreviation: string;
  tone: EcosystemTone;
}

const ECOSYSTEMS: Record<string, EcosystemMeta> = {
  'Node.js': { abbreviation: 'JS', tone: 'node' },
  Rust: { abbreviation: 'RS', tone: 'rust' },
  Maven: { abbreviation: 'MV', tone: 'maven' },
  Python: { abbreviation: 'PY', tone: 'python' },
  Unity: { abbreviation: 'U', tone: 'unity' },
  CocoaPods: { abbreviation: 'PD', tone: 'cocoapods' },
  'Next.js': { abbreviation: 'N', tone: 'next' },
  Gradle: { abbreviation: 'GR', tone: 'gradle' },
};

export function ecosystemMeta(ecosystem: string): EcosystemMeta {
  return ECOSYSTEMS[ecosystem] ?? { abbreviation: ecosystem.slice(0, 2).toUpperCase(), tone: 'other' };
}
