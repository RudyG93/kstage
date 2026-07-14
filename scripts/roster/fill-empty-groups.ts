/**
 * Remplit les membres des 8 groupes qui étaient SANS roster (pages artistes
 * vides) + corrige 4 classifications is_solo erronées (ADYA/ARrC/KISEO/SUCTION
 * sont des GROUPES, pas des solistes) + pose disbanded_on pour ARrC.
 *
 * Données vérifiées adversarialement (double-source : MusicBrainz + ja/ko.wiki +
 * fandom + kprofiles, cf. session 2026-07-14). Figées ici = reproductible, pas
 * de re-fetch fragile. Idempotent : un groupe qui a déjà des membres est ignoré.
 *
 *   npx tsx scripts/roster/fill-empty-groups.ts           # dry-run
 *   npx tsx scripts/roster/fill-empty-groups.ts --write   # insère via service_role
 */
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../src/types/database'

loadEnvConfig(process.cwd())
const WRITE = process.argv.includes('--write')

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

interface Member {
  stage_name: string
  real_name: string | null
  birthday: string | null // YYYY-MM-DD
  position: string | null
}

interface GroupSpec {
  slug: string
  setGroup: boolean // is_solo=true à corriger en false
  disbandedOn?: string // dissolution confirmée
  members: Member[]
}

// Rosters vérifiés (final lineup actif). status = 'active' pour tous, y compris
// les groupes dissous (convention DB : CIX/Loossemble gardent leurs membres
// 'active', seul disbanded_on marque la dissolution).
const SPECS: GroupSpec[] = [
  {
    slug: 'team', // &TEAM — déjà classé groupe
    setGroup: false,
    members: [
      {
        stage_name: 'K',
        real_name: 'Koga Yudai',
        birthday: '1997-10-21',
        position: 'Performance Leader, Main Dancer, Lead Vocalist',
      },
      {
        stage_name: 'Fuma',
        real_name: 'Murata Fuma',
        birthday: '1998-06-29',
        position: 'Sub-Leader, Vocalist',
      },
      {
        stage_name: 'Nicholas',
        real_name: 'Wang Yi-hsiang',
        birthday: '2002-07-09',
        position: 'Main Rapper, Lead Vocalist',
      },
      {
        stage_name: 'EJ',
        real_name: 'Byun Eui-ju',
        birthday: '2002-09-07',
        position: 'Leader, Vocalist, Rapper',
      },
      {
        stage_name: 'Yuma',
        real_name: 'Nakakita Yuma',
        birthday: '2004-02-07',
        position: 'Main Vocalist',
      },
      {
        stage_name: 'Jo',
        real_name: 'Asakura Jo',
        birthday: '2004-07-08',
        position: 'Vocalist, Visual',
      },
      {
        stage_name: 'Harua',
        real_name: 'Shigeta Harua',
        birthday: '2005-05-01',
        position: 'Vocalist, Visual',
      },
      {
        stage_name: 'TAKI',
        real_name: 'Takayama Riki',
        birthday: '2005-05-04',
        position: 'Lead Dancer, Vocalist',
      },
      {
        stage_name: 'Maki',
        real_name: 'Riki Wilhelm Mauss',
        birthday: '2006-02-17',
        position: 'Main Vocalist, Maknae',
      },
    ],
  },
  {
    slug: 'adya', // classé soliste par erreur → girl group 5 membres
    setGroup: true,
    members: [
      {
        stage_name: 'Yeonsu',
        real_name: 'Ryu Yeon-su',
        birthday: '2003-02-19',
        position: 'Leader, Lead Vocalist',
      },
      {
        stage_name: 'Seowon',
        real_name: 'Jung Seo-won',
        birthday: '2004-04-26',
        position: 'Sub-Vocalist',
      },
      {
        stage_name: 'Sena',
        real_name: 'Im Ye-na',
        birthday: '2005-10-12',
        position: 'Main Dancer, Lead Vocalist, Rapper',
      },
      {
        stage_name: 'Chaeeun',
        real_name: 'Yoon Chae-eun',
        birthday: '2005-12-10',
        position: 'Main Dancer, Rapper',
      },
      {
        stage_name: 'Seungchae',
        real_name: 'Cho Seung-chae',
        birthday: '2006-10-26',
        position: 'Maknae, Lead Vocalist, Lead Dancer',
      },
    ],
  },
  {
    slug: 'arrc', // classé soliste par erreur → boy group 7 membres, dissous
    setGroup: true,
    disbandedOn: '2026-06-23',
    members: [
      {
        stage_name: 'Hyunmin',
        real_name: 'Park Hyunbin',
        birthday: '2005-04-11',
        position: 'Leader, Main Rapper',
      },
      {
        stage_name: 'Kien',
        real_name: 'Nguyễn Trung Kiên',
        birthday: '2004-12-19',
        position: 'Lead Vocalist, Lead Dancer',
      },
      {
        stage_name: 'Choi Han',
        real_name: 'Choi Han',
        birthday: '2007-04-10',
        position: 'Sub-Leader, Main Rapper, Main Dancer',
      },
      {
        stage_name: 'Andy',
        real_name: 'Andy Toshihide Okuda',
        birthday: '2007-04-19',
        position: 'Lead Vocalist, Lead Rapper',
      },
      {
        stage_name: 'Rioto',
        real_name: 'Kaneko Rioto',
        birthday: '2007-08-25',
        position: 'Main Dancer, Lead Vocalist',
      },
      {
        stage_name: 'Doha',
        real_name: 'Kim Doha',
        birthday: '2008-02-10',
        position: 'Main Vocalist, Lead Dancer',
      },
      {
        stage_name: 'Jibeen',
        real_name: 'Lee Jibeen',
        birthday: '2008-08-08',
        position: 'Main Rapper, Lead Dancer, Maknae',
      },
    ],
  },
  {
    slug: 'kiiikiii', // déjà classé groupe
    setGroup: false,
    members: [
      {
        stage_name: 'Leesol',
        real_name: 'Lee Su-min',
        birthday: '2005-09-18',
        position: 'Main Rapper, Vocalist',
      },
      {
        stage_name: 'Sui',
        real_name: 'Lee Su-bin',
        birthday: '2006-04-10',
        position: 'Main Vocalist',
      },
      {
        stage_name: 'Jiyu',
        real_name: 'Seo Ji-yu',
        birthday: '2006-05-14',
        position: 'Leader, Vocalist, Rapper, Dancer',
      },
      {
        stage_name: 'Haum',
        real_name: 'Kwak Ha-eum',
        birthday: '2006-11-14',
        position: 'Vocalist, Rapper, Dancer, Visual',
      },
      {
        stage_name: 'Kya',
        real_name: 'Park Ji-woo',
        birthday: '2010-12-18',
        position: 'Vocalist, Maknae',
      },
    ],
  },
  {
    slug: 'kiseo', // classé soliste par erreur → girl group 4 membres (re-debut d'IHOTEU)
    setGroup: true,
    members: [
      { stage_name: 'Amu', real_name: null, birthday: null, position: 'Vocalist' },
      { stage_name: 'Negi', real_name: null, birthday: null, position: 'Vocalist' },
      { stage_name: 'Nara', real_name: null, birthday: null, position: 'Vocalist, Maknae' },
      { stage_name: 'Zero', real_name: null, birthday: null, position: 'Vocalist' },
    ],
  },
  {
    slug: 'meovv', // déjà classé groupe
    setGroup: false,
    members: [
      {
        stage_name: 'Sooin',
        real_name: 'Kim Soo-in',
        birthday: '2005-04-12',
        position: 'Main Dancer, Vocalist',
      },
      {
        stage_name: 'Gawon',
        real_name: 'Lee Ga-won',
        birthday: '2005-04-27',
        position: 'Main Vocalist, Rapper',
      },
      {
        stage_name: 'Anna',
        real_name: 'Tanaka Anna',
        birthday: '2005-11-17',
        position: 'Vocalist, Visual',
      },
      {
        stage_name: 'Narin',
        real_name: 'Na Rin',
        birthday: '2007-08-15',
        position: 'Main Rapper, Main Vocalist',
      },
      {
        stage_name: 'Ella',
        real_name: 'Ella McKenzie Gross',
        birthday: '2008-12-01',
        position: 'Vocalist, Visual, Maknae',
      },
    ],
  },
  {
    slug: 'nctwish', // déjà classé groupe
    setGroup: false,
    members: [
      {
        stage_name: 'Sion',
        real_name: 'Oh Si-on',
        birthday: '2002-05-11',
        position: 'Leader, Lead Vocalist, Lead Dancer',
      },
      {
        stage_name: 'Riku',
        real_name: 'Maeda Riku',
        birthday: '2003-06-28',
        position: 'Main Rapper, Lead Dancer, Sub Vocalist',
      },
      {
        stage_name: 'Yushi',
        real_name: 'Tokuno Yushi',
        birthday: '2004-04-05',
        position: 'Main Dancer, Lead Vocalist',
      },
      {
        stage_name: 'Jaehee',
        real_name: 'Kim Dae-young',
        birthday: '2005-06-21',
        position: 'Main Vocalist',
      },
      {
        stage_name: 'Ryo',
        real_name: 'Hirose Ryo',
        birthday: '2007-08-04',
        position: 'Lead Vocalist, Sub Vocalist',
      },
      {
        stage_name: 'Sakuya',
        real_name: 'Fujinaga Sakuya',
        birthday: '2007-11-18',
        position: 'Lead Rapper, Sub Vocalist, Maknae',
      },
    ],
  },
  {
    slug: 'suction', // classé soliste par erreur → groupe co-ed 4 membres (projet Gag Concert)
    setGroup: true,
    members: [
      {
        stage_name: 'Jin E',
        real_name: 'Park Hyo-jin',
        birthday: '1981-12-28',
        position: 'Vocalist',
      },
      { stage_name: 'Hyuk E', real_name: 'Kwon Hyuk-soo', birthday: '1986-05-06', position: null },
      {
        stage_name: 'MJ',
        real_name: 'Kim Myung-jun',
        birthday: '1994-03-05',
        position: 'Main Vocal',
      },
      {
        stage_name: 'Yeong E',
        real_name: 'Kim Hyun-young',
        birthday: '1996-01-11',
        position: 'Maknae',
      },
    ],
  },
]

async function main() {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  console.log(`=== ${WRITE ? 'WRITE' : 'DRY-RUN'} — fill-empty-groups ===\n`)

  for (const spec of SPECS) {
    const { data: group, error: gErr } = await supabase
      .from('groups')
      .select('id, name, is_solo, disbanded_on')
      .eq('slug', spec.slug)
      .maybeSingle()
    if (gErr || !group) {
      console.error(`✗ ${spec.slug}: groupe introuvable (${gErr?.message ?? 'null'})`)
      continue
    }

    const { count } = await supabase
      .from('members')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', group.id)
    if ((count ?? 0) > 0) {
      console.log(`• ${spec.slug} (${group.name}): déjà ${count} membres → skip (idempotent)`)
      continue
    }

    const meta: string[] = []
    if (spec.setGroup && group.is_solo) meta.push('is_solo=false')
    if (spec.disbandedOn && !group.disbanded_on) meta.push(`disbanded_on=${spec.disbandedOn}`)

    const rows = spec.members.map((m) => ({
      group_id: group.id,
      stage_name: m.stage_name,
      real_name: m.real_name,
      birthday: m.birthday,
      position: m.position,
      status: 'active' as const,
      slug: `${spec.slug}-${slugify(m.stage_name)}`,
    }))

    console.log(
      `→ ${spec.slug} (${group.name}): +${rows.length} membres` +
        (meta.length ? ` | maj groupe: ${meta.join(', ')}` : ''),
    )
    for (const r of rows)
      console.log(`    ${r.stage_name} [${r.slug}]${r.birthday ? ` — ${r.birthday}` : ''}`)

    if (!WRITE) continue

    if (spec.setGroup && group.is_solo) {
      const { error } = await supabase.from('groups').update({ is_solo: false }).eq('id', group.id)
      if (error) console.error(`    ✗ is_solo update: ${error.message}`)
    }
    if (spec.disbandedOn && !group.disbanded_on) {
      const { error } = await supabase
        .from('groups')
        .update({ disbanded_on: spec.disbandedOn })
        .eq('id', group.id)
      if (error) console.error(`    ✗ disbanded_on update: ${error.message}`)
    }
    const { error: mErr } = await supabase.from('members').insert(rows)
    if (mErr) console.error(`    ✗ members insert: ${mErr.message}`)
    else console.log(`    ✓ ${rows.length} membres insérés`)
  }

  console.log(`\n${WRITE ? 'Terminé.' : 'Dry-run only. Re-run with --write to apply.'}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
