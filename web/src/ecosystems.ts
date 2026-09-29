export type EcosystemTone =
  | 'node'
  | 'rust'
  | 'maven'
  | 'python'
  | 'unity'
  | 'cocoapods'
  | 'next'
  | 'gradle'
  | 'dotnet'
  | 'flutter'
  | 'angular'
  | 'swift'
  | 'nuxt'
  | 'svelte'
  | 'turbo'
  | 'parcel'
  | 'terraform'
  | 'composer'
  | 'other';

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
  '.NET': { abbreviation: 'NET', tone: 'dotnet' },
  Flutter: { abbreviation: 'FL', tone: 'flutter' },
  Angular: { abbreviation: 'NG', tone: 'angular' },
  'Swift PM': { abbreviation: 'SW', tone: 'swift' },
  Nuxt: { abbreviation: 'NU', tone: 'nuxt' },
  SvelteKit: { abbreviation: 'SV', tone: 'svelte' },
  Turborepo: { abbreviation: 'TB', tone: 'turbo' },
  Parcel: { abbreviation: 'PC', tone: 'parcel' },
  Terraform: { abbreviation: 'TF', tone: 'terraform' },
  Composer: { abbreviation: 'PHP', tone: 'composer' },
};

export function ecosystemMeta(ecosystem: string): EcosystemMeta {
  return ECOSYSTEMS[ecosystem] ?? { abbreviation: ecosystem.slice(0, 2).toUpperCase(), tone: 'other' };
}
