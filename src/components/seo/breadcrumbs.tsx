import { JsonLd } from './json-ld'
import { SITE_URL } from '@/lib/site'

/**
 * `BreadcrumbList` schema.org — le seul balisage envisagé que Google RENDE
 * visiblement en SERP (le fil « kstage.app › Groups › aespa » remplace l'URL
 * nue sous le titre). Le `Person` et le `BroadcastEvent` ont été écartés :
 * aucun rich result associé, et un `Event` a déjà été rejeté au JOURNAL.
 *
 * Le dernier maillon est la page courante : il porte quand même son `item`,
 * ce que Google accepte et qui garde le fil cliquable dans les outils de test.
 */
export function Breadcrumbs({ trail }: { trail: { name: string; path: string }[] }) {
  if (trail.length === 0) return null
  return (
    <JsonLd
      data={{
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: trail.map((step, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: step.name,
          item: `${SITE_URL}${step.path}`,
        })),
      }}
    />
  )
}
