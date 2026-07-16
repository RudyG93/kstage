import { describe, it, expect } from 'vitest'
import { followMilestones } from './milestones'

describe('followMilestones', () => {
  it('0 follow → aucun jalon', () => {
    expect(followMilestones(0)).toEqual([])
  })
  it('1-2 follows → premier groupe seulement', () => {
    expect(followMilestones(1)).toEqual(['first_group_followed'])
    expect(followMilestones(2)).toEqual(['first_group_followed'])
  })
  it('≥3 follows → les deux jalons (la dédup once absorbe les répétitions)', () => {
    expect(followMilestones(3)).toEqual(['first_group_followed', 'three_groups_followed'])
    expect(followMilestones(7)).toEqual(['first_group_followed', 'three_groups_followed'])
  })
})
