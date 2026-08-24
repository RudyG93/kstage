import { describe, it, expect, beforeAll } from 'vitest'
import { isOwnStorageUrl } from './cloudinary'

// `avatar_url` est écrit par l'utilisateur : la policy « profiles: update own »
// contrôle la ligne, pas les colonnes, et la clé anon est dans le bundle.
// L'URL servie BRUTE (sans proxy) doit donc être reconnue par son ORIGINE.
describe('isOwnStorageUrl', () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://projet.supabase.co'
  })

  it('accepte une URL de notre bucket', () => {
    expect(
      isOwnStorageUrl('https://projet.supabase.co/storage/v1/object/public/avatars/u/x.jpg'),
    ).toBe(true)
  })

  it('refuse un hôte étranger qui IMITE le chemin de storage', () => {
    // Le test précédent était un `includes('/storage/v1/object/')` : celui-ci
    // le passait, et l'image partait brute chez l'attaquant — une IP de lecteur
    // récoltée à chaque affichage du commentaire.
    expect(
      isOwnStorageUrl('https://attaquant.example/storage/v1/object/public/avatars/u/x.png'),
    ).toBe(false)
  })

  it('refuse un sous-domaine qui contient notre hôte', () => {
    expect(isOwnStorageUrl('https://projet.supabase.co.attaquant.example/x.png')).toBe(false)
  })

  it("refuse un hôte en préfixe d'un chemin", () => {
    expect(isOwnStorageUrl('https://attaquant.example/https://projet.supabase.co/x.png')).toBe(
      false,
    )
  })

  it('refuse ce qui n’est pas une URL', () => {
    expect(isOwnStorageUrl('blob:abc')).toBe(false)
    expect(isOwnStorageUrl('')).toBe(false)
    expect(isOwnStorageUrl('pas une url')).toBe(false)
  })
})
